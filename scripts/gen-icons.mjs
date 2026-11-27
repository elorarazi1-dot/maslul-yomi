import fs from "fs";
import path from "path";
import zlib from "zlib";

function crc32(buffer) {
  let crc = ~0;
  for (let index = 0; index < buffer.length; index += 1) {
    crc ^= buffer[index];
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const name = Buffer.from(type);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, crc]);
}

function insideRoundRect(x, y, size, inset, radius) {
  const left = inset;
  const top = inset;
  const right = size - inset;
  const bottom = size - inset;
  if (x < left || y < top || x >= right || y >= bottom) return false;
  const checks = [
    [left + radius, top + radius],
    [right - radius, top + radius],
    [left + radius, bottom - radius],
    [right - radius, bottom - radius],
  ];
  for (const [cx, cy] of checks) {
    const inCornerX = x < left + radius || x >= right - radius;
    const inCornerY = y < top + radius || y >= bottom - radius;
    if (inCornerX && inCornerY) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy > radius * radius) return false;
    }
  }
  return true;
}

function png(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const cx = size / 2;
  const cy = size * 0.46;
  const radius = size * 0.16;
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x += 1) {
      const pixel = row + 1 + x * 4;
      if (!insideRoundRect(x, y, size, size * 0.08, size * 0.18)) {
        raw[pixel + 3] = 0;
        continue;
      }
      const dx = x - cx;
      const dy = y - cy;
      const inDot = dx * dx + dy * dy < radius * radius;
      const inInner = dx * dx + dy * dy < (radius * 0.42) ** 2;
      if (inInner) {
        raw[pixel] = 15;
        raw[pixel + 1] = 110;
        raw[pixel + 2] = 86;
      } else if (inDot) {
        raw[pixel] = 255;
        raw[pixel + 1] = 253;
        raw[pixel + 2] = 248;
      } else {
        raw[pixel] = 15;
        raw[pixel + 1] = 110;
        raw[pixel + 2] = 86;
      }
      raw[pixel + 3] = 255;
    }
  }
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    signature,
    chunk("IHDR", header),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const root = path.resolve(import.meta.dirname, "..");
fs.mkdirSync(path.join(root, "public"), { recursive: true });
fs.writeFileSync(path.join(root, "public", "icon-192.png"), png(192));
fs.writeFileSync(path.join(root, "public", "icon-512.png"), png(512));
fs.writeFileSync(path.join(root, "app", "icon.png"), png(192));
