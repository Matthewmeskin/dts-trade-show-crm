/**
 * The one model call in the MHA pipeline. Claude transcribes the form into the
 * canonical MhaExtraction shape via a forced tool call — it never renders a
 * verdict. All decisions happen later in the deterministic rule engine.
 */
import Anthropic from "@anthropic-ai/sdk";
import { MhaExtractionSchema, MHA_TOOL_INPUT_SCHEMA, type MhaExtraction } from "./extraction";
import type { PreparedMedia } from "./media";

const MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You are transcribing a trade show Material Handling Agreement (MHA), also called an outbound Bill of Lading, filled out at a general contractor's exhibitor service desk (Freeman, GES, or Shepard).

Your ONLY job is to record what literally appears on the page by calling the record_mha tool. You do not judge, validate, or decide whether anything is correct. That happens elsewhere.

Rules:
- Transcribe verbatim, including obvious typos. Do NOT normalize or "fix" company names.
- Forms are frequently hand-corrected: printed text is struck through and the correct value handwritten in. Always record the FINAL intended value — prefer a handwritten correction over crossed-out printed text. This matters most for Bill To: if a printed company/address is crossed out and "DTS" (or an account number with a different address such as 19829 Hamilton Ave, Torrance CA) is written in, record the handwritten DTS company and address, NOT the struck-through print.
- Read the Carrier field only from the Carrier box(es). Do NOT infer the carrier from the Special Instructions text — a note like "Diversified Transportation Services contracted SAIA" means the carrier is SAIA, so carrier.name is "SAIA".
- Every field is null when it is not present or not legible. NEVER guess and NEVER infer a value from context. If the Carrier line is blank, it is null — blank is itself a finding.
- For every checkbox, report true, false, or null (unreadable). An X, a check mark, or a filled square all mean true.
- Detect the general contractor from the form code or header first: Freeman forms carry a code like "FDC0097T"; GES forms say "GES" and often "Form #1087"; Shepard forms carry the Shepard logo. If you cannot tell, use "unknown".
- carrier.gc_logistics_selected applies to GES only: true when the "Ship Via: GES Logistics" option is marked (as opposed to "Other Carrier").
- carrier_no_show_option: "gc_reroute" when the exhibitor selected the option letting the contractor reroute via its own carrier; "return_to_warehouse" when the return-to-warehouse option is selected; null when neither is marked.
- freight_terms: "collect", "prepaid", or "third_party" per the marked box; null if none.
- In the confidence object, include an entry for every field you transcribed, keyed by its dotted path (e.g. "carrier.name", "bill_to.company", "total_weight_lbs"), valued "high", "medium", or "low".

Return through the tool only. Do not write any prose.`;

function buildContent(media: PreparedMedia[]): Anthropic.ContentBlockParam[] {
  const blocks: Anthropic.ContentBlockParam[] = media.map((m) =>
    m.kind === "pdf"
      ? {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: m.base64 },
        }
      : {
          type: "image",
          source: { type: "base64", media_type: m.mediaType, data: m.base64 },
        },
  );
  blocks.push({
    type: "text",
    text: "Transcribe this Material Handling Agreement into the record_mha tool. Record only what is legibly present; use null for anything blank or unreadable.",
  });
  return blocks;
}

export type ExtractionResult = { extraction: MhaExtraction; model: string };

/**
 * Runs the vision transcription with up to two attempts. A forced tool call
 * guarantees a JSON object; if it fails Zod validation we retry once, appending
 * the validation error so the model can correct itself.
 */
export async function extractMha(media: PreparedMedia[]): Promise<ExtractionResult> {
  const client = new Anthropic();
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: buildContent(media) }];

  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await client.messages.create({
      model: MODEL,
      // The forced-tool transcription is compact; a tighter cap returns faster.
      max_tokens: 2048,
      temperature: 0,
      system: SYSTEM_PROMPT,
      tools: [
        {
          name: "record_mha",
          description: "Record the transcribed fields of the Material Handling Agreement.",
          input_schema: MHA_TOOL_INPUT_SCHEMA as Anthropic.Tool.InputSchema,
        },
      ],
      tool_choice: { type: "tool", name: "record_mha" },
      messages,
    });

    const toolUse = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );
    const parsed = MhaExtractionSchema.safeParse(toolUse?.input ?? {});
    if (parsed.success) {
      return { extraction: parsed.data, model: MODEL };
    }

    lastError = parsed.error.issues
      .slice(0, 8)
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");

    // Feed the failed attempt back and ask for a corrected tool call.
    if (toolUse) {
      messages.push({ role: "assistant", content: response.content });
      messages.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: toolUse.id,
            is_error: true,
            content: `The recorded data failed validation: ${lastError}. Call record_mha again with corrected values.`,
          },
        ],
      });
    }
  }

  throw new Error(`Could not read the form reliably (${lastError}). Please retake the photo and try again.`);
}
