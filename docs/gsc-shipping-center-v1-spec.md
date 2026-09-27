# GSC Shipping Center, Version 1: Build Spec for Claude Code

Owner: Matthew Meskin (DTS). Written Sept 26, 2026. Read this whole file before writing any code.

## 1. What we are building, in one paragraph

A shipping only version of Freeman Online or GES Expo that an independent general service
contractor (GSC, also called the decorator) can put in its exhibitor kit. Every show the GSC runs
gets a page branded with the GSC's name, where an exhibitor can, in about three minutes and without
creating an account, order outbound shipping (the return trip after the show) and inbound shipping
(to the advance warehouse or direct to show), print correct booth labels and a bill of lading, and
check status later from a link in their email. DTS, a freight broker, arranges the carriers behind
it. The GSC gets a manifest by booth before move in and fewer forced freight problems at move out.
The GSC pays nothing and DTS earns on the freight it moves.

## 2. Why, so you make the right tradeoffs

- The big GSCs (Freeman, GES, Shepard, The Expo Group) already run their own freight brands. They
  are not the customer. Independent and regional decorators with no freight arm are. Most still hand
  exhibitors a PDF kit and "email us for a quote."
- The most expensive failure at a show is forced freight at move out: the exhibitor never booked a
  return carrier or never filed the outbound paperwork, so the GSC reroutes the freight at premium
  rates. **Outbound is the most important thing in this product.** Build it first and make it the
  default.
- What a GSC values most: a manifest by booth before move in, freight that arrives labeled for the
  right booth, and outbound booked with paperwork done before the show closes.
- Full research: `reports/GSC shipping portal opportunity.md` (sent to Matthew separately).

## 3. Hard rules

1. **Plan first.** Read the repos below, then write a short plan (slices, files, migrations, open
   questions) and wait for Matthew's approval before changing anything.
2. **Small slices, one pull request each**, in the order in section 9. Other Claude sessions push to
   `dts-trade-show-crm` main. Work on branches and open PRs; do not push to main directly.
3. **Security model does not change.** The website never connects to DTS Database (the CRM). Public
   and exhibitor data live in the DTS Trade Show project (`cqkiukvlukzotipclvdm`). Every new table
   there ships in the same migration with RLS enabled, explicit grants and policies, and is not
   readable by `anon` unless it is meant to be public. No Supabase key goes to the browser.
4. **CRM migrations:** Supabase branching on DTS Database is broken (branches replay only 36 of 345
   migrations). So: show Matthew the SQL, take a backup or confirm point in time recovery, apply to
   the `tradeshow` schema only, and write the migration file in `supabase/migrations/` in the same
   style as 0040 to 0045 (with the "refusing to run" guard). Never touch the `public` schema on DTS
   Database; it runs payables.
5. **Never invent logistics data.** Show facts come only from verified show pages.
6. **Stay in scope.** If something drifts into section 8 (not in v1), stop and flag it.
7. **Language.** DTS is a freight broker: it arranges and coordinates, carriers move the freight.
   Never promise on time delivery, preventing delays, "no surprises," or "vetted/reliable/safe
   carriers." Say "strong carrier network" if carriers come up. No em dashes in user facing copy.
   Write like someone who works in freight, not corporate marketing.

## 4. Where things live today (read these first)

| Piece | Repo and path | Notes |
| --- | --- | --- |
| Public show pages app | `Matthewmeskin/dts-sage`, `trade-show/web` (Vercel project `dts-trade-show-web`) | Next.js. Serves `dtsone.com/trade-show/shipping/...` through a rewrite in `dts-website`. |
| Plain show page | `trade-show/web/app/trade-show/shipping/[slug]/page.tsx` | Built from `lib/page-model.ts` rows. |
| Cobranded show page | `trade-show/web/app/trade-show/shipping/[slug]/with/[partner]/page.tsx` | Partner banner, partner code on the quote button. |
| Quote button today | `trade-show/web/components/quote-cta.tsx`, `lib/site.ts quoteUrlFor` | Links to the generic `dtsone.com/quote/` form with `show`, `show_slug`, `partner` params. **Version 1 replaces this with the order form.** |
| Public project schema | `dts-sage/trade-show/supabase/migrations`, tests in `supabase/tests` | Base tables in `showdata` (not exposed). Public surface is read only views in `public`. Signed apply functions for the sync. |
| Phase 1 spec and security model | `dts-sage/docs/trade-show-phase-1-spec.md`, `...-plan.md` | Still binding for security. |
| CRM (back office) | `Matthewmeskin/dts-trade-show-crm` | Next.js on DTS Database `tradeshow` schema. |
| CRM to public sync | `lib/public-sync.ts` | Every 15 minutes and on Verify. Calls signed RPCs on the public project. |
| Show page setup in CRM | `app/(app)/shows/[id]` Show page tab, `lib/logistics.ts`, kit reader `lib/kit-reader.ts` | Verify rules mirror the database. |
| Partners (GSCs) | `app/(app)/partners`, `lib/partners.ts`, tables `partners`, `partner_shows` | Partner `code`, `public_name`, `logo_url`, `cobrand_active`; per show `cobranded`. |
| GSC manifest | `lib/gsc-manifest.ts`, `app/(app)/partners/[id]/manifest` | Built from DTS shipments today. Version 1 feeds it from orders. |
| Shipments | `tradeshow.shipments` | Where booked freight lives, synced with the TMS (Hyperion). |

## 5. The exhibitor experience (make this dead simple)

**Entry points**
- GSC landing page: `/trade-show/shipping/gsc/[code]/`. The GSC's name and logo, then their upcoming
  shows as cards (show name, dates, city, "Order shipping" button). This is the one link a GSC puts
  in every kit.
- Show page for that GSC: existing `/trade-show/shipping/[slug]/with/[code]/`. Keep the verified
  facts. Replace the quote section with a large "Order shipping for [Show]" button and a short
  "What to do and by when" checklist at the top.

**Order form** at `/trade-show/shipping/[slug]/with/[code]/order/`. One page, three steps, mobile
first, no login, finishable in about three minutes. Save progress in the browser so a refresh does
not lose it.

1. **You and your booth:** company, contact name, email, phone, booth number (required; this goes on
   every label).
2. **Outbound (on by default, labeled "Recommended"):** where it goes after the show (address, or
   "same as pickup"), dock or liftgate needed, delivery by date (optional). Show the move out window
   and carrier check in cutoff for this show from verified data, and one plain line: "Booking this
   now means your freight has a carrier and paperwork when the show closes."
3. **Inbound (optional):** pickup address, ready date, pieces, total weight, what it is (crates,
   cases, pallets, loose), liftgate at pickup. Choose advance warehouse or direct to show. Pre-select
   advance warehouse when the ready date allows it, and show the warehouse deadline next to the choice.
   If the ready date misses the warehouse deadline, say so in plain words and offer direct to show.

**Confirmation page** (and the same content by email):
- Order number and a private status link (signed token in the URL, no login).
- **Labels PDF**: one label per piece, "piece 1 of N," exhibitor, booth number, show name, and the
  correct address for the chosen option, including the GSC's "c/o" line for the advance warehouse.
  Use the show's `label_requirements_note` if present.
- **Bill of lading PDF** (draft): shipper, consignee (warehouse c/o GSC or direct to show), piece
  count, weight, DTS order reference. Carrier shows "arranged by DTS" until booked.
- **What happens next**: "A DTS coordinator will email you pricing and pickup details." Do not promise
  a turnaround time on the page; Matthew will set one.
- Outbound summary with the check in cutoff, so they know it is handled.

**Status page** (the token link): order details, each leg's status (received, quoted, booked,
picked up, delivered to warehouse or show, outbound booked, outbound picked up, delivered), carrier
and PRO when booked, and the label and BOL downloads again.

**Reminders (email)**
- Inbound but no outbound: 7 days and 2 days before move out, "Book your return trip."
- Before inbound pickup and before move out: a short checklist (labels on every piece, BOL ready).

## 6. The GSC experience

- Their landing page and cobranded show pages (above).
- **Manifest by booth** emailed on a schedule the CRM already supports (weekly, then daily the week
  before move in): booth, exhibitor, pieces, weight, inbound mode, expected arrival, outbound booked
  yes or no. Build it from orders plus shipments.
- **Outbound list** before move out: which booths have outbound booked with DTS, carrier, pickup
  window. This is the list that saves them forced freight work.
- No GSC login in version 1.

## 7. The DTS staff experience (the current setup is too hard; fix it)

Today, getting a show live takes too many screens: the Show page tab, the kit reader, series and
slug, Verify, Publish, then the partner page to cobrand. Version 1 adds one place to do all of it.

**CRM: "GSC Shipping Centers"** (one nav item, replaces nothing, links out where needed)
- List of GSC partners with: shows linked, shows live, orders this month, next move in.
- GSC screen, top to bottom:
  1. Branding: public name, logo upload, code (suggested from the name), on or off.
  2. Their shows: add by picking from the shows list. Each row shows a single status
     ("Needs kit", "Draft ready to check", "Live") and one primary button that does the next step.
  3. **Set up show** opens one guided panel: paste or upload the exhibitor kit, the kit reader fills
     the fields, the person checks them side by side with the kit, confirms the page address (slug,
     with a clear warning it cannot change once live), then one button "Verify and publish" that
     verifies, creates or attaches the series, publishes, and turns cobranding on for this GSC.
     Reuse the existing actions and rules in `lib/logistics.ts` and `logistics-actions.ts`; do not
     weaken any database guard.
  4. Copy buttons for the GSC landing link and each show link, plus a "Preview" link.
- **Orders inbox** (tab on the same screen and a global list): new orders first. Each order: exhibitor,
  booth, show, legs, weights, ready dates. Actions: "Quote sent" (with amount), "Booked" (load number,
  carrier, PRO, which links or creates the shipment), "Picked up," "Delivered," "Cancelled." Each
  status change updates the exhibitor's status page on the next sync.
- New order alert by email to a configurable team inbox.

## 8. Not in version 1 (stop and flag if you drift here)

Online payment (invoice through the normal process), exhibitor logins, instant or automated rates,
a GSC login or dashboard, rebates or markup to the GSC, exhibit house features, national big show
rollouts, material handling ordering (that stays the GSC's), international freight, and any change
to how the TMS books loads.

## 9. Build order (one PR each)

1. **Plan and data design.** Propose tables and the order flow (below). Wait for approval.
2. **Order storage on the public project.** A table in `showdata` for orders and order lines, not
   readable by `anon`, written only through a signed or rate limited server route in the web app
   with server side validation, spam protection (honeypot plus rate limit), and input limits.
   Tokens for status links are random and unguessable.
3. **Order form and confirmation page** in `trade-show/web`, with labels and BOL PDFs generated from
   the order plus the verified show row.
4. **Orders into the CRM.** Recommended: extend the existing CRM sync to pull new orders from the
   public project into a `tradeshow` staging table using a signed RPC (same pattern as the export),
   then status goes back out through the existing one way export as order status only. This is a
   deliberate, narrow exception to "nothing syncs back": orders only, pulled by the CRM, validated
   again on arrival, never trusted as verified data. Confirm this with Matthew in step 1.
5. **CRM Orders inbox and alerts.**
6. **Status page and reminder emails.**
7. **GSC landing page** and the show page checklist and button.
8. **CRM GSC Shipping Centers screen** with the one panel show setup.
9. **Manifest and outbound list fed from orders.**

## 10. Done means

- A real independent GSC (first pilot: one of the Indianapolis decorators Brad Sedam is working with)
  has a landing link and at least one live show page.
- An exhibitor can place an outbound plus inbound order on a phone in under three minutes, print
  labels and a BOL, and open a status link later.
- The order appears in the CRM inbox within minutes, alerts the team, and staff can move it to
  Booked with a load number in two clicks.
- The GSC receives a manifest by booth and an outbound list for that show.
- Security checks from the Phase 1 spec still pass, plus: `anon` cannot read orders, the order route
  rejects spam and oversized input, and no secret is in the repo.
- A new staff member can take a GSC from "added" to "show live" in one screen without help.

## 11. Open questions to raise in the plan (do not guess)

1. The turnaround promise for quotes, if any.
2. Which team inbox gets order alerts.
3. First pilot GSC and show.
4. Whether exhibitors can choose "I have my own carrier for inbound" and still use DTS for outbound
   (recommended yes).
5. Logo hosting for GSC branding (public storage bucket on the public project is fine).
