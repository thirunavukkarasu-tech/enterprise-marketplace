export type ProductStatus = 'draft' | 'active' | 'archived';
export type ProductSort = 'newest' | 'price_asc' | 'price_desc' | 'rating';

export interface CategoryImage {
  url: string;
  alt?: string;
}

export interface Category {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  parent: string | null;
  image?: CategoryImage;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductVariant {
  sku: string;
  attributes?: Record<string, string>;
  price: number;
  compareAtPrice?: number;
  stock: number;
  reservedStock: number;
  availableStock: number;
}

export interface ProductImage {
  url: string;
  alt?: string;
}

export interface CategoryRef {
  _id: string;
  name: string;
  slug: string;
}

export interface Product {
  _id: string;
  vendor: string;
  category: CategoryRef | string;
  title: string;
  description: string;
  slug: string;
  variants: ProductVariant[];
  images: ProductImage[];
  status: ProductStatus;
  priceRange: { min: number; max: number };
  ratingAverage: number;
  ratingCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ProductListQuery {
  q?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  status?: ProductStatus;
  vendor?: string;
  sort?: ProductSort;
  page?: number;
  limit?: number;
}

/** Shape sent to POST /products/manage and used as the base for edits. */
export interface ProductInput {
  title: string;
  description: string;
  category: string;
  images?: ProductImage[];
  variants: Array<{
    sku: string;
    attributes?: Record<string, string>;
    price: number;
    compareAtPrice?: number;
    stock: number;
  }>;
}
