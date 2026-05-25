/**
 * Wraps a value in Markdown bold markers. Used by notification template
 * `mainTitle` strings so authors don't repeat `**…**` literals — and so a
 * future syntax change (e.g. `<strong>`) is a one-line edit.
 */
export const bold = (value: string): string => `**${value}**`;
