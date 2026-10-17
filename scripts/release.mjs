// Builds the extension and packs dist/ into release/flipbook-<version>.zip, ready to upload to the Chrome Web Store.
// Usage: npm run release
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { crc32, deflateRawSync } from 'node:zlib';

const DIST = 'dist';
const OUT_DIR = 'release';
const { version } = JSON.parse(readFileSync('package.json', 'utf8'));

const dirty = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
if (dirty && !process.argv.includes('--allow-dirty')) {
  console.error('Commit your changes first, so the zip matches a commit. Pass --allow-dirty to pack anyway.');
  process.exit(1);
}

execSync('npm run build', { stdio: 'inherit' });

const built = JSON.parse(readFileSync(join(DIST, 'manifest.json'), 'utf8'));
if (built.version !== version) throw new Error(`dist/manifest.json says ${built.version}, package.json says ${version}`);

const files = (function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
})(DIST).sort();

const zipPath = join(OUT_DIR, `flipbook-${version}.zip`);
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(zipPath, zip(files.map((path) => ({ name: relative(DIST, path).split(sep).join('/'), data: readFileSync(path) }))));
console.log(`\n${zipPath}: ${files.length} files. Tag this commit v${version} once it's uploaded.`);

/** A plain zip archive: deflated entries, a central directory, no extras. */
function zip(entries) {
  const DOS_DATE = (1 << 5) | 1; // 1980-01-01, so the same build always gives the same zip
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBytes = Buffer.from(name, 'utf8');
    const packed = deflateRawSync(data, { level: 9 });
    const crc = crc32(data);
    const fields = (header) => {
      header.writeUInt16LE(20, 4); // version needed
      header.writeUInt16LE(0x0800, 6); // UTF-8 names
      header.writeUInt16LE(8, 8); // deflate
      header.writeUInt16LE(0, 10);
      header.writeUInt16LE(DOS_DATE, 12);
      header.writeUInt32LE(crc, 14);
      header.writeUInt32LE(packed.length, 18);
      header.writeUInt32LE(data.length, 22);
      header.writeUInt16LE(nameBytes.length, 26);
    };
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    fields(local);
    locals.push(local, nameBytes, packed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); // made by
    fields(central.subarray(2)); // same fields, shifted by the extra "made by" slot
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBytes);
    offset += local.length + nameBytes.length + packed.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}
