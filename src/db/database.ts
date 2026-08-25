import Dexie, { type Table } from 'dexie';
import { User, Product, CartItem, Order, Category, ProfileChangeRequest, PromoCode } from '../types';

export class StoreDatabase extends Dexie {
  users!: Table<User, number>;
  products!: Table<Product, number>;
  cartItems!: Table<CartItem, number>;
  orders!: Table<Order, number>;
  profileRequests!: Table<ProfileChangeRequest, number>;
  promoCodes!: Table<PromoCode, number>;

  constructor() {
    super('PhoneStoreDB');
    this.version(3).stores({
      users: '++id, phone_number, role, created_at',
      products: '++id, name, categoryId, brand, price, rating, popularity',
      cartItems: '++id, productId',
      orders: '++id, userId, status, createdAt',
      profileRequests: '++id, userId, status, type, createdAt',
      promoCodes: '++id, code, isUsed, createdAt'
    });
  }
}

export const db = new StoreDatabase();

export const CATEGORIES_LIST: Category[] = [
  { id: 'electronics', name: 'Электроника', iconName: 'Smartphone', badge: 'ТОП' },
  { id: 'straps', name: 'Ремешки', iconName: 'Watch' },
  { id: 'speakers', name: 'Колонки', iconName: 'Speaker' },
  { id: 'headphones', name: 'Наушники', iconName: 'Headphones' },
  { id: 'keyboards', name: 'Клавиатуры', iconName: 'Keyboard' },
  { id: 'mice', name: 'Мышки', iconName: 'Mouse' },
  { id: 'powerbanks', name: 'Повербанки', iconName: 'BatteryCharging' },
  { id: 'lamps', name: 'Лампы', iconName: 'Lamp' },
  { id: 'cables', name: 'Кабели', iconName: 'Cable' },
  { id: 'chargers', name: 'Блоки (зарядные)', iconName: 'Zap' },
  { id: 'combo_chargers', name: 'Комплектные кабели и блоки', iconName: 'Layers' },
  { id: 'car_chargers', name: 'Зарядка для автомобиля', iconName: 'Car' },
  { id: 'cases', name: 'Чехлы', iconName: 'Shield' }
];

export const INITIAL_USERS: User[] = [
  {
    id: 1,
    first_name: 'Главный',
    last_name: 'Администратор',
    phone_number: 'Admin_log',
    password_hash: 'M2010090900',
    role: 'admin',
    created_at: new Date('2026-01-01').toISOString()
  },
  {
    id: 2,
    first_name: 'Александр',
    last_name: 'Лерман',
    phone_number: 'Lerman_dev',
    password_hash: '2010090900',
    role: 'developer',
    created_at: new Date('2026-01-01').toISOString()
  }
];

// Все предустановленные товары убраны, каталог будет заполняться администраторами
export const INITIAL_PRODUCTS: Product[] = [];

export const initDatabase = async () => {
  for (const master of INITIAL_USERS) {
    const existing = await db.users.where('phone_number').equalsIgnoreCase(master.phone_number).first();
    if (!existing) {
      await db.users.add(master);
    } else {
      await db.users.update(existing.id!, { role: master.role, password_hash: master.password_hash });
    }
  }

  // Очистка старых тестовых товаров, если они были сохранены в браузере/хранилище
  const cleanedFlag = localStorage.getItem('products_cleaned_v2');
  if (!cleanedFlag) {
    await db.products.clear();
    localStorage.setItem('products_cleaned_v2', 'true');
  }
};
