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

## 4a. Two products, kept apart on purpose

The same app will hold two different things. Keep them clearly separate so nobody (staff, GSCs or
exhibitors) confuses them.

| | Public show pages (exists) | GSC Shipping Center (new) |
| --- | --- | --- |
| What it is | DTS branded shipping guides for big national shows like FABTECH, for search traffic | A shipping ordering portal a GSC runs its own shows through |
| Who it is for | Any exhibitor searching Google | Exhibitors at one GSC's shows, sent by the GSC's kit |
| Branding | DTS | The GSC (DTS shown only as "Shipping arranged by DTS") |
| Main action | Get a freight quote | Order outbound and inbound shipping, labels, BOL, status |
| Indexed by search | Yes | No (noindex, not in the sitemap) |
| URL space | `/trade-show/shipping/...` | `/ship/...` (its own route group and layout) |
| Staff area in the CRM | Show pages | GSC Shipping Centers |

Rules that follow from this:
- **Separate route group and layout** in `trade-show/web`: `app/(ship)/ship/...` with its own
  minimal header (GSC logo and name, show name, "Shipping arranged by DTS" in the footer). Do not
  reuse the dtsone.com site header, menus, search or quote bar there. Shared building blocks
  (date formatting, address blocks, the logistics facts) can live in `lib/` and `components/`.
- **A show can be in either or both.** A GSC show does not need a public SEO page to be live in the
  Shipping Center, and a public page does not need a GSC. Enabling a show in a GSC's Shipping
  Center requires verified logistics (same Verify rules), not a published series. Model this as its
  own link (for example a `ship_shows` table: GSC, show, portal slug, enabled) rather than reusing
  the SEO page's publish flag.
- **Separate CRM areas.** "Show pages" stays the SEO publishing queue. "GSC Shipping Centers" is
  its own nav item for GSCs, their shows, orders and users. Do not add GSC controls to the Show
  pages screen or SEO controls to the GSC screen.
- The existing cobranded SEO page (`/trade-show/shipping/[slug]/with/[code]/`) stays as is for
  partners who just want a branded info page. The Shipping Center does not build on it.

## 5. The exhibitor experience (make this dead simple)

**Entry points**
- GSC landing page: `/ship/[gsc-code]/`. The GSC's name and logo, then their upcoming shows as cards
  (show name, dates, city, "Order shipping" button). This is the one link a GSC puts in every kit.
- Show home: `/ship/[gsc-code]/[show-slug]/`. A short "What to do and by when" checklist at the top
  (warehouse deadline, direct window, move out and carrier check in), the addresses, and a large
  "Order shipping" button. Built from the same verified logistics as the public pages.

**Order form** at `/ship/[gsc-code]/[show-slug]/order/`. One page, three steps, mobile
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

## 6. The GSC experience, including a GSC admin site

**What the GSC's exhibitors see:** the landing page and cobranded show pages (above).

**GSC admin site** at `/ship/admin/` (in the same `(ship)` route group of `trade-show/web`), for the GSC's own
exhibitor services and warehouse staff. This is how the GSC runs its shows with us, so it has to feel
like their own tool, not a DTS report.

Access
- Logins live in the DTS Trade Show project (Supabase Auth), never in DTS Database. Email magic link
  plus a password option; MFA available.
- DTS staff invite GSC users from the CRM (section 7). A GSC user belongs to one GSC and can see only
  that GSC's shows and orders, enforced by RLS on every table and view they touch, not just in the UI.
- Two roles: GSC admin (manage their users, branding details) and GSC staff (view and export).

Screens
1. **Home:** their upcoming shows as cards with move in date, orders count, booths with outbound
   booked, booths without outbound, and a "Copy kit link" button for each show and for their landing
   page.
2. **Show board** (one per show), tabs:
   - **Inbound manifest:** booth, exhibitor, pieces, weight, advance warehouse or direct, expected
     arrival date, status (booked, picked up, delivered to warehouse). Filter by date. Print and CSV.
   - **Outbound:** every booth with an outbound order, pickup window, destination city, carrier and
     PRO once booked, check in status on move out day. A second list of booths that shipped inbound
     with DTS but have no outbound yet.
   - **Exhibitor lookup:** search by booth or company, see that exhibitor's order and status, and
     copy the exhibitor's status link to send them.
3. **Nudge:** one button to email every booth on the "no outbound yet" list a reminder (DTS wording,
   GSC branding), with a log of when it was sent.
4. **Settings:** their public name, logo, exhibitor services phone and email shown on their pages,
   and their users (GSC admin role only).

What the GSC does not see
- DTS pricing, quotes, or margins. Order views show freight facts and status only.
- Other GSCs' shows or anything from the CRM beyond what is synced to the public project for their
  shows.

Also emailed (for GSCs who never log in): the manifest by booth on a schedule (weekly, then daily
the week before move in) and the outbound list before move out.

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
GSC ordering of anything besides viewing freight (material handling stays the GSC's), rebates or markup to the GSC, exhibit house features, national big show
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
7. **GSC landing page and show home** under `/ship`, with its own layout.
8. **CRM GSC Shipping Centers screen** with the one panel show setup.
9. **Manifest and outbound list fed from orders** (emailed).
10. **GSC admin site:** auth and RLS first (with SQL tests proving a GSC user cannot read another
    GSC's rows or any price field), then Home, Show board, Nudge, Settings, then user invites from
    the CRM.

## 10. Done means

- A real independent GSC (first pilot: one of the Indianapolis decorators Brad Sedam is working with)
  has a landing link and at least one live show page.
- An exhibitor can place an outbound plus inbound order on a phone in under three minutes, print
  labels and a BOL, and open a status link later.
- The order appears in the CRM inbox within minutes, alerts the team, and staff can move it to
  Booked with a load number in two clicks.
- The GSC receives a manifest by booth and an outbound list for that show, by email and in their
  admin site, and can nudge booths with no outbound in one click.
- A GSC user can log in and see only their own shows and orders, never prices; SQL tests prove it.
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
7. Where the Shipping Center is served. Recommended: its own subdomain, `ship.dtsone.com`, pointed at
   the `dts-trade-show-web` Vercel project, so it never mixes with the dtsone.com site or its SEO.
   Fallback: `dtsone.com/ship/...` through a rewrite in `dts-website` like the show pages use.
6. How much of the exhibitor's contact info a GSC should see (recommended: company, contact name and
   booth; email and phone only if Matthew approves, since the GSC already has them from registration).
