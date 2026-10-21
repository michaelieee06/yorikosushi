import sharp from 'sharp';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

const files = (await readdir('assets')).filter((f) => f.endsWith('.png'));
const cell = 260;
const cols = 5;
const rows = Math.ceil(files.length / cols);
const composites = [];
for (let i = 0; i < files.length; i++) {
  const buf = await sharp(join('assets', files[i])).resize(cell - 20, cell - 20).png().toBuffer();
  composites.push({ input: buf, left: (i % cols) * cell + 10, top: Math.floor(i / cols) * cell + 10 });
}
await sharp({ create: { width: cols * cell, height: rows * cell, channels: 3, background: '#f4ece0' } })
  .composite(composites)
  .png()
  .toFile('tools/_sheet.png');
console.log('ok', files.length);
