// scripts/check-redundancy.mjs
// Simple guard to catch duplicate route files and overlapping paths across route modules.

import fs from 'fs';
import path from 'path';

const ROUTES_DIR = path.resolve('backend/src/routes');

function listTsFiles(dir) {
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.ts'))
    .map(f => path.join(dir, f));
}

function readFile(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return ''; }
}

// Naive extract of app.use('/prefix', xyz) and router.<method>('/path', ...)
function extractPaths(src) {
  const results = [];
  const useRegex = /app\.use\(\s*['"`]([^'"`]+)['"`]/g;
  const routerRegex = /router\.(get|post|patch|put|delete)\(\s*['"`]([^'"`]+)['"`]/g;

  let m;
  while ((m = useRegex.exec(src))) results.push({ type: 'mount', path: m[1] });
  while ((m = routerRegex.exec(src))) results.push({ type: m[1].toUpperCase(), path: m[2] });

  return results;
}

function normalize(p) {
  return p.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
}

const files = listTsFiles(ROUTES_DIR);
const byBase = new Map();
const allPaths = [];

for (const f of files) {
  const bn = path.basename(f);
  byBase.set(bn, (byBase.get(bn) || []).concat(f));

  const src = readFile(f);
  extractPaths(src).forEach(r => {
    allPaths.push({ file: f, type: r.type, path: normalize(r.path) });
  });
}

// Duplicate file basenames
const dup = [...byBase.entries()].filter(([, arr]) => arr.length > 1);
if (dup.length) {
  console.error('❌ Duplicate route files by basename detected:');
  dup.forEach(([k, arr]) => console.error('  -', k, '→', arr.join(', ')));
}

// Overlapping route definitions (same method+path across files)
const key = (x) => `${x.type}:${x.path}`;
const map = new Map();
for (const r of allPaths) {
  const k = key(r);
  map.set(k, (map.get(k) || []).concat(r));
}
const overlaps = [...map.entries()].filter(([, arr]) => arr.length > 1 && !arr[0].file.endsWith('server.ts'));

if (overlaps.length) {
  console.error('❌ Overlapping route handlers detected (same method+path across multiple files):');
  for (const [, arr] of overlaps) {
    console.error('  -', arr[0].type, arr[0].path);
    arr.forEach(a => console.error('      ', a.file));
  }
}

if (dup.length || overlaps.length) {
  process.exit(1);
} else {
  console.log('✅ No duplicate basenames or overlapping route handlers found.');
}
