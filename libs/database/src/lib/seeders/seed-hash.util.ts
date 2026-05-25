import { createHash } from 'node:crypto';

export function computeSeedHash(data: unknown): string {
  return createHash('sha256').update(JSON.stringify(data), 'utf8').digest('hex');
}
