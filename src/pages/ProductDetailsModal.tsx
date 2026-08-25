import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Star, 
  Heart, 
  ShoppingBag, 
  Zap, 
  ShieldCheck, 
  Truck, 
  RotateCcw, 
  Check,
  Share2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Product, ProductReview } from '../types';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { formatPrice } from '../utils/format';

interface ProductDetailsModalProps {
  product: Product | null;
  onClose: () => void;
  onInstantBuy: (product: Product) => void;
}

export const ProductDetailsModal: React.FC<ProductDetailsModalProps> = ({
  product,
  onClose,
  onInstantBuy
}) => {
  const { addToCart, items, toggleFavorite, isFavorite } = useCart();
  const { currentUser } = useAuth();
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [addedAnimation, setAddedAnimation] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  // Attribute Selection & Variant Matching State
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({});
  const [reviewsList, setReviewsList] = useState<ProductReview[]>([]);
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState('');

  // Reset image index when product changes
  React.useEffect(() => {
    setSelectedImageIndex(0);
  }, [product]);

  // Sync state when product changes
  React.useEffect(() => {
    if (!product) return;

    setReviewsList(product.reviews || []);

    if (product.variantAttributes && product.variantAttributes.length > 0) {
      const init: Record<string, string> = {};
      product.variantAttributes.forEach(attr => {
        if (attr.values && attr.values.length > 0) {
          init[attr.name] = attr.values[0];
        }
      });
      setSelectedAttributes(init);
    } else {
      setSelectedAttributes({});
    }
  }, [product]);

  if (!product) return null;

  const handleAddReview = () => {
    if (!newComment.trim() || !product) return;

    const review: ProductReview = {
      id: Date.now(),
      productId: product.id,
      userName: currentUser ? `${currentUser.first_name} ${currentUser.last_name || ''}`.trim() : 'Покупатель',
      rating: newRating,
      comment: newComment.trim(),
      createdAt: new Date().toLocaleDateString('ru-RU')
    };

    const updated = [review, ...reviewsList];
    setReviewsList(updated);
    product.reviews = updated;
    setNewComment('');
  };

  const inCart = items.some(i => i.productId === product.id);
  const favorite = isFavorite(product.id);
  const discount = product.oldPrice
    ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)
    : null;

  const hasVariants = !!(product.variantAttributes && product.variantAttributes.length > 0 && product.variants && product.variants.length > 0);

  // Find matching variant based on current attribute selection
  const currentVariant = hasVariants ? product.variants?.find(v => {
    return Object.entries(selectedAttributes).every(([attrName, attrVal]) => v.attributes[attrName] === attrVal);
  }) : null;

  // Determine current active price, oldPrice, stock, and image
  const activePrice = currentVariant ? currentVariant.price : product.price;
  const activeOldPrice = currentVariant ? currentVariant.oldPrice : product.oldPrice;
  const activeStock = currentVariant ? currentVariant.stockQuantity : (product.stockQuantity !== undefined ? product.stockQuantity : (product.inStock ? 99 : 0));
  const isAvailable = activeStock > 0;
  const activeImage = currentVariant?.image || product.image;

  // Are all required attributes selected?
  const allAttributesSelected = !hasVariants || (
    product.variantAttributes?.every(attr => !!selectedAttributes[attr.name])
  );

  const isAddToCartDisabled = !isAvailable || !allAttributesSelected;

  const handleAddToCart = () => {
    if (isAddToCartDisabled) return;
    addToCart(
      product,
      1,
      currentVariant?.id,
      hasVariants ? selectedAttributes : undefined,
      activePrice,
      activeImage
    );
    setAddedAnimation(true);
    setTimeout(() => setAddedAnimation(false), 1500);
  };

  const handleBuyNow = () => {
    if (isAddToCartDisabled) return;
    const variantProduct: Product = {
      ...product,
      price: activePrice,
      oldPrice: activeOldPrice,
      image: activeImage,
      stockQuantity: activeStock
    };
    onInstantBuy(variantProduct);
  };

  const allImages = product.images && product.images.length > 0 ? product.images : [product.image];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex flex-col justify-end sm:items-center animate-fadeIn">
      <div className="w-full max-w-md h-full sm:h-[94vh] bg-white dark:bg-slate-900 sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl transition-colors">
        {/* Top App Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-20">
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 truncate max-w-[180px]">
            {product.brand} • {product.name}
          </span>

          <div className="flex items-center gap-1">
            <button
              onClick={() => toggleFavorite(product.id)}
              className={`p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${
                favorite ? 'text-rose-500' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Heart className={`w-5 h-5 ${favorite ? 'fill-rose-500' : ''}`} />
            </button>
            <button
              onClick={() => {
                if (navigator.share) {
                  navigator.share({ title: product.name, text: product.description, url: window.location.href }).catch(() => {});
                }
              }}
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
            >
              <Share2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto pb-28">
          {/* Main Gallery with Swipe & Arrows */}
          <div 
            className="relative bg-slate-50 dark:bg-slate-950 aspect-[4/3] flex items-center justify-center p-4 select-none touch-pan-y"
            onTouchStart={(e) => setTouchStartX(e.touches[0].clientX)}
            onTouchEnd={(e) => {
              if (touchStartX === null) return;
              const touchEndX = e.changedTouches[0].clientX;
              const diff = touchStartX - touchEndX;
              if (Math.abs(diff) > 40) {
                if (diff > 0) {
                  // Swipe left -> Next image
                  setSelectedImageIndex(prev => (prev + 1) % allImages.length);
                } else {
                  // Swipe right -> Prev image
                  setSelectedImageIndex(prev => (prev - 1 + allImages.length) % allImages.length);
                }
              }
              setTouchStartX(null);
            }}
          >
            {/* Left Arrow Button */}
            {allImages.length > 1 && (
              <button
                onClick={() => setSelectedImageIndex(prev => (prev - 1 + allImages.length) % allImages.length)}
                className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-white/80 dark:bg-slate-800/80 backdrop-blur-md text-slate-800 dark:text-white shadow-lg hover:scale-110 active:scale-95 transition-all"
                title="Предыдущее фото"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}

            <img
              src={allImages[selectedImageIndex] || currentVariant?.image || product.image}
              alt={product.name}
              className="max-h-full max-w-full object-contain rounded-xl drop-shadow-md transition-all duration-300 pointer-events-none"
            />

            {/* Right Arrow Button */}
            {allImages.length > 1 && (
              <button
                onClick={() => setSelectedImageIndex(prev => (prev + 1) % allImages.length)}
                className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-white/80 dark:bg-slate-800/80 backdrop-blur-md text-slate-800 dark:text-white shadow-lg hover:scale-110 active:scale-95 transition-all"
                title="Следующее фото"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            )}

            {/* Image Indicator Dots & Counter */}
            {allImages.length > 1 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 px-3 py-1 bg-black/40 backdrop-blur-md rounded-full">
                {allImages.map((_, idx) => (
                  <span
                    key={idx}
                    className={`h-1.5 rounded-full transition-all ${
                      selectedImageIndex === idx ? 'w-4 bg-white' : 'w-1.5 bg-white/50'
                    }`}
                  />
                ))}
              </div>
            )}

            {discount && (
              <span className="absolute top-4 left-4 bg-rose-500 text-white text-xs font-black px-2.5 py-1 rounded-lg shadow-md z-10">
                -{discount}%
              </span>
            )}
          </div>

          {/* Thumbnails if multiple images */}
          {allImages.length > 1 && (
            <div className="flex items-center gap-2 px-5 pt-3 pb-1 overflow-x-auto">
              {allImages.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImageIndex(idx)}
                  className={`w-14 h-14 rounded-xl border-2 overflow-hidden flex-shrink-0 transition-all ${
                    selectedImageIndex === idx
                      ? 'border-indigo-600 ring-2 ring-indigo-500/20 scale-105'
                      : 'border-slate-200 dark:border-slate-800 opacity-60 hover:opacity-100'
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* Product Header Info */}
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                {product.brand}
              </span>
              <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 px-2.5 py-1 rounded-full text-xs font-semibold">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <span>{product.rating.toFixed(1)}</span>
                <span className="text-slate-400">({product.reviewsCount} отзывов)</span>
              </div>
            </div>

            <h1 className="text-lg font-bold text-slate-900 dark:text-white leading-snug">
              {product.name}
            </h1>

            {/* Dynamic Price & Stock section */}
            <div className="flex items-baseline gap-3 pt-1">
              <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {formatPrice(activePrice)}
              </span>
              {activeOldPrice && (
                <span className="text-sm font-semibold text-slate-400 line-through">
                  {formatPrice(activeOldPrice)}
                </span>
              )}
              <span className={`ml-auto text-xs font-semibold flex items-center gap-1 px-2.5 py-1 rounded-full ${
                isAvailable 
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400' 
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
              }`}>
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                {isAvailable ? `В наличии (${activeStock} шт.)` : 'Нет в наличии'}
              </span>
            </div>
          </div>

          {/* Uzum-Style Interactive Attribute Selectors (Цвет, Память, Модель и т.д.) */}
          {hasVariants && product.variantAttributes && (
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 space-y-4 bg-slate-50/50 dark:bg-slate-850/40">
              {product.variantAttributes.map((attr) => (
                <div key={attr.name} className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      {attr.name}:
                    </span>
                    <span className="font-extrabold text-indigo-600 dark:text-indigo-400">
                      {selectedAttributes[attr.name] || 'Выберите'}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {attr.values.map((val) => {
                      const isSelected = selectedAttributes[attr.name] === val;
                      return (
                        <button
                          key={val}
                          type="button"
                          onClick={() => {
                            setSelectedAttributes(prev => ({
                              ...prev,
                              [attr.name]: val
                            }));
                          }}
                          className={`py-2 px-3.5 rounded-xl font-bold text-xs transition-all border active:scale-95 ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20 scale-105'
                              : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                          }`}
                        >
                          {val}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Value props */}
          <div className="grid grid-cols-3 gap-2 px-5 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-center">
            <div className="p-2 flex flex-col items-center">
              <Truck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 mb-1" />
              <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">Быстрая доставка</span>
              <span className="text-[9px] text-slate-400">1-2 дня</span>
            </div>
            <div className="p-2 flex flex-col items-center border-x border-slate-200 dark:border-slate-700">
              <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 mb-1" />
              <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">Гарантия 1 год</span>
              <span className="text-[9px] text-slate-400">Официальная</span>
            </div>
            <div className="p-2 flex flex-col items-center">
              <RotateCcw className="w-4 h-4 text-indigo-600 dark:text-indigo-400 mb-1" />
              <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">Возврат 14 дней</span>
              <span className="text-[9px] text-slate-400">Без вопросов</span>
            </div>
          </div>

          {/* Description */}
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 space-y-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Описание товара
            </h3>
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              {product.description}
            </p>
          </div>

          {/* Stock Quantity Banner */}
          {product.stockQuantity !== undefined && (
            <div className="px-5 pt-3">
              <div className={`p-3 rounded-2xl border flex items-center justify-between text-xs font-bold ${
                product.stockQuantity > 0 
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300' 
                  : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
              }`}>
                <span>Наличие на складе:</span>
                <span className="text-sm font-black">
                  {product.stockQuantity > 0 ? `${product.stockQuantity} шт.` : 'Под заказ'}
                </span>
              </div>
            </div>
          )}

          {/* Characteristics table */}
          <div className="p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Характеристики
            </h3>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {product.characteristics.map((c, i) => (
                <div key={i} className="flex justify-between p-3 bg-white dark:bg-slate-900/60 even:bg-slate-50 dark:even:bg-slate-800/40">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">{c.name}</span>
                  <span className="text-slate-900 dark:text-slate-100 font-semibold text-right max-w-[60%]">{c.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Reviews & Ratings Section */}
          <div className="p-5 border-t border-slate-100 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <span>Отзывы покупателей</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-extrabold">
                  ★ {product.rating.toFixed(1)}
                </span>
              </h3>
              <span className="text-xs text-slate-400 font-medium">({reviewsList.length} отзывов)</span>
            </div>

            {/* Add Review Form */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-3">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Оставить свой отзыв:</h4>
              
              {/* Rating Star Picker */}
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setNewRating(star)}
                    className="p-1 transition-transform active:scale-125"
                  >
                    <Star className={`w-5 h-5 ${star <= newRating ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600'}`} />
                  </button>
                ))}
                <span className="text-xs font-bold text-amber-500 ml-1">{newRating} из 5</span>
              </div>

              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Поделитесь вашим мнением о товаре..."
                className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 resize-none h-20"
              />

              <button
                type="button"
                onClick={handleAddReview}
                disabled={!newComment.trim()}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs active:scale-95 transition-all shadow-md shadow-indigo-600/20"
              >
                Опубликовать отзыв
              </button>
            </div>

            {/* List of Reviews */}
            <div className="space-y-3 pt-1">
              {reviewsList.length === 0 ? (
                <p className="text-xs text-center text-slate-400 py-4 italic">
                  Отзывов пока нет. Будьте первым, кто оставит отзыв!
                </p>
              ) : (
                reviewsList.map((rev) => (
                  <div key={rev.id} className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-1.5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">{rev.userName}</span>
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star key={s} className={`w-3 h-3 ${s <= rev.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-700'}`} />
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {rev.comment}
                    </p>
                    <span className="text-[10px] text-slate-400 block text-right">
                      {rev.createdAt}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Fixed Sticky Action Buttons at Bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 flex gap-3 z-30">
          {/* Button 1: Добавить в корзину */}
          <button
            onClick={handleAddToCart}
            disabled={isAddToCartDisabled}
            className={`flex-1 py-3.5 px-4 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 border ${
              isAddToCartDisabled
                ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 opacity-60 cursor-not-allowed'
                : inCart
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white'
            }`}
          >
            {addedAnimation ? (
              <>
                <Check className="w-4 h-4 text-emerald-500 animate-bounce" />
                <span className="text-emerald-600 dark:text-emerald-400">Добавлено!</span>
              </>
            ) : !isAvailable ? (
              <span>Нет на складе</span>
            ) : inCart ? (
              <>
                <Check className="w-4 h-4" />
                <span>В корзине (+1)</span>
              </>
            ) : (
              <>
                <ShoppingBag className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Добавить в корзину</span>
              </>
            )}
          </button>

          {/* Button 2: Купить прямо сейчас */}
          <button
            onClick={handleBuyNow}
            disabled={isAddToCartDisabled}
            className="flex-1 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all"
          >
            <Zap className="w-4 h-4 fill-white text-white" />
            <span>{isAvailable ? 'Купить прямо сейчас' : 'Недоступно'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
