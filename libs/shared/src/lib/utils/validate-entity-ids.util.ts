import { BadRequestException } from '@nestjs/common';

/**
 * Validates that all IDs in the input array correspond to existing (active) records.
 *
 * Deduplicates input IDs, fetches matching records via the provided `fetcher`,
 * and throws a `BadRequestException` listing invalid IDs if any are missing.
 *
 * @param ids         - The IDs to validate.
 * @param fetcher     - Async function that returns records for the given IDs.
 *                      Each returned record must have an `id: number` field.
 * @param errorMessage - Prefix for the error message (e.g., "Invalid user(s)").
 */
export async function validateEntityIds(
  ids: number[],
  fetcher: (uniqueIds: number[]) => Promise<Array<{ id: number }>>,
  errorMessage: string,
): Promise<void> {
  const uniqueIds = [...new Set(ids)];
  const found = await fetcher(uniqueIds);

  if (found.length !== uniqueIds.length) {
    const foundIds = new Set(found.map((r) => r.id));
    const invalid = uniqueIds.filter((id) => !foundIds.has(id));
    throw new BadRequestException(`${errorMessage}: ${invalid.join(', ')}`);
  }
}
