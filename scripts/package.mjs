// Packages the built extension (./dist) into a store-ready ZIP with no external
// dependencies. Produces `web-ext-artifacts/hype-detector-v<version>.zip`, the
// exact file you upload to the Chrome Web Store and Edge Add-ons.
//
// Run `npm run zip` (which builds first). ZIP entries use DEFLATE (method 8) via
// node's zlib; source maps are excluded to keep the upload lean.
import { deflateRawSync } from 'node:zlib';
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const OUT_DIR = join(ROOT, 'web-ext-artifacts');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'));
const OUT_FILE = join(OUT_DIR, `hype-detector-v${pkg.version}.zip`);

// CRC-32 (IEEE) with a precomputed table.
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
}

// Recursively collect files under `dir`, returning POSIX-style relative paths.
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const DOS_DATE = 0x21; // 1980-01-01, fixed for reproducible archives
const DOS_TIME = 0x00;

function localHeader(nameBuf, crc, compSize, rawSize) {
  const h = Buffer.alloc(30);
  h.writeUInt32LE(0x04034b50, 0);
  h.writeUInt16LE(20, 4); // version needed
  h.writeUInt16LE(0, 6); // flags
  h.writeUInt16LE(8, 8); // method: deflate
  h.writeUInt16LE(DOS_TIME, 10);
  h.writeUInt16LE(DOS_DATE, 12);
  h.writeUInt32LE(crc, 14);
  h.writeUInt32LE(compSize, 18);
  h.writeUInt32LE(rawSize, 22);
  h.writeUInt16LE(nameBuf.length, 26);
  h.writeUInt16LE(0, 28); // extra length
  return Buffer.concat([h, nameBuf]);
}

function centralHeader(nameBuf, crc, compSize, rawSize, offset) {
  const h = Buffer.alloc(46);
  h.writeUInt32LE(0x02014b50, 0);
  h.writeUInt16LE(20, 4); // version made by
  h.writeUInt16LE(20, 6); // version needed
  h.writeUInt16LE(0, 8); // flags
  h.writeUInt16LE(8, 10); // method
  h.writeUInt16LE(DOS_TIME, 12);
  h.writeUInt16LE(DOS_DATE, 14);
  h.writeUInt32LE(crc, 16);
  h.writeUInt32LE(compSize, 20);
  h.writeUInt32LE(rawSize, 24);
  h.writeUInt16LE(nameBuf.length, 28);
  h.writeUInt16LE(0, 30); // extra
  h.writeUInt16LE(0, 32); // comment
  h.writeUInt16LE(0, 34); // disk number start
  h.writeUInt16LE(0, 36); // internal attrs
  h.writeUInt32LE(0, 38); // external attrs
  h.writeUInt32LE(offset, 42);
  return Buffer.concat([h, nameBuf]);
}

function build() {
  let dist;
  try {
    dist = statSync(DIST);
  } catch {
    dist = null;
  }
  if (!dist?.isDirectory()) {
    console.error('dist/ not found. Run `npm run build` first (or use `npm run zip`).');
    process.exit(1);
  }

  const files = walk(DIST)
    .map((f) => relative(DIST, f).split('\\').join('/'))
    .filter((name) => !name.endsWith('.map'))
    .sort();

  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const name of files) {
    const raw = readFileSync(join(DIST, name));
    const nameBuf = Buffer.from(name, 'utf-8');
    const crc = crc32(raw);
    const compressed = deflateRawSync(raw);

    const local = localHeader(nameBuf, crc, compressed.length, raw.length);
    localParts.push(local, compressed);
    centralParts.push(centralHeader(nameBuf, crc, compressed.length, raw.length, offset));
    offset += local.length + compressed.length;
  }

  const centralDir = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4); // disk number
  eocd.writeUInt16LE(0, 6); // disk with cd
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20); // comment length

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, Buffer.concat([...localParts, centralDir, eocd]));
  console.log(`Packaged ${files.length} files → ${relative(ROOT, OUT_FILE)}`);
}

build();
