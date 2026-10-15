import fs from "node:fs";
import zlib from "node:zlib";

function crc32(buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeBuffer = Buffer.from(type);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function insideRoundedRect(x, y, left, top, right, bottom, radius) {
  if (x < left || x > right || y < top || y > bottom) return false;
  const nearLeft = x < left + radius;
  const nearRight = x > right - radius;
  const nearTop = y < top + radius;
  const nearBottom = y > bottom - radius;
  if (!(nearLeft || nearRight) || !(nearTop || nearBottom)) return true;
  const cx = nearLeft ? left + radius : right - radius;
  const cy = nearTop ? top + radius : bottom - radius;
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= radius * radius;
}

function png(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x += 1) {
      const index = row + 1 + x * 4;
      const nx = x / size;
      const ny = y / size;
      if (!insideRoundedRect(nx, ny, 0, 0, 1, 1, 0.22)) continue;
      let red = 11;
      let green = 31;
      let blue = 58;
      if (nx > 0.28 && nx < 0.72 && ny > 0.44 && ny < 0.78) {
        red = 248;
        green = 250;
        blue = 252;
      }
      const dx = nx - 0.5;
      const dy = (ny - 0.38) * 1.15;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (ny < 0.48 && ny > 0.22 && distance > 0.11 && distance < 0.19) {
        red = 20;
        green = 184;
        blue = 166;
      }
      raw[index] = red;
      raw[index + 1] = green;
      raw[index + 2] = blue;
      raw[index + 3] = 255;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

for (const size of [180, 192, 512]) {
  fs.writeFileSync(new URL(`../public/icons/icon-${size}.png`, import.meta.url), png(size));
}
