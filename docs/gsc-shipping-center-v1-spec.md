# GSC Shipping Center, Version 1 (and Phase 2 My Shows): Build Spec for Claude Code

Owner: Matthew Meskin (DTS). Written Sept 26, 2026, revised the same night after an independent
audit against the code and the market research. Read this whole file before writing any code.

## 1. What we are building

A shipping only version of what Freeman and GES give exhibitors, that an independent general service
contractor (GSC, also called the decorator) puts in its exhibitor kit. Every show the GSC runs gets a
page branded with the GSC's name, where an exhibitor can, in about three minutes on a phone and
without an account, **request** outbound shipping (the return trip after the show) and inbound
shipping (advance warehouse or direct to show), print booth labels, and follow status from a link in
their email. DTS, a freight broker, quotes, arranges the carriers and books the freight. The GSC gets
an admin site with a manifest by booth before move in and an outbound list before move out. The GSC
pays nothing; DTS earns on the freight it moves. Rebates are off the table.

## 2. Why, so you make the right tradeoffs

- The big GSCs (Freeman, GES, Shepard, The Expo Group) run their own freight arms. They are not the
  customer. Independent and regional decorators with no freight arm are. Most still run on PDF kits,
  fax numbers and "email us for a quote." No decorator software on the market books freight.
- The most expensive failure at a show is forced freight at move out: no return carrier booked, or no
  Material Handling Agreement (MHA) on file, so the GSC reroutes the freight at premium rates.
  **Outbound, with complete MHA information, is the heart of this product.** It is on by default.
- What a GSC values most, in order: a manifest by booth before move in, freight that arrives labeled
  for the right booth, outbound booked with the MHA done before the show closes. Then a clean
  experience for their exhibitors under their own name.
- Full research: `reports/GSC shipping portal opportunity.md`.

## 3. Hard rules

1. **Plan first.** Read the files in section 4, then write a plan (slices, files, every migration,
   open questions) and wait for Matthew's approval. Nothing changes before that.
2. **One pull request per slice**, in the order in section 11. Other Claude sessions push to
   `dts-trade-show-crm` main; work on branches and open PRs.
3. **Security model:** the web app never connects to DTS Database. Public and exhibitor data live in
   the DTS Trade Show project (`cqkiukvlukzotipclvdm`). No Supabase key reaches the browser: GSC login
   runs on the server with cookies (`@supabase/ssr`). No service_role key is added to either app for
   the public project. Every new table ships in the same migration with RLS on, explicit grants and
   policies. Every view the GSC site reads runs with the caller's rights (`security_invoker`), never
   the owner's.
4. **Migrations go where their objects live:**
   - CRM tables: `dts-trade-show-crm/supabase/migrations`, as the guarded `public` file plus the
     `tradeshow` variant that is actually applied (same pattern as 0040 to 0045).
   - Export views and `public_export()`: `dts-sage/trade-show/crm/migrations`, with a `down_` file.
   - Public project: `dts-sage/trade-show/supabase/migrations`, with SQL tests in `supabase/tests`.
   Supabase branching on DTS Database is broken (36 of 345 migrations replay), so for CRM changes:
   show Matthew the SQL, confirm point in time recovery, apply to `tradeshow` only. Never touch the
   `public` schema on DTS Database (it runs payables).
5. **Never invent logistics data.** Show facts come only from verified logistics. Never print an
   address the public views withhold.
6. **Stay in scope** (section 10). If something drifts, stop and flag it.
7. **Language.** DTS is a freight broker: it arranges and coordinates, carriers move the freight.
   Never write "guaranteed," "on time," "no surprises," "no forced freight," "handled," or
   "vetted/reliable/safe carriers" in pages, emails, reminders or labels. Say "strong carrier network"
   if carriers come up. No em dashes in user facing copy. Reuse `trade-show/web/lib/copy.ts` patterns,
   `components/language.tsx` (`BrokerRole`, `DrayageNotice`) and
   `dts-sage/docs/trade-show-language-checklist.md`. Never name Freeman or GES in user facing text.

## 4. Where things live today (read these first)

| Piece | Where | Notes |
| --- | --- | --- |
| Public pages app | `dts-sage/trade-show/web` (Vercel `dts-trade-show-web`) | Next ^16.3.1. One root `app/layout.tsx` that always renders the DTS header, footer and QuoteBar, `metadataBase` dtsone.com, `assetPrefix: '/trade-show-static'`. No PDF library installed. |
| Show page, cobranded page | `app/trade-show/shipping/[slug]/`, `[slug]/with/[partner]/` | Built from `lib/page-model.ts` rows. Leave as is. |
| Quote button | `components/quote-cta.tsx`, `lib/site.ts quoteUrlFor` | Links to the generic dtsone.com quote form. Unchanged; the Shipping Center has its own request form. |
| Public project | `dts-sage/trade-show/supabase` | Base tables in `showdata` (not exposed). `public` holds read only views plus the signed RPCs `apply_export_signed`, `apply_partner_export_signed` that anon can execute (secret checked against a hash). `tests/anon_surface.sql` is out of date (missing `partner_pages` and the signed RPCs): re-baseline it in slice 1. |
| Export side | `dts-sage/trade-show/crm/migrations` | `tradeshow_public.show_export` includes only shows whose series is public. `apply_export` sets `is_public = true` on everything it receives and deletes editions and shows that drop out. `apply_partner_export` deletes partners no longer cobranded (cascades). |
| CRM | `dts-trade-show-crm` (Next 16.2.9) | `tradeshow` schema on DTS Database. |
| CRM to public sync | `lib/public-sync.ts` | Runs in the CRM on Vercel cron every 15 minutes and on Verify (older docs saying n8n are stale). Export column signatures `SHOW_EXPORT_SIG`, `PARTNER_EXPORT_SIG`. |
| Show setup | Show page tab in `app/(app)/shows/[id]`, `lib/logistics.ts`, `lib/kit-reader.ts` | Verify rules mirror database guards. |
| Partners | `app/(app)/partners`, `lib/partners.ts`, `partners`, `partner_shows` | `code` is editable today. |
| MHA and move out | `lib/mha`, `lib/move-out/MoveOutForm.tsx`, `RETURN_TO_WAREHOUSE_TEXT` | Reuse for outbound. |
| GSC manifest | `lib/gsc-manifest.ts`, `partners/[id]/manifest` | Built from shipments; migration 0043 assumes a rep sends it, never automatically. |
| Shipments | `tradeshow.shipments` | Synced with the TMS (Hyperion), matched on `tms_reference_id`. Status enum: quoted, booked, in_transit, delivered, issue. |
| Rebates | migration 0044, `partner_rebate_statements` | Must not credit Shipping Center freight (section 9). |

## 5. Two products, kept apart on purpose

| | Public show pages (exists) | GSC Shipping Center (new) |
| --- | --- | --- |
| What it is | DTS branded shipping guides for big national shows like FABTECH | A shipping request portal a GSC runs its own shows through |
| Who | Anyone searching Google | Exhibitors at one GSC's shows, from the GSC's kit |
| Branding | DTS | The GSC, with "Shipping arranged by DTS" in the footer |
| Main action | Get a freight quote | Request outbound and inbound shipping, labels, status |
| Search engines | Indexed | Noindex, never in the sitemap |
| URL | `/trade-show/shipping/...` | `/ship/...` |
| CRM area | Show pages | GSC Shipping Centers |

**Making them truly independent (this needs export changes):**
- A show can be in either or both. Today anything that reaches the public project becomes a public
  SEO page, so change the export: it carries `is_public` (series public) and `ship_enabled`
  separately; the export filter becomes "series public OR enabled for a Shipping Center";
  `apply_export` stops forcing `is_public = true`; `show_pages`, `show_index` and the sitemap keep
  filtering on `is_public`; the Shipping Center reads its own new view. Update `SHOW_EXPORT_SIG`.
- **A Shipping Center show is one specific edition (year).** New CRM table `ship_shows`: partner
  (GSC) id, `tradeshow.shows` id (the edition), enabled, created by and when. The series slug is still
  the page identity (it has the rename guard); if a show has no series yet, setup creates one with a
  slug the person confirms. URL: `/ship/[gsc-code]/[series-slug]/[year]/`.
- **Nothing a request depends on may be deleted by the sync.** Export the CRM partner uuid as
  `partner_id` and key requests and GSC users on it, never on `code` or slug. Unlinking sets
  `enabled = false`; it never deletes. GSC codes printed in kits are permanent: keep a code history
  table and redirect old codes, like slugs.
- **Separate root layouts.** Move the existing pages into `app/(site)/` with the current root layout,
  and give `app/(ship)/` its own root layout: GSC logo and name, show name, "Shipping arranged by DTS"
  footer, no dtsone.com header, menus, search or QuoteBar. Every `/ship` page sets its own metadata,
  noindex, no canonical to dtsone.com. Confirm the asset prefix works when served on the app's own
  host. Extend `/api/revalidate` to `/ship` paths.
- **Separate CRM areas.** Show pages stays the SEO publishing queue. GSC Shipping Centers is its own
  nav item. Neither gets the other's controls.
- **Where it is served:** for now the app's own Vercel URL (`dts-trade-show-web.vercel.app/ship/...`),
  read from one env var (`SHIP_BASE_URL`). Do not use dtsone.com anywhere in `/ship`. **Before the
  first kit is printed**, Matthew picks a permanent domain (not dtsone.com) and points it at the app,
  because printed kit links cannot be recalled and vercel.app links in email look like phishing.
  Flag this in the plan; do not block the build on it.

## 6. The exhibitor experience

**Entry points**
- GSC landing: `/ship/[gsc-code]/`. GSC name and logo, their upcoming shows as cards (name, dates,
  city, "Request shipping"). The one link a GSC puts in every kit.
- Show home: `/ship/[gsc-code]/[series-slug]/[year]/`. At the top, "What to do and by when":
  warehouse receiving window and deadline, direct window, targeted move in note, move out and carrier
  check in cutoff, all in the show's timezone with the zone named. Addresses. A large "Request
  shipping" button. The coordinator's name and mobile for move out day. `BrokerRole` and
  `DrayageNotice` (material handling is billed by the GSC, not DTS).

**Request form** at `.../[year]/request/`. One page, clear steps, mobile first, no login, about three
minutes. Progress saved in the browser; the last entry is remembered for the next show, with a "This
is a shared computer" option that clears it after submit. Address autocomplete if a browser key is
approved (not a Supabase key).

1. **You and your booth:** company, contact name, email, mobile, booth number or "TBD," optional
   "Shipping on behalf of" (exhibit houses ship for exhibitors).
2. **Outbound (on by default, "Recommended"):** destination address and location type; pieces and
   estimated weight; on-site contact name and mobile (required: the GSC and the carrier need it at
   move out); delivery by date (optional); if the carrier does not check in, return to warehouse
   (default, reuse `RETURN_TO_WAREHOUSE_TEXT`). Copy: "Booking now gives us time to line up a carrier
   and get your outbound paperwork done before the show closes."
3. **Inbound (optional, can add more than one pickup):** pickup address; location type (business with
   dock, business without dock, residential, limited access such as storage unit, school or church);
   liftgate and inside pickup; ready date; pieces, total weight and what they are (crates, cases,
   pallets, loose); largest piece dimensions (or approximate size); "Anything hazardous? (batteries,
   fuel, aerosols, compressed gas)" where yes goes to coordinator review. Choose advance warehouse or
   direct. Suggest advance warehouse only when ready date plus transit (default 5 business days,
   adjustable per show) lands between receiving start and the deadline; label it as guidance.
   "I have my own inbound carrier" is allowed: they still get labels, and outbound still applies.
4. **Declared value:** value of the shipment, a plain released value notice (carrier liability can be
   limited to a small amount per pound unless coverage is bought), and "Quote me cargo coverage."
5. **Terms:** checkbox with DTS terms, MC number, privacy notice link. US addresses only; anything
   else shows "Call us."

**After submit** (wording matters: nothing is priced or booked yet)
- Page and email say: "Request received. Not booked yet. We will email pricing, and you approve before
  we book." The request stays "unconfirmed" until the exhibitor opens the email link (stops spam).
- Private status link (section 9). Labels PDF: one label per piece, "piece 1 of N," exhibitor, booth
  (or a clear "BOOTH TBD" warning), show name and the right address with the GSC's c/o line for the
  warehouse, laid out to the GSC's label settings (section 8). Plus a piece inventory sheet. **No bill
  of lading before booking**; the real BOL comes after booking from TMS data.

**Status page** (token link): each leg's status computed from the linked CRM shipment (requested,
quoted, approved, booked, picked up, delivered to warehouse or show; outbound requested, booked,
picked up, delivered), carrier and PRO once booked, "Approve quote" button, reprint labels, and
downloads. Until a leg is booked the exhibitor can edit booth, pieces, weight, dates and on-site
contact, or cancel. After booking it becomes "Request a change," which alerts the coordinator and
notes carrier charges may apply.

**Exhibitor accounts (optional, version 1).** The guest flow above stays the fastest path, but
every confirmation and status page offers "Create a free account to manage your shipments."
- Sign up with email magic link (password optional). Accounts live in the DTS Trade Show project,
  never in DTS Database. Exhibitor signup is open (unlike GSC logins) but needs email verification,
  Turnstile, and rate limits.
- An account belongs to a company; a company can have several users (the exhibit manager, a
  coordinator, their exhibit house). Requests made as a guest with the same verified email attach to
  the account after sign in.
- **My shipments for this show:** every request and leg for the show, status, carrier and PRO once
  booked, labels, BOL and MHA downloads, approve quotes, edit or cancel before booking, get an
  instant rate (section 9a), and add another shipment.
- Account pages use the same `(ship)` layout. When the exhibitor arrived through a GSC link, that
  show keeps the GSC's branding; the account area itself is branded "DTS Show Shipping."
- RLS on every table by company membership; tests prove one company cannot see another's data.

**Tracking (guest status page and accounts).** Each booked leg shows tracking from the existing
Hyperion sync: carrier, PRO, milestones (picked up, in transit, out for delivery, delivered to the
warehouse or show, outbound picked up, delivered), estimated delivery when the carrier provides it,
and POD once available. Email or text notifications on pickup, delivery and any exception, with the
exhibitor choosing which. Copy stays broker safe: show what the carrier reports, never promise
arrival times.

**Everyday freight marketing (consent based).** The request form and account signup include an
unchecked box: "Email me about shipping for my everyday freight, not just shows" with a one line
description. Rules:
- Transactional emails (confirmations, quotes, tracking, reminders) are always sent and never carry
  marketing. Marketing only goes to people who checked the box, with a working unsubscribe, the DTS
  mailing address, and CAN-SPAM compliance.
- Record consent with time, source (show and GSC) and the exact wording shown. Consenting contacts
  are copied to the CRM (not kept only in the public project), so the 180 day purge of exhibitor
  contact data on the public project does not remove them; non consenting contacts are never copied
  for marketing.
- Never send marketing from the cold outreach domains (dtsshowfreight.com, shipwithdts.com).
- The GSC is told plainly in the pilot agreement that DTS may market everyday freight to exhibitors
  who opt in, and DTS does not market anything that competes with the GSC's services (material
  handling, rentals, labor).
- Exhibitors who ship with DTS get a short "ship your everyday freight with the same team" note in
  the delivered email for their outbound leg only if they opted in.

**Reminders (email, in the show's timezone):** booth still TBD; inbound but no outbound (7 and 2 days
before move out); quote waiting for approval; checklist before pickup and before move out ("labels
on every piece, BOL from us in hand").

## 7. The GSC admin site

At `/ship/admin/` in the same `(ship)` route group. It must feel like the GSC's own tool on show
days.

**Access**
- Logins live in the DTS Trade Show project (Supabase Auth, server side cookies). Signups are off.
  The CRM writes an invite allowlist through a signed RPC; a before-user-created auth hook refuses any
  email not on it. Magic link plus password. Custom SMTP is required (Supabase's built in email is
  rate limited).
- `gsc_members(user_id, partner_id, role)`; every read uses RLS on `auth.uid()` through that table.
  A GSC user sees only their GSC's shows and requests. Pilot: one role. Roles (admin vs staff) and
  self managed users come after the pilot.
- `anon_surface.sql` is updated on purpose with the new expected privileges, and new SQL tests prove a
  GSC user cannot read another GSC's rows or any price field.

**What they see**
1. **Home:** upcoming shows with requests count, booths with outbound requested or booked, booths
   without outbound, and "Copy kit link" for each show and the landing page.
2. **Show board:**
   - **Inbound manifest:** booth, exhibitor, pieces, weight, warehouse or direct, expected arrival,
     status. Filter by date. Print and CSV.
   - **Outbound:** sorted by check in cutoff and carrier: booth, pickup window, destination city,
     carrier and PRO once booked, MHA complete yes or no. A printable dock sheet per carrier. A second
     list: booths that came in with DTS but have no outbound yet.
   - **Booth search:** fast lookup by booth or company, with status and a copyable status link.
   - **Show day marks:** GSC staff can mark "carrier checked in" and "freight left dock" per outbound
     leg. A narrow write through a policy, with an audit log.
3. **Nudge:** email every booth on the no outbound list a reminder (GSC branding, DTS wording), with a
   log of sends.
4. **Settings:** their exhibitor services phone and email shown on their pages.

**Never shown to a GSC:** DTS prices, quotes or margins. Quote amounts never enter the public project
at all; the CRM keeps them. Exhibitor email and phone only if Matthew approves (open question).

**Also emailed** for GSCs who never log in: the manifest by booth (weekly, daily the last week before
move in) and the outbound list before move out. This changes migration 0043's "sent by a rep"
assumption; make it an explicit per show setting.

## 8. The DTS staff side (make it simple)

**CRM: "GSC Shipping Centers"** (one nav item)
- List of GSCs: shows enabled, requests this month, next move in.
- GSC screen:
  1. **Branding:** public name, logo (PNG, JPEG or WebP only, under 500 KB, re-encoded; hosted where
     the CRM can write, such as Vercel Blob; https only), code (suggested, permanent once used).
  2. **Label settings:** required fields and wording, 4x6 or letter, booth number large, targeted
     move in time if assigned. Get the pilot GSC's label sample before building labels.
  3. **Shows:** add by picking a show. Each row shows one status ("Needs kit," "Ready to check,"
     "Enabled," "Stale, reconfirm") and one button for the next step.
  4. **Set up show:** one guided panel. Paste or upload the kit, the kit reader fills fields, the
     person checks them beside the kit, confirms the series slug (warned it is permanent), then
     **"Verify and enable in Shipping Center"**: verifies, creates or attaches the series, and sets
     `ship_shows.enabled`. Publishing a public SEO page is a separate checkbox, off by default.
     Cobranding is untouched. Reuse `lib/logistics.ts` and `logistics-actions.ts`; weaken no guard.
  5. **Links:** copy buttons for the landing page and each show, plus Preview.
  6. **GSC users:** invite and deactivate (writes the allowlist through the signed RPC).
- **Requests inbox** (tab and global list): confirmed requests first, unconfirmed hidden by default.
  Each shows exhibitor, booth, show, legs, weights, dates, location types, hazmat flag. Actions:
  "Quote" (amount and note, emails the exhibitor; the amount stays in the CRM), "Booked" with the load
  number only, "Cancelled." Carrier, PRO, picked up and delivered flow in from the Hyperion sync by
  `tms_reference_id`; staff never type them. Booking creates or links the `tradeshow.shipments` row.
  After booking, produce the prefilled outbound MHA form (carrier filled in, bill to DTS) from the
  existing renderer.
- **Stale logistics:** verified rows go stale after 60 days and the public views withhold addresses.
  Kits go out 60 to 90 days before move in, so: create a reconfirm task at day 50, alert staff, and if
  a show goes stale the Shipping Center disables labels and the warehouse option with "Address being
  reconfirmed" until someone re-verifies.
- **Alerts:** a team email the moment a request is confirmed (sent from the web app at confirm time,
  data free, pointing to the CRM inbox).

## 9. Data, sync and security details

- **Requests live in the public project** (`showdata`, not readable by anon). Written only through
  `public.submit_request_signed(p_secret, payload)` checked against a separate web secret stored only
  as a hash (same pattern as `sync_keys`). Read by exhibitors only through
  `public.request_by_token(token)` returning one request. Status tokens are 128 bits or more, stored
  only as a hash, reissuable, served with `Referrer-Policy: no-referrer`. Request numbers are not
  sequential.
- **Spam and abuse:** Cloudflare Turnstile, rate limits stored in the database (by hashed IP, email and
  show), server side validation with length limits, confirmation emails carry no free text the
  submitter controls, unconfirmed requests expire.
- **To the CRM:** a signed RPC on the public project returns confirmed requests changed since a
  cursor; the CRM pulls every 5 minutes into a `tradeshow` staging table, validates again, then
  acknowledges. This is a deliberate, narrow exception to "nothing syncs back": requests only, pulled
  by the CRM, never trusted as verified show data.
- **Back to the public project:** request status (no prices) through its own signed apply function
  with its own column signature. Do not bolt it onto `apply_export`.
- **Status mapping:** map CRM `shipment_status` (quoted, booked, in_transit, delivered, issue) plus
  leg type to the exhibitor facing statuses explicitly; do not share a type.
- **Email:** one sending path, chosen in the plan (Resend or Postmark on a verified DTS subdomain with
  SPF, DKIM and DMARC; or the CRM's n8n). From "[GSC name] Shipping (arranged by DTS)", reply-to the
  coordinator. Supabase Auth uses the same custom SMTP.
- **PDFs:** `@react-pdf/renderer` is only in the CRM today; add it to the web app or render labels in
  the CRM, decided in the plan.
- **Retention:** remove exhibitor contact details from the public project 180 days after the show
  ends. Privacy notice linked from the form.
- **Rebates:** exclude Shipping Center freight from `partner_rebate_statements` and any partner credit.

## 9a. Instant LTL rates from the TMS (slice 5b, right after the status page)

Instant pricing is the strongest differentiator in this product: the big GSCs' freight arms quote
through staff, and no decorator tool prices freight at all. Build it on top of the request flow, not
instead of it.

- **Source of truth is the TMS sell rate.** Pull sell rates from Hyperion (the TMS already applies
  DTS's per carrier linehaul markups, minimums, the DTS fuel table and the 20 percent accessorial
  markup). Never recompute markup or fuel in the web app or CRM. First task: confirm what rating API
  Hyperion exposes (rate request by origin, destination, class or density, pieces, weight,
  accessorials) and its limits. If there is no usable rating API, stop and flag it.
- **Where it runs:** server to server only. The web app calls a signed, rate limited rating endpoint
  on the CRM side (same secret pattern as the other signed calls); the CRM calls Hyperion. No TMS
  credentials in the web app, the public project or the browser. Log every rate request.
- **What qualifies for an instant rate:** LTL only, US only, business or residential addresses with
  standard accessorials, no hazmat, within weight and dimension limits set per show (default up to
  about 5,000 lb and 6 pallets or crates; above that goes to a coordinator). Everything else stays a
  quote request with the current flow.
- **Trade show accessorials must be in the rate** or the price is wrong: convention center or trade
  show delivery and pickup, limited access, liftgate, appointment or targeted window, inside
  delivery or pickup, residential, and expected wait time at the marshalling yard where a carrier
  charges it. Map the form's location type and options to TMS accessorial codes explicitly, and check
  the list against the DTS LTL accessorials guide before build.
- **Density and class:** the form must collect what the rate needs (pieces, weight, largest piece
  dimensions, crate or pallet). If class or density can't be determined, show a range or fall back to
  a coordinator quote rather than a guess.
- **What the exhibitor sees:** one or two options (for example lowest price and best transit), total
  price including fuel and accessorials, estimated transit days, and the note "Estimate based on the
  details you entered. Final charges can change if pieces, weight, size or access differ." Accept
  books a request for DTS to confirm and dispatch; it is not an automatic tender to the carrier in
  version 1. The price shown is saved with the request as the agreed estimate.
- **What the GSC sees:** never a price (unchanged).
- **Rate expiry:** estimates are valid for a set number of days (default 7) and for the pickup date
  entered; after that the exhibitor re-rates.
- **Outbound from the show:** rate outbound with the convention center pickup and wait time
  accessorials and the move out date; still require a coordinator to confirm the carrier knows the
  marshalling yard process before booking.

## 9b. Phase 2: My Shows (the exhibitor show manager)

Once the pilot works, the same exhibitor account grows into an ExhibitDay style tool for managing
every show a company exhibits at, centered on freight. This is how a GSC's exhibitors keep using DTS
at their other shows. Do not start Phase 2 until Matthew approves it after the pilot; design the
version 1 account tables so Phase 2 needs no rework.

What it does
- **Show calendar:** the company's shows for the year. Add a show from the DTS show database
  (deadlines, addresses and GSC filled in from verified data) or add a show we don't have (the
  company enters it; it goes to a CRM queue for DTS to verify and add to the database).
- **Per show plan:** auto generated checklist and deadlines from verified logistics (warehouse
  deadline, direct window, targeted move in, move out, carrier check in), in the show's timezone,
  with reminders. Tasks with owners for the company's team.
- **Shipping for every show:** request or instant rate inbound and outbound for any show, whether or
  not a GSC Shipping Center exists for it. Non GSC shows use DTS branding. Shows with a Shipping
  Center route the request through it so the GSC still gets its manifest.
- **Documents per show:** labels, BOLs, MHA forms, the exhibitor kit link, and their own uploads.
- **Booth and freight profile:** saved pickup addresses, typical pieces and weights (for example
  "10x20 crate set, 6 crates, 2,400 lb"), dock and liftgate notes, so a new request takes seconds.
- **Year view:** shows, shipments and freight spend by show, exportable.

Data (public project, all RLS by company)
- `exhibitor_companies`, `company_members(user_id, company_id, role)`, `company_shows` (company,
  show edition or custom show, booth, status), `company_tasks`, `freight_profiles`, and requests
  keyed to company and edition.
- Custom shows entered by exhibitors are never published and never treated as verified until DTS
  verifies them in the CRM.

Not in Phase 2: budgets beyond freight, lead capture, booth design, staffing schedules, hotel and
travel, or anything that is not about getting to and from the show.

Build order after approval: calendar and add show, per show checklist and reminders, shipping for
non GSC shows, freight profiles, documents, year view.

## 10. Not in version 1

Online payment (open question on first time exhibitor credit), Phase 2 My Shows (section 9b),
automatic tender to carriers, rates for truckload or anything outside section 9a's limits, material handling ordering (that stays the GSC's), rebates or markup, exhibit house accounts,
national big show rollouts, international freight, changes to how the TMS books loads, embeds for
decorator stores, GSC roles and self managed users (after the pilot).

## 11. Build order (one PR each)

1. **Plan and data design**, including re-baselining `anon_surface.sql`, the export changes, the
   email path and the PDF decision. Wait for approval.
2. **Export and `ship_shows`:** CRM table, export flags and view changes, public side view for the
   Shipping Center, no forced `is_public`, stable partner ids, code history.
3. **Shipping Center shell, show home and request form with labels,** in the new `(ship)` layout,
   with `submit_request_signed`, Turnstile, rate limits and the confirm email. (Matthew can enable the
   pilot show on existing screens until slice 7.)
4. **CRM pull, requests inbox and team alert.**
5. **Status page, approve quote, edits and cancel, outbound MHA,** status back from TMS data.
5b. **Instant LTL rates from the TMS** (section 9a), starting with confirming the Hyperion rating API.
6. **Reminders and the emailed manifest and outbound list** (reusing `lib/gsc-manifest.ts`).
7. **CRM GSC Shipping Centers screen** with the one panel setup, label settings and stale handling.
8. **GSC admin site:** auth, allowlist hook and RLS with tests first, then Home, Show board, show day
   marks, Nudge, Settings; invites from the CRM.
9. **Tracking notifications and marketing consent** (opt in capture, consent record, copy to CRM,
   unsubscribe), then **Exhibitor accounts:** sign up, company membership, guest requests attached by verified email,
   "My shipments for this show," with tenant isolation tests. Tables designed for Phase 2 (9b).

## 12. Show week plan (write it into the plan; staff will live by it)

Rough load for a 300 booth show at 20 percent uptake: about 120 quote requests bunched in the two
weeks before the warehouse deadline, and about 60 outbound loads due at the marshalling yard in one
window. The plan must cover: an internal quote target (suggest same business day) with an automatic
acknowledgment email; consolidating outbound onto one or two carriers that know the venue; a named
coordinator with a mobile number on the show home and status page for move out, including evenings
and weekends; an escalation step when a carrier is running late for check in; manual TMS entry for
each booked request; and a cap on accepted requests for the pilot show.

## 13. Done means

- The pilot GSC (one of the Indianapolis decorators Brad Sedam is working with) has a landing link,
  at least one enabled show, and label settings from their own sample.
- An exhibitor can request outbound plus inbound on a phone in about three minutes, print labels, get
  the "not booked yet" confirmation, approve a quote and see status later.
- A confirmed request reaches the CRM inbox within minutes with an alert; staff quote it and move it to
  Booked with only a load number; carrier, PRO and delivery flow in from the TMS; the MHA form is
  generated.
- The GSC sees their manifest and outbound list in the admin site and by email, can mark check ins,
  and never sees a price. SQL tests prove tenant isolation.
- Security: `anon` cannot read requests; spam and oversized input are rejected; no secrets in either
  repo; the updated `anon_surface.sql` and advisors pass.
- A staff member takes a GSC from "added" to "show enabled" in one screen without help.
- An exhibitor can create an account after a request and manage all their shipments for that show in
  one place, and company data is isolated by tests.

## 14. Open questions for Matthew (raise in the plan, do not guess)

1. Internal quote turnaround target and who covers move out days.
2. The team inbox for alerts and the email sending path.
3. First pilot GSC and show, and their label sample.
4. How a first time exhibitor is approved to book (card, prepay or existing credit process).
5. Whether GSCs see exhibitor email and phone (recommended: company, contact name, booth only).
6. The permanent domain for kit links before the first kit prints (not dtsone.com).
7. Pilot request cap.
9. Which marketing tool receives opted in contacts (CRM list, HubSpot or other) and who owns the
   everyday freight follow up.
8. Which Hyperion rating API and account to use, and the instant rate limits (weight, pieces) for the
   pilot.
