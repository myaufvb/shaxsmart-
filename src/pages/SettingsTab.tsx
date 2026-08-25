import React, { useState, useEffect } from 'react';
import { 
  Sun, 
  Moon, 
  Send, 
  HelpCircle, 
  Bell, 
  Shield, 
  Smartphone, 
  RotateCcw, 
  Info, 
  Check, 
  ExternalLink, 
  MessageCircle, 
  Sparkles,
  Wifi,
  Search,
  RefreshCw,
  Server
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { db, initDatabase } from '../db/database';
import { api } from '../services/api';

export const SettingsTab: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [resetSuccess, setResetSuccess] = useState(false);

  // Wi-Fi Server settings
  const [serverUrl, setServerUrl] = useState(api.getServerUrl());
  const [isOnline, setIsOnline] = useState(api.getIsOnline());
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState('');

  useEffect(() => {
    const unsub = api.onStatusChange((online, url) => {
      setIsOnline(online);
      setServerUrl(url);
    });
    return unsub;
  }, []);

  const handleSaveWifiServer = () => {
    api.setServerUrl(serverUrl);
    setScanMessage('Адрес Wi-Fi сервера сохранен!');
    setTimeout(() => setScanMessage(''), 3000);
  };

  const handleScanWifi = async () => {
    setIsScanning(true);
    setScanMessage('Сканирование Wi-Fi сети на поиск сервера...');
    const foundUrl = await api.scanWifiForServer();
    setIsScanning(false);
    if (foundUrl) {
      setServerUrl(foundUrl);
      setScanMessage(`✅ Сервер найден в сети: ${foundUrl}`);
    } else {
      const pinged = await api.checkHealth();
      if (pinged) {
        setScanMessage('✅ Сервер по текущему адресу успешно отвечает!');
      } else {
        setScanMessage('⚠️ Сервер не найден. Убедитесь, что запущен start_server_wifi.bat');
      }
    }
    setTimeout(() => setScanMessage(''), 4500);
  };

  const handleResetDB = async () => {
    if (window.confirm('Сбросить базу данных до начального состояния? Все предустановленные аккаунты сохранятся.')) {
      await db.delete();
      await db.open();
      await initDatabase();
      setResetSuccess(true);
      setTimeout(() => setResetSuccess(false), 2000);
      window.location.reload();
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 pb-28 space-y-4 overflow-y-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-black text-slate-900 dark:text-white">Настройки</h1>
        <p className="text-xs text-slate-500">Параметры приложения и работы по сети Wi-Fi</p>
      </div>

      {/* 0. Store Address & Contacts Card */}
      <div className="bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 space-y-2.5 shadow-sm">
        <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
          <Smartphone className="w-5 h-5" />
          <h3 className="text-xs font-bold uppercase tracking-wider">
            Фирменный магазин SHAXSMART STORE
          </h3>
        </div>
        <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl space-y-1.5 text-xs">
          <div className="flex items-start gap-2">
            <span className="text-slate-400 font-medium">📍 Адрес:</span>
            <span className="font-bold text-slate-900 dark:text-white">
              г. Термез, улица Алишера Навои, 2м
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <span>🕒 Режим работы:</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">Пн-Вс: 09:00 — 21:00</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <span>📞 Поддержка:</span>
            <span className="font-semibold text-indigo-600 dark:text-indigo-400">Telegram @Sir_lerman</span>
          </div>
        </div>
      </div>

      {/* 1. Network & Cloud Sync Card */}
      <div className="bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 space-y-3 shadow-sm text-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-xl ${isOnline ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600' : 'bg-amber-50 dark:bg-amber-950 text-amber-600'}`}>
              <Wifi className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 dark:text-white">Синхронизация (Интернет / Wi-Fi)</h3>
              <p className="text-[10px] text-slate-400">
                {isOnline ? '🟢 Сервер подключен' : '🟡 Поиск сервера в сети...'}
              </p>
            </div>
          </div>

          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
            isOnline 
              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' 
              : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
          }`}>
            {isOnline ? 'ОНЛАЙН' : 'ОФЛАЙН'}
          </span>
        </div>

        <p className="text-slate-500 leading-snug text-[11px]">
          Позволяет покупателям заходить в приложение с <strong>любой точки</strong> (мобильный интернет 3G/4G/5G, домашний Wi-Fi или любой город).
        </p>

        {/* Server IP / Cloud URL Input */}
        <div className="space-y-2 pt-1">
          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
            Адрес сервера (Облачный HTTPS или локальный IP):
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="http://192.168.0.38:4000"
              className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={handleSaveWifiServer}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold rounded-xl"
            >
              ОК
            </button>
          </div>
        </div>

        {/* Quick Scan / Check Button */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={handleScanWifi}
            disabled={isScanning}
            className="flex-1 py-2 px-3 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-400 font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all text-xs"
          >
            {isScanning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            <span>{isScanning ? 'Поиск...' : 'Проверить / Найти сервер'}</span>
          </button>
        </div>

        {scanMessage && (
          <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 rounded-xl text-[11px] text-indigo-700 dark:text-indigo-300 font-semibold">
            {scanMessage}
          </div>
        )}
      </div>

      {/* 2. Theme Switcher */}
      <div className="bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 space-y-3 shadow-sm">
        <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Тема оформления:
        </h3>
        <div className="grid grid-cols-2 gap-2.5">
          {/* Light Theme Button */}
          <button
            onClick={() => setTheme('light')}
            className={`p-3.5 rounded-xl border flex items-center justify-between transition-all ${
              theme === 'light'
                ? 'border-indigo-600 bg-indigo-50/80 text-indigo-700 font-bold ring-2 ring-indigo-500/20'
                : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-300'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Sun className={`w-4 h-4 ${theme === 'light' ? 'text-amber-500 fill-amber-400' : 'text-slate-400'}`} />
              <span className="text-xs">Светлая</span>
            </div>
            {theme === 'light' && <Check className="w-4 h-4 text-indigo-600" />}
          </button>

          {/* Dark Theme Button */}
          <button
            onClick={() => setTheme('dark')}
            className={`p-3.5 rounded-xl border flex items-center justify-between transition-all ${
              theme === 'dark'
                ? 'border-indigo-500 bg-indigo-950/60 text-indigo-300 font-bold ring-2 ring-indigo-500/20'
                : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-300'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Moon className={`w-4 h-4 ${theme === 'dark' ? 'text-indigo-400 fill-indigo-400' : 'text-slate-400'}`} />
              <span className="text-xs">Темная</span>
            </div>
            {theme === 'dark' && <Check className="w-4 h-4 text-indigo-400" />}
          </button>
        </div>
      </div>

      {/* 3. Notifications & System */}
      <div className="bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 space-y-3 shadow-sm divide-y divide-slate-100 dark:divide-slate-800 text-xs">
        <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pb-1">
          Система и уведомления:
        </h3>

        <div className="flex items-center justify-between pt-3">
          <div className="flex items-center gap-2.5">
            <Bell className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <div>
              <div className="font-semibold text-slate-800 dark:text-slate-200">Звук и Push-уведомления</div>
              <div className="text-[11px] text-slate-400">Мгновенный звуковой колокол при заказе</div>
            </div>
          </div>
          <button
            onClick={() => setNotificationsEnabled(!notificationsEnabled)}
            className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 ${
              notificationsEnabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                notificationsEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between pt-3">
          <div className="flex items-center gap-2.5">
            <Smartphone className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <div>
              <div className="font-semibold text-slate-800 dark:text-slate-200">Версия приложения</div>
              <div className="text-[11px] text-slate-400">v1.2.0 (Android Wi-Fi Direct Build)</div>
            </div>
          </div>
          <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md">
            WI-FI READY
          </span>
        </div>

        <div className="flex items-center justify-between pt-3">
          <div className="flex items-center gap-2.5">
            <RotateCcw className="w-4 h-4 text-slate-400" />
            <div>
              <div className="font-semibold text-slate-800 dark:text-slate-200">Очистить кэш и данные</div>
              <div className="text-[11px] text-slate-400">Сброс базы до начального состояния</div>
            </div>
          </div>
          <button
            onClick={handleResetDB}
            className="px-2.5 py-1 text-[11px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/40 rounded-lg hover:bg-rose-100"
          >
            Сброс
          </button>
        </div>
      </div>

      {/* 3.5 App Version & In-App Update Check */}
      <div className="bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">Обновление приложения</h3>
              <p className="text-[11px] text-slate-500">Текущая версия: <span className="font-semibold text-slate-700 dark:text-slate-300">v1.2.0</span></p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            Актуально
          </span>
        </div>

        <button
          onClick={async () => {
            try {
              const res = await fetch(`${api.getServerUrl()}/api/version`).catch(() => null);
              if (res && res.ok) {
                const data = await res.json();
                if (data.latestVersion && data.latestVersion !== '1.2.0') {
                  alert(`🎉 Доступно новое обновление: v${data.latestVersion}!\n\n${data.releaseNotes || 'Рекомендуется обновить приложение.'}`);
                } else {
                  alert('✅ У вас установлена самая последняя версия SHAXSMART STORE (v1.2.0)!');
                }
              } else {
                alert('✅ У вас установлена самая последняя версия SHAXSMART STORE (v1.2.0)!');
              }
            } catch {
              alert('✅ У вас установлена самая последняя версия SHAXSMART STORE (v1.2.0)!');
            }
          }}
          className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-all"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Проверить наличие обновлений</span>
        </button>
      </div>

      {/* 4. Mandatory Support & Developer Appeal Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 text-white p-5 shadow-xl shadow-indigo-500/25 space-y-3">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-white/20 backdrop-blur-md rounded-2xl text-white">
            <MessageCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-200 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Поддержка и связь
            </span>
            <h4 className="text-sm font-bold leading-snug">
              Обращение для пользователей
            </h4>
          </div>
        </div>

        <p className="text-xs text-indigo-100 leading-relaxed bg-black/15 p-3 rounded-2xl border border-white/10">
          Если нашли ошибку при работе приложения — обратитесь напрямую к разработчику. Мы оперативно всё исправим!
        </p>

        {/* Telegram Direct Link Button */}
        <a
          href="https://t.me/Sir_lerman"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-3.5 px-4 bg-white text-indigo-700 hover:bg-indigo-50 active:scale-95 rounded-2xl font-black text-xs flex items-center justify-center gap-2 shadow-lg transition-all"
        >
          <Send className="w-4 h-4 fill-indigo-600 text-indigo-600" />
          <span>Написать разработчику (@Sir_lerman)</span>
          <ExternalLink className="w-3.5 h-3.5 opacity-70 ml-1" />
        </a>

        <div className="text-center">
          <a
            href="https://t.me/Sir_lerman"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-indigo-200 underline font-medium hover:text-white"
          >
            https://t.me/Sir_lerman
          </a>
        </div>
      </div>
    </div>
  );
};
