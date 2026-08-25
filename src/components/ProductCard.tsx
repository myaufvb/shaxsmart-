import React from 'react';
import { Star, Heart, ShoppingBag, Check } from 'lucide-react';
import { Product } from '../types';
import { useCart } from '../context/CartContext';
import { formatPrice } from '../utils/format';

interface ProductCardProps {
  product: Product;
  onOpenDetails: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onOpenDetails }) => {
  const { addToCart, items, toggleFavorite, isFavorite } = useCart();
  const cartItem = items.find(i => i.productId === product.id);
  const inCart = !!cartItem;
  const favorite = isFavorite(product.id);

  const discount = product.oldPrice
    ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)
    : null;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    addToCart(product, 1);
  };

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavorite(product.id);
  };

  return (
    <div
      onClick={() => onOpenDetails(product)}
      className="group bg-white dark:bg-slate-800/90 rounded-2xl p-3 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between relative overflow-hidden"
    >
      {/* Badges */}
      <div className="absolute top-2.5 left-2.5 z-10 flex flex-col gap-1">
        {discount && (
          <span className="bg-rose-500 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-md shadow-sm">
            -{discount}%
          </span>
        )}
        {product.isHit && (
          <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md shadow-sm">
            ХИТ
          </span>
        )}
        {product.isNew && (
          <span className="bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md shadow-sm">
            NEW
          </span>
        )}
      </div>

      {/* Favorite Button */}
      <button
        onClick={handleToggleFavorite}
        className={`absolute top-2.5 right-2.5 z-10 p-1.5 rounded-full backdrop-blur-md transition-all active:scale-90 ${
          favorite
            ? 'bg-rose-50 dark:bg-rose-950/70 text-rose-500'
            : 'bg-white/80 dark:bg-slate-900/80 text-slate-400 hover:text-rose-500'
        }`}
      >
        <Heart className={`w-4 h-4 ${favorite ? 'fill-rose-500 text-rose-500' : ''}`} />
      </button>

      {/* Image container */}
      <div className="w-full aspect-square rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-900 mb-2.5 flex items-center justify-center relative">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
        {!product.inStock ? (
          <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center backdrop-blur-xs">
            <span className="text-white text-[11px] font-bold bg-slate-800/90 px-2.5 py-1 rounded-full border border-slate-700">
              Под заказ
            </span>
          </div>
        ) : product.stockQuantity !== undefined && (
          <div className="absolute bottom-1.5 left-1.5 z-10">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-900/75 text-emerald-400 backdrop-blur-xs border border-emerald-500/30">
              {product.stockQuantity > 0 ? `В наличии: ${product.stockQuantity} шт.` : 'Под заказ'}
            </span>
          </div>
        )}
      </div>

      {/* Product info */}
      <div className="flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              {product.brand}
            </span>
            <div className="flex items-center gap-0.5 text-amber-500 text-[11px] font-medium ml-auto">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              <span>{product.rating.toFixed(1)}</span>
              <span className="text-[10px] text-slate-400">({product.reviewsCount})</span>
            </div>
          </div>

          <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-100 line-clamp-2 leading-snug mb-2 min-h-[32px]">
            {product.name}
          </h4>
        </div>

        {/* Price & Action in UZS (сум) */}
        <div className="pt-2 border-t border-slate-50 dark:border-slate-800/80 flex items-end justify-between gap-1 mt-auto">
          <div>
            <div className="text-xs font-black text-slate-900 dark:text-white leading-tight">
              {formatPrice(product.price)}
            </div>
            {product.oldPrice && (
              <div className="text-[10px] text-slate-400 line-through mt-0.5">
                {formatPrice(product.oldPrice)}
              </div>
            )}
          </div>

          <button
            onClick={handleAddToCart}
            className={`p-2 rounded-xl transition-all active:scale-90 flex items-center justify-center ${
              inCart
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-500/20'
                : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white shadow-md shadow-indigo-600/20'
            }`}
            title={inCart ? 'В корзине' : 'Добавить в корзину'}
          >
            {inCart ? (
              <div className="flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold">{cartItem?.quantity}</span>
              </div>
            ) : (
              <ShoppingBag className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
