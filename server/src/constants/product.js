export const PRODUCT_STATUS = Object.freeze({
  DRAFT: 'draft',
  ACTIVE: 'active',
  ARCHIVED: 'archived',
});

export const ALL_PRODUCT_STATUSES = Object.values(PRODUCT_STATUS);

// Only these statuses are ever visible on public storefront endpoints —
// draft and archived products exist for vendor/admin eyes only.
export const PUBLIC_PRODUCT_STATUSES = [PRODUCT_STATUS.ACTIVE];

export const PRODUCT_SORT_OPTIONS = Object.freeze({
  NEWEST: 'newest',
  PRICE_ASC: 'price_asc',
  PRICE_DESC: 'price_desc',
  RATING: 'rating',
  TITLE_ASC: 'title_asc',
});

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 60;
