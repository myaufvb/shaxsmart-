export type UserRole = 'developer' | 'admin' | 'user';

export interface User {
  id?: number;
  first_name: string;
  last_name?: string;
  phone_number: string;
  password_hash: string;
  role: UserRole;
  created_at: string;
  avatar?: string;
}

export type ProfileChangeRequestType = 'name' | 'phone' | 'password';
export type ProfileChangeRequestStatus = 'pending' | 'approved' | 'rejected';

export interface ProfileChangeRequest {
  id: number;
  userId: number;
  userName: string;
  userPhone: string;
  type: ProfileChangeRequestType;
  oldValue: string;
  newValue: string;
  newLastName?: string;
  status: ProfileChangeRequestStatus;
  createdAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface Category {
  id: string;
  name: string;
  iconName: string;
  badge?: string;
  itemCount?: number;
}

export type PhoneOS = 'android' | 'iphone';
export type ItemCondition = 'new' | 'used' | 'ideal';

export interface ProductCharacteristic {
  name: string;
  value: string;
}

export interface VariantAttribute {
  name: string; // e.g. "Цвет", "Память", "Модель"
  values: string[]; // e.g. ["Черный", "Белый", "Синий"] or ["128 ГБ", "256 ГБ", "512 ГБ"]
}

export interface ProductVariant {
  id: string; // e.g. "var_iphone13_black_128"
  productId: number;
  attributes: Record<string, string>; // e.g. { "Цвет": "Черный", "Память": "128 ГБ" }
  price: number;
  oldPrice?: number;
  stockQuantity: number;
  sku?: string;
  image?: string;
}

export interface ProductReview {
  id: number;
  productId: number;
  userName: string;
  userAvatar?: string;
  rating: number; // 1 - 5
  comment: string;
  createdAt: string;
}

export interface Product {
  id: number;
  name: string;
  categoryId: string;
  brand: string;
  price: number;
  oldPrice?: number;
  rating: number;
  reviewsCount: number;
  popularity: number;
  image: string;
  images: string[];
  description: string;
  characteristics: ProductCharacteristic[];
  inStock: boolean;
  stockQuantity?: number; // Управление наличием на складе (шт.)
  reviews?: ProductReview[]; // Отзывы и оценки к товару
  variantAttributes?: VariantAttribute[]; // Атрибуты для выбора (Цвет, Память и т.д.)
  variants?: ProductVariant[]; // Все SKU вариации товара
  isNew?: boolean;
  isHit?: boolean;
  // Specific attributes for phones & accessories
  phoneOS?: PhoneOS;
  condition?: ItemCondition;
  color?: string;
  storage?: string;
  ram?: string;
  batteryHealth?: string;
  packageContents?: string[]; // e.g. ['Кабель', 'Блок', 'Чехол'] or ['Кабель', 'Блок', 'Наушники']
}

export interface CartItem {
  id?: number;
  productId: number;
  variantId?: string; // Выбранный SKU (вариация)
  selectedAttributes?: Record<string, string>; // Выбранный цвет, память и т.д.
  quantity: number;
  priceOverride?: number;
  imageOverride?: string;
}

export type OrderStatus = 'awaiting_payment' | 'payment_failed' | 'processing' | 'shipped' | 'completed' | 'canceled';

export interface Order {
  id?: number;
  userId: number;
  items: {
    productId: number;
    name: string;
    price: number;
    quantity: number;
    image: string;
  }[];
  totalPrice: number;
  status: OrderStatus;
  createdAt: string;
  customerName: string;
  phone: string;
  address: string;
  paymentCard: string;
  paymentMethod: string;
  adminNote?: string;
}

export type SortType = 'cheap' | 'expensive' | 'popular' | 'rating';

export interface FilterState {
  minPrice: number;
  maxPrice: number;
  inStockOnly: boolean;
  selectedBrands: string[];
}

export interface PromoCode {
  id: number;
  code: string;
  discountPercent: number; // e.g. 10, 20, 30, 50%
  minOrderSum: number; // e.g. 100000 сум
  minOrderAmount?: number; // alias for compatibility with cloud
  isUsed: boolean;
  isOneTime?: boolean;
  usedBy?: string | null;
  usedAt?: string | null;
  createdAt: string;
  createdBy: string;
}

