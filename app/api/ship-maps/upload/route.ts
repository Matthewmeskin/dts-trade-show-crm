import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { createClient } from "@/lib/supabase/server";
import { blobConfigured } from "@/lib/logo-upload";
import { MAP_MAX_BYTES, MAP_UPLOAD_TYPES, validMapPathname } from "@/lib/ship-maps";

export const dynamic = "force-dynamic";

/**
 * Signs a browser upload of a show map (floor plan, dock and marshalling yard
 * map) straight to Vercel Blob, so a big kit PDF never passes through a server
 * action. Admins only, like the rest of a Shipping Center show's settings, and
 * only for a GSC and show that are set up. The file's link is saved with the
 * show's setup form; nothing is written here.
 */
export async function POST(request: Request) {
  if (!blobConfigured()) return NextResponse.json({ error: "File upload is not set up yet. Paste a link instead." }, { status: 400 });
  const body = (await request.json()) as HandleUploadBody;
  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!validMapPathname(pathname)) throw new Error("That is not a map upload.");
        const supabase = await createClient();
        const { data: claims } = await supabase.auth.getClaims();
        const sub = claims?.claims?.sub;
        if (!sub) throw new Error("Sign in again.");
        const { data: me } = await supabase.from("profiles").select("role").eq("id", sub).maybeSingle();
        if (me?.role !== "admin") throw new Error("Only admins can change a Shipping Center show.");
        const [, partnerId, showId] = pathname.split("/");
        const { data: ship } = await supabase
          .from("ship_shows")
          .select("id")
          .eq("partner_id", partnerId)
          .eq("show_id", showId)
          .maybeSingle();
        if (!ship) throw new Error("This show is not in that GSC's Shipping Center.");
        return {
          allowedContentTypes: [...MAP_UPLOAD_TYPES],
          maximumSizeInBytes: MAP_MAX_BYTES,
          // A replaced map gets a new link, so nobody is served the old file from a cache.
          addRandomSuffix: true,
        };
      },
    });
    return NextResponse.json(json);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "The upload was refused." }, { status: 400 });
  }
}
