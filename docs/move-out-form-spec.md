# DTS Outbound Move-Out Form — generation spec

Instructions for the auto-generated outbound move-out PDF in the trade show CRM.

## What it is
A DTS-branded outbound shipping form (no Freeman branding) generated per move-out shipment.
The renderer is in `lib/move-out/MoveOutForm.tsx` (`@react-pdf/renderer`, runs server-side in a
Next.js route). `app/api/move-out/[loadId]/route.ts` does the Supabase wiring + the
shipment-to-form mapping.

## Files
- `lib/move-out/MoveOutForm.tsx` — exports `renderMoveOutForm(shipment) => Buffer`, the
  `MoveOutShipment` / `Party` types, and `DTS_BILL_TO`.
- `app/api/move-out/[loadId]/route.ts` — `GET /api/move-out/<shipmentId>` returns the PDF inline.
  `[loadId]` is the **shipment id** in this codebase. The schema-specific part is
  `mapShipmentToMoveOut`.

## How it's wired here
- The route reads from this project's `shipments` table, joined to `exhibitors`, `carriers`, and
  `shows`. It's guarded: callers must be signed in (the route checks the Supabase session because
  `/api/*` is public to the auth middleware).
- A **Move-out form** link appears on **move-out** shipments in a show's Shipments tab, opening the
  PDF in a new tab (`/api/move-out/<shipmentId>`).

## Field mapping (form field -> data source)
| Form field | Source |
|---|---|
| Name of show | `shipment.show.show_name` |
| Company name | `shipment.exhibitor.company_name` |
| Booth # | not stored — left blank |
| Contact name / phone / email | `exhibitor.primary_contact_*` |
| SHIP TO company / attn / phone | exhibitor (the consignee on a move-out) |
| SHIP TO address | `shipment.destination_address` (free text); city/state/zip hand-filled |
| Special instructions | `special_requirements` + `notes`, minus anything matched to a checkbox |
| BILL TO | **default `DTS_BILL_TO` (DTS, 19829 Hamilton Ave, Torrance CA)** |
| Other Carrier (checked) + carrier name | `shipment.carrier.carrier_name` |
| Level of service | **always Standard Ground** |
| Shipment options (checkboxes) | parsed from `special_requirements` / `notes` |
| Number of labels | `shipment.pieces` |
| Carrier-fails block, option 2 (warehouse return) | **always checked** |
| Re-route via / Carrier lines (failure block) | **left blank** (hand-filled only if carrier no-shows) |

## Fixed values (always applied)
1. **Level of service = Standard Ground.**
2. **"Delivery back to warehouse at exhibitor's expense" = always checked.** Hard-coded in the
   component, not data-driven.
3. **Other Carrier** is the checked carrier option (DTS arranges, named carrier executes).
4. **Re-route via and Carrier lines in the failure block stay blank.**

## Configurable: Bill To
Defaults to `DTS_BILL_TO`. To override per carrier later, add an optional `bill_to` JSON to the
carrier and use `carrier.bill_to ?? DTS_BILL_TO` in `mapShipmentToMoveOut`. **Confirm the DTS ZIP
(currently `90502`) before go-live.**

## Accessorial mapping
`mapAccessorials` turns the shipment's requirement notes into checkboxes:
liftgate, inside delivery, residential, do-not-stack, pad wrap, loading dock, air ride.
Anything without a checkbox (e.g. **call before delivery**, **appointment required**, **notify**,
**limited access**) flows into SPECIAL INSTRUCTIONS instead of being dropped.

## Improving the data
Today there's no structured consignee/return address or booth number on a shipment. To make the
SHIP TO block complete without hand-filling, add those columns to `shipments` (or a move-out detail
record) and map them in `mapShipmentToMoveOut`.

## Auto-generating for all move-outs
Call `renderMoveOutForm` on a move-out status transition or in a batch job over all move-out
shipments. To return one combined PDF, merge per-shipment buffers with `pdf-lib`; or store one PDF
per shipment in Supabase Storage (the `documents` bucket) and attach it to the shipment record.

## Runtime note
The route runs on the Node runtime, not edge: `export const runtime = "nodejs"`. react-pdf fails on
the edge runtime. This is the most common gotcha.

## Brand fonts (optional)
Uses Helvetica for zero-config serverless. To match the DTS brand exactly, register Montserrat
(headings) and Lato (body) via `Font.register` and swap the `fontFamily` values. Maroon `#AB0534`
and blue `#0063A0` are already applied.

## One practical flag
General contractors (Freeman, GES, etc.) usually require **their own** outbound/MHA form at the
service desk, so a generic DTS form may not be accepted as the official outbound doc at every show.
Works well as a DTS internal record, a carrier handoff sheet, and an attachment to the contractor's
form. If it's meant to replace the contractor form, confirm acceptance show-by-show.
