import React, { useState, useEffect } from 'react';
import { 
  Search, 
  SlidersHorizontal, 
  Sparkles, 
  TrendingUp, 
  Layers, 
  X,
  Smartphone,
  Watch,
  Speaker,
  Headphones,
  Keyboard,
  Mouse,
  BatteryCharging,
  Lamp,
  Cable,
  Zap,
  Car,
  Shield,
  RefreshCw
} from 'lucide-react';
import { Product, SortType, FilterState } from '../types';
import { db, CATEGORIES_LIST } from '../db/database';
import { ProductCard } from '../components/ProductCard';
import { SortFilterModal } from '../components/SortFilterModal';

import { api } from '../services/api';

interface HomeTabProps {
  onOpenCategories: () => void;
  onOpenProductDetails: (product: Product) => void;
}

const CATEGORY_ICONS: Record<string, React.FC<{ className?: string }>> = {
  electronics: Smartphone,
  straps: Watch,
  speakers: Speaker,
  headphones: Headphones,
  keyboards: Keyboard,
  mice: Mouse,
  powerbanks: BatteryCharging,
  lamps: Lamp,
  cables: Cable,
  chargers: Zap,
  combo_chargers: Layers,
  car_chargers: Car,
  cases: Shield,
};

export const HomeTab: React.FC<HomeTabProps> = ({
  onOpenCategories,
  onOpenProductDetails
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [currentSort, setCurrentSort] = useState<SortType>('popular');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [filterState, setFilterState] = useState<FilterState>({
    minPrice: 0,
    maxPrice: 30000000,
    inStockOnly: false,
    selectedBrands: []
  });

  useEffect(() => {
    const fetchProducts = async () => {
      const all = await api.getProducts();
      setProducts(all);
    };
    fetchProducts();

    // Subscribe to realtime product updates from Cloud
    const unsubscribe = api.onProductsChange((updated) => {
      setProducts(updated);
    });

    const interval = setInterval(fetchProducts, 3000);
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const availableBrands = Array.from(new Set(products.map(p => p.brand).filter(Boolean)));

  // Filter & Sort Logic
  const filteredProducts = products.filter(product => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = product.name.toLowerCase().includes(q);
      const matchBrand = product.brand.toLowerCase().includes(q);
      const matchDesc = product.description.toLowerCase().includes(q);
      if (!matchName && !matchBrand && !matchDesc) return false;
    }

    if (selectedCategory && product.categoryId !== selectedCategory) {
      return false;
    }

    if (product.price < filterState.minPrice || product.price > filterState.maxPrice) {
      return false;
    }

    if (filterState.inStockOnly && !product.inStock) {
      return false;
    }

    if (filterState.selectedBrands.length > 0 && !filterState.selectedBrands.includes(product.brand)) {
      return false;
    }

    return true;
  });

  filteredProducts.sort((a, b) => {
    switch (currentSort) {
      case 'cheap':
        return a.price - b.price;
      case 'expensive':
        return b.price - a.price;
      case 'rating':
        return b.rating - a.rating;
      case 'popular':
      default:
        return b.popularity - a.popularity;
    }
  });

  const getSortLabel = () => {
    switch (currentSort) {
      case 'cheap': return 'Дешевле';
      case 'expensive': return 'Дороже';
      case 'rating': return 'Высокий рейтинг';
      case 'popular':
      default: return 'Популярное';
    }
  };

  return (
    <div className="flex-1 flex flex-col pb-24 overflow-y-auto">
      {/* Top Search & Catalog Bar */}
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-4 pt-3 pb-3 border-b border-slate-100 dark:border-slate-800 space-y-2.5 transition-colors">
        {/* Row 0: App Brand & Store Logo */}
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-2.5">
            <img
              src="/logo.png"
              alt="SHAXSMART STORE"
              className="w-9 h-9 rounded-2xl object-contain shadow-sm border border-slate-200/80 dark:border-slate-700 bg-white"
            />
            <div>
              <h1 className="text-sm font-black tracking-wider text-slate-900 dark:text-white uppercase leading-tight">
                SHAXSMART <span className="text-indigo-600 dark:text-indigo-400">STORE</span>
              </h1>
              <p className="text-[10px] text-slate-400 font-medium leading-none">
                Фирменный магазин техники
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={async () => {
                const live = await api.getProducts();
                setProducts(live);
              }}
              className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 rounded-xl active:scale-95 transition-all"
              title="Обновить каталог"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/90 px-2.5 py-1 rounded-xl">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span>г. Термез</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск товаров, брендов..."
              className="w-full pl-9 pr-8 py-2.5 bg-slate-100 dark:bg-slate-800 border-none rounded-2xl text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            onClick={onOpenCategories}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-2xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-all flex-shrink-0"
          >
            <Layers className="w-4 h-4" />
            <span>Каталог</span>
          </button>
        </div>

        {/* Row 2: Sort & Filter Bar */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          {/* "Отображено первым" button */}
          <button
            onClick={() => setIsFilterModalOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700/80 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700/80 transition-all active:scale-95"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span className="text-slate-500 dark:text-slate-400">Отображено первым:</span>
            <span className="font-bold text-indigo-600 dark:text-indigo-400">{getSortLabel()}</span>
          </button>

          <span className="text-[11px] font-semibold text-slate-400">
            {filteredProducts.length} {filteredProducts.length === 1 ? 'товар' : 'товаров'}
          </span>
        </div>
      </div>

      {/* Quick Category Chips Scroll */}
      <div className="px-4 pb-2">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex-shrink-0 flex items-center gap-1.5 ${
              selectedCategory === null
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/80 hover:bg-slate-100'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Все</span>
          </button>

          {CATEGORIES_LIST.map(cat => {
            const Icon = CATEGORY_ICONS[cat.id] || Layers;
            const isSelected = selectedCategory === cat.id;

            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(isSelected ? null : cat.id)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all flex-shrink-0 flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-bold'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/80 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{cat.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Filter Chips */}
      {(selectedCategory || filterState.selectedBrands.length > 0 || filterState.inStockOnly) && (
        <div className="px-4 py-1.5 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-slate-400 font-medium">Фильтры:</span>
          {selectedCategory && (
            <span className="inline-flex items-center gap-1 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[11px] font-semibold px-2 py-0.5 rounded-lg">
              {CATEGORIES_LIST.find(c => c.id === selectedCategory)?.name}
              <button onClick={() => setSelectedCategory(null)}>
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {filterState.inStockOnly && (
            <span className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold px-2 py-0.5 rounded-lg">
              В наличии
              <button onClick={() => setFilterState({ ...filterState, inStockOnly: false })}>
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {filterState.selectedBrands.map(brand => (
            <span key={brand} className="inline-flex items-center gap-1 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-[11px] font-semibold px-2 py-0.5 rounded-lg">
              {brand}
              <button onClick={() => setFilterState({ ...filterState, selectedBrands: filterState.selectedBrands.filter(b => b !== brand) })}>
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Products Grid */}
      <div className="p-4 pt-1">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-16 px-4 space-y-3 bg-white dark:bg-slate-800/40 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
            <Smartphone className="w-12 h-12 text-indigo-400/60 dark:text-indigo-500/60 mx-auto" />
            <h3 className="text-base font-bold text-slate-800 dark:text-white">
              {products.length === 0 ? 'Каталог пока пуст' : 'Товары не найдены'}
            </h3>
            <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
              {products.length === 0 
                ? 'Администраторы магазина скоро добавят актуальные товары и характеристики по всем 13 категориям!'
                : 'Попробуйте изменить поисковый запрос или сбросить фильтры'}
            </p>
            {products.length > 0 && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory(null);
                  setFilterState({ minPrice: 0, maxPrice: 30000000, inStockOnly: false, selectedBrands: [] });
                }}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20"
              >
                Сбросить все фильтры
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredProducts.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                onOpenDetails={onOpenProductDetails}
              />
            ))}
          </div>
        )}
      </div>

      {/* Sort / Filter Modal */}
      <SortFilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        currentSort={currentSort}
        onSortChange={setCurrentSort}
        filterState={filterState}
        onFilterChange={setFilterState}
        availableBrands={availableBrands}
      />
    </div>
  );
};
