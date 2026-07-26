import { readFileSync } from 'fs';
import { join } from 'path';

/** Read @gx-portal/api version from package.json (cwd may be repo root or apps/api). */
function readApiVersion(): string {
  const candidates = [
    join(process.cwd(), 'package.json'),
    join(process.cwd(), 'apps/api/package.json'),
  ];
  for (const path of candidates) {
    try {
      const pkg = JSON.parse(readFileSync(path, 'utf8')) as {
        name?: string;
        version?: string;
      };
      if (pkg.name === '@gx-portal/api' && pkg.version) return pkg.version;
    } catch {
      /* try next */
    }
  }
  return '0.0.0';
}

export const API_VERSION = readApiVersion();
