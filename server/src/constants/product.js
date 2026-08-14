export const PRODUCT_STATUS = Object.freeze({
  DRAFT: 'draft',
  ACTIVE: 'active',
  ARCHIVED: 'archived',
});

export const ALL_PRODUCT_STATUSES = Object.values(PRODUCT_STATUS);

export const PRODUCT_SORT = Object.freeze({
  NEWEST: 'newest',
  PRICE_ASC: 'price_asc',
  PRICE_DESC: 'price_desc',
  RATING: 'rating',
});

export const ALL_PRODUCT_SORTS = Object.values(PRODUCT_SORT);

export const PAGINATION_DEFAULTS = Object.freeze({
  PAGE: 1,
  LIMIT: 20,
  MAX_LIMIT: 100,
});
