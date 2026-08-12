export interface CategoryRef {
  _id: string;
  name: string;
  slug: string;
}

export interface Category extends CategoryRef {
  description: string;
  parent: string | null;
  image?: { url: string | null; alt: string };
  isActive: boolean;
  createdAt: string;
  children?: Category[];
}

export interface VendorRef {
  _id: string;
  name: string;
  email?: string;
}

export type ProductStatus = 'draft' | 'active' | 'archived';

export interface ProductVariant {
  _id: string;
  sku: string;
  attributes: Record<string, string>;
  price: number;
  compareAtPrice: number | null;
  stock: number;
  reservedStock: number;
  availableStock: number;
  isActive: boolean;
}

export interface ProductImage {
  url: string;
  alt: string;
}

export interface Product {
  _id: string;
  vendor: VendorRef;
  category: CategoryRef;
  title: string;
  slug: string;
  description: string;
  images: ProductImage[];
  variants: ProductVariant[];
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

export type ProductSort = 'newest' | 'price_asc' | 'price_desc' | 'rating' | 'title_asc';

export interface PublicProductFilters {
  q?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: ProductSort;
  page?: number;
  limit?: number;
}

export interface ManagedProductFilters {
  q?: string;
  category?: string;
  status?: ProductStatus;
  vendor?: string; // admin-only; ignored for vendor callers
  sort?: ProductSort;
  page?: number;
  limit?: number;
}

export interface VariantInput {
  sku: string;
  attributes?: Record<string, string>;
  price: number;
  compareAtPrice?: number | null;
  stock?: number;
  isActive?: boolean;
}

export interface CreateProductInput {
  title: string;
  description?: string;
  category: string;
  images?: ProductImage[];
  variants: VariantInput[];
  status?: ProductStatus;
}

export type UpdateProductInput = Partial<Omit<CreateProductInput, 'variants'>>;
