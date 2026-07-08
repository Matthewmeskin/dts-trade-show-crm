/**
 * Canonical, GC-agnostic transcription of a Material Handling Agreement.
 *
 * The model's ONLY job is to fill this shape with what it can literally read on
 * the page — never a verdict, never an inference. All pass/fail logic lives in
 * the deterministic rule engine (lib/mha/rules.ts). Every field is null when
 * absent or illegible; blank is itself a finding.
 *
 * One output shape, three GC mapping strategies (Freeman / GES / Shepard) feed
 * it. Adding a new general contractor is a new mapping, not a new pipeline.
 */
import { z } from "zod";

const nstr = z.string().trim().nullable().catch(null);
const nnum = z.number().nullable().catch(null);
const nbool = z.boolean().nullable().catch(null);

const gcEnum = z.enum(["freeman", "ges", "shepard", "unknown"]).catch("unknown");

const AddressSchema = z
  .object({
    company: nstr.optional(),
    facility: nstr.optional(),
    attention: nstr.optional(),
    street: nstr.optional(),
    city: nstr.optional(),
    state: nstr.optional(),
    zip: nstr.optional(),
    phone: nstr.optional(),
  })
  .partial();

const CommoditySchema = z.object({
  description: nstr.optional(),
  pieces: nnum.optional(),
  weight_lbs: nnum.optional(),
});

export const MhaExtractionSchema = z.object({
  gc_detected: gcEnum,
  form_code: nstr,
  show_name: nstr,
  booth_number: nstr,
  origin: AddressSchema.default({}),
  destination: AddressSchema.default({}),
  carrier: z
    .object({
      name: nstr.optional(),
      phone: nstr.optional(),
      // GES "Ship Via: GES Logistics" radio — true routes freight to the GC's carrier.
      gc_logistics_selected: nbool.optional(),
    })
    .default({}),
  bill_to: AddressSchema.default({}),
  freight_terms: z.enum(["collect", "prepaid", "third_party"]).nullable().catch(null),
  commodities: z.array(CommoditySchema).default([]),
  total_pieces: nnum,
  total_weight_lbs: nnum,
  accessorials: z
    .object({
      liftgate: nbool.optional(),
      inside_delivery: nbool.optional(),
      residential: nbool.optional(),
      pallet_jack: nbool.optional(),
      call_before_delivery: nbool.optional(),
      other_text: nstr.optional(),
    })
    .default({}),
  service_level: nstr,
  separate_destinations_in_booth: nnum,
  carrier_no_show_option: z.enum(["gc_reroute", "return_to_warehouse"]).nullable().catch(null),
  declared_value: nstr,
  exhibitor_signature_present: nbool,
  // Per-field confidence keyed by dotted path (e.g. "carrier.name", "bill_to.company").
  confidence: z.record(z.string(), z.enum(["high", "medium", "low"])).default({}),
});

export type MhaExtraction = z.infer<typeof MhaExtractionSchema>;

/**
 * JSON Schema handed to Claude as a forced tool. Kept deliberately in step with
 * MhaExtractionSchema above; the Zod schema is the source of truth and
 * re-validates whatever the tool returns.
 */
export const MHA_TOOL_INPUT_SCHEMA = {
  type: "object" as const,
  properties: {
    gc_detected: { type: "string", enum: ["freeman", "ges", "shepard", "unknown"] },
    form_code: { type: ["string", "null"] },
    show_name: { type: ["string", "null"] },
    booth_number: { type: ["string", "null"] },
    origin: { $ref: "#/$defs/address" },
    destination: { $ref: "#/$defs/address" },
    carrier: {
      type: "object",
      properties: {
        name: { type: ["string", "null"] },
        phone: { type: ["string", "null"] },
        gc_logistics_selected: { type: ["boolean", "null"] },
      },
    },
    bill_to: { $ref: "#/$defs/address" },
    freight_terms: { type: ["string", "null"], enum: ["collect", "prepaid", "third_party", null] },
    commodities: {
      type: "array",
      items: {
        type: "object",
        properties: {
          description: { type: ["string", "null"] },
          pieces: { type: ["number", "null"] },
          weight_lbs: { type: ["number", "null"] },
        },
      },
    },
    total_pieces: { type: ["number", "null"] },
    total_weight_lbs: { type: ["number", "null"] },
    accessorials: {
      type: "object",
      properties: {
        liftgate: { type: ["boolean", "null"] },
        inside_delivery: { type: ["boolean", "null"] },
        residential: { type: ["boolean", "null"] },
        pallet_jack: { type: ["boolean", "null"] },
        call_before_delivery: { type: ["boolean", "null"] },
        other_text: { type: ["string", "null"] },
      },
    },
    service_level: { type: ["string", "null"] },
    separate_destinations_in_booth: { type: ["number", "null"] },
    carrier_no_show_option: {
      type: ["string", "null"],
      enum: ["gc_reroute", "return_to_warehouse", null],
    },
    declared_value: { type: ["string", "null"] },
    exhibitor_signature_present: { type: ["boolean", "null"] },
    confidence: {
      type: "object",
      additionalProperties: { type: "string", enum: ["high", "medium", "low"] },
    },
  },
  required: ["gc_detected", "carrier", "bill_to"],
  $defs: {
    address: {
      type: "object",
      properties: {
        company: { type: ["string", "null"] },
        facility: { type: ["string", "null"] },
        attention: { type: ["string", "null"] },
        street: { type: ["string", "null"] },
        city: { type: ["string", "null"] },
        state: { type: ["string", "null"] },
        zip: { type: ["string", "null"] },
        phone: { type: ["string", "null"] },
      },
    },
  },
};
