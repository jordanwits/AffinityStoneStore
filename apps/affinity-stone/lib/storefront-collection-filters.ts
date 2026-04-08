/**
 * Collections that are admin-only tags (e.g. product badges) and must not appear
 * in storefront filter chips. Keep in sync with admin ProductForm collection options.
 */
const ADMIN_ONLY_COLLECTION_LABELS_NORMALIZED = new Set(['custom order']);

function normalizeCollectionLabel(c: string): string {
  return c.trim().toLowerCase();
}

export function filterStorefrontCollectionOptions(collections: string[]): string[] {
  return collections.filter((c) => !ADMIN_ONLY_COLLECTION_LABELS_NORMALIZED.has(normalizeCollectionLabel(c)));
}

export function storefrontCollectionFiltersFromParams(
  collections: string | string[] | undefined
): string[] {
  if (!collections) return [];
  const list = Array.isArray(collections) ? collections : [collections];
  return list.filter((c) => !ADMIN_ONLY_COLLECTION_LABELS_NORMALIZED.has(normalizeCollectionLabel(c)));
}
