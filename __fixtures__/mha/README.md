# MHA fixtures

Golden set for the MHA verification tool. All fixtures describe the **same test
shipment** so they double as a cross-GC regression set:

- Show: Fabtech, McCormick Place, 2301 Lake Shore Drive, Chicago, IL 60616
- Exhibitor: LA Manufacturing, 123 Main Street, Pasadena, CA 91001
- Booth: A456
- Carrier: T-Force Freight
- 3 skids, 1000 lbs
- Special instruction: Liftgate

## `expected/*.json` — transcription fixtures (no API calls)

Hand-authored `MhaExtraction` objects, one per general contractor plus the
inverted case. They drive the rule-engine unit tests in
`lib/mha/__tests__/rules.test.ts`:

- `freeman.json`, `ges.json`, `shepard.json` — **R2 fails** (Bill To reads
  "LA Manufacturing", not DTS) and **R1 passes** (carrier is T-Force, not DTS).
- `inverted.json` — the case that actually happens in the field: carrier **is**
  DTS and Bill To **is** DTS → **R1 fails**, **R2 passes**.

## Form images — NOT in this repo yet

The three source images (`freeman.png`, `ges.png`, `shepard.png`) referenced by
the build spec were **not attached** to the task that generated this feature, so
the live vision-extraction integration test can't run yet. When you have them:

1. Drop them in this directory as `freeman.png`, `ges.png`, `shepard.png`.
2. Add an integration test that sends each through `extractMha()` and snapshots
   the result against the matching `expected/*.json`, asserting R1 passes and
   R2 fails on all three.

Until then, the deterministic rule engine — the part that actually decides — is
fully covered by the transcription fixtures above.
