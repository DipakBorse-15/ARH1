// ---------------------------------------------------------------------------
// Core domain types shared across the AARAAH storefront + admin panel.
// These mirror the Supabase database schema in supabase/migrations.
// ---------------------------------------------------------------------------

export type UserRole = "customer" | "admin";

export interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  mobile: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Collection {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

/** Extendable variant attribute set. Today: color. Tomorrow: size, fabric... */
export interface VariantAttributes {
  color?: string;
  color_hex?: string;
  size?: string;
  fabric?: string;
  pattern?: string;
  length?: string;
  [key: string]: string | undefined;
}

/** Parent "design" that groups color/size/etc. variants together. */
export interface Product {
  id: string;
  brand: string;
  parent_sku: string | null;
  name: string;
  slug: string;
  description: string | null;
  bullet_points: string[];
  category_id: string | null;
  collection_id: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  category?: Category | null;
  collection?: Collection | null;
  variants?: ProductVariant[];
}

export interface ProductVariant {
  id: string;
  product_id: string;
  sku: string;
  color: string | null;
  color_hex: string | null;
  attributes: VariantAttributes;
  price: number;
  sale_price: number | null;
  stock_quantity: number;
  is_available: boolean;
  active: boolean;
  variant_info: string | null;
  bullet_points: string[];
  description: string | null;
  work_type: string | null;
  work_pattern: string | null;
  best_for: string | null;
  manufacturer: string | null;
  included_components: string | null;
  discount_percent: number | null;
  discount_amount: number | null;
  color_group: string | null;
  fabric_type: string | null;
  search_keywords: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  images?: ProductImage[];
}

export interface ProductImage {
  id: string;
  variant_id: string;
  storage_path: string;
  url: string;
  alt_text: string | null;
  sort_order: number;
  created_at: string;
}

/** Convenience shape used across the storefront UI. */
export interface ProductWithVariants extends Product {
  variants: ProductVariant[];
}

export interface Address {
  id: string;
  user_id: string;
  full_name: string;
  mobile: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface CartItem {
  id: string;
  user_id: string;
  variant_id: string;
  quantity: number;
  created_at: string;
  updated_at: string;
  variant?: ProductVariant & { product?: Product };
}

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";

export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

export interface OrderItem {
  id: string;
  order_id: string;
  variant_id: string | null;
  product_name: string;
  brand: string;
  color: string | null;
  sku: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  image_url: string | null;
}

export interface Order {
  id: string;
  order_number: string;
  user_id: string;
  full_name: string;
  mobile: string;
  email: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  pincode: string;
  payment_method: string;
  payment_status: PaymentStatus;
  status: OrderStatus;
  subtotal: number;
  shipping_fee: number;
  total: number;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
}

export interface DashboardStats {
  totalProducts: number;
  activeProducts: number;
  totalOrders: number;
  pendingOrders: number;
  deliveredOrders: number;
  totalCustomers: number;
  lowStockVariants: number;
  totalSales: number;
}
