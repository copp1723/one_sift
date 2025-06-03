export function sanitizeSlug(slug: string): string {
  const normalized = slug.toLowerCase();
  if (!/^[a-z0-9-]+$/.test(normalized)) {
    throw new Error('Invalid slug format');
  }
  return normalized;
}

export function schemaNameFromSlug(slug: string): string {
  const sanitized = sanitizeSlug(slug);
  return `customer_${sanitized.replace(/-/g, '_')}`;
}
