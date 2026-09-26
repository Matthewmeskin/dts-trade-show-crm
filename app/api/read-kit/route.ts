import { NextResponse, type NextRequest } from "next/server";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import {
  KIT_SCHEMA,
  KIT_SYSTEM_PROMPT,
  htmlToText,
  isFetchableUrl,
  parseKitReading,
} from "@/lib/kit-reader";

export const dynamic = "force-dynamic";
// A 100-page manual takes a while to read properly.
export const maxDuration = 300;

const MAX_PDF_BYTES = 30 * 1024 * 1024;
const MAX_TEXT_CHARS = 200_000;
const FETCH_TIMEOUT_MS = 20_000;

type KitSource =
  | { kind: "pdf"; data: string }
  | { kind: "text"; data: string };

const fail = (error: string, status = 400) =>
  NextResponse.json({ ok: false, error }, { status });

/** True for loopback, private, link-local and other addresses no kit lives on. */
function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v === "::1" || v === "::") return true;
    if (v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80")) return true;
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? isPrivateAddress(mapped[1]) : false;
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

async function assertPublicHost(url: string) {
  if (!isFetchableUrl(url)) throw new Error("That doesn't look like a public web address.");
  const { hostname } = new URL(url);
  const addrs = await lookup(hostname, { all: true }).catch(() => []);
  if (!addrs.length) throw new Error(`Couldn't find ${hostname} — check the link.`);
  if (addrs.some((a) => isPrivateAddress(a.address))) {
    throw new Error("That address points inside a private network, so it can't be read.");
  }
}

/** Fetch the kit, re-checking every redirect hop so a link can't bounce us inward. */
async function fetchKit(url: string): Promise<KitSource> {
  let current = url;
  for (let hop = 0; hop < 5; hop++) {
    await assertPublicHost(current);
    const res = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "user-agent": "DTS-Trade-Show-CRM kit reader", accept: "application/pdf,text/html;q=0.9,*/*;q=0.5" },
    });
    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get("location");
      if (!next) throw new Error("The link redirected nowhere.");
      current = new URL(next, current).toString();
      continue;
    }
    if (!res.ok) throw new Error(`The kit link answered ${res.status}. If it needs a login, download the PDF and upload it instead.`);

    const type = res.headers.get("content-type") ?? "";
    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > MAX_PDF_BYTES) throw new Error("That file is over 30 MB. Upload just the shipping section instead.");
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > MAX_PDF_BYTES) throw new Error("That file is over 30 MB. Upload just the shipping section instead.");

    if (type.includes("pdf") || buf.subarray(0, 5).toString() === "%PDF-") {
      return { kind: "pdf", data: buf.toString("base64") };
    }
    if (type.includes("html") || type.startsWith("text/")) {
      const raw = buf.toString("utf8");
      const text = type.includes("html") ? htmlToText(raw) : raw;
      if (text.length < 400) {
        throw new Error(
          "That page loaded almost no text — it's probably an online kit that needs a login or builds itself in the browser. Download the PDF and upload it, or paste the shipping section as text.",
        );
      }
      return { kind: "text", data: text.slice(0, MAX_TEXT_CHARS) };
    }
    throw new Error(`The link returned a ${type || "file type"} the reader can't use. Give it the PDF or the web page.`);
  }
  throw new Error("The link redirected too many times.");
}

/**
 * Reads an exhibitor kit and returns a DRAFT of the Show page tab's freight
 * details. It writes nothing: the browser fills the form, and the coordinator
 * checks every value against the kit before Save draft or Verify. The API key
 * stays server-side and the route requires a signed-in user.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) return fail("Unauthorized", 401);
  if (!process.env.ANTHROPIC_API_KEY) {
    return fail("The kit reader isn't configured (set ANTHROPIC_API_KEY).", 503);
  }

  let fd: FormData;
  try {
    fd = await req.formData();
  } catch {
    return fail("Couldn't read the upload. PDFs over about 4 MB have to go in as a link.");
  }
  const showId = String(fd.get("show_id") ?? "");
  const url = String(fd.get("url") ?? "").trim();
  const pasted = String(fd.get("text") ?? "").trim();
  const file = fd.get("file");

  const { data: show } = await supabase
    .from("shows")
    .select("show_name, edition_year, show_start_date")
    .eq("id", showId)
    .maybeSingle();
  if (!show) return fail("Show not found.", 404);

  let source: KitSource;
  try {
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_PDF_BYTES) throw new Error("That file is over 30 MB.");
      const buf = Buffer.from(await file.arrayBuffer());
      if (buf.subarray(0, 5).toString() !== "%PDF-") throw new Error("Upload a PDF, or paste the text instead.");
      source = { kind: "pdf", data: buf.toString("base64") };
    } else if (pasted) {
      source = { kind: "text", data: pasted.slice(0, MAX_TEXT_CHARS) };
    } else if (url) {
      source = await fetchKit(url);
    } else {
      throw new Error("Give the reader a kit link, a PDF, or pasted text.");
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Couldn't load the kit.";
    return fail(e instanceof Error && e.name === "TimeoutError" ? "The kit link took too long to answer." : msg);
  }

  const year = show.edition_year ?? (show.show_start_date ? show.show_start_date.slice(0, 4) : "");
  const kit: Anthropic.DocumentBlockParam =
    source.kind === "pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: source.data } }
      : { type: "document", source: { type: "text", media_type: "text/plain", data: source.data } };

  try {
    const client = new Anthropic();
    const message = await client.messages
      .stream({
        model: "claude-opus-5",
        max_tokens: 16000,
        thinking: { type: "adaptive" },
        output_config: { format: { type: "json_schema", schema: KIT_SCHEMA } },
        system: KIT_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              kit,
              {
                type: "text",
                text: `This is the exhibitor kit for ${show.show_name}${year ? ` ${year}` : ""}. Draft the freight details from it. If the kit is for a different year than ${year || "the one named"}, say so in warnings.`,
              },
            ],
          },
        ],
      })
      .finalMessage();

    if (message.stop_reason === "refusal") return fail("The reader declined this document.", 502);
    if (message.stop_reason === "max_tokens") return fail("The kit was too long to finish reading. Try just the shipping section.", 502);

    const raw = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      return fail("Couldn't read the reader's answer. Try again.", 502);
    }
    const reading = parseKitReading(json);
    if (!reading) return fail("Couldn't read the reader's answer. Try again.", 502);

    return NextResponse.json({
      ok: true,
      reading,
      source: { kind: source.kind, url: url || null },
    });
  } catch (e) {
    const message =
      e instanceof Anthropic.APIError
        ? `${e.status ?? ""} ${e.message}`.trim()
        : e instanceof Error
          ? e.message
          : "Unknown error";
    return fail(message, 502);
  }
}
