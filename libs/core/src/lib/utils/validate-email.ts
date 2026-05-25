export function isValidEmail(addr: string): boolean {
  const atIndex = addr.indexOf('@');
  if (atIndex < 1 || addr.includes(' ')) return false;

  const domain = addr.slice(atIndex + 1);
  if (domain.includes('@')) return false;

  const dotIndex = domain.indexOf('.');
  return dotIndex > 0 && dotIndex < domain.length - 1;
}

export function validateEmails(addresses: readonly string[]): void {
  const invalid = addresses.filter((addr) => !isValidEmail(addr));
  if (invalid.length > 0) {
    throw new Error(`Invalid email address(es): ${invalid.join(', ')}`);
  }
}
