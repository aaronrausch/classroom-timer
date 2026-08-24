/**
 * Generates the PWA icons.
 *
 * PNGs are written by hand here — a deflate stream and four chunks — rather
 * than by pulling in an image library, because a build-time dependency that
 * exists to draw two squares is exactly the kind of future breakage §9.1 warns
 * about. The SVG favicon is written alongside, from the same geometry.
 *
 *   npm run gen:assets
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

const BG = [15, 95, 87]; // teal, matching the default palette's finished field
const FG = [255, 255, 255];

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function png(size, pixel) {
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0; // filter: none
    for (let x = 0; x < size; x += 1) {
      const [r, g, b, a] = pixel(x, y);
      const offset = y * (stride + 1) + 1 + x * 4;
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
      raw[offset + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * The mark: a ring three-quarters full, depleting clockwise from twelve — the
 * same geometry the app itself draws, so the icon is a picture of the product
 * rather than a decoration.
 */
const REMAINING = 0.75;

function sample(size) {
  const c = size / 2;
  const outer = size * 0.36;
  const inner = size * 0.255;
  const corner = size * 0.22;
  // Supersample, since there is no antialiasing to inherit from anywhere.
  const grid = 3;

  return (x, y) => {
    let bgHits = 0;
    let fgHits = 0;
    for (let sy = 0; sy < grid; sy += 1) {
      for (let sx = 0; sx < grid; sx += 1) {
        const px = x + (sx + 0.5) / grid;
        const py = y + (sy + 0.5) / grid;
        if (!insideRoundedSquare(px, py, size, corner)) continue;
        bgHits += 1;
        const dx = px - c;
        const dy = py - c;
        const r = Math.hypot(dx, dy);
        if (r < inner || r > outer) continue;
        // Angle clockwise from twelve, in turns.
        const turns = (Math.atan2(dx, -dy) / (2 * Math.PI) + 1) % 1;
        // The remaining arc sits at the far side of the sweep, so the gap it
        // leaves opens clockwise from twelve.
        if (turns >= 1 - REMAINING) fgHits += 1;
      }
    }
    const total = grid * grid;
    if (bgHits === 0) return [0, 0, 0, 0];
    const alpha = Math.round((bgHits / total) * 255);
    const mix = fgHits / bgHits;
    return [
      Math.round(BG[0] + (FG[0] - BG[0]) * mix),
      Math.round(BG[1] + (FG[1] - BG[1]) * mix),
      Math.round(BG[2] + (FG[2] - BG[2]) * mix),
      alpha,
    ];
  };
}

function insideRoundedSquare(x, y, size, radius) {
  const dx = Math.max(radius - x, 0, x - (size - radius));
  const dy = Math.max(radius - y, 0, y - (size - radius));
  return Math.hypot(dx, dy) <= radius;
}

mkdirSync(OUT, { recursive: true });
for (const size of [192, 512]) {
  const buffer = png(size, sample(size));
  writeFileSync(join(OUT, `icon-${size}.png`), buffer);
  console.log(`icon-${size}.png  ${(buffer.length / 1024).toFixed(1)} KB`);
}

// The same mark as vector, for the browser tab.
const R = 0.305; // ring centre-line radius, as a fraction of the 100-unit box
const STROKE = 10.5;
const CIRCUMFERENCE = 2 * Math.PI * R * 100;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="Classroom Timer">
  <rect width="100" height="100" rx="22" fill="rgb(${BG.join(',')})"/>
  <circle cx="50" cy="50" r="${R * 100}" fill="none" stroke="rgb(${FG.join(',')})" stroke-width="${STROKE}"
    stroke-linecap="butt"
    stroke-dasharray="${CIRCUMFERENCE.toFixed(2)}"
    stroke-dashoffset="${(CIRCUMFERENCE * (1 - REMAINING)).toFixed(2)}"
    transform="rotate(90 50 50) matrix(-1 0 0 1 100 0)"/>
</svg>
`;
writeFileSync(join(OUT, 'icon.svg'), svg);
console.log('icon.svg');
