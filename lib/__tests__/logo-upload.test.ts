import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { LOGO_MAX_BYTES, processLogo } from "../logo-upload";

const img = (w: number, h: number, fmt: "png" | "jpeg" | "webp" | "gif") =>
  sharp({ create: { width: w, height: h, channels: 4, background: { r: 171, g: 5, b: 52, alpha: 1 } } })
    .toFormat(fmt)
    .toBuffer();

test("a big logo is re-encoded to a PNG within 600 x 240", async () => {
  const r = await processLogo(await img(1800, 600, "jpeg"), "image/jpeg");
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.width, 600);
  assert.equal(r.height, 200);
  assert.equal((await sharp(r.png).metadata()).format, "png");
});

test("a small logo is not blown up", async () => {
  const r = await processLogo(await img(120, 40, "webp"), "image/webp");
  assert.ok(r.ok && r.width === 120 && r.height === 40);
});

test("wrong types, lies about type, empty and oversized files are refused", async () => {
  assert.equal((await processLogo(await img(50, 50, "gif"), "image/gif")).ok, false);
  // A GIF claiming to be a PNG is still a GIF.
  const liar = await processLogo(await img(50, 50, "gif"), "image/png");
  assert.equal(liar.ok, false);
  assert.equal((await processLogo(Buffer.from("<svg/>"), "image/png")).ok, false);
  assert.equal((await processLogo(Buffer.alloc(0), "image/png")).ok, false);
  const big = await processLogo(Buffer.alloc(LOGO_MAX_BYTES + 1), "image/png");
  assert.ok(!big.ok && /500 KB/.test(big.error));
});
