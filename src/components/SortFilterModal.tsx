import React, { useState } from 'react';
import { X, ArrowDownWideNarrow, ArrowUpNarrowWide, Flame, Star, Check, RotateCcw } from 'lucide-react';
import { SortType, FilterState } from '../types';

interface SortFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSort: SortType;
  onSortChange: (sort: SortType) => void;
  filterState: FilterState;
  onFilterChange: (filters: FilterState) => void;
  availableBrands: string[];
}

export const SortFilterModal: React.FC<SortFilterModalProps> = ({
  isOpen,
  onClose,
  currentSort,
  onSortChange,
  filterState,
  onFilterChange,
  availableBrands
}) => {
  const [localFilters, setLocalFilters] = useState<FilterState>(filterState);

  if (!isOpen) return null;

  const sortOptions: { type: SortType; label: string; icon: React.FC<{ className?: string }> }[] = [
    { type: 'popular', label: 'Популярное', icon: Flame },
    { type: 'cheap', label: 'Сначала дешевле', icon: ArrowDownWideNarrow },
    { type: 'expensive', label: 'Сначала дороже', icon: ArrowUpNarrowWide },
    { type: 'rating', label: 'Высокий рейтинг', icon: Star },
  ];

  const handleApply = () => {
    onFilterChange(localFilters);
    onClose();
  };

  const handleReset = () => {
    const resetState: FilterState = {
      minPrice: 0,
      maxPrice: 200000,
      inStockOnly: false,
      selectedBrands: []
    };
    setLocalFilters(resetState);
    onFilterChange(resetState);
    onSortChange('popular');
  };

  const toggleBrand = (brand: string) => {
    setLocalFilters(prev => ({
      ...prev,
      selectedBrands: prev.selectedBrands.includes(brand)
        ? prev.selectedBrands.filter(b => b !== brand)
        : [...prev.selectedBrands, brand]
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div 
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl max-h-[88vh] flex flex-col shadow-2xl border-t sm:border border-slate-200 dark:border-slate-800 transition-colors animate-slideUp"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Сортировка и фильтры</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Настройте отображение товаров</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="p-2 text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg flex items-center gap-1 font-medium transition-colors"
              title="Сбросить"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Сброс</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1 text-sm">
          {/* Sort Section */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
              Отображено первым:
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {sortOptions.map((opt) => {
                const Icon = opt.icon;
                const isSelected = currentSort === opt.type;
                return (
                  <button
                    key={opt.type}
                    onClick={() => onSortChange(opt.type)}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-left font-medium transition-all ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`} />
                    <span className="text-xs leading-tight flex-1">{opt.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Price Range */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
              Цена (сум):
            </label>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <span className="text-[10px] text-slate-400">От (сум)</span>
                <input
                  type="number"
                  min="0"
                  value={localFilters.minPrice}
                  onChange={(e) => setLocalFilters({ ...localFilters, minPrice: Number(e.target.value) || 0 })}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="0"
                />
              </div>
              <div className="flex-1">
                <span className="text-[10px] text-slate-400">До (сум)</span>
                <input
                  type="number"
                  min="0"
                  value={localFilters.maxPrice}
                  onChange={(e) => setLocalFilters({ ...localFilters, maxPrice: Number(e.target.value) || 0 })}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="25000000"
                />
              </div>
            </div>
          </div>

          {/* Stock Filter */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
            <div>
              <div className="font-semibold text-slate-800 dark:text-slate-200 text-xs">Только в наличии</div>
              <div className="text-[11px] text-slate-500">Показывать товары готовые к заказу</div>
            </div>
            <button
              onClick={() => setLocalFilters({ ...localFilters, inStockOnly: !localFilters.inStockOnly })}
              className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 ${
                localFilters.inStockOnly ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                  localFilters.inStockOnly ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Brands */}
          {availableBrands.length > 0 && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                Бренды:
              </label>
              <div className="flex flex-wrap gap-2">
                {availableBrands.map((brand) => {
                  const isSelected = localFilters.selectedBrands.includes(brand);
                  return (
                    <button
                      key={brand}
                      onClick={() => toggleBrand(brand)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {brand}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Закрыть
          </button>
          <button
            onClick={handleApply}
            className="flex-1 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all"
          >
            Применить
          </button>
        </div>
      </div>
    </div>
  );
};
