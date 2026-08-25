import React, { createContext, useContext, useState, useEffect } from 'react';
import { Bell, X, ArrowRight } from 'lucide-react';
import { Order } from '../types';
import { useAuth } from './AuthContext';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  orderId?: number;
  customerName?: string;
  phone?: string;
  totalPrice?: number;
  createdAt: string;
  isRead: boolean;
}

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  notifyNewOrder: (order: Order) => void;
  markAsRead: (id: string) => void;
  clearAll: () => void;
  activeToast: AppNotification | null;
  dismissToast: () => void;
  onNavigateToOrders?: () => void;
  setOnNavigateToOrders: (cb: () => void) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Web Audio API synthesized pleasant chime
function playNotificationSound() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    // High note followed by higher note (pleasant shop chime)
    const now = ctx.currentTime;
    
    // Note 1 (E5 - 659.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);

    // Note 2 (A5 - 880 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.15);
    gain2.gain.setValueAtTime(0.4, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.55);
  } catch (e) {
    console.error('Audio chime error:', e);
  }
}

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    const saved = localStorage.getItem('app_notifications');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeToast, setActiveToast] = useState<AppNotification | null>(null);
  const [navigateCallback, setNavigateCallback] = useState<(() => void) | undefined>(undefined);

  useEffect(() => {
    localStorage.setItem('app_notifications', JSON.stringify(notifications));
  }, [notifications]);

  // Listen to cross-tab / window storage events
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'last_order_broadcast' && e.newValue) {
        try {
          const order: Order = JSON.parse(e.newValue);
          triggerAdminAlert(order);
        } catch (err) {}
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [currentUser]);

  const triggerAdminAlert = (order: Order) => {
    const newNotif: AppNotification = {
      id: Date.now().toString(),
      title: '🔔 Новый заказ в магазине!',
      message: `Покупатель ${order.customerName} (${order.phone}) оформил заказ на сумму ${order.totalPrice.toLocaleString('ru-RU')} ₽. Требуется проверка оплаты Click.`,
      orderId: order.id,
      customerName: order.customerName,
      phone: order.phone,
      totalPrice: order.totalPrice,
      createdAt: new Date().toISOString(),
      isRead: false
    };

    setNotifications(prev => [newNotif, ...prev]);
    setActiveToast(newNotif);

    // Audio chime & Android vibration
    playNotificationSound();
    if (navigator.vibrate) {
      navigator.vibrate([150, 100, 250]);
    }

    // Auto-dismiss toast after 7 seconds
    setTimeout(() => {
      setActiveToast(prev => (prev?.id === newNotif.id ? null : prev));
    }, 7000);
  };

  const notifyNewOrder = (order: Order) => {
    localStorage.setItem('last_order_broadcast', JSON.stringify(order));
    triggerAdminAlert(order);
  };

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const dismissToast = () => {
    setActiveToast(null);
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        notifyNewOrder,
        markAsRead,
        clearAll,
        activeToast,
        dismissToast,
        onNavigateToOrders: navigateCallback,
        setOnNavigateToOrders: (cb) => setNavigateCallback(() => cb)
      }}
    >
      {children}

      {/* Floating Push-Style Top Banner / Toast Notification */}
      {activeToast && (
        <div className="fixed top-3 left-3 right-3 max-w-md mx-auto z-50 animate-bounce">
          <div className="bg-slate-900/95 dark:bg-indigo-950/95 text-white p-4 rounded-2xl shadow-2xl border border-indigo-500/40 backdrop-blur-md flex items-start gap-3">
            <div className="p-2 bg-indigo-600 rounded-xl text-white flex-shrink-0 animate-pulse">
              <Bell className="w-5 h-5" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h4 className="font-black text-xs text-amber-300 uppercase tracking-wide">
                  {activeToast.title}
                </h4>
                <button
                  onClick={dismissToast}
                  className="p-1 text-slate-400 hover:text-white rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-slate-200 mt-1 leading-snug">
                {activeToast.message}
              </p>

              {navigateCallback && (
                <button
                  onClick={() => {
                    navigateCallback();
                    dismissToast();
                  }}
                  className="mt-2.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-[11px] rounded-xl flex items-center gap-1.5 shadow-md shadow-indigo-600/40 transition-all"
                >
                  <span>Открыть заказ</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
};

export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
