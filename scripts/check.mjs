import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { ActivityReader, readQuota } from '../src/magpie.mjs';

const manifest = JSON.parse(readFileSync(new URL('../assets/upstream.json', import.meta.url)));
for (const entry of manifest.files) {
  const data = readFileSync(new URL('../assets/webm/' + encodeURIComponent(entry.name), import.meta.url));
  const hash = createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex');
  if (hash !== entry.sha) throw new Error('Animation checksum mismatch: ' + entry.name);
}
console.log(`Verified ${manifest.files.length} animation checksums.`);
const reader = new ActivityReader();
console.log('Activity:', await reader.read());
if (process.argv.includes('--quota')) console.log('Quota:', await readQuota());
