const ESCAPE_PATTERN = /[*_\\[\]<>`]/g;

/**
 * Escapes Markdown control characters in interpolated values so user-supplied
 * names cannot inject formatting (or break the surrounding `**bold**` spans
 * used in notification main titles).
 */
export function escapeMarkdownInline(value: string): string {
  return value.replace(ESCAPE_PATTERN, (ch) => `\\${ch}`);
}
