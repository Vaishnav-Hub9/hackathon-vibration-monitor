import archiver from '/tmp/ziptools/node_modules/archiver/index.js';
import { createWriteStream } from 'fs';
import { resolve } from 'path';

const OUTPUT = '/home/runner/workspace/smartbearing.zip';
const ROOT = '/home/runner/workspace';

const EXCLUDE_DIRS = new Set(['node_modules', '.git', 'dist', '.local', '.agents', '__pycache__']);
const EXCLUDE_FILES = new Set(['.replit', 'replit.nix', 'smartbearing.zip', 'smartbearing.tar.gz', 'create-zip.mjs']);

const output = createWriteStream(OUTPUT);
const archive = archiver('zip', { zlib: { level: 6 } });

output.on('close', () => {
  const mb = (archive.pointer() / 1024 / 1024).toFixed(1);
  console.log(`Done — ${mb} MB → ${OUTPUT}`);
});

archive.on('error', err => { throw err; });
archive.pipe(output);

archive.glob('**/*', {
  cwd: ROOT,
  dot: false,
  ignore: [
    '**/node_modules/**',
    '**/.git/**',
    '**/dist/**',
    '**/.local/**',
    '**/.agents/**',
    '**/*.tsbuildinfo',
    '.replit',
    'replit.nix',
    'smartbearing.zip',
    'smartbearing.tar.gz',
    'create-zip.mjs',
  ],
}, { prefix: 'smartbearing' });

await archive.finalize();
