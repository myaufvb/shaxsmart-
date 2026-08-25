import React, { useState, useEffect } from 'react';
import { 
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
  Layers,
  Car,
  Shield,
  ChevronRight,
  ArrowLeft,
  SlidersHorizontal
} from 'lucide-react';
import { Category, Product, SortType } from '../types';
import { db, CATEGORIES_LIST } from '../db/database';
import { api } from '../services/api';
import { ProductCard } from '../components/ProductCard';
import { SortFilterModal } from '../components/SortFilterModal';

interface CategoriesTabProps {
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

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  electronics: { bg: 'bg-blue-50 dark:bg-blue-950/50', text: 'text-blue-600 dark:text-blue-400' },
  straps: { bg: 'bg-amber-50 dark:bg-amber-950/50', text: 'text-amber-600 dark:text-amber-400' },
  speakers: { bg: 'bg-red-50 dark:bg-red-950/50', text: 'text-red-600 dark:text-red-400' },
  headphones: { bg: 'bg-purple-50 dark:bg-purple-950/50', text: 'text-purple-600 dark:text-purple-400' },
  keyboards: { bg: 'bg-emerald-50 dark:bg-emerald-950/50', text: 'text-emerald-600 dark:text-emerald-400' },
  mice: { bg: 'bg-cyan-50 dark:bg-cyan-950/50', text: 'text-cyan-600 dark:text-cyan-400' },
  powerbanks: { bg: 'bg-teal-50 dark:bg-teal-950/50', text: 'text-teal-600 dark:text-teal-400' },
  lamps: { bg: 'bg-yellow-50 dark:bg-yellow-950/50', text: 'text-yellow-600 dark:text-yellow-400' },
  cables: { bg: 'bg-indigo-50 dark:bg-indigo-950/50', text: 'text-indigo-600 dark:text-indigo-400' },
  chargers: { bg: 'bg-orange-50 dark:bg-orange-950/50', text: 'text-orange-600 dark:text-orange-400' },
  combo_chargers: { bg: 'bg-violet-50 dark:bg-violet-950/50', text: 'text-violet-600 dark:text-violet-400' },
  car_chargers: { bg: 'bg-sky-50 dark:bg-sky-950/50', text: 'text-sky-600 dark:text-sky-400' },
  cases: { bg: 'bg-pink-50 dark:bg-pink-950/50', text: 'text-pink-600 dark:text-pink-400' },
};

export const CategoriesTab: React.FC<CategoriesTabProps> = ({ onOpenProductDetails }) => {
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [categoryProducts, setCategoryProducts] = useState<Product[]>([]);
  const [currentSort, setCurrentSort] = useState<SortType>('popular');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const loadCounts = async () => {
      const all = await api.getProducts();
      const counts: Record<string, number> = {};
      CATEGORIES_LIST.forEach(cat => {
        counts[cat.id] = all.filter(p => p.categoryId === cat.id).length;
      });
      setCategoryCounts(counts);
      if (selectedCategory) {
        setCategoryProducts(all.filter(p => p.categoryId === selectedCategory.id));
      }
    };
    loadCounts();

    const unsubscribe = api.onProductsChange((all) => {
      const counts: Record<string, number> = {};
      CATEGORIES_LIST.forEach(cat => {
        counts[cat.id] = all.filter(p => p.categoryId === cat.id).length;
      });
      setCategoryCounts(counts);
      if (selectedCategory) {
        setCategoryProducts(all.filter(p => p.categoryId === selectedCategory.id));
      }
    });

    const interval = setInterval(loadCounts, 3000);
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [selectedCategory]);

  const sortedProducts = [...categoryProducts].sort((a, b) => {
    switch (currentSort) {
      case 'cheap': return a.price - b.price;
      case 'expensive': return b.price - a.price;
      case 'rating': return b.rating - a.rating;
      case 'popular':
      default: return b.popularity - a.popularity;
    }
  });

  return (
    <div className="flex-1 flex flex-col pb-24 overflow-y-auto">
      {selectedCategory ? (
        /* Category Detail View with Products */
        <div>
          {/* Header */}
          <div className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedCategory(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {selectedCategory.name}
              </h2>
            </div>

            <button
              onClick={() => setIsFilterModalOpen(true)}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 hover:bg-slate-200 transition-colors"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </div>

          {/* Subheader info */}
          <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between text-xs text-slate-500">
            <span>Всего товаров: {sortedProducts.length}</span>
            <span className="font-semibold text-indigo-600 dark:text-indigo-400">
              Сортировка: {currentSort === 'cheap' ? 'Дешевле' : currentSort === 'expensive' ? 'Дороже' : currentSort === 'rating' ? 'Рейтинг' : 'Популярное'}
            </span>
          </div>

          {/* Products Grid */}
          <div className="p-4">
            {sortedProducts.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                В этой категории пока нет товаров
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {sortedProducts.map(product => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onOpenDetails={onOpenProductDetails}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Categories List View */
        <div className="p-4 space-y-4">
          <div className="flex items-baseline justify-between">
            <h1 className="text-xl font-black text-slate-900 dark:text-white">
              Категории каталога
            </h1>
            <span className="text-xs font-semibold text-slate-400">
              {CATEGORIES_LIST.length} разделов
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {CATEGORIES_LIST.map((cat, index) => {
              const Icon = CATEGORY_ICONS[cat.id] || Layers;
              const colors = CATEGORY_COLORS[cat.id] || { bg: 'bg-indigo-50 dark:bg-indigo-950/50', text: 'text-indigo-600' };
              const count = categoryCounts[cat.id] || 0;

              return (
                <div
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat)}
                  className="flex items-center justify-between p-3.5 bg-white dark:bg-slate-800/80 hover:bg-indigo-50/50 dark:hover:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md cursor-pointer transition-all active:scale-[0.99] group"
                >
                  <div className="flex items-center gap-3.5">
                    <div className={`p-2.5 rounded-xl ${colors.bg} ${colors.text} group-hover:scale-110 transition-transform`}>
                      <Icon className="w-5 h-5" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400">#{index + 1}</span>
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {cat.name}
                        </h3>
                        {cat.badge && (
                          <span className="bg-indigo-600 text-white text-[9px] font-extrabold px-1.5 py-0.2 rounded-md">
                            {cat.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {count} {count === 1 ? 'товар' : 'товаров в наличии'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <SortFilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        currentSort={currentSort}
        onSortChange={setCurrentSort}
        filterState={{ minPrice: 0, maxPrice: 200000, inStockOnly: false, selectedBrands: [] }}
        onFilterChange={() => {}}
        availableBrands={[]}
      />
    </div>
  );
};
