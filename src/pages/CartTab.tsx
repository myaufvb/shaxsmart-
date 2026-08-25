import React, { useState } from 'react';
import { 
  ShoppingBag, 
  Trash2, 
  Plus, 
  Minus, 
  ArrowRight, 
  ShieldCheck, 
  Tag, 
  CheckCircle2, 
  Truck,
  Sparkles,
  CreditCard,
  Copy,
  Check,
  X,
  Send,
  PhoneCall
} from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { Product } from '../types';
import { api } from '../services/api';
import { formatPrice } from '../utils/format';

interface CartTabProps {
  onOpenHome: () => void;
  onOpenProductDetails: (product: Product) => void;
}

export const CartTab: React.FC<CartTabProps> = ({ onOpenHome, onOpenProductDetails }) => {
  const { items, totalCount, totalPrice, updateQuantity, removeFromCart, clearCart } = useCart();
  const { currentUser } = useAuth();
  const { notifyNewOrder } = useNotifications();
  
  const [promoCode, setPromoCode] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [appliedPromoCode, setAppliedPromoCode] = useState<string | null>(null);
  const [promoError, setPromoError] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [isValidatingPromo, setIsValidatingPromo] = useState(false);

  // Checkout modal
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [customerName, setCustomerName] = useState(
    currentUser ? `${currentUser.first_name} ${currentUser.last_name || ''}`.trim() : ''
  );
  const [phone, setPhone] = useState(currentUser?.phone_number || '+998 ');
  const [address, setAddress] = useState('г. Термез, ул. Алишера Навои, 2м');
  const [copiedCard, setCopiedCard] = useState(false);
  const [isOrdering, setIsOrdering] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [createdOrderId, setCreatedOrderId] = useState<number | null>(null);

  const cardNumber = '8600041778281007';

  const copyCard = () => {
    navigator.clipboard.writeText(cardNumber);
    setCopiedCard(true);
    setTimeout(() => setCopiedCard(false), 2000);
  };

  const applyPromo = async () => {
    const clean = promoCode.replace(/\s+/g, '').trim().toUpperCase();
    if (!clean) {
      setPromoError('Введите промокод');
      return;
    }

    setIsValidatingPromo(true);
    setPromoError('');
    const res = await api.validatePromoCode(clean, totalPrice);
    setIsValidatingPromo(false);

    if (res.valid && res.discountPercent && res.discountPercent > 0) {
      setDiscountPercent(res.discountPercent);
      setAppliedPromoCode(res.promoCode || clean);
      setPromoApplied(true);
      setPromoError('');
    } else {
      setPromoError(res.error || 'Неверный или использованный промокод');
      setDiscountPercent(0);
      setAppliedPromoCode(null);
      setPromoApplied(false);
    }
  };

  const discountAmount = Math.round((totalPrice * discountPercent) / 100);
  const finalPrice = Math.max(0, totalPrice - discountAmount);

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !phone || items.length === 0) return;

    // Защита от случайного касания
    if (!window.confirm(`Вы уверены, что хотите оформить заказ на сумму ${formatPrice(finalPrice)}? Убедитесь, что вы перевели оплату.`)) return;

    setIsOrdering(true);
    try {
      const orderData = {
        userId: currentUser?.id || 0,
        items: items.map(item => ({
          productId: item.productId,
          name: item.product.name,
          price: item.product.price,
          quantity: item.quantity,
          image: item.product.image
        })),
        totalPrice: finalPrice,
        status: 'awaiting_payment' as const,
        createdAt: new Date().toISOString(),
        customerName,
        phone,
        address,
        paymentCard: cardNumber,
        paymentMethod: 'Click / Payme'
      };

      // Save order to central server and local storage via API
      const savedOrder = await api.createOrder(orderData);
      setCreatedOrderId(savedOrder.id || null);

      // If promo code was applied, mark it as single-used!
      if (appliedPromoCode && savedOrder.id) {
        await api.usePromoCode(appliedPromoCode, savedOrder.id, customerName);
      }

      // Trigger admin order notification with audio chime and push-banner
      notifyNewOrder(savedOrder);

      setOrderSuccess(true);
      await clearCart();
    } catch (e) {
      console.error('Error placing order:', e);
    } finally {
      setIsOrdering(false);
    }
  };

  const getTelegramShareUrl = () => {
    const text = encodeURIComponent(
      `🛍 Заказ #${createdOrderId || 'Новый'}\n` +
      `👤 Покупатель: ${customerName}\n` +
      `📞 Телефон: ${phone}\n` +
      `📍 Адрес: ${address}\n` +
      `💰 Итого: ${formatPrice(finalPrice)}\n` +
      `💳 Оплата Click: ${cardNumber}\n` +
      `📦 Состав заказа:\n` +
      items.map(i => `• ${i.product.name} (x${i.quantity})`).join('\n')
    );
    return `https://t.me/Sir_lerman?text=${text}`;
  };

  if (items.length === 0 && !isCheckoutModalOpen) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center pb-24">
        <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-950/50 rounded-full flex items-center justify-center mb-4 text-indigo-600 dark:text-indigo-400 animate-pulse">
          <ShoppingBag className="w-10 h-10" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Ваша корзина пуста</h2>
        <p className="text-xs text-slate-500 max-w-xs mb-6">
          Посмотрите наш каталог смартфонов и полезных аксессуаров, чтобы добавить товары
        </p>
        <button
          onClick={onOpenHome}
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-xs rounded-2xl shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2"
        >
          <span>Перейти к покупкам</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col pb-28 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black text-slate-900 dark:text-white">Корзина</h1>
          <span className="text-xs text-slate-400">{totalCount} {totalCount === 1 ? 'товар' : 'товаров'}</span>
        </div>
        <button
          onClick={clearCart}
          className="text-xs font-semibold text-rose-500 hover:text-rose-600 flex items-center gap-1 p-1.5"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Очистить</span>
        </button>
      </div>

      {/* Items list */}
      <div className="p-4 space-y-3">
        {items.map(item => (
          <div
            key={item.productId}
            className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm"
          >
            {/* Image */}
            <div 
              onClick={() => onOpenProductDetails(item.product)}
              className="w-16 h-16 bg-slate-100 dark:bg-slate-900 rounded-xl overflow-hidden flex-shrink-0 cursor-pointer"
            >
              <img src={item.product.image} alt={item.product.name} className="w-full h-full object-cover" />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div 
                onClick={() => onOpenProductDetails(item.product)}
                className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400"
              >
                {item.product.name}
              </div>
              <div className="text-[11px] text-slate-400 uppercase tracking-wider mt-0.5">
                {item.product.brand}
              </div>
              <div className="text-xs font-black text-slate-900 dark:text-white mt-1">
                {formatPrice(item.product.price * item.quantity)}
              </div>
            </div>

            {/* Quantity Controls */}
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900/90 rounded-xl p-1">
              <button
                onClick={() => updateQuantity(item.productId, -1)}
                className="p-1 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
              >
                {item.quantity === 1 ? <Trash2 className="w-3.5 h-3.5 text-rose-500" /> : <Minus className="w-3.5 h-3.5" />}
              </button>
              <span className="text-xs font-bold w-5 text-center text-slate-900 dark:text-white">
                {item.quantity}
              </span>
              <button
                onClick={() => updateQuantity(item.productId, 1)}
                className="p-1 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Promo code */}
      <div className="px-4 py-2">
        <div className="p-3.5 bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Промокод на скидку:</span>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={promoCode}
              onChange={(e) => {
                setPromoCode(e.target.value.toUpperCase());
                setPromoError('');
              }}
              placeholder="Введите промокод (например: SHAX-CD6G)"
              className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs uppercase font-bold outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="button"
              disabled={isValidatingPromo || !promoCode.trim()}
              onClick={applyPromo}
              className="px-4 py-2 bg-indigo-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 active:scale-95 transition-all"
            >
              {isValidatingPromo ? '...' : 'Применить'}
            </button>
          </div>
          {promoApplied && (
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Промокод <b>{appliedPromoCode}</b> применен! Скидка {discountPercent}% (-{formatPrice(discountAmount)})
            </div>
          )}
          {promoError && (
            <div className="text-[11px] text-rose-500 font-semibold">{promoError}</div>
          )}
        </div>
      </div>

      {/* Order Summary */}
      <div className="p-4 space-y-2 text-xs">
        <div className="bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 space-y-2">
          <div className="flex justify-between text-slate-500">
            <span>Сумма товаров ({totalCount} шт.):</span>
            <span className="font-semibold text-slate-900 dark:text-white">{formatPrice(totalPrice)}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
              <span>Скидка по промокоду ({discountPercent}%):</span>
              <span>-{formatPrice(discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between text-slate-500">
            <span>Самовывоз / Доставка:</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">Бесплатно</span>
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex justify-between items-baseline text-sm">
            <span className="font-bold text-slate-900 dark:text-white">Итого к оплате:</span>
            <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">
              {formatPrice(finalPrice)}
            </span>
          </div>
        </div>
      </div>

      {/* Fixed Sticky Checkout Button */}
      <div className="fixed bottom-16 left-0 right-0 max-w-md mx-auto p-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 z-30">
        <button
          onClick={() => setIsCheckoutModalOpen(true)}
          className="w-full py-3.5 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black text-xs shadow-lg shadow-indigo-600/30 flex items-center justify-between transition-all"
        >
          <span>Оформить заказ и оплатить</span>
          <span className="bg-indigo-700 px-3 py-1 rounded-xl">{formatPrice(finalPrice)}</span>
        </button>
      </div>

      {/* Checkout Modal */}
      {isCheckoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl p-5 max-h-[92vh] overflow-y-auto shadow-2xl border-t sm:border border-slate-200 dark:border-slate-800 animate-slideUp">
            {orderSuccess ? (
              <div className="py-5 text-center space-y-3.5">
                <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto animate-bounce" />
                <h3 className="text-lg font-black text-slate-900 dark:text-white">Заказ успешно отправлен!</h3>
                
                {/* Call Manager Banner */}
                <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800 text-left space-y-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/20">
                      <PhoneCall className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">Позвонить менеджеру</div>
                      <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">+998 33 636 80 00</div>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-tight">
                    Пожалуйста, позвоните нашему менеджеру для моментального подтверждения и согласования доставки!
                  </p>
                  <a
                    href="tel:+998336368000"
                    className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/30 transition-all"
                  >
                    <PhoneCall className="w-4 h-4" />
                    <span>📞 Позвонить менеджеру: +998 33 636 80 00</span>
                  </a>
                </div>

                <div className="space-y-2 pt-1">
                  <a
                    href={getTelegramShareUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 px-4 rounded-xl bg-sky-500 hover:bg-sky-600 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-sky-500/30 transition-all"
                  >
                    <Send className="w-4 h-4" />
                    <span>💬 Отправить чек в Telegram (@Sir_lerman)</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => {
                      setIsCheckoutModalOpen(false);
                      setOrderSuccess(false);
                      setPromoCode('');
                      setDiscountPercent(0);
                      setAppliedPromoCode(null);
                      setPromoApplied(false);
                    }}
                    className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs"
                  >
                    Закрыть
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCheckoutSubmit} className="space-y-3.5 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Truck className="w-5 h-5 text-indigo-600" />
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Оформление и оплата Click</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCheckoutModalOpen(false)}
                    className="p-1 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                      ФИО получателя:
                    </label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Иван Иванов"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                      Контактный телефон:
                    </label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!val.startsWith('+998')) {
                          setPhone('+998 ');
                        } else {
                          setPhone(val);
                        }
                      }}
                      placeholder="+998 90 000-00-00"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                      Адрес доставки:
                    </label>
                    <input
                      type="text"
                      required
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="г. Термез, ул. Алишера Навои, 2м"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                    />
                  </div>
                </div>

                {/* Click Payment Card Box */}
                <div className="p-3.5 bg-gradient-to-br from-indigo-50 via-slate-50 to-purple-50 dark:from-slate-800 dark:to-indigo-950/40 rounded-2xl border border-indigo-200 dark:border-indigo-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-indigo-700 dark:text-indigo-300">
                      <CreditCard className="w-4 h-4" />
                      <span>Оплата через Click / Карту:</span>
                    </div>
                    <span className="text-[10px] bg-indigo-600 text-white font-bold px-2 py-0.5 rounded-md">
                      CLICK
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">Номер карты для перевода:</span>
                      <span className="font-mono font-bold text-sm tracking-wider text-slate-900 dark:text-white">
                        {cardNumber}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={copyCard}
                      className="px-2.5 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 font-bold text-[10px] flex items-center gap-1 hover:bg-indigo-100 transition-all active:scale-95"
                    >
                      {copiedCard ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedCard ? 'Скопировано' : 'Копировать'}</span>
                    </button>
                  </div>

                  <p className="text-[10px] text-slate-500 leading-tight">
                    ℹ️ Переведите <strong>{formatPrice(finalPrice)}</strong> по номеру карты через Click и нажмите подтверждение.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isOrdering}
                    className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Я оплатил(а) заказ • {formatPrice(finalPrice)}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
