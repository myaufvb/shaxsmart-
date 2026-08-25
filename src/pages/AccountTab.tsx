import React, { useState, useEffect } from 'react';
import { 
  User as UserIcon, 
  Shield, 
  Code2, 
  Lock, 
  Phone, 
  Check, 
  LogOut, 
  Plus, 
  Eye, 
  EyeOff, 
  Sparkles,
  RefreshCw,
  Trash2,
  Clock,
  CheckCircle2,
  XCircle,
  Package,
  PhoneCall,
  Smartphone,
  CheckSquare,
  Square,
  AlertTriangle,
  UploadCloud,
  DollarSign,
  Radio,
  Server,
  Send,
  Camera,
  Image as ImageIcon,
  Upload,
  Key,
  Edit3,
  UserCheck,
  UserX,
  FileText,
  AlertCircle,
  Smile,
  X,
  Gift,
  Copy,
  Tag
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { UserRole, Product, Order, OrderStatus, PhoneOS, ItemCondition, ProfileChangeRequest, ProfileChangeRequestType, User, PromoCode, VariantAttribute, ProductVariant } from '../types';
import { db, CATEGORIES_LIST } from '../db/database';
import { api } from '../services/api';
import { formatPrice, USD_TO_UZS_DEFAULT_RATE, convertUsdToUzs } from '../utils/format';
import { UserAvatar, isVideoAvatar, isAnimatedAvatar } from '../components/UserAvatar';

// Helper to compress images from phone gallery / camera
const compressImageFile = (file: File, maxDim: number = 800): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height *= maxDim / width;
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width *= maxDim / height;
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          resolve(dataUrl);
        } else {
          resolve(event.target?.result as string);
        }
      };
      img.onerror = reject;
      img.src = event.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const ANIMATED_AVATARS = [
  { name: 'Киберпанк Неон', url: 'https://media.giphy.com/media/26tn33aiTi1jkl6H6/giphy.gif' },
  { name: 'Голограмма', url: 'https://media.giphy.com/media/L1R1tvI9svkIWwpVYr/giphy.gif' },
  { name: '3D Жидкая Волна', url: 'https://media.giphy.com/media/xT9IgzoKnwFNmISR8I/giphy.gif' },
  { name: 'Матрица Код', url: 'https://media.giphy.com/media/3oKIPnAiaMCws8nOsE/giphy.gif' },
  { name: 'Неоновые Линии', url: 'https://media.giphy.com/media/3o7TKTDnUxE0g2fSE8/giphy.gif' },
  { name: 'Кибер Робот', url: 'https://media.giphy.com/media/3o7btQ8jDTPGDpgc6I/giphy.gif' },
  { name: 'Портал Галактика', url: 'https://media.giphy.com/media/l41lI4bYmcsPJX9Go/giphy.gif' },
  { name: 'Пиксельный Огонь', url: 'https://media.giphy.com/media/xT0xeJpnrWC4XWblEk/giphy.gif' }
];

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=250&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=250&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=250&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=250&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1628157582853-a796fa650a6a?w=250&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=250&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=250&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=250&auto=format&fit=crop&q=80'
];

export const AccountTab: React.FC = () => {
  const { currentUser, login, verify2FA, resend2FA, register, logout, allUsers, reloadUsers, updateAvatar, updateNickname } = useAuth();
  const { notifications, notifyNewOrder } = useNotifications();

  // Helper to read initial state from localStorage
  const getSavedRegForm = () => {
    try {
      const saved = localStorage.getItem('reg_form');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  };

  const initialForm = getSavedRegForm();

  // Auth form states
  const [authMode, setAuthMode] = useState<'login' | 'register'>(initialForm ? 'register' : 'login');
  const [loginInput, setLoginInput] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // 2FA Security Modal States
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [twoFaSessionId, setTwoFaSessionId] = useState('');
  const [twoFaRole, setTwoFaRole] = useState<string>('');
  const [twoFaUserName, setTwoFaUserName] = useState<string>('');
  const [twoFaCode, setTwoFaCode] = useState('');
  const [twoFaTimer, setTwoFaTimer] = useState(180);
  const [isVerifying2FA, setIsVerifying2FA] = useState(false);
  const [isResending2FA, setIsResending2FA] = useState(false);
  const [twoFaError, setTwoFaError] = useState('');
  const [twoFaSuccessMsg, setTwoFaSuccessMsg] = useState('');

  // Register form fields (lazy initialized from localStorage)
  const [firstName, setFirstName] = useState(initialForm?.firstName || '');
  const [lastName, setLastName] = useState(initialForm?.lastName || '');
  const [regPhone, setRegPhone] = useState(initialForm?.regPhone || '+998 ');
  const [regPassword, setRegPassword] = useState(initialForm?.regPassword || '');
  const [regPasswordConfirm, setRegPasswordConfirm] = useState(initialForm?.regPasswordConfirm || '');
  const [agreedToTerms, setAgreedToTerms] = useState(initialForm?.agreedToTerms || false);

  // Customer Telegram Verification
  const [telegramVerifyCode, setTelegramVerifyCode] = useState('');
  const [isTelegramVerified, setIsTelegramVerified] = useState(false);
  const [isRequestingCode, setIsRequestingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [codeSent, setCodeSent] = useState(initialForm?.codeSent || false);

  // Password visibility toggles
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegPasswordConfirm, setShowRegPasswordConfirm] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 2FA Countdown Timer Effect
  useEffect(() => {
    let interval: any;
    if (show2FAModal && twoFaTimer > 0) {
      interval = setInterval(() => {
        setTwoFaTimer(prev => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [show2FAModal, twoFaTimer]);

  // Admin & Dev states
  const [adminTab, setAdminTab] = useState<'orders' | 'products' | 'users' | 'requests' | 'server' | 'promocodes'>('orders');
  const [ordersList, setOrdersList] = useState<Order[]>([]);
  const [productsList, setProductsList] = useState<Product[]>([]);
  const [requestsList, setRequestsList] = useState<ProfileChangeRequest[]>([]);
  const [promoCodesList, setPromoCodesList] = useState<PromoCode[]>([]);
  const [serverOnline, setServerOnline] = useState<boolean>(false);
  const [serverUrlInput, setServerUrlInput] = useState<string>(api.getServerUrl());

  // Promo Code Generator Form
  const [promoPercentInput, setPromoPercentInput] = useState<number>(20);
  const [promoMinSumInput, setPromoMinSumInput] = useState<string>('0');
  const [promoCustomCodeInput, setPromoCustomCodeInput] = useState<string>('');
  const [isGeneratingPromo, setIsGeneratingPromo] = useState<boolean>(false);
  const [copiedPromoId, setCopiedPromoId] = useState<number | null>(null);

  // Developer Instant Nickname Modal
  const [showDevNickModal, setShowDevNickModal] = useState<boolean>(false);
  const [devNewFirstName, setDevNewFirstName] = useState<string>('');
  const [devNewLastName, setDevNewLastName] = useState<string>('');
  const [isSavingDevNick, setIsSavingDevNick] = useState<boolean>(false);

  // Avatar Modal State
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [avatarTab, setAvatarTab] = useState<'animated' | 'static'>('animated');
  const [avatarUrlInput, setAvatarUrlInput] = useState('');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // Developer Modals
  const [devPasswordModalUser, setDevPasswordModalUser] = useState<User | null>(null);
  const [devNewPassword, setDevNewPassword] = useState('');

  // User Profile Change Request Modal
  const [showUserRequestModal, setShowUserRequestModal] = useState<ProfileChangeRequestType | null>(null);
  const [requestNewValue, setRequestNewValue] = useState('');
  const [requestNewLastName, setRequestNewLastName] = useState('');

  // Add / Edit Product Modal Form States
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState('Layers');
  const [categoriesListState, setCategoriesListState] = useState(CATEGORIES_LIST);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('electronics');
  
  // Phone specific fields
  const [phoneOS, setPhoneOS] = useState<PhoneOS>('android');
  const [phoneCondition, setPhoneCondition] = useState<ItemCondition>('new');
  const [phoneModel, setPhoneModel] = useState('');
  const [phoneColor, setPhoneColor] = useState('');
  const [phoneStorage, setPhoneStorage] = useState('128 ГБ');
  const [phoneRam, setPhoneRam] = useState('8 ГБ');
  const [batteryHealth, setBatteryHealth] = useState('100%');
  
  // Package checklist
  const [pkgCable, setPkgCable] = useState(true);
  const [pkgBlock, setPkgBlock] = useState(true);
  const [pkgCase, setPkgCase] = useState(false);
  const [pkgHeadphones, setPkgHeadphones] = useState(false);

  // Photos from device (gallery / camera) or URLs (up to 4)
  const [devicePhotos, setDevicePhotos] = useState<string[]>([]);
  const [photoUrlInput, setPhotoUrlInput] = useState('');
  const [isCompressingPhoto, setIsCompressingPhoto] = useState(false);

  // General fields for all items
  const [generalName, setGeneralName] = useState('');
  const [generalBrand, setGeneralBrand] = useState('');
  const [generalDesc, setGeneralDesc] = useState('');

  // Currency & Price States
  const [priceCurrency, setPriceCurrency] = useState<'uzs' | 'usd'>('uzs');
  const [inputPrice, setInputPrice] = useState('');
  const [usdRate, setUsdRate] = useState(USD_TO_UZS_DEFAULT_RATE.toString());

  // Stock Quantity State (для Управления Наличием Склада)
  const [stockQuantityInput, setStockQuantityInput] = useState<string>('5');

  // SKU Product Variants State (для Разработчика/Админа)
  const [useVariants, setUseVariants] = useState<boolean>(false);
  const [variantAttrColorText, setVariantAttrColorText] = useState<string>('Черный, Белый, Синий');
  const [variantAttrOptionText, setVariantAttrOptionText] = useState<string>('iPhone 13, iPhone 14 Pro, Samsung S24');
  const [variantOptionName, setVariantOptionName] = useState<string>('Модель');

  // Handle Avatar Selection from Phone Device (Gallery or Camera, Video or GIF)
  const handleDeviceAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAvatar(true);
    try {
      if (
        file.type.startsWith('video/') || 
        file.type === 'image/gif' || 
        file.name.toLowerCase().endsWith('.gif') || 
        file.name.toLowerCase().endsWith('.mp4') || 
        file.name.toLowerCase().endsWith('.webm') ||
        file.name.toLowerCase().endsWith('.mov')
      ) {
        if (file.size > 25 * 1024 * 1024) {
          alert('Пожалуйста, выберите видео или GIF размером до 25 МБ');
          setIsUploadingAvatar(false);
          return;
        }
        const reader = new FileReader();
        reader.onload = async (event) => {
          const dataUrl = event.target?.result as string;
          await updateAvatar(dataUrl);
          setShowAvatarModal(false);
          setIsUploadingAvatar(false);
        };
        reader.readAsDataURL(file);
      } else {
        const compressedBase64 = await compressImageFile(file, 400);
        await updateAvatar(compressedBase64);
        setShowAvatarModal(false);
        setIsUploadingAvatar(false);
      }
    } catch (err) {
      console.error('Ошибка загрузки аватарки:', err);
      setIsUploadingAvatar(false);
    } finally {
      e.target.value = '';
    }
  };

  const handleSelectPresetAvatar = async (url: string) => {
    await updateAvatar(url);
    setShowAvatarModal(false);
  };

  const handleUrlAvatarSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!avatarUrlInput.trim()) return;
    await updateAvatar(avatarUrlInput.trim());
    setAvatarUrlInput('');
    setShowAvatarModal(false);
  };

  const handleRemoveAvatar = async () => {
    await updateAvatar('');
    setShowAvatarModal(false);
  };

  // Handle Photo Selection from Phone Device (Gallery or Camera)
  const handleDevicePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsCompressingPhoto(true);
    const newPhotos: string[] = [...devicePhotos];

    for (let i = 0; i < files.length; i++) {
      if (newPhotos.length >= 4) break;
      try {
        const compressedBase64 = await compressImageFile(files[i], 800);
        newPhotos.push(compressedBase64);
      } catch (err) {
        console.error('Ошибка сжатия фото:', err);
      }
    }

    setDevicePhotos(newPhotos);
    setIsCompressingPhoto(false);
    e.target.value = '';
  };

  const handleRemovePhoto = (index: number) => {
    setDevicePhotos(devicePhotos.filter((_, idx) => idx !== index));
  };

  const handleAddPhotoByUrl = () => {
    if (photoUrlInput.trim() && devicePhotos.length < 4) {
      setDevicePhotos([...devicePhotos, photoUrlInput.trim()]);
      setPhotoUrlInput('');
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadData();
      const interval = setInterval(loadData, 2500); // Live real-time polling
      return () => clearInterval(interval);
    }
  }, [currentUser]);

  const loadData = async () => {
    await reloadUsers();
    
    // Check server status
    const isOnline = await api.checkHealth();
    setServerOnline(isOnline);

    // Fetch live orders
    const orders = await api.getOrders();
    setOrdersList([...orders].reverse());

    // Fetch live products
    const prods = await api.getProducts();
    setProductsList(prods);

    // Fetch live profile change requests
    const reqs = await api.getProfileRequests();
    setRequestsList(reqs);

    // Fetch live promo codes
    const promos = await api.getPromoCodes();
    setPromoCodesList(promos);
  };

  // Promo Code Generator Actions (Developer / Admin)
  const handleGenerateRandomCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let rand = '';
    for (let i = 0; i < 5; i++) rand += chars.charAt(Math.floor(Math.random() * chars.length));
    setPromoCustomCodeInput(`SHAX-${rand}`);
  };

  const handleCreatePromoCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGeneratingPromo(true);
    const res = await api.createPromoCode({
      discountPercent: promoPercentInput,
      minOrderSum: Number(promoMinSumInput) || 0,
      code: promoCustomCodeInput.trim() || undefined,
      createdBy: currentUser?.first_name || 'Разработчик'
    });
    setIsGeneratingPromo(false);

    if (res.success) {
      setPromoCustomCodeInput('');
      await loadData();
      alert(`Одноразовый промокод "${res.promoCode?.code}" на ${res.promoCode?.discountPercent}% успешно создан!`);
    } else {
      alert(res.error || 'Ошибка создания промокода');
    }
  };

  const handleDeletePromoCode = async (promo: PromoCode) => {
    if (window.confirm(`Удалить промокод "${promo.code}"?`)) {
      await api.deletePromoCode(promo.id);
      await loadData();
    }
  };

  const handleCopyPromoCode = (promo: PromoCode) => {
    navigator.clipboard.writeText(promo.code);
    setCopiedPromoId(promo.id);
    setTimeout(() => setCopiedPromoId(null), 2000);
  };

  // Developer Instant Nickname Save Action
  const handleSaveDevNick = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!devNewFirstName.trim()) return;

    setIsSavingDevNick(true);
    const res = await updateNickname(devNewFirstName.trim(), devNewLastName.trim() || undefined);
    setIsSavingDevNick(false);

    if (res.success) {
      setShowDevNickModal(false);
      await loadData();
      alert('Никнейм успешно изменен!');
    } else {
      alert(res.error || 'Ошибка смены ника');
    }
  };

  // Calculate final price in Uzbek Sums
  const calculateFinalPriceInUzs = (): number => {
    const rawVal = parseFloat(inputPrice) || 0;
    if (priceCurrency === 'usd') {
      const rate = parseFloat(usdRate) || USD_TO_UZS_DEFAULT_RATE;
      return convertUsdToUzs(rawVal, rate);
    }
    return Math.round(rawVal);
  };

  // Validation for Registration
  const isNameValid = firstName.trim().length >= 2;
  const isPhoneValid = regPhone.trim().length >= 3;
  const isPasswordValid = regPassword.length >= 4;
  const isPasswordMatch = regPassword === regPasswordConfirm && isPasswordValid;
  const isRegisterFormReady = isNameValid && isPhoneValid && isPasswordValid && isPasswordMatch && agreedToTerms && isTelegramVerified;

  // Save reg form to localStorage (survives app backgrounding)
  const saveRegFormToStorage = () => {
    try {
      localStorage.setItem('reg_form', JSON.stringify({
        firstName, lastName, regPhone, regPassword, regPasswordConfirm, codeSent, agreedToTerms
      }));
    } catch {}
  };

  // Auto-save form values to localStorage whenever they change
  useEffect(() => {
    saveRegFormToStorage();
  }, [firstName, lastName, regPhone, regPassword, regPasswordConfirm, codeSent, agreedToTerms]);

  // Request verification code via Telegram
  const handleRequestTelegramCode = async () => {
    if (regPhone.trim().length < 9) {
      setVerifyError('Сначала введите номер телефона');
      return;
    }
    setIsRequestingCode(true);
    setVerifyError('');
    try {
      const result = await api.requestCustomerCode(regPhone.trim());
      if (result.success) {
        setCodeSent(true);
        // Save form before leaving app
        saveRegFormToStorage();
        // Open Telegram bot
        window.open('https://t.me/shaxsmartadmins_bot', '_blank');
      } else {
        setVerifyError(result.error || 'Ошибка запроса кода');
      }
    } catch {
      setVerifyError('Нет связи с сервером');
    }
    setIsRequestingCode(false);
  };

  // Verify the code received in Telegram
  const handleVerifyTelegramCode = async () => {
    if (!telegramVerifyCode.trim()) {
      setVerifyError('Введите 6-значный код');
      return;
    }
    setIsVerifyingCode(true);
    setVerifyError('');
    try {
      const result = await api.verifyCustomerCode(regPhone.trim(), telegramVerifyCode.trim());
      if (result.success && result.verified) {
        setIsTelegramVerified(true);
        setVerifyError('');
        // Clear saved form - verification done
        localStorage.removeItem('reg_form');
      } else {
        setVerifyError(result.error || 'Неверный код');
      }
    } catch {
      setVerifyError('Нет связи с сервером');
    }
    setIsVerifyingCode(false);
  };
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    const res = await login(loginInput, loginPassword);
    setIsSubmitting(false);

    if (!res.success) {
      setErrorMessage(res.error || 'Неверный логин или пароль');
      return;
    }

    // High Security: 2FA Required for Dev/Admin
    if (res.require2FA) {
      setTwoFaSessionId(res.sessionId || '');
      setTwoFaRole(res.role || '');
      setTwoFaUserName(res.userName || '');
      setTwoFaCode('');
      setTwoFaTimer(180);
      setTwoFaError('');
      setTwoFaSuccessMsg('');
      setShow2FAModal(true);
      return;
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!twoFaCode.trim() || twoFaCode.trim().length < 6) {
      setTwoFaError('Пожалуйста, введите 6 цифр кода из Telegram');
      return;
    }

    setTwoFaError('');
    setIsVerifying2FA(true);
    const res = await verify2FA(twoFaSessionId, twoFaCode.trim());
    setIsVerifying2FA(false);

    if (!res.success) {
      setTwoFaError(res.error || 'Неверный код 2FA');
    } else {
      setShow2FAModal(false);
      setLoginPassword('');
      setTwoFaCode('');
      setSuccessMessage('Успешный 2FA вход в аккаунт!');
      setTimeout(() => setSuccessMessage(''), 4000);
    }
  };

  const handleResend2FA = async () => {
    if (twoFaTimer > 120) return; // Anti spam
    setIsResending2FA(true);
    setTwoFaError('');
    const res = await resend2FA(twoFaSessionId);
    setIsResending2FA(false);

    if (res.success) {
      setTwoFaTimer(180);
      setTwoFaSuccessMsg('Новый код отправлен в ваш Telegram бот!');
      setTimeout(() => setTwoFaSuccessMsg(''), 4000);
    } else {
      setTwoFaError(res.error || 'Ошибка отправки');
    }
  };

  // 2FA Modal Component Renderer
  const render2FAModal = () => {
    if (!show2FAModal) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
        <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-indigo-500/30 dark:border-indigo-500/20 text-center relative overflow-hidden">
          {/* Top decorative glow */}
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-40 h-40 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />

          {/* Icon */}
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-sky-500 flex items-center justify-center shadow-lg shadow-indigo-500/30 mb-4 animate-bounce-subtle">
            <Shield className="w-8 h-8 text-white" />
          </div>

          <h3 className="text-lg font-black text-slate-900 dark:text-white mb-1">
            Двухфакторная защита 2FA
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Вход в аккаунт{' '}
            <span className="font-bold text-indigo-600 dark:text-indigo-400">
              {twoFaRole === 'developer' ? 'Разработчика' : 'Администратора'}
            </span>
          </p>

          {/* Telegram Notice Card */}
          <div className="p-3.5 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 rounded-2xl text-left mb-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-sky-500/30">
              <Send className="w-5 h-5" />
            </div>
            <div className="text-[11px] leading-tight text-slate-700 dark:text-slate-300">
              <div className="font-bold text-sky-600 dark:text-sky-400 mb-0.5">Код отправлен в Telegram!</div>
              <div>Проверьте сообщения от бота <b>@shaxsmartadmins_bot</b></div>
            </div>
          </div>

          {/* Error & Success Messages */}
          {twoFaError && (
            <div className="p-3 mb-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-600 dark:text-red-400 text-xs font-bold animate-shake">
              {twoFaError}
            </div>
          )}
          {twoFaSuccessMsg && (
            <div className="p-3 mb-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400 text-xs font-bold">
              {twoFaSuccessMsg}
            </div>
          )}

          {/* 2FA Form */}
          <form onSubmit={handleVerify2FA} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                6-значный код безопасности:
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                autoFocus
                required
                placeholder="000000"
                value={twoFaCode}
                onChange={(e) => setTwoFaCode(e.target.value.replace(/\D/g, ''))}
                className="w-full py-3 px-4 rounded-2xl bg-slate-100 dark:bg-slate-800 border-2 border-indigo-500/50 focus:border-indigo-500 font-mono text-2xl font-black text-center tracking-[0.5em] text-slate-900 dark:text-white outline-none transition-all"
              />
            </div>

            {/* Countdown Timer */}
            <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Clock className="w-4 h-4 text-indigo-500" />
              <span>
                Код действует:{' '}
                <b className="font-mono text-slate-800 dark:text-slate-200">
                  {Math.floor(twoFaTimer / 60)}:{(twoFaTimer % 60).toString().padStart(2, '0')}
                </b>
              </span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isVerifying2FA || twoFaCode.length < 6}
              className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 active:scale-95 disabled:opacity-50 text-white font-black rounded-2xl text-sm shadow-xl shadow-indigo-600/30 transition-all flex items-center justify-center gap-2"
            >
              {isVerifying2FA ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Key className="w-4 h-4" />
                  <span>Подтвердить вход</span>
                </>
              )}
            </button>

            {/* Resend & Cancel */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handleResend2FA}
                disabled={isResending2FA || twoFaTimer > 120}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-40 disabled:no-underline"
              >
                {isResending2FA ? 'Отправка...' : twoFaTimer > 120 ? `Повтор через ${twoFaTimer - 120}с` : '🔄 Отправить повторно'}
              </button>

              <button
                type="button"
                onClick={() => setShow2FAModal(false)}
                className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                Отмена
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isRegisterFormReady) return;

    setErrorMessage('');
    setIsSubmitting(true);

    const res = await register({
      first_name: firstName,
      last_name: lastName,
      phone_number: regPhone,
      password_hash: regPassword
    });

    setIsSubmitting(false);

    if (!res.success) {
      setErrorMessage(res.error || 'Ошибка регистрации');
    } else {
      localStorage.removeItem('reg_form');
      setSuccessMessage('Регистрация успешна! Добро пожаловать.');
    }
  };

  // ========================================================
  // DEVELOPER MASTER ACTIONS (DELETE, CHANGE PASSWORD, ROLES)
  // ========================================================
  const handleDeveloperDeleteUser = async (user: User) => {
    if (user.role === 'developer' || user.phone_number === 'Lerman_dev') {
      alert('Защита безопасности: Нельзя удалить главный аккаунт разработчика!');
      return;
    }

    if (window.confirm(`Вы точно хотите навсегда удалить аккаунт пользователя "${user.first_name} ${user.last_name || ''}" (${user.phone_number})?`)) {
      await api.deleteUser(user.id!);
      await loadData();
    }
  };

  const handleDeveloperSubmitNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!devPasswordModalUser || !devNewPassword.trim()) return;

    await api.changeUserPassword(devPasswordModalUser.id!, devNewPassword.trim());
    setDevPasswordModalUser(null);
    setDevNewPassword('');
    await loadData();
    alert('Пароль пользователя успешно изменен от имени разработчика!');
  };

  const handleDeveloperToggleRole = async (user: User) => {
    if (user.phone_number === 'Lerman_dev') {
      alert('Нельзя изменить роль главного разработчика!');
      return;
    }
    const newRole: UserRole = user.role === 'admin' ? 'user' : 'admin';
    await api.changeUserRole(user.id!, newRole);
    await loadData();
  };

  // ========================================================
  // PROFILE CHANGE REQUESTS WORKFLOW (SUBMIT & APPROVAL)
  // ========================================================
  const handleUserSubmitChangeRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !showUserRequestModal || !requestNewValue.trim()) return;

    let oldValue = '';
    if (showUserRequestModal === 'name') oldValue = `${currentUser.first_name} ${currentUser.last_name || ''}`.trim();
    if (showUserRequestModal === 'phone') oldValue = currentUser.phone_number;
    if (showUserRequestModal === 'password') oldValue = '••••••••';

    await api.submitProfileRequest({
      userId: currentUser.id!,
      userName: `${currentUser.first_name} ${currentUser.last_name || ''}`.trim(),
      userPhone: currentUser.phone_number,
      type: showUserRequestModal,
      oldValue,
      newValue: requestNewValue.trim(),
      newLastName: showUserRequestModal === 'name' ? requestNewLastName.trim() : undefined
    });

    setShowUserRequestModal(null);
    setRequestNewValue('');
    setRequestNewLastName('');
    await loadData();
    alert('Запрос на изменение отправлен! Он будет применен после подтверждения администратором или разработчиком.');
  };

  const handleApproveRequest = async (reqId: number) => {
    await api.approveProfileRequest(reqId, currentUser?.first_name || 'Администратор');
    await loadData();
  };

  const handleRejectRequest = async (reqId: number) => {
    await api.rejectProfileRequest(reqId, currentUser?.first_name || 'Администратор');
    await loadData();
  };

  // Product Creation Handler
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();

    let finalName = '';
    let finalBrand = '';
    let finalDesc = '';
    const finalCharacteristics: { name: string; value: string }[] = [];
    const photos: string[] = devicePhotos.filter(Boolean);

    // Fallback default image if empty
    if (photos.length === 0) {
      photos.push('https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&auto=format&fit=crop&q=80');
    }

    const conditionText = phoneCondition === 'new' ? 'Новое' : phoneCondition === 'ideal' ? 'Идеальное' : 'Использованное (Б/У)';
    const finalPrice = calculateFinalPriceInUzs();

    if (selectedCategory === 'electronics') {
      if (phoneOS === 'android') {
        finalName = phoneModel.trim() || 'Android Смартфон';
        finalBrand = generalBrand.trim() || 'Android';
        
        const pkg: string[] = [];
        if (pkgCable) pkg.push('Кабель');
        if (pkgBlock) pkg.push('Блок зарядки');
        if (pkgCase) pkg.push('Чехол');

        finalDesc = `Смартфон ${finalName}. Состояние: ${conditionText}. Память: ${phoneStorage} / ОЗУ: ${phoneRam}. Цвет: ${phoneColor || 'Стандартный'}. Комплектация: ${pkg.join(', ') || 'Только устройство'}.`;
        
        finalCharacteristics.push(
          { name: 'Тип', value: 'Android Смартфон' },
          { name: 'Состояние', value: conditionText },
          { name: 'Встроенная память', value: phoneStorage },
          { name: 'Оперативная память (RAM)', value: phoneRam },
          { name: 'Цвет', value: phoneColor || 'Оригинальный' },
          { name: 'Комплектация', value: pkg.join(', ') || 'Без аксессуаров' }
        );
      } else {
        // iPhone
        finalName = `Apple iPhone ${phoneModel}`;
        finalBrand = 'Apple';

        const pkg: string[] = [];
        if (pkgCable) pkg.push('Кабель');
        if (pkgBlock) pkg.push('Блок зарядки');
        if (pkgHeadphones) pkg.push('Наушники');

        finalDesc = `Оригинальный Apple iPhone ${phoneModel}. Состояние: ${conditionText}. Емкость аккумулятора: ${batteryHealth}. Память: ${phoneStorage}. Цвет: ${phoneColor}. Комплект: ${pkg.join(', ') || 'Устройство'}.`;

        finalCharacteristics.push(
          { name: 'Тип', value: 'Apple iPhone (iOS)' },
          { name: 'Модель', value: `iPhone ${phoneModel}` },
          { name: 'Состояние', value: conditionText },
          { name: 'Емкость аккумулятора', value: batteryHealth },
          { name: 'Память', value: phoneStorage },
          { name: 'Цвет', value: phoneColor || 'Space Gray' },
          { name: 'Комплектация', value: pkg.join(', ') || 'Без аксессуаров' }
        );
      }
    } else {
      // Other 12 categories
      const catName = CATEGORIES_LIST.find(c => c.id === selectedCategory)?.name || 'Товар';
      finalName = generalName.trim() || `${catName}`;
      finalBrand = generalBrand.trim() || 'Store';
      finalDesc = generalDesc.trim() || `Качественный товар из категории "${catName}". Отличная надежность и гарантия качества.`;
      
      finalCharacteristics.push(
        { name: 'Категория', value: catName },
        { name: 'Бренд', value: finalBrand },
        { name: 'Гарантия', value: '12 месяцев' }
      );
    }

    const parsedStock = parseInt(stockQuantityInput) || 0;

    // Generate SKU Variants if enabled
    let generatedAttributes: VariantAttribute[] | undefined = undefined;
    let generatedVariants: ProductVariant[] | undefined = undefined;

    if (useVariants) {
      const colors = variantAttrColorText.split(',').map(s => s.trim()).filter(Boolean);
      const options = variantAttrOptionText.split(',').map(s => s.trim()).filter(Boolean);
      const optName = variantOptionName.trim() || 'Вариант';

      generatedAttributes = [
        { name: 'Цвет', values: colors },
        { name: optName, values: options }
      ];

      generatedVariants = [];
      colors.forEach(col => {
        options.forEach(opt => {
          generatedVariants!.push({
            id: `var_${Date.now()}_${col}_${opt}`.replace(/\s+/g, '_'),
            productId: editingProduct ? editingProduct.id : 0,
            attributes: {
              'Цвет': col,
              [optName]: opt
            },
            price: finalPrice,
            oldPrice: editingProduct?.oldPrice,
            stockQuantity: parsedStock,
            image: photos[0]
          });
        });
      });
    }

    const newProduct: Product = {
      id: editingProduct ? editingProduct.id : Date.now(),
      name: finalName,
      categoryId: selectedCategory,
      brand: finalBrand,
      price: finalPrice,
      rating: editingProduct ? editingProduct.rating : 5.0,
      reviewsCount: editingProduct ? editingProduct.reviewsCount : 0,
      popularity: editingProduct ? editingProduct.popularity : 60,
      image: photos[0],
      images: photos,
      description: finalDesc,
      characteristics: finalCharacteristics,
      inStock: parsedStock > 0,
      stockQuantity: parsedStock,
      reviews: editingProduct ? (editingProduct.reviews || []) : [],
      variantAttributes: generatedAttributes || (editingProduct ? editingProduct.variantAttributes : undefined),
      variants: generatedVariants || (editingProduct ? editingProduct.variants : undefined),
      phoneOS: selectedCategory === 'electronics' ? phoneOS : undefined,
      condition: selectedCategory === 'electronics' ? phoneCondition : undefined,
      color: phoneColor,
      storage: phoneStorage,
      ram: phoneRam,
      batteryHealth: selectedCategory === 'electronics' && phoneOS === 'iphone' ? batteryHealth : undefined
    };

    // Save to local DB and central server
    await api.saveProduct(newProduct);

    setShowAddProductModal(false);
    resetProductForm();
    await loadData();
  };

  // Delete Product Handler
  const handleDeleteProduct = async (id: number, name: string) => {
    if (window.confirm(`Вы уверены, что хотите удалить товар "${name}"?`)) {
      await api.deleteProduct(id);
      await loadData();
    }
  };

  // Reset product form fields
  const resetProductForm = () => {
    setGeneralName('');
    setGeneralBrand('');
    setInputPrice('');
    setStockQuantityInput('5');
    setGeneralDesc('');
    setDevicePhotos([]);
    setPhotoUrlInput('');
    setPhoneModel('');
    setPhoneColor('');
    setPhoneOS('android');
    setPhoneCondition('new');
    setPhoneStorage('128 ГБ');
    setPhoneRam('8 ГБ');
    setBatteryHealth('100%');
    setPkgCable(true);
    setPkgBlock(true);
    setPkgCase(false);
    setPkgHeadphones(false);
    setSelectedCategory('electronics');
    setPriceCurrency('uzs');
    setEditingProduct(null);
  };

  // Edit Product Handler — pre-fills the modal form with existing product data
  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setSelectedCategory(product.categoryId || 'electronics');
    setStockQuantityInput(product.stockQuantity !== undefined ? product.stockQuantity.toString() : (product.inStock ? '5' : '0'));

    // Set photos
    if (product.images && product.images.length > 0) {
      setDevicePhotos([...product.images]);
    } else if (product.image) {
      setDevicePhotos([product.image]);
    } else {
      setDevicePhotos([]);
    }

    // Price
    setPriceCurrency('uzs');
    setInputPrice(String(product.price || ''));

    if (product.categoryId === 'electronics') {
      setPhoneOS(product.phoneOS || 'android');
      setPhoneCondition(product.condition || 'new');
      setPhoneColor(product.color || '');
      setPhoneStorage(product.storage || '128 ГБ');
      setPhoneRam(product.ram || '8 ГБ');
      setBatteryHealth(product.batteryHealth || '100%');

      // Extract model name
      if (product.phoneOS === 'iphone' || product.name?.startsWith('Apple iPhone')) {
        setPhoneModel(product.name?.replace('Apple iPhone ', '') || '');
      } else {
        setPhoneModel(product.name || '');
      }
      setGeneralBrand(product.brand || '');

      // Package checklist from characteristics
      const pkgChar = product.characteristics?.find(c => c.name === 'Комплектация')?.value || '';
      setPkgCable(pkgChar.includes('Кабель'));
      setPkgBlock(pkgChar.includes('Блок'));
      setPkgCase(pkgChar.includes('Чехол'));
      setPkgHeadphones(pkgChar.includes('Наушники'));
    } else {
      setGeneralName(product.name || '');
      setGeneralBrand(product.brand || '');
      setGeneralDesc(product.description || '');
    }

    setShowAddProductModal(true);
  };

  // Order Actions by Admin / Dev
  const handleUpdateOrderStatus = async (orderId: number, newStatus: OrderStatus) => {
    await api.updateOrderStatus(orderId, newStatus);
    await loadData();
  };

  // Save custom server URL
  const handleSaveServerUrl = () => {
    api.setServerUrl(serverUrlInput);
    loadData();
  };

  // -------------------------------------------------------------
  // NOT LOGGED IN: CLEAN LOGIN & REGISTER (No preset account leaks)
  // -------------------------------------------------------------
  if (!currentUser) {
    return (
      <div className="flex-1 flex flex-col p-5 pb-24 overflow-y-auto">
        <div className="text-center space-y-1 my-4">
          <div className="w-14 h-14 bg-indigo-600 rounded-3xl mx-auto flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
            <UserIcon className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white">
            {authMode === 'login' ? 'Вход в аккаунт' : 'Регистрация'}
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            {authMode === 'login' 
              ? 'Войдите, чтобы отслеживать заказы и статус' 
              : 'Создайте аккаунт для быстрых покупок'}
          </p>
        </div>

        {/* Switcher */}
        <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl mb-5 text-xs font-bold">
          <button
            type="button"
            onClick={() => { setAuthMode('login'); setErrorMessage(''); setSuccessMessage(''); }}
            className={`flex-1 py-2.5 rounded-xl transition-all ${
              authMode === 'login'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            Войти
          </button>
          <button
            type="button"
            onClick={() => { setAuthMode('register'); setErrorMessage(''); setSuccessMessage(''); }}
            className={`flex-1 py-2.5 rounded-xl transition-all ${
              authMode === 'register'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            Регистрация
          </button>
        </div>

        {/* Alerts */}
        {errorMessage && (
          <div className="p-3 mb-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-semibold">
            {errorMessage}
          </div>
        )}
        {successMessage && (
          <div className="p-3 mb-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
            {successMessage}
          </div>
        )}

        {/* LOGIN FORM */}
        {authMode === 'login' ? (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Логин или номер телефона:
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={loginInput}
                  onChange={(e) => setLoginInput(e.target.value)}
                  placeholder="Введите логин или телефон"
                  className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Пароль:
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Введите пароль"
                  className="w-full pl-10 pr-10 py-3 bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !loginInput || !loginPassword}
              className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 disabled:opacity-50 text-white font-black text-xs shadow-lg shadow-indigo-600/30 transition-all mt-2"
            >
              {isSubmitting ? 'Проверка...' : 'Войти в аккаунт'}
            </button>
          </form>
        ) : (
          /* REGISTRATION FORM */
          <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Имя <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Введите ваше имя"
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Фамилия <span className="text-slate-400 text-[10px]">(не обязательно)</span>
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Введите фамилию"
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Номер телефона или логин <span className="text-rose-500">*</span>
              </label>
              <input
                type="tel"
                required
                value={regPhone}
                onChange={(e) => {
                  // Не давать удалить +998 префикс
                  const val = e.target.value;
                  if (!val.startsWith('+998')) {
                    setRegPhone('+998 ');
                  } else {
                    setRegPhone(val);
                  }
                }}
                placeholder="+998 90 123 45 67"
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Пароль <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showRegPassword ? 'text' : 'password'}
                  required
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="Минимум 4 символа"
                  className="w-full px-3.5 py-2.5 pr-10 bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowRegPassword(!showRegPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Подтверждение пароля <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showRegPasswordConfirm ? 'text' : 'password'}
                  required
                  value={regPasswordConfirm}
                  onChange={(e) => setRegPasswordConfirm(e.target.value)}
                  placeholder="Повторите пароль"
                  className={`w-full px-3.5 py-2.5 pr-10 bg-white dark:bg-slate-800/80 border rounded-xl text-xs font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 ${
                    regPasswordConfirm && !isPasswordMatch ? 'border-rose-500' : 'border-slate-200 dark:border-slate-700'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowRegPasswordConfirm(!showRegPasswordConfirm)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showRegPasswordConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Telegram Verification */}
            <div className="p-3.5 bg-sky-50 dark:bg-sky-950/40 rounded-2xl border border-sky-200 dark:border-sky-800 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-sky-800 dark:text-sky-300">
                <Send className="w-4 h-4" />
                <span>Подтверждение через Telegram</span>
              </div>

              {isTelegramVerified ? (
                <div className="flex items-center gap-2 p-2.5 bg-emerald-50 dark:bg-emerald-950/50 rounded-xl border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">Номер подтверждён через Telegram!</span>
                </div>
              ) : (
                <>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                    Для безопасности нажмите кнопку ниже. Бот проверит, что ваш Telegram привязан к указанному номеру, и выдаст код.
                  </p>

                  {!codeSent ? (
                    <button
                      type="button"
                      onClick={handleRequestTelegramCode}
                      disabled={isRequestingCode || regPhone.trim().length < 9}
                      className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isRequestingCode ? 'Запрос...' : 'Получить код через Telegram'}</span>
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <div className="p-2 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800 text-[10px] text-amber-700 dark:text-amber-300">
                        📱 Перейдите в бот <strong>@shaxsmartadmins_bot</strong>, нажмите кнопку «📱 Отправить мой номер» и получите код.
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={telegramVerifyCode}
                          onChange={(e) => { setTelegramVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setVerifyError(''); }}
                          placeholder="6-значный код"
                          maxLength={6}
                          className="flex-1 px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-center tracking-[0.3em] outline-none focus:ring-2 focus:ring-sky-500"
                        />
                        <button
                          type="button"
                          onClick={handleVerifyTelegramCode}
                          disabled={isVerifyingCode || telegramVerifyCode.length < 6}
                          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs disabled:opacity-50 active:scale-95"
                        >
                          {isVerifyingCode ? '...' : 'Проверить'}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setCodeSent(false); setTelegramVerifyCode(''); }}
                        className="text-[10px] text-sky-600 dark:text-sky-400 font-semibold underline"
                      >
                        Запросить код заново
                      </button>
                    </div>
                  )}

                  {verifyError && (
                    <div className="text-[10px] text-rose-600 font-semibold">{verifyError}</div>
                  )}
                </>
              )}
            </div>

            {/* Checkbox согласия */}
            <div className="pt-1">
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                />
                <span className="text-[11px] text-slate-600 dark:text-slate-300 leading-tight">
                  Я подтверждаю согласие на наши <strong className="text-indigo-600 dark:text-indigo-400">условия использования</strong> и обработку персональных данных
                </span>
              </label>
            </div>

            {/* Кнопка "Продолжить" */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={!isRegisterFormReady || isSubmitting}
                className={`w-full py-3.5 px-4 rounded-2xl font-black text-xs transition-all duration-300 flex items-center justify-center gap-2 ${
                  isRegisterFormReady
                    ? 'bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 text-white shadow-xl shadow-indigo-500/40 ring-2 ring-indigo-400 scale-[1.01] animate-pulse'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed opacity-60'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span>Продолжить</span>
              </button>
            </div>
          </form>
        )}

        {/* 2FA Verification Modal for Login */}
        {render2FAModal()}
      </div>
    );
  }

  // -------------------------------------------------------------
  // LOGGED IN DASHBOARDS
  // -------------------------------------------------------------
  const roleBadge = () => {
    switch (currentUser.role) {
      case 'developer':
        return (
          <span className="inline-flex items-center gap-1 bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 text-[11px] font-black px-2.5 py-1 rounded-full border border-purple-300 dark:border-purple-800">
            <Code2 className="w-3.5 h-3.5" />
            Разработчик
          </span>
        );
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1 bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 text-[11px] font-black px-2.5 py-1 rounded-full border border-amber-300 dark:border-amber-800">
            <Shield className="w-3.5 h-3.5" />
            Администратор
          </span>
        );
      case 'user':
      default:
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold px-2.5 py-1 rounded-full border border-emerald-300 dark:border-emerald-800">
            <UserIcon className="w-3.5 h-3.5" />
            Пользователь
          </span>
        );
    }
  };

  const getOrderStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'awaiting_payment':
        return (
          <span className="inline-flex items-center gap-1 bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-md">
            <Clock className="w-3 h-3 animate-spin" />
            Ожидает оплаты Click
          </span>
        );
      case 'payment_failed':
        return (
          <span className="inline-flex items-center gap-1 bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 text-[10px] font-bold px-2 py-0.5 rounded-md">
            <XCircle className="w-3 h-3" />
            Оплата не поступила
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1 bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold px-2 py-0.5 rounded-md animate-pulse">
            <Package className="w-3 h-3" />
            Заказ собирается
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-md">
            <CheckCircle2 className="w-3 h-3" />
            Заказ получен
          </span>
        );
      default:
        return null;
    }
  };

  const pendingRequestsCount = requestsList.filter(r => r.status === 'pending').length;

  return (
    <div className="flex-1 flex flex-col pb-24 overflow-y-auto">
      {/* Header Profile Card */}
      <div className="p-5 bg-gradient-to-b from-indigo-50/60 to-white dark:from-slate-800/40 dark:to-slate-900 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            {/* Clickable Avatar with Camera Badge and Video/GIF support */}
            <div className="relative group cursor-pointer" onClick={() => setShowAvatarModal(true)}>
              <UserAvatar
                avatar={currentUser.avatar}
                name={currentUser.first_name}
                size="lg"
                showBadge={true}
                className="border-2 border-indigo-600 shadow-md shadow-indigo-600/30 group-hover:opacity-90 transition-all"
              />
              <div 
                className="absolute -bottom-1 -right-1 w-6 h-6 bg-slate-900 dark:bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-md border-2 border-white dark:border-slate-900 group-hover:scale-110 transition-transform"
                title="Изменить аватарку"
              >
                <Camera className="w-3 h-3" />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-base font-black text-slate-900 dark:text-white">
                  {currentUser.first_name} {currentUser.last_name || ''}
                </h2>
              </div>
              <p className="text-xs text-slate-500 font-medium">{currentUser.phone_number}</p>
              <div className="mt-1 flex items-center gap-2">
                {roleBadge()}
                <button
                  onClick={() => setShowAvatarModal(true)}
                  className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Сменить аву
                </button>
                {(currentUser.role === 'developer' || currentUser.role === 'admin') && (
                  <button
                    onClick={() => {
                      setDevNewFirstName(currentUser.first_name);
                      setDevNewLastName(currentUser.last_name || '');
                      setShowDevNickModal(true);
                    }}
                    className="text-[10px] font-bold text-purple-600 dark:text-purple-400 hover:underline"
                  >
                    ✏️ Сменить ник
                  </button>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={logout}
            className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-600 dark:text-slate-300 hover:text-rose-600 transition-colors"
            title="Выйти"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>

        {/* Server Status Ribbon for Admin / Dev */}
        {(currentUser.role === 'admin' || currentUser.role === 'developer') && (
          <div className="mt-3.5 flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px]">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${serverOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <span className="font-bold text-slate-700 dark:text-slate-300">
                Сервер синхронизации: {serverOnline ? 'В сети (Онлайн)' : 'Локальный режим'}
              </span>
            </div>
            <button
              onClick={loadData}
              className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-[10px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:bg-slate-200"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Обновить</span>
            </button>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* ADMIN & DEVELOPER DASHBOARD */}
      {/* ======================================================== */}
      {(currentUser.role === 'admin' || currentUser.role === 'developer') && (
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {currentUser.role === 'admin' ? (
                <Shield className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              ) : (
                <Code2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              )}
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
                {currentUser.role === 'admin' ? 'Панель Администратора' : 'Панель Разработчика'}
              </h3>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowAddCategoryModal(true)}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/30"
              >
                <Plus className="w-4 h-4" />
                <span>Категория</span>
              </button>
              <button
                onClick={() => setShowAddProductModal(true)}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/30"
              >
                <Plus className="w-4 h-4" />
                <span>Товар</span>
              </button>
            </div>
          </div>

          {/* Subtabs */}
          <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl text-xs font-bold overflow-x-auto">
            <button
              onClick={() => setAdminTab('orders')}
              className={`flex-1 min-w-[75px] py-2 rounded-xl transition-all relative ${
                adminTab === 'orders' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <span>Заказы ({ordersList.length})</span>
              {ordersList.some(o => o.status === 'awaiting_payment') && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full animate-ping" />
              )}
            </button>
            <button
              onClick={() => setAdminTab('products')}
              className={`flex-1 min-w-[75px] py-2 rounded-xl transition-all ${
                adminTab === 'products' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Товары ({productsList.length})
            </button>
            <button
              onClick={() => setAdminTab('promocodes')}
              className={`flex-1 min-w-[95px] py-2 rounded-xl transition-all ${
                adminTab === 'promocodes' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              🎁 Промокоды ({promoCodesList.length})
            </button>
            <button
              onClick={() => setAdminTab('users')}
              className={`flex-1 min-w-[90px] py-2 rounded-xl transition-all ${
                adminTab === 'users' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Аккаунты ({allUsers.length})
            </button>
            <button
              onClick={() => setAdminTab('requests')}
              className={`flex-1 min-w-[85px] py-2 rounded-xl transition-all relative ${
                adminTab === 'requests' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <span>Запросы ({requestsList.length})</span>
              {pendingRequestsCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 bg-rose-500 text-white text-[9px] font-black rounded-full">
                  {pendingRequestsCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setAdminTab('server')}
              className={`flex-1 min-w-[65px] py-2 rounded-xl transition-all ${
                adminTab === 'server' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Сервер
            </button>
          </div>

          {/* TAB 1: ORDERS MANAGEMENT */}
          {adminTab === 'orders' && (
            <div className="space-y-3">
              {ordersList.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                  Заказов пока нет
                </div>
              ) : (
                ordersList.map(order => (
                  <div
                    key={order.id}
                    className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">
                        Заказ #{order.id}
                      </span>
                      {getOrderStatusBadge(order.status)}
                    </div>

                    <div className="text-slate-600 dark:text-slate-300 text-[11px] space-y-1">
                      <div>Покупатель: <strong>{order.customerName}</strong></div>
                      <div>Телефон: <strong>{order.phone}</strong></div>
                      <div>Адрес: <strong>{order.address}</strong></div>
                      <div>Сумма: <strong>{formatPrice(order.totalPrice)}</strong></div>
                      <div>Товары: <strong>{order.items.map(i => `${i.name} (x${i.quantity})`).join(', ')}</strong></div>
                      <div className="text-slate-400 text-[10px]">
                        Дата: {new Date(order.createdAt).toLocaleString('ru-RU')}
                      </div>
                    </div>

                    {/* Admin Status Actions */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      {order.status === 'awaiting_payment' && (
                        <>
                          <button
                            onClick={() => handleUpdateOrderStatus(order.id!, 'processing')}
                            className="py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center justify-center gap-1 shadow-sm active:scale-95"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Оплата поступила</span>
                          </button>
                          <button
                            onClick={() => handleUpdateOrderStatus(order.id!, 'payment_failed')}
                            className="py-2 px-3 bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 font-bold rounded-xl flex items-center justify-center gap-1 active:scale-95"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Не поступила</span>
                          </button>
                        </>
                      )}

                      {order.status === 'processing' && (
                        <button
                          onClick={() => handleUpdateOrderStatus(order.id!, 'completed')}
                          className="col-span-2 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl flex items-center justify-center gap-1 shadow-sm active:scale-95"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Заказ выдан / завершен</span>
                        </button>
                      )}

                      {order.status === 'payment_failed' && (
                        <button
                          onClick={() => handleUpdateOrderStatus(order.id!, 'awaiting_payment')}
                          className="col-span-2 py-2 px-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl flex items-center justify-center gap-1 active:scale-95"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Перепроверить оплату</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 2: PRODUCTS MANAGEMENT */}
          {adminTab === 'products' && (
            <div className="space-y-3">
              {productsList.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                  Товаров в магазине пока нет. Нажмите «Добавить товар»!
                </div>
              ) : (
                productsList.map(prod => (
                  <div
                    key={prod.id}
                    className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs shadow-sm"
                  >
                    <img src={prod.image} alt="" className="w-14 h-14 rounded-xl object-cover" />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-900 dark:text-white truncate">{prod.name}</div>
                      <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold uppercase mt-0.5">
                        {CATEGORIES_LIST.find(c => c.id === prod.categoryId)?.name || prod.categoryId}
                      </div>
                      <div className="text-xs font-black text-slate-900 dark:text-white mt-1">
                        {formatPrice(prod.price)}
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleEditProduct(prod)}
                        className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 hover:bg-indigo-100 transition-colors"
                        title="Редактировать товар"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(prod.id, prod.name)}
                        className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 hover:bg-rose-100 transition-colors"
                        title="Удалить товар"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 3: ALL REGISTERED ACCOUNTS & DEVELOPER CONTROLS */}
          {adminTab === 'users' && (
            <div className="space-y-3">
              <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/40 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 text-xs">
                <div className="font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-indigo-600" />
                  <span>Управление всеми зарегистрированными аккаунтами</span>
                </div>
                <p className="text-[11px] text-indigo-700/80 dark:text-indigo-300/80 mt-1">
                  Разработчик может удалять аккаунты, сбрасывать пароли и управлять правами доступа.
                </p>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {allUsers.map(u => (
                  <div key={u.id} className="p-3.5 space-y-2.5">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-center gap-2.5">
                        <UserAvatar
                          avatar={u.avatar}
                          name={u.first_name}
                          size="md"
                          showBadge={true}
                          className="border border-slate-200 dark:border-slate-700 flex-shrink-0"
                        />

                        <div>
                          <div className="font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                            <span>{u.first_name} {u.last_name || ''}</span>
                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                              u.role === 'developer'
                                ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                                : u.role === 'admin'
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            }`}>
                              {u.role === 'developer' ? 'Разработчик' : u.role === 'admin' ? 'Админ' : 'Клиент'}
                            </span>
                          </div>
                          <div className="text-slate-500 text-[11px] mt-0.5">
                            Логин/Тел: <strong className="text-slate-800 dark:text-slate-200">{u.phone_number}</strong>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Регистрация: {new Date(u.created_at).toLocaleDateString('ru-RU')}
                          </div>
                        </div>
                      </div>

                      {/* Developer Master Action Buttons */}
                      {currentUser.role === 'developer' && (
                        <div className="flex items-center gap-1.5">
                          {/* Change password */}
                          <button
                            onClick={() => {
                              setDevPasswordModalUser(u);
                              setDevNewPassword('');
                            }}
                            className="p-2 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-400 rounded-xl transition-all"
                            title="Сменить пароль от имени разработчика"
                          >
                            <Key className="w-3.5 h-3.5" />
                          </button>

                          {/* Role toggle */}
                          {u.phone_number !== 'Lerman_dev' && (
                            <button
                              onClick={() => handleDeveloperToggleRole(u)}
                              className="p-2 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 text-amber-600 dark:text-amber-400 rounded-xl transition-all"
                              title={u.role === 'admin' ? 'Снять права админа' : 'Назначить администратором'}
                            >
                              <Shield className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Delete account */}
                          {u.phone_number !== 'Lerman_dev' && (
                            <button
                              onClick={() => handleDeveloperDeleteUser(u)}
                              className="p-2 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-600 dark:text-rose-400 rounded-xl transition-all"
                              title="Удалить аккаунт"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: PROFILE CHANGE REQUESTS (NICKNAME & PASSWORD) */}
          {adminTab === 'requests' && (
            <div className="space-y-3">
              <div className="p-3 bg-purple-50/60 dark:bg-purple-950/40 rounded-2xl border border-purple-100 dark:border-purple-900/50 text-xs">
                <div className="font-bold text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-purple-600" />
                  <span>Запросы пользователей на смену ника / телефона / пароля</span>
                </div>
                <p className="text-[11px] text-purple-700/80 dark:text-purple-300/80 mt-1">
                  Подтвердите или отклоните запросы на изменение данных учетных записей.
                </p>
              </div>

              {requestsList.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                  Нет активных запросов на изменение профиля
                </div>
              ) : (
                requestsList.map(req => (
                  <div
                    key={req.id}
                    className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2.5 text-xs"
                  >
                    <div className="flex justify-between items-center">
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span>{req.userName}</span>
                        <span className="text-[10px] text-slate-400">({req.userPhone})</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        req.status === 'pending'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                          : req.status === 'approved'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                      }`}>
                        {req.status === 'pending' ? '⏳ Ожидает' : req.status === 'approved' ? '✓ Одобрено' : '✕ Отклонено'}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-1 text-[11px]">
                      <div>
                        Тип изменения: <strong>{
                          req.type === 'name' ? 'Смена Имени / Ника' : req.type === 'phone' ? 'Смена Логина / Телефона' : 'Смена Пароля'
                        }</strong>
                      </div>
                      <div>Было: <span className="text-slate-400 line-through">{req.oldValue}</span></div>
                      <div>Станет: <strong className="text-indigo-600 dark:text-indigo-400">{req.newValue} {req.newLastName || ''}</strong></div>
                      <div className="text-[10px] text-slate-400 pt-0.5">
                        Дата запроса: {new Date(req.createdAt).toLocaleString('ru-RU')}
                      </div>
                      {req.reviewedBy && (
                        <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                          Проверено: {req.reviewedBy} ({new Date(req.reviewedAt || '').toLocaleString('ru-RU')})
                        </div>
                      )}
                    </div>

                    {req.status === 'pending' && (
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          onClick={() => handleApproveRequest(req.id)}
                          className="py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center justify-center gap-1 shadow-sm active:scale-95"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Одобрить</span>
                        </button>
                        <button
                          onClick={() => handleRejectRequest(req.id)}
                          className="py-2 bg-rose-50 dark:bg-rose-950 text-rose-600 border border-rose-200 dark:border-rose-800 font-bold rounded-xl flex items-center justify-center gap-1 active:scale-95"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Отклонить</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 5: SERVER SETTINGS */}
          {adminTab === 'server' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3.5 text-xs">
              <div className="flex items-center gap-2">
                <Server className="w-5 h-5 text-indigo-600" />
                <h4 className="font-bold text-slate-900 dark:text-white">Настройки сервера синхронизации</h4>
              </div>

              <p className="text-slate-500 leading-relaxed text-[11px]">
                Постоянный облачный сервер 24/7 подключен к Railway PostgreSQL.
              </p>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Адрес сервера API:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={serverUrlInput}
                    onChange={(e) => setServerUrlInput(e.target.value)}
                    placeholder="https://shaxsmart-production.up.railway.app"
                    className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs outline-none"
                  />
                  <button
                    onClick={handleSaveServerUrl}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold"
                  >
                    Сохранить
                  </button>
                </div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-[11px] space-y-1">
                <div>Статус подключения: <strong className={serverOnline ? 'text-emerald-600' : 'text-amber-600'}>{serverOnline ? '● Подключено (Онлайн)' : '○ Офлайн / Локально'}</strong></div>
                <div className="text-slate-400">Telegram администратора: <strong>@Sir_lerman</strong></div>
              </div>
            </div>
          )}

          {/* TAB 5: PROMO CODES GENERATOR & LIST */}
          {adminTab === 'promocodes' && (
            <div className="space-y-4">
              {/* Generator Form */}
              <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3.5 shadow-sm">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Gift className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    <h4 className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-xs">
                      Генератор одноразовых промокодов
                    </h4>
                  </div>
                  <span className="text-[10px] bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold px-2 py-0.5 rounded-full">
                    Одноразовые
                  </span>
                </div>

                <form onSubmit={handleCreatePromoCode} className="space-y-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      1. Процент скидки (%):
                    </label>
                    <div className="flex gap-1.5 mb-2">
                      {[10, 15, 20, 30, 50].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setPromoPercentInput(pct)}
                          className={`flex-1 py-1.5 rounded-xl font-bold text-xs transition-all ${
                            promoPercentInput === pct
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                          }`}
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      required
                      value={promoPercentInput}
                      onChange={(e) => setPromoPercentInput(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      2. От какой суммы действует (сум):
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={promoMinSumInput}
                      onChange={(e) => setPromoMinSumInput(e.target.value)}
                      placeholder="0 — действует на любую сумму"
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <div className="text-[10px] text-slate-400 mt-1">
                      {Number(promoMinSumInput) > 0 ? `Действует от ${formatPrice(Number(promoMinSumInput))}` : 'Действует на любую сумму заказа'}
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block font-bold text-slate-700 dark:text-slate-300">
                        3. Код промокода:
                      </label>
                      <button
                        type="button"
                        onClick={handleGenerateRandomCode}
                        className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Случайный код</span>
                      </button>
                    </div>
                    <input
                      type="text"
                      value={promoCustomCodeInput}
                      onChange={(e) => setPromoCustomCodeInput(e.target.value.toUpperCase())}
                      placeholder="Оставьте пустым или введите свой (например: SHAX-SUPER)"
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isGeneratingPromo}
                    className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 active:scale-95 disabled:opacity-50 text-white font-black rounded-xl text-xs shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{isGeneratingPromo ? 'Создание...' : '⚡ Сгенерировать и добавить промокод'}</span>
                  </button>
                </form>
              </div>

              {/* Promo codes list */}
              <div className="space-y-2.5">
                <div className="flex justify-between items-center px-1">
                  <h4 className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-xs">
                    Список промокодов ({promoCodesList.length})
                  </h4>
                  <span className="text-[10px] text-slate-400">
                    Активных: {promoCodesList.filter(p => !p.isUsed).length}
                  </span>
                </div>

                {promoCodesList.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
                    Нет созданных промокодов. Создайте первый выше!
                  </div>
                ) : (
                  promoCodesList.map((promo) => (
                    <div
                      key={promo.id}
                      className={`p-3.5 rounded-2xl border transition-all ${
                        promo.isUsed
                          ? 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 opacity-60'
                          : 'bg-white dark:bg-slate-900 border-indigo-200 dark:border-indigo-800 shadow-sm'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-sm text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800">
                            {promo.code}
                          </span>
                          <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-md">
                            -{promo.discountPercent}%
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleCopyPromoCode(promo)}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 text-slate-600 dark:text-slate-300 hover:text-indigo-600 transition-colors"
                            title="Скопировать"
                          >
                            {copiedPromoId === promo.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePromoCode(promo)}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 text-slate-600 dark:text-slate-300 hover:text-rose-600 transition-colors"
                            title="Удалить"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center justify-between text-[11px] text-slate-500 gap-1">
                        <div>
                          Мин. заказ: <b>{(Number(promo.minOrderSum || (promo as any).minOrderAmount || 0) > 0) ? formatPrice(Number(promo.minOrderSum || (promo as any).minOrderAmount || 0)) : 'Без ограничений'}</b>
                        </div>
                        <div>
                          {promo.isUsed ? (
                            <span className="text-rose-500 font-bold">
                              🔴 Использован {promo.usedBy ? `(${promo.usedBy})` : ''}
                            </span>
                          ) : (
                            <span className="text-emerald-600 font-bold">
                              🟢 Активен (одноразовый)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* REGULAR USER PROFILE VIEW */}
      {/* ======================================================== */}
      {currentUser.role === 'user' && (
        <div className="p-4 space-y-4">
          {/* Profile & Security Settings Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 text-xs shadow-sm">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <UserIcon className="w-4 h-4 text-indigo-600" />
                <span>Настройки профиля и безопасность</span>
              </h3>
              <button
                onClick={() => setShowAvatarModal(true)}
                className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl font-bold text-[11px] flex items-center gap-1"
              >
                <Camera className="w-3 h-3" />
                <span>Аватарка</span>
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400">Имя и фамилия:</span>
                <span className="font-bold text-slate-900 dark:text-white">{currentUser.first_name} {currentUser.last_name || ''}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400">Логин / Телефон:</span>
                <span className="font-bold text-slate-900 dark:text-white">{currentUser.phone_number}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400">Пароль:</span>
                <span className="font-mono text-slate-500">••••••••</span>
              </div>
            </div>

            {/* Action Buttons to Request Changes */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => {
                  setShowUserRequestModal('name');
                  setRequestNewValue(currentUser.first_name);
                  setRequestNewLastName(currentUser.last_name || '');
                }}
                className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 font-bold rounded-xl flex flex-col items-center justify-center gap-1 text-center text-[10px] active:scale-95 transition-all"
              >
                <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                <span>Сменить ник</span>
              </button>

              <button
                onClick={() => {
                  setShowUserRequestModal('phone');
                  setRequestNewValue(currentUser.phone_number);
                }}
                className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 font-bold rounded-xl flex flex-col items-center justify-center gap-1 text-center text-[10px] active:scale-95 transition-all"
              >
                <Phone className="w-3.5 h-3.5 text-indigo-600" />
                <span>Сменить логин</span>
              </button>

              <button
                onClick={() => {
                  setShowUserRequestModal('password');
                  setRequestNewValue('');
                }}
                className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 font-bold rounded-xl flex flex-col items-center justify-center gap-1 text-center text-[10px] active:scale-95 transition-all"
              >
                <Lock className="w-3.5 h-3.5 text-indigo-600" />
                <span>Сменить пароль</span>
              </button>
            </div>

            {/* Logout button to easily switch users */}
            <div className="pt-1">
              <button
                type="button"
                onClick={logout}
                className="w-full py-2.5 px-3 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 active:scale-98 transition-all"
              >
                <LogOut className="w-4 h-4" />
                <span>Выйти из аккаунта (Войти как Админ / Разработчик)</span>
              </button>
            </div>
          </div>

          {/* User's Profile Change Requests History */}
          {requestsList.filter(r => r.userId === currentUser.id).length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2.5 text-xs shadow-sm">
              <h4 className="font-bold text-slate-900 dark:text-white text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                <span>Мои запросы на изменение данных</span>
              </h4>

              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {requestsList.filter(r => r.userId === currentUser.id).map(r => (
                  <div key={r.id} className="py-2.5 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">
                        {r.type === 'name' ? 'Смена ника' : r.type === 'phone' ? 'Смена логина' : 'Смена пароля'}: <strong>{r.newValue}</strong>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {new Date(r.createdAt).toLocaleDateString('ru-RU')}
                      </div>
                    </div>

                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                      r.status === 'pending'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                        : r.status === 'approved'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                    }`}>
                      {r.status === 'pending' ? '⏳ На рассмотрении' : r.status === 'approved' ? '✓ Одобрено' : '✕ Отклонено'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* User Orders */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider px-1">
              Мои заказы
            </h3>

            {ordersList.filter(o => o.phone === currentUser.phone_number || o.userId === currentUser.id).length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
                У вас пока нет оформленных заказов
              </div>
            ) : (
              ordersList
                .filter(o => o.phone === currentUser.phone_number || o.userId === currentUser.id)
                .map(order => (
                  <div
                    key={order.id}
                    className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3 text-xs shadow-sm"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">Заказ #{order.id}</span>
                      {getOrderStatusBadge(order.status)}
                    </div>

                    <div className="text-slate-600 dark:text-slate-300 text-[11px] space-y-1">
                      <div>Товары: <strong>{order.items.map(i => `${i.name} (x${i.quantity})`).join(', ')}</strong></div>
                      <div>Итого к оплате: <strong>{formatPrice(order.totalPrice)}</strong></div>
                      <div>Оплата: <strong>Click (карта {order.paymentCard})</strong></div>
                    </div>

                    {/* STATUS 1: Awaiting Payment */}
                    {order.status === 'awaiting_payment' && (
                      <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-[11px] flex items-center gap-2">
                        <Clock className="w-4 h-4 animate-spin flex-shrink-0" />
                        <span>Администратор проверяет поступление оплаты на карту <strong>{order.paymentCard}</strong> (до 10 минут).</span>
                      </div>
                    )}

                    {/* STATUS 2: Payment Failed */}
                    {order.status === 'payment_failed' && (
                      <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-[11px] space-y-1">
                        <div className="font-bold flex items-center gap-1.5">
                          <XCircle className="w-4 h-4" />
                          <span>Оплата не поступила</span>
                        </div>
                        <p className="text-[10px]">
                          Пожалуйста, проверьте чек перевода или напишите в поддержку: <a href="https://t.me/Sir_lerman" className="underline font-bold">@Sir_lerman</a>
                        </p>
                      </div>
                    )}

                    {/* STATUS 3: Processing */}
                    {order.status === 'processing' && (
                      <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300 text-[11px] space-y-2">
                        <div className="font-bold flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                          <Package className="w-4 h-4" />
                          <span>Оплата подтверждена! Заказ собирается</span>
                        </div>
                        <p className="text-[10px] leading-relaxed">
                          Пожалуйста, свяжитесь с менеджером для продолжения и согласования получения заказа.
                        </p>
                        <div className="flex gap-2 pt-1">
                          <a
                            href="https://t.me/Sir_lerman"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 py-2 px-3 bg-emerald-600 text-white font-bold rounded-xl text-center flex items-center justify-center gap-1.5"
                          >
                            <PhoneCall className="w-3.5 h-3.5" />
                            <span>Написать менеджеру</span>
                          </a>
                        </div>
                      </div>
                    )}

                    {/* Button for customer to confirm receiving order */}
                    {(order.status === 'processing' || order.status === 'shipped') && (
                      <button
                        onClick={() => handleUpdateOrderStatus(order.id!, 'completed')}
                        className="w-full py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-md"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Подтвердить получение заказа</span>
                      </button>
                    )}

                    {order.status === 'completed' && (
                      <div className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-center text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">
                        ✓ Заказ успешно получен. Спасибо за покупку!
                      </div>
                    )}
                  </div>
                ))
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: CHOOSE / UPLOAD ANY AVATAR (VIDEO / GIF / PHOTO) */}
      {/* ======================================================== */}
      {showAvatarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 text-xs animate-slideUp space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-black text-slate-900 dark:text-white uppercase flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-indigo-600" />
                <span>Выбор живой аватарки профиля</span>
              </h3>
              <button onClick={() => setShowAvatarModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            {/* Current avatar preview */}
            <div className="flex flex-col items-center justify-center gap-2 py-1">
              <UserAvatar
                avatar={currentUser.avatar}
                name={currentUser.first_name}
                size="xl"
                showBadge={true}
                className="border-2 border-indigo-600 shadow-xl shadow-indigo-600/30"
              />
              <span className="text-[11px] text-slate-400 font-medium">
                {currentUser.avatar ? (isAnimatedAvatar(currentUser.avatar) ? '🔥 Активна живая видео/GIF аватарка' : 'Текущая аватарка') : 'У вас установлена стандартная буква'}
              </span>
            </div>

            {/* Upload Button from Device (Video, GIF, Photos) */}
            <div>
              <label className="w-full py-3.5 px-3 rounded-2xl border-2 border-dashed border-indigo-400 dark:border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 hover:bg-indigo-100/50 text-indigo-700 dark:text-indigo-300 font-bold flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-[0.98]">
                <input
                  type="file"
                  accept="image/*,video/*,.gif,.mp4,.webm,.mov"
                  onChange={handleDeviceAvatarSelect}
                  className="hidden"
                />
                <div className="flex items-center gap-2 text-xs">
                  <Upload className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>
                    {isUploadingAvatar ? 'Загрузка и сохранение...' : '📁 Загрузить Видео / GIF / Фото с телефона'}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 font-normal text-center">
                  Поддерживаются короткие видеоклипы MP4, анимации GIF и любые фото
                </span>
              </label>
            </div>

            {/* Tabs for Presets: Animated vs Static */}
            <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setAvatarTab('animated')}
                className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1 ${
                  avatarTab === 'animated'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <span>🔥 Живые Анимации</span>
              </button>
              <button
                type="button"
                onClick={() => setAvatarTab('static')}
                className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1 ${
                  avatarTab === 'static'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <span>🖼️ 3D и Фото</span>
              </button>
            </div>

            {/* Tab 1: Animated Avatars Grid */}
            {avatarTab === 'animated' && (
              <div className="space-y-2">
                <label className="block font-bold text-slate-700 dark:text-slate-300 text-[11px]">
                  Выберите живую анимированную аватарку:
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {ANIMATED_AVATARS.map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectPresetAvatar(item.url)}
                      className="group relative aspect-square rounded-2xl overflow-hidden border-2 border-slate-200 dark:border-slate-700 hover:border-indigo-600 active:scale-95 transition-all hover:shadow-lg"
                      title={item.name}
                    >
                      <UserAvatar avatar={item.url} name={item.name} size="md" className="w-full h-full" />
                      <div className="absolute inset-x-0 bottom-0 bg-black/70 py-0.5 text-[8px] text-white font-bold text-center truncate px-0.5">
                        {item.name}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Tab 2: Static Presets Grid */}
            {avatarTab === 'static' && (
              <div className="space-y-2">
                <label className="block font-bold text-slate-700 dark:text-slate-300 text-[11px]">
                  Выберите стильный 3D аватар:
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {PRESET_AVATARS.map((url, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectPresetAvatar(url)}
                      className="aspect-square rounded-2xl overflow-hidden border-2 border-slate-200 dark:border-slate-700 hover:border-indigo-600 active:scale-95 transition-all hover:shadow-md"
                    >
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Custom URL */}
            <form onSubmit={handleUrlAvatarSubmit} className="space-y-1.5 pt-1">
              <label className="block font-bold text-slate-700 dark:text-slate-300 text-[11px]">
                Или вставьте ссылку на GIF / Видео / Фото:
              </label>
              <div className="flex gap-1.5">
                <input
                  type="url"
                  placeholder="https://example.com/avatar.gif или .mp4"
                  value={avatarUrlInput}
                  onChange={(e) => setAvatarUrlInput(e.target.value)}
                  className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none"
                />
                <button
                  type="submit"
                  disabled={!avatarUrlInput.trim()}
                  className="px-3 py-2 bg-indigo-600 disabled:opacity-50 text-white font-bold rounded-xl text-xs"
                >
                  OK
                </button>
              </div>
            </form>

            {/* Remove avatar */}
            {currentUser.avatar && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  className="w-full py-2.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Удалить аватарку и вернуть букву</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: DEVELOPER DIRECT NICKNAME CHANGE                 */}
      {/* ======================================================== */}
      {showDevNickModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 text-xs animate-slideUp space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-black text-slate-900 dark:text-white uppercase flex items-center gap-1.5">
                <Edit3 className="w-4 h-4 text-purple-600" />
                <span>Смена никнейма (Разработчик)</span>
              </h3>
              <button onClick={() => setShowDevNickModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              Вы можете изменить отображаемый никнейм. Логин для входа (<b>{currentUser.phone_number}</b>) останется неизменным.
            </p>

            <form onSubmit={handleSaveDevNick} className="space-y-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Новый никнейм / Имя:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Введите никнейм"
                  value={devNewFirstName}
                  onChange={(e) => setDevNewFirstName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Фамилия или приписка (не обязательно):
                </label>
                <input
                  type="text"
                  placeholder="Фамилия / статус"
                  value={devNewLastName}
                  onChange={(e) => setDevNewLastName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDevNickModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isSavingDevNick || !devNewFirstName.trim()}
                  className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-md disabled:opacity-50"
                >
                  {isSavingDevNick ? 'Сохранение...' : 'Сохранить ник'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: DEVELOPER CHANGE PASSWORD FOR USER */}
      {/* ======================================================== */}
      {devPasswordModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 text-xs animate-slideUp space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-black text-slate-900 dark:text-white uppercase flex items-center gap-1.5">
                <Key className="w-4 h-4 text-indigo-600" />
                <span>Смена пароля (Разработчик)</span>
              </h3>
              <button onClick={() => setDevPasswordModalUser(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="text-slate-600 dark:text-slate-300 text-[11px]">
              Пользователь: <strong>{devPasswordModalUser.first_name} {devPasswordModalUser.last_name || ''}</strong> ({devPasswordModalUser.phone_number})
            </div>

            <form onSubmit={handleDeveloperSubmitNewPassword} className="space-y-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Новый пароль:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Введите новый пароль"
                  value={devNewPassword}
                  onChange={(e) => setDevNewPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDevPasswordModalUser(null)}
                  className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={!devNewPassword.trim()}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md disabled:opacity-50"
                >
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: ADD / DELETE CATEGORIES (ДЛЯ РАЗРАБОТЧИКА И АДМИНА) */}
      {/* ======================================================== */}
      {showAddCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-sm max-h-[85vh] bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 text-xs animate-slideUp flex flex-col overflow-hidden space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-black text-slate-900 dark:text-white uppercase flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-emerald-600" />
                <span>Управление категориями</span>
              </h3>
              <button onClick={() => setShowAddCategoryModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="overflow-y-auto space-y-4 flex-1 pr-1">
              {/* Form to create */}
              <form onSubmit={(e) => {
                e.preventDefault();
                if (!newCategoryName.trim()) return;
                const catId = 'cat_' + Date.now();
                const newCat = {
                  id: catId,
                  name: newCategoryName.trim(),
                  iconName: newCategoryIcon || 'Layers',
                  badge: 'НОВОЕ'
                };
                CATEGORIES_LIST.push(newCat);
                setCategoriesListState([...CATEGORIES_LIST]);
                setNewCategoryName('');
              }} className="space-y-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
                <span className="font-extrabold text-slate-800 dark:text-slate-200 block text-[11px] uppercase">
                  + Добавить новую категорию
                </span>
                <div>
                  <input
                    type="text"
                    required
                    placeholder="Название категории"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex gap-2">
                  <select
                    value={newCategoryIcon}
                    onChange={(e) => setNewCategoryIcon(e.target.value)}
                    className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-xs outline-none"
                  >
                    <option value="Layers">Слои / Стандарт</option>
                    <option value="Smartphone">Смартфон</option>
                    <option value="Watch">Часы</option>
                    <option value="Headphones">Наушники</option>
                    <option value="Speaker">Колонка</option>
                    <option value="Zap">Зарядка</option>
                    <option value="Shield">Чехол</option>
                    <option value="Car">Авто</option>
                  </select>

                  <button
                    type="submit"
                    disabled={!newCategoryName.trim()}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md disabled:opacity-50 active:scale-95"
                  >
                    Создать
                  </button>
                </div>
              </form>

              {/* List of existing categories with Delete option */}
              <div className="space-y-2">
                <span className="font-extrabold text-slate-700 dark:text-slate-300 block text-[11px] uppercase">
                  Существующие категории ({categoriesListState.length}):
                </span>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {categoriesListState.map((cat, idx) => (
                    <div
                      key={cat.id || idx}
                      className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold"
                    >
                      <span className="text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
                        {cat.name}
                      </span>

                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Удалить категорию "${cat.name}"?`)) {
                            const index = CATEGORIES_LIST.findIndex(c => c.id === cat.id);
                            if (index !== -1) {
                              CATEGORIES_LIST.splice(index, 1);
                              setCategoriesListState([...CATEGORIES_LIST]);
                            }
                          }
                        }}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors"
                        title="Удалить категорию"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowAddCategoryModal(false)}
                className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl"
              >
                Готово
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: USER SUBMIT PROFILE CHANGE REQUEST */}
      {/* ======================================================== */}
      {showUserRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 text-xs animate-slideUp space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-black text-slate-900 dark:text-white uppercase flex items-center gap-1.5">
                <Edit3 className="w-4 h-4 text-indigo-600" />
                <span>
                  {showUserRequestModal === 'name' ? 'Запрос на смену ника' : showUserRequestModal === 'phone' ? 'Запрос на смену логина' : 'Запрос на смену пароля'}
                </span>
              </h3>
              <button onClick={() => setShowUserRequestModal(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              Операция требует подтверждения администратора или разработчика в целях безопасности.
            </p>

            <form onSubmit={handleUserSubmitChangeRequest} className="space-y-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {showUserRequestModal === 'name' ? 'Новое Имя / Никнейм:' : showUserRequestModal === 'phone' ? 'Новый Логин / Телефон:' : 'Новый Пароль:'}
                </label>
                <input
                  type={showUserRequestModal === 'password' ? 'password' : 'text'}
                  required
                  placeholder={showUserRequestModal === 'password' ? 'Введите новый пароль' : 'Введите новое значение'}
                  value={requestNewValue}
                  onChange={(e) => setRequestNewValue(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {showUserRequestModal === 'name' && (
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Новая Фамилия (не обязательно):
                  </label>
                  <input
                    type="text"
                    placeholder="Введите фамилию"
                    value={requestNewLastName}
                    onChange={(e) => setRequestNewLastName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUserRequestModal(null)}
                  className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={!requestNewValue.trim()}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md disabled:opacity-50"
                >
                  Отправить запрос
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* DYNAMIC ADD PRODUCT MODAL (UZS / USD CURRENCY CONVERTER) */}
      {/* ======================================================== */}
      {showAddProductModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl p-5 max-h-[92vh] overflow-y-auto shadow-2xl border-t sm:border border-slate-200 dark:border-slate-800 text-xs animate-slideUp">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                {editingProduct ? 'Редактирование товара' : 'Добавление товара'}
              </h3>
              <button
                type="button"
                onClick={() => { setShowAddProductModal(false); resetProductForm(); }}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-3.5 pt-3">
              {/* 1. Выбор категории из 13 */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  1. Категория товара (13 категорий):
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white outline-none"
                >
                  {categoriesListState.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* CATEGORY 1: ELECTRONICS / PHONES */}
              {selectedCategory === 'electronics' ? (
                <div className="space-y-3 p-3.5 bg-indigo-50/50 dark:bg-slate-800/60 rounded-2xl border border-indigo-100 dark:border-slate-700">
                  <div>
                    <label className="block font-bold text-indigo-900 dark:text-indigo-300 mb-1.5">
                      Тип устройства:
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPhoneOS('android')}
                        className={`py-2 rounded-xl font-bold border transition-all ${
                          phoneOS === 'android'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        Android
                      </button>
                      <button
                        type="button"
                        onClick={() => setPhoneOS('iphone')}
                        className={`py-2 rounded-xl font-bold border transition-all ${
                          phoneOS === 'iphone'
                            ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 shadow-sm'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        Apple iPhone
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Состояние устройства:
                    </label>
                    <select
                      value={phoneCondition}
                      onChange={(e) => setPhoneCondition(e.target.value as ItemCondition)}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none"
                    >
                      <option value="new">Новое</option>
                      <option value="ideal">Идеальное</option>
                      <option value="used">Использованное (Б/У)</option>
                    </select>
                  </div>

                  {phoneOS === 'android' ? (
                    <>
                      <div>
                        <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Модель Android смартфона:
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Например: Samsung Galaxy S24 Ultra / Xiaomi 14"
                          value={phoneModel}
                          onChange={(e) => setPhoneModel(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Цвет:
                          </label>
                          <input
                            type="text"
                            placeholder="Черный, Белый..."
                            value={phoneColor}
                            onChange={(e) => setPhoneColor(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Память:
                          </label>
                          <select
                            value={phoneStorage}
                            onChange={(e) => setPhoneStorage(e.target.value)}
                            className="w-full px-2.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none"
                          >
                            <option value="32 ГБ">32 ГБ</option>
                            <option value="64 ГБ">64 ГБ</option>
                            <option value="128 ГБ">128 ГБ</option>
                            <option value="256 ГБ">256 ГБ</option>
                            <option value="512 ГБ">512 ГБ</option>
                            <option value="1 ТБ">1 ТБ</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                            ОЗУ (RAM):
                          </label>
                          <select
                            value={phoneRam}
                            onChange={(e) => setPhoneRam(e.target.value)}
                            className="w-full px-2.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none"
                          >
                            <option value="4 ГБ">4 ГБ</option>
                            <option value="6 ГБ">6 ГБ</option>
                            <option value="8 ГБ">8 ГБ</option>
                            <option value="12 ГБ">12 ГБ</option>
                            <option value="16 ГБ">16 ГБ</option>
                          </select>
                        </div>

                        <div>
                          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Бренд:
                          </label>
                          <input
                            type="text"
                            placeholder="Samsung, Xiaomi, Honor..."
                            value={generalBrand}
                            onChange={(e) => setGeneralBrand(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none"
                          />
                        </div>
                      </div>

                      {/* Checklist */}
                      <div>
                        <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                          Комплектация:
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={() => setPkgCable(!pkgCable)}
                            className={`py-1.5 px-2 rounded-xl border flex items-center gap-1 text-[11px] font-semibold ${
                              pkgCable ? 'bg-indigo-50 border-indigo-600 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            {pkgCable ? <CheckSquare className="w-3.5 h-3.5 text-indigo-600" /> : <Square className="w-3.5 h-3.5 text-slate-400" />}
                            <span>Кабель</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setPkgBlock(!pkgBlock)}
                            className={`py-1.5 px-2 rounded-xl border flex items-center gap-1 text-[11px] font-semibold ${
                              pkgBlock ? 'bg-indigo-50 border-indigo-600 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            {pkgBlock ? <CheckSquare className="w-3.5 h-3.5 text-indigo-600" /> : <Square className="w-3.5 h-3.5 text-slate-400" />}
                            <span>Блок</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setPkgCase(!pkgCase)}
                            className={`py-1.5 px-2 rounded-xl border flex items-center gap-1 text-[11px] font-semibold ${
                              pkgCase ? 'bg-indigo-50 border-indigo-600 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            {pkgCase ? <CheckSquare className="w-3.5 h-3.5 text-indigo-600" /> : <Square className="w-3.5 h-3.5 text-slate-400" />}
                            <span>Чехол</span>
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Модель Apple iPhone:
                        </label>
                        <select
                          value={phoneModel}
                          onChange={(e) => setPhoneModel(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none"
                        >
                          <option value="">-- Выберите модель iPhone --</option>
                          {['7', '7 Plus', '8', '8 Plus', 'X', 'XR', 'XS', 'XS Max', '11', '11 Pro', '11 Pro Max', '12', '12 mini', '12 Pro', '12 Pro Max', '13', '13 mini', '13 Pro', '13 Pro Max', '14', '14 Plus', '14 Pro', '14 Pro Max', '15', '15 Plus', '15 Pro', '15 Pro Max', '16', '16 Plus', '16 Pro', '16 Pro Max'].map(m => (
                            <option key={m} value={m}>iPhone {m}</option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                            АКБ (Батарея):
                          </label>
                          <input
                            type="text"
                            placeholder="100% / 88%..."
                            value={batteryHealth}
                            onChange={(e) => setBatteryHealth(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Цвет:
                          </label>
                          <input
                            type="text"
                            placeholder="Natural Titanium..."
                            value={phoneColor}
                            onChange={(e) => setPhoneColor(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Память:
                        </label>
                        <select
                          value={phoneStorage}
                          onChange={(e) => setPhoneStorage(e.target.value)}
                          className="w-full px-2.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none"
                        >
                          <option value="64 ГБ">64 ГБ</option>
                          <option value="128 ГБ">128 ГБ</option>
                          <option value="256 ГБ">256 ГБ</option>
                          <option value="512 ГБ">512 ГБ</option>
                          <option value="1 ТБ">1 ТБ</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                          Комплектация:
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={() => setPkgCable(!pkgCable)}
                            className={`py-1.5 px-2 rounded-xl border flex items-center gap-1 text-[11px] font-semibold ${
                              pkgCable ? 'bg-indigo-50 border-indigo-600 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            {pkgCable ? <CheckSquare className="w-3.5 h-3.5 text-indigo-600" /> : <Square className="w-3.5 h-3.5 text-slate-400" />}
                            <span>Кабель</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setPkgBlock(!pkgBlock)}
                            className={`py-1.5 px-2 rounded-xl border flex items-center gap-1 text-[11px] font-semibold ${
                              pkgBlock ? 'bg-indigo-50 border-indigo-600 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            {pkgBlock ? <CheckSquare className="w-3.5 h-3.5 text-indigo-600" /> : <Square className="w-3.5 h-3.5 text-slate-400" />}
                            <span>Блок</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setPkgHeadphones(!pkgHeadphones)}
                            className={`py-1.5 px-2 rounded-xl border flex items-center gap-1 text-[11px] font-semibold ${
                              pkgHeadphones ? 'bg-indigo-50 border-indigo-600 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            {pkgHeadphones ? <CheckSquare className="w-3.5 h-3.5 text-indigo-600" /> : <Square className="w-3.5 h-3.5 text-slate-400" />}
                            <span>Наушники</span>
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                /* OTHER 12 CATEGORIES */
                <div className="space-y-3 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Название модели товара:
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Например: JBL Charge 5 / Baseus 65W GaN"
                      value={generalName}
                      onChange={(e) => setGeneralName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Бренд:
                    </label>
                    <input
                      type="text"
                      placeholder="Apple, Samsung, Baseus, Anker, JBL..."
                      value={generalBrand}
                      onChange={(e) => setGeneralBrand(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Описание товара:
                    </label>
                    <textarea
                      placeholder="Подробное описание и свойства..."
                      value={generalDesc}
                      onChange={(e) => setGeneralDesc(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none h-16 resize-none"
                    />
                  </div>
                </div>
              )}

              {/* Photos from Device (Gallery / Camera) & Preview */}
              <div className="space-y-2.5 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>Фотографии товара ({devicePhotos.length}/4 шт.):</span>
                  </label>
                  {devicePhotos.length > 0 && (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                      ✓ Добавлено: {devicePhotos.length}
                    </span>
                  )}
                </div>

                {/* Thumbnails Grid */}
                {devicePhotos.length > 0 && (
                  <div className="grid grid-cols-4 gap-2">
                    {devicePhotos.map((photo, idx) => (
                      <div key={idx} className="relative group aspect-square rounded-xl overflow-hidden border-2 border-indigo-500/50 bg-slate-200 dark:bg-slate-850 shadow-sm">
                        <img src={photo} alt={`Фото ${idx + 1}`} className="w-full h-full object-cover" />
                        <div className="absolute top-1 left-1 bg-black/70 text-white text-[9px] font-black px-1.5 py-0.5 rounded">
                          {idx === 0 ? 'Главное' : `#${idx + 1}`}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(idx)}
                          className="absolute top-1 right-1 w-5 h-5 bg-rose-600 text-white rounded-full flex items-center justify-center text-xs font-bold hover:bg-rose-700 shadow-md active:scale-90"
                          title="Удалить фото"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload Button from Device */}
                {devicePhotos.length < 4 && (
                  <div>
                    <label className="w-full py-3 px-3 rounded-xl border-2 border-dashed border-indigo-400 dark:border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 hover:bg-indigo-100/50 text-indigo-700 dark:text-indigo-300 font-bold flex flex-col items-center justify-center gap-1 cursor-pointer transition-all active:scale-[0.99]">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleDevicePhotoSelect}
                        className="hidden"
                      />
                      <div className="flex items-center gap-2 text-xs">
                        <Upload className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        <span>
                          {isCompressingPhoto ? 'Обработка фото...' : 'Выбрать фото из Галереи / Камеры'}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-normal">
                        Поддерживаются форматы JPG, PNG, WEBP (до 4 фото)
                      </span>
                    </label>
                  </div>
                )}

                {/* Optional URL input fallback */}
                <div className="pt-1">
                  <div className="flex gap-1.5">
                    <input
                      type="url"
                      placeholder="Или вставьте ссылку на фото (URL)..."
                      value={photoUrlInput}
                      onChange={(e) => setPhotoUrlInput(e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddPhotoByUrl}
                      disabled={!photoUrlInput.trim() || devicePhotos.length >= 4}
                      className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 disabled:opacity-50 text-slate-800 dark:text-white font-bold rounded-xl text-[11px]"
                    >
                      + Добавить
                    </button>
                  </div>
                </div>
              </div>

              {/* CURRENCY SELECTOR & CONVERTER ($ USD / UZS СУМ) */}
              <div className="p-3.5 bg-gradient-to-br from-amber-50 to-indigo-50 dark:from-slate-800 dark:to-indigo-950/40 rounded-2xl border border-amber-200 dark:border-amber-900/50 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>Валюта ввода цены:</span>
                  </label>

                  <div className="flex bg-white dark:bg-slate-900 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setPriceCurrency('uzs')}
                      className={`px-3 py-1 rounded-lg font-bold transition-all ${
                        priceCurrency === 'uzs'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      Сум (UZS)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPriceCurrency('usd')}
                      className={`px-3 py-1 rounded-lg font-bold transition-all ${
                        priceCurrency === 'usd'
                          ? 'bg-amber-600 text-white shadow-sm'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      Доллар ($)
                    </button>
                  </div>
                </div>

                {/* Price input */}
                <div>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min="1"
                      placeholder={priceCurrency === 'usd' ? 'Например: 1200 ($)' : 'Например: 15000000 (сум)'}
                      value={inputPrice}
                      onChange={(e) => setInputPrice(e.target.value)}
                      className="w-full pl-3.5 pr-14 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-black text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-bold text-xs text-indigo-600 dark:text-indigo-400 uppercase">
                      {priceCurrency === 'usd' ? '$ USD' : 'СУМ'}
                    </span>
                  </div>
                </div>

                {/* If Dollar is selected: show live rate and auto-converted sums */}
                {priceCurrency === 'usd' && (
                  <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-amber-300 dark:border-amber-800 space-y-1.5 text-[11px]">
                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                      <span>Курс 1$ в сумах:</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={usdRate}
                          onChange={(e) => setUsdRate(e.target.value)}
                          className="w-20 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-bold text-right outline-none"
                        />
                        <span className="font-bold">сум</span>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center pt-1 border-t border-slate-100 dark:border-slate-800 font-black text-xs text-indigo-600 dark:text-indigo-400">
                      <span>Итоговая цена в сумах:</span>
                      <span className="text-sm">{calculateFinalPriceInUzs().toLocaleString('ru-RU')} сум</span>
                    </div>
                  </div>
                )}
              </div>

              {/* STOCK QUANTITY INPUT (Управление наличием) */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1.5">
                <label className="block font-bold text-slate-900 dark:text-white text-xs">
                  Количество на складе (шт.):
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    placeholder="Например: 5"
                    value={stockQuantityInput}
                    onChange={(e) => setStockQuantityInput(e.target.value)}
                    className="w-full pl-3.5 pr-12 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-black text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-bold text-xs text-slate-400">
                    шт.
                  </span>
                </div>
                <p className="text-[10px] text-slate-500">
                  Если указать 0 — товар будет отображаться как «Под заказ».
                </p>
              </div>

              {/* SKU VARIANTS BUILDER (Для разработчика/админа) */}
              <div className="p-3.5 bg-gradient-to-br from-indigo-50/70 to-sky-50/70 dark:from-slate-800 dark:to-slate-850/60 rounded-2xl border border-indigo-200 dark:border-indigo-800/50 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-extrabold text-indigo-900 dark:text-indigo-300 text-xs flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>Вариации товара (Цвет / Модель)</span>
                  </label>
                  <input
                    type="checkbox"
                    checked={useVariants}
                    onChange={(e) => setUseVariants(e.target.checked)}
                    className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                  />
                </div>

                {useVariants && (
                  <div className="space-y-2.5 pt-1 text-xs">
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        1. Доступные Цвета (через запятую):
                      </label>
                      <input
                        type="text"
                        placeholder="Например: Черный, Белый, Синий, Золотой"
                        value={variantAttrColorText}
                        onChange={(e) => setVariantAttrColorText(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                          2. Название 2-й опции:
                        </label>
                        <input
                          type="text"
                          placeholder="Модель / Память"
                          value={variantOptionName}
                          onChange={(e) => setVariantOptionName(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Список Моделей (через запятую):
                        </label>
                        <input
                          type="text"
                          placeholder="iPhone 13, iPhone 14 Pro, S24"
                          value={variantAttrOptionText}
                          onChange={(e) => setVariantAttrOptionText(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 outline-none"
                        />
                      </div>
                    </div>

                    <p className="text-[10px] text-indigo-600 dark:text-indigo-300 font-semibold">
                      ✓ Покупатель сможет зайти в карточку товара и сначала выбрать Цвет, а затем выбрать {variantOptionName || 'Модель'} своего телефона.
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className={`w-full py-3.5 ${editingProduct ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/30'} active:scale-95 text-white font-black rounded-2xl text-xs shadow-xl flex items-center justify-center gap-2`}
                >
                  {editingProduct ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  <span>{editingProduct ? 'Сохранить изменения' : 'Добавить товар в каталог'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2FA Verification Modal */}
      {render2FAModal()}
    </div>
  );
};
