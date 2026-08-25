import React, { useState } from 'react';
import { X, CheckCircle2, Zap, ShieldCheck, Copy, Check, CreditCard, Send } from 'lucide-react';
import { Product } from '../types';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { api } from '../services/api';
import { formatPrice } from '../utils/format';

interface InstantBuyModalProps {
  product: Product | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const InstantBuyModal: React.FC<InstantBuyModalProps> = ({
  product,
  onClose,
  onSuccess
}) => {
  const { currentUser } = useAuth();
  const { notifyNewOrder } = useNotifications();
  const [customerName, setCustomerName] = useState(
    currentUser ? `${currentUser.first_name} ${currentUser.last_name || ''}`.trim() : ''
  );
  const [phone, setPhone] = useState(currentUser?.phone_number || '');
  const [address, setAddress] = useState('г. Термез, ул. Алишера Навои, 2м');
  const [copied, setCopied] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdOrderId, setCreatedOrderId] = useState<number | null>(null);

  if (!product) return null;

  const cardNumber = '8600041778281007';

  const copyCard = () => {
    navigator.clipboard.writeText(cardNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !phone) return;

    setIsSubmitting(true);
    try {
      const orderData = {
        userId: currentUser?.id || 0,
        items: [
          {
            productId: product.id,
            name: product.name,
            price: product.price,
            quantity: 1,
            image: product.image
          }
        ],
        totalPrice: product.price,
        status: 'awaiting_payment' as const,
        createdAt: new Date().toISOString(),
        customerName,
        phone,
        address,
        paymentCard: cardNumber,
        paymentMethod: 'Click / Payme'
      };

      // Create order via API (saves to central server and local database)
      const savedOrder = await api.createOrder(orderData);
      setCreatedOrderId(savedOrder.id || null);

      // Trigger instant audio chime & push notification
      notifyNewOrder(savedOrder);

      setIsSuccess(true);
    } catch (e) {
      console.error('Ошибка при создании заказа:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Pre-filled Telegram receipt link for admin
  const getTelegramShareUrl = () => {
    const text = encodeURIComponent(
      `🛍 Заказ #${createdOrderId || 'Новый'}\n` +
      `👤 Клиент: ${customerName}\n` +
      `📞 Телефон: ${phone}\n` +
      `📍 Адрес: ${address}\n` +
      `💰 Сумма: ${formatPrice(product.price)}\n` +
      `💳 Оплата Click: ${cardNumber}\n` +
      `📦 Товар: ${product.name}`
    );
    return `https://t.me/Sir_lerman?text=${text}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl p-5 max-h-[92vh] overflow-y-auto shadow-2xl border-t sm:border border-slate-200 dark:border-slate-800 transition-colors animate-slideUp">
        {isSuccess ? (
          <div className="py-6 text-center space-y-4">
            <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto animate-bounce" />
            <h3 className="text-xl font-black text-slate-900 dark:text-white">Заказ отправлен на сервер!</h3>
            
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/60 rounded-2xl border border-indigo-200 dark:border-indigo-800 text-xs text-slate-700 dark:text-slate-300 space-y-1 text-left">
              <p className="font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                <span>⏳ Ожидается проверка оплаты администратором</span>
              </p>
              <p className="text-[11px] text-slate-500">
                Администратор получил уведомление о вашем заказе (проверка до 10 минут). После подтверждения вам поступит оповещение.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <a
                href={getTelegramShareUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 px-4 rounded-2xl bg-sky-500 hover:bg-sky-600 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-sky-500/30 transition-all"
              >
                <Send className="w-4 h-4" />
                <span>Отправить чек менеджеру в Telegram</span>
              </a>

              <button
                type="button"
                onClick={() => {
                  onSuccess();
                  onClose();
                }}
                className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs"
              >
                Закрыть
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 rounded-xl text-indigo-600 dark:text-indigo-400">
                  <Zap className="w-5 h-5 fill-current" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Быстрый заказ и оплата</h3>
                  <p className="text-[10px] text-slate-500">Оплата через Click / перевод на карту</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Product mini card */}
            <div className="flex items-center gap-3 p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
              <img src={product.image} alt="" className="w-12 h-12 rounded-xl object-cover" />
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-slate-800 dark:text-slate-200 truncate">{product.name}</h4>
                <div className="text-xs font-black text-indigo-600 dark:text-indigo-400 mt-0.5">
                  {formatPrice(product.price)}
                </div>
              </div>
            </div>

            {/* Client Inputs */}
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
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                Номер телефона:
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+998 90 000-00-00"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
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
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
              />
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
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Скопировано' : 'Копировать'}</span>
                </button>
              </div>

              <p className="text-[10px] text-slate-500 leading-tight">
                ℹ️ Переведите <strong>{formatPrice(product.price)}</strong> по указанному номеру карты через Click и нажмите кнопку подтверждения ниже.
              </p>
            </div>

            <div className="pt-1">
              <button
                type="submit"
                disabled={isSubmitting || !customerName || !phone}
                className="w-full py-3.5 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black text-xs shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Я оплатил(а) заказ • {formatPrice(product.price)}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
