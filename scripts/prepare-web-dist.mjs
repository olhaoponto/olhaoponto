import { existsSync, mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const dist = join(process.cwd(), 'dist');
const assets = join(dist, 'assets');
const nestedAssets = join(assets, 'assets');
const nestedNodeModules = join(assets, 'node_modules');
const vendor = join(dist, 'vendor');

function moveContents(source, destination) {
  if (!existsSync(source)) return;
  mkdirSync(destination, { recursive: true });
  for (const name of readdirSync(source)) renameSync(join(source, name), join(destination, name));
  rmSync(source, { recursive: true, force: true });
}

moveContents(nestedAssets, assets);
moveContents(nestedNodeModules, vendor);

const extensions = new Set(['.html', '.js', '.css', '.json', '.map']);
// Rewrite only generated text files after the directories have been moved.
import { readFileSync, writeFileSync } from 'node:fs';
function rewriteFiles(directory) {
  if (!existsSync(directory)) return;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) rewriteFiles(file);
    else {
      const extension = entry.name.slice(entry.name.lastIndexOf('.'));
      if (!extensions.has(extension)) continue;
      const original = readFileSync(file, 'utf8');
      const updated = original
        .replaceAll('/assets/assets/', '/assets/')
        .replaceAll('assets/assets/', 'assets/')
        .replaceAll('/assets/node_modules/', '/vendor/')
        .replaceAll('assets/node_modules/', 'vendor/');
      if (updated !== original) writeFileSync(file, updated);
    }
  }
}

rewriteFiles(dist);
console.log('Web dist normalized: assets/assets → assets; assets/node_modules → vendor');
