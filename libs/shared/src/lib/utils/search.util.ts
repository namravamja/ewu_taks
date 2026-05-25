export function buildSearchWhere<TField extends string>(
  search: string | undefined,
  searchFields: readonly TField[] | undefined,
  allowedFields: readonly TField[],
): Record<string, unknown> {
  const trimmed = search?.trim();
  if (!trimmed) return {};
  const fields = (searchFields?.length ? searchFields : allowedFields).filter((f) =>
    (allowedFields as readonly string[]).includes(f),
  );
  if (fields.length === 0) return {};
  return {
    OR: fields.map((field) => ({
      [field]: { contains: trimmed, mode: 'insensitive' },
    })),
  };
}
