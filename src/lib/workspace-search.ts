/** Match all search words regardless of casing, accents or extra spaces. */
export function normalizeSearch(value: unknown): string {
  return String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
}
export function matchesSearch(query: unknown, ...values: unknown[]): boolean {
  const words = normalizeSearch(query).split(' ').filter(Boolean);
  const haystack = normalizeSearch(values.flat(Infinity).filter(value => value != null).join(' '));
  return words.every(word => haystack.includes(word));
}
