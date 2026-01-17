import { copyFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Files and directories to copy to dist
const filesToCopy = [
  'manifest.json',
  'background.js',
  'content.js',
  'content.css',
  'icons',
  'lib'
];

function copyRecursive(src, dest) {
  const stat = statSync(src);

  if (stat.isDirectory()) {
    mkdirSync(dest, { recursive: true });
    const entries = readdirSync(src);

    for (const entry of entries) {
      const srcPath = join(src, entry);
      const destPath = join(dest, entry);
      copyRecursive(srcPath, destPath);
    }
  } else {
    copyFileSync(src, dest);
  }
}

// Copy files to dist
const distDir = join(__dirname, 'dist');
mkdirSync(distDir, { recursive: true });

filesToCopy.forEach(item => {
  const src = join(__dirname, item);
  const dest = join(distDir, item);

  try {
    const srcStat = statSync(src);
    if (srcStat.isFile() || srcStat.isDirectory()) {
      copyRecursive(src, dest);
      console.log(`✓ Copied ${item}`);
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.warn(`⚠ ${item} not found, skipping...`);
    } else {
      console.error(`✗ Failed to copy ${item}:`, error.message);
    }
  }
});

console.log('Build files copied successfully!');
