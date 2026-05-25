export function formatDisplayName(
  firstName: string | null,
  lastName: string | null,
  fallback = '',
): string {
  const full = [firstName, lastName].filter(Boolean).join(' ');
  return full || fallback;
}
