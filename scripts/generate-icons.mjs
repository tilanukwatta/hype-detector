// Generates placeholder PNG icons for the extension without any image deps.
// Draws a magnifier-style glyph: a blue disc with a lighter inner ring on a
// transparent background. Run with `node scripts/generate-icons.mjs`.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'assets');
const ACCENT = [47, 111, 235]; // matches --accent
const RING = [255, 255, 255];

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function makePng(size) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.42;
  const ringOuter = size * 0.3;
  const ringInner = size * 0.2;

  // RGBA raw with a filter byte (0) at the start of each scanline.
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      const o = y * (stride + 1) + 1 + x * 4;
      if (d > r) continue; // transparent outside disc
      const inRing = d <= ringOuter && d >= ringInner;
      const [rr, gg, bb] = inRing ? RING : ACCENT;
      raw[o] = rr;
      raw[o + 1] = gg;
      raw[o + 2] = bb;
      raw[o + 3] = 255;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of [16, 48, 128]) {
  writeFileSync(join(OUT_DIR, `icon-${size}.png`), makePng(size));
  console.log(`wrote icon-${size}.png`);
}
