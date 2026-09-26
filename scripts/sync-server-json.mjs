// Keeps server.json's version fields aligned with package.json.
// Run automatically by `npm version` (see package.json's "version" script);
// can also be run manually via `npm run sync-version`.
import { readFileSync, writeFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const server = JSON.parse(readFileSync('server.json', 'utf8'));
const version = pkg.version;

server.version = version;
for (const pkgEntry of server.packages) {
  if (pkgEntry.registryType === 'npm') {
    pkgEntry.version = version;
  }
  if (pkgEntry.registryType === 'oci') {
    pkgEntry.identifier = pkgEntry.identifier.replace(/:[^:]+$/, `:${version}`);
  }
}

writeFileSync('server.json', JSON.stringify(server, null, 2) + '\n');
console.log(`server.json synced to version ${version}`);
