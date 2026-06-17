# TMS Integration — Hyperion → CRM (phase two)

Pulls live shipment tracking from **Hyperion TMS** (`3pl.hyperiontms.com`) into
the CRM via **n8n** middleware. The CRM exposes one ingest endpoint; n8n fetches
from Hyperion and posts the results here.

```
 ┌─────────────┐   GET tracking    ┌──────────┐   POST array (Bearer)   ┌────────────────────────────┐
 │  Hyperion   │ ────────────────▶ │   n8n    │ ──────────────────────▶ │  /api/tms/shipments        │
 │  TMS API    │                   │ (cron)   │                         │  (upsert by load number)   │
 └─────────────┘                   └──────────┘                         └────────────────────────────┘
```

## Endpoint

```
POST /api/tms/shipments
Authorization: Bearer <TMS_WEBHOOK_SECRET>
Content-Type: application/json
```

Body is **Hyperion's tracking response as-is** — a JSON array of load objects.
A single object or `{ "shipments": [ ... ] }` are also accepted.

### Matching & ownership

- Each load is matched to a CRM shipment by **load number**:
  Hyperion `clientLoadId` → `shipments.tms_reference_id` (the unique key).
- **Exists** → updated in place, `tms_sync_status` set to `synced`.
- **New load number** → a new shipment is created (unlinked) for a coordinator
  to attach to a show/exhibitor later.
- A sync **only owns freight fields**. It never overwrites the `show`/`exhibitor`
  an operator attached, or the `notes` / `special_requirements` they typed.

### Field mapping (Hyperion → CRM)

| Hyperion field | CRM column | Notes |
|---|---|---|
| `clientLoadId` | `tms_reference_id` | The load number / match key |
| `status` + `isDispatched` / `isIntransit` / `isDelivered` | `status` | String mapped first (e.g. "In Transit"→`in_transit`); flags as fallback |
| `serviceType` | `mode` | `LTL`/`FTL`/`partial`/`expedited`/`specialized` |
| `totalPieces` | `pieces` | |
| `totalWeight` | `weight` | |
| `pickupDate` | `pickup_date` | US `M/D/YYYY [time]` → `YYYY-MM-DD` |
| `deliveryDate` | `estimated_delivery_date` | Date portion of the window |
| `deliverStatusDate` | `actual_delivery_date` | When delivered |
| `pickupLocation` | `origin_street/city/state/zip` | Best-effort parse of `"street, city, ST zip"` |
| `proNumber` | `pro_number` | |
| `carrierName` | `carrier` | Resolved by name; created if new |

Also set on every sync: `tms_sync_status = synced`, `tms_last_synced_at = now`.
Synced rows show a green **Synced** badge in the Shipments UI; manual rows stay
**Manual**.

> Generic field names (`load_number`, `pickup_date`, `weight`, `carrier_name`,
> etc.) are accepted too, so hand-built payloads or other TMS sources work.

### Response

```json
{ "ok": true, "processed": 2, "inserted": 1, "updated": 1, "errors": 0,
  "results": [ { "tms_reference_id": "13793", "action": "updated" } ] }
```

`401` = bad/missing bearer secret. `503` = `TMS_WEBHOOK_SECRET` not set.

## Setup

1. Set a strong shared secret in `.env.local` (already generated during build —
   rotate as needed):
   ```
   TMS_WEBHOOK_SECRET=tms_xxxxxxxx...
   ```
2. **n8n workflow** (runs on a schedule, e.g. every 10 min):
   - **HTTP Request** → `GET https://3pl.hyperiontms.com/api/home/tracking?type=0&trackingnumbers=<ids>`
     (with Hyperion's own auth). `trackingnumbers` is a comma-separated list of
     the `clientLoadId`s you want to track — typically the load numbers attached
     to active shows in the CRM.
   - **HTTP Request** → `POST {APP_URL}/api/tms/shipments`
     - Header `Authorization: Bearer {{$env.TMS_WEBHOOK_SECRET}}`
     - Body: the array from the previous node (pass through; no transform needed).

## Operator workflow

To have a CRM shipment auto-update from Hyperion, put its Hyperion **load number**
in the shipment's *TMS reference ID* field (Shipments → edit). On the next sync,
the freight fields update automatically and the row flips to **Synced**. New
loads that arrive before anyone logs them appear as unlinked synced shipments,
ready to attach to the right show/exhibitor.
