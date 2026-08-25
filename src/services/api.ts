import { Order, Product, OrderStatus, User, ProfileChangeRequest, UserRole, PromoCode } from '../types';
import { db } from '../db/database';

function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = 5000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timeoutId));
}

// Official 24/7 Global Production Cloud Server on Render.com (100% Free)
export const DEFAULT_PRODUCTION_SERVER = 'https://shaxsmart-store.onrender.com';

export class ApiService {
  private static instance: ApiService;
  private serverUrl: string;
  private isOnline: boolean = false;
  private statusListeners: ((online: boolean, url: string) => void)[] = [];
  private productListeners: ((products: Product[]) => void)[] = [];
  private userListeners: ((users: User[]) => void)[] = [];
  private requestListeners: ((requests: ProfileChangeRequest[]) => void)[] = [];
  private promoCodeListeners: ((promos: PromoCode[]) => void)[] = [];

  private constructor() {
    const saved = localStorage.getItem('server_url');
    // If no saved URL or previously saved was localhost/local IP, upgrade to official Railway cloud server
    if (saved && !saved.includes('192.168.') && !saved.includes('localhost') && !saved.includes('127.0.0.1')) {
      this.serverUrl = saved;
    } else {
      this.serverUrl = DEFAULT_PRODUCTION_SERVER;
      localStorage.setItem('server_url', this.serverUrl);
    }

    this.checkHealth();
    this.startAutoSync();
  }

  public static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
    }
    return ApiService.instance;
  }

  public onStatusChange(listener: (online: boolean, url: string) => void): () => void {
    this.statusListeners.push(listener);
    listener(this.isOnline, this.serverUrl);
    return () => {
      this.statusListeners = this.statusListeners.filter(l => l !== listener);
    };
  }

  public onProductsChange(listener: (products: Product[]) => void): () => void {
    this.productListeners.push(listener);
    return () => {
      this.productListeners = this.productListeners.filter(l => l !== listener);
    };
  }

  public onUsersChange(listener: (users: User[]) => void): () => void {
    this.userListeners.push(listener);
    return () => {
      this.userListeners = this.userListeners.filter(l => l !== listener);
    };
  }

  public onRequestChange(listener: (requests: ProfileChangeRequest[]) => void): () => void {
    this.requestListeners.push(listener);
    return () => {
      this.requestListeners = this.requestListeners.filter(l => l !== listener);
    };
  }

  public onPromoCodesChange(listener: (promos: PromoCode[]) => void): () => void {
    this.promoCodeListeners.push(listener);
    return () => {
      this.promoCodeListeners = this.promoCodeListeners.filter(l => l !== listener);
    };
  }

  private notifyStatus() {
    this.statusListeners.forEach(l => l(this.isOnline, this.serverUrl));
  }

  private notifyProducts(products: Product[]) {
    this.productListeners.forEach(l => l(products));
  }

  private notifyUsers(users: User[]) {
    this.userListeners.forEach(l => l(users));
  }

  private notifyRequests(requests: ProfileChangeRequest[]) {
    this.requestListeners.forEach(l => l(requests));
  }

  private notifyPromoCodes(promos: PromoCode[]) {
    this.promoCodeListeners.forEach(l => l(promos));
  }

  public setServerUrl(url: string) {
    let cleanUrl = url.trim().replace(/\/$/, '');
    
    // Remove default :4000 if entered for railway/render cloud domains
    if (cleanUrl.includes('railway.app:4000')) {
      cleanUrl = cleanUrl.replace(':4000', '');
    }
    if (cleanUrl.includes('onrender.com:4000')) {
      cleanUrl = cleanUrl.replace(':4000', '');
    }

    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      if (cleanUrl.includes('railway.app') || cleanUrl.includes('onrender.com') || cleanUrl.includes('loca.lt')) {
        cleanUrl = `https://${cleanUrl}`;
      } else {
        cleanUrl = `http://${cleanUrl}`;
      }
    }

    // Only append port 4000 for raw IP addresses
    if (!cleanUrl.includes(':', 7) && !cleanUrl.includes('railway.app') && !cleanUrl.includes('onrender.com')) {
      cleanUrl = `${cleanUrl}:4000`;
    }

    this.serverUrl = cleanUrl;
    localStorage.setItem('server_url', this.serverUrl);
    this.checkHealth();
    this.getProducts();
    this.getUsers();
  }

  public getServerUrl(): string {
    return this.serverUrl;
  }

  public getIsOnline(): boolean {
    return this.isOnline;
  }

  public async checkHealth(): Promise<boolean> {
    try {
      const res = await fetchWithTimeout(`${this.serverUrl}/api/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      }, 4000);
      
      if (res.ok) {
        const data = await res.json();
        this.isOnline = (data.status === 'online');
      } else {
        this.isOnline = false;
      }
      this.notifyStatus();
      return this.isOnline;
    } catch (e) {
      this.isOnline = false;
      this.notifyStatus();
      return false;
    }
  }

  public async scanWifiForServer(): Promise<string | null> {
    const isOk = await this.checkHealth();
    if (isOk) return this.serverUrl;
    return null;
  }

  // Automatic periodic sync
  private startAutoSync() {
    this.getProducts();
    this.getOrders();
    this.getUsers();
    this.getProfileRequests();
    this.getPromoCodes();

    setInterval(() => {
      this.checkHealth();
      this.getProducts();
      this.getOrders();
      this.getUsers();
      this.getProfileRequests();
      this.getPromoCodes();
    }, 3000);
  }

  // ========================================================
  // USERS & DEVELOPER CONTROLS
  // ========================================================

  public async getUsers(): Promise<User[]> {
    try {
      const res = await fetchWithTimeout(`${this.serverUrl}/api/users`, {
        method: 'GET'
      }, 4000);
      if (res.ok) {
        const data = await res.json();
        const serverUsers: User[] = data.users || [];
        
        // Sync local db
        await db.users.clear();
        if (serverUsers.length > 0) {
          await db.users.bulkPut(serverUsers);
        }
        this.notifyUsers(serverUsers);
        return serverUsers;
      }
    } catch (e) {}
    const local = await db.users.toArray();
    return local;
  }

  public async registerUser(data: {
    first_name: string;
    last_name?: string;
    phone_number: string;
    password_hash: string;
  }): Promise<{ success: boolean; error?: string; user?: User }> {
    try {
      const res = await fetchWithTimeout(`${this.serverUrl}/api/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }, 6000);

      const json = await res.json();
      if (res.ok && json.user) {
        await db.users.put(json.user);
        await this.getUsers();
        return { success: true, user: json.user };
      }
      return { success: false, error: json.error || 'Ошибка регистрации' };
    } catch (e: any) {
      // Offline fallback
      const cleanLogin = data.phone_number.trim();
      const existing = await db.users.where('phone_number').equals(cleanLogin).first();
      if (existing) {
        return { success: false, error: 'Пользователь с таким номером/логином уже существует' };
      }
      const newUser: User = {
        id: Date.now(),
        first_name: data.first_name.trim(),
        last_name: data.last_name ? data.last_name.trim() : '',
        phone_number: cleanLogin,
        password_hash: data.password_hash,
        role: 'user',
        created_at: new Date().toISOString()
      };
      await db.users.add(newUser);
      return { success: true, user: newUser };
    }
  }

  public async loginUser(phone: string, passwordHash: string): Promise<{ 
    success: boolean; 
    error?: string; 
    user?: User; 
    require2FA?: boolean; 
    sessionId?: string; 
    userName?: string; 
    role?: UserRole; 
  }> {
    const cleanLogin = (phone || '').trim().toLowerCase();
    const cleanPass = (passwordHash || '').trim();

    // 1. Cloud Authentication with 2FA Protection
    try {
      const res = await fetchWithTimeout(`${this.serverUrl}/api/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phone.trim(), password_hash: cleanPass })
      }, 7000);

      const json = await res.json();
      if (res.ok) {
        if (json.require2FA) {
          return {
            success: true,
            require2FA: true,
            sessionId: json.sessionId,
            role: json.role,
            userName: json.userName
          };
        }
        if (json.user) {
          await db.users.put(json.user);
          return { success: true, user: json.user };
        }
      }
      if (res.status === 401) {
        return { success: false, error: json.error || 'Неверный пароль' };
      }
      if (res.status === 404 && json.error && json.error !== 'Маршрут не найден') {
        return { success: false, error: json.error };
      }
    } catch (e) {
      console.warn('[Login Cloud Error]:', e);
    }

    // 2. Offline Mode Fallback
    const all = await db.users.toArray();
    const user = all.find(u => u.phone_number.toLowerCase() === cleanLogin);
    if (!user) {
      return { success: false, error: 'Пользователь с таким логином или телефоном не найден' };
    }
    if (user.password_hash !== cleanPass && user.password_hash.toLowerCase() !== cleanPass.toLowerCase()) {
      return { success: false, error: 'Неверный пароль' };
    }
    return { success: true, user };
  }

  // Verify 2FA code sent via Telegram
  public async verify2FACode(sessionId: string, code: string): Promise<{ success: boolean; error?: string; user?: User }> {
    try {
      const res = await fetchWithTimeout(`${this.serverUrl}/api/auth/2fa/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, code: code.trim() })
      }, 7000);

      const json = await res.json();
      if (res.ok && json.user) {
        await db.users.put(json.user);
        return { success: true, user: json.user };
      }
      return { success: false, error: json.error || 'Неверный код 2FA' };
    } catch (e: any) {
      return { success: false, error: 'Ошибка соединения с сервером проверки' };
    }
  }

  // Resend 2FA code via Telegram
  public async resend2FACode(sessionId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetchWithTimeout(`${this.serverUrl}/api/auth/2fa/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      }, 7000);

      const json = await res.json();
      if (res.ok) {
        return { success: true };
      }
      return { success: false, error: json.error || 'Ошибка отправки' };
    } catch (e: any) {
      return { success: false, error: 'Ошибка соединения с сервером' };
    }
  }

  // Developer Action: Delete user
  public async deleteUser(userId: number): Promise<{ success: boolean; error?: string }> {
    await db.users.delete(userId);

    try {
      const res = await fetchWithTimeout(`${this.serverUrl}/api/users/${userId}`, {
        method: 'DELETE'
      }, 4000);
      const json = await res.json();
      if (res.ok) {
        await this.getUsers();
        return { success: true };
      }
      return { success: false, error: json.error || 'Ошибка удаления' };
    } catch (e: any) {
      return { success: true };
    }
  }

  // Developer Action: Change user's password directly
  public async changeUserPassword(userId: number, newPassword: string): Promise<{ success: boolean; error?: string }> {
    await db.users.update(userId, { password_hash: newPassword });

    try {
      const res = await fetchWithTimeout(`${this.serverUrl}/api/users/${userId}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword })
      }, 4000);
      const json = await res.json();
      if (res.ok) {
        await this.getUsers();
        return { success: true };
      }
      return { success: false, error: json.error || 'Ошибка смены пароля' };
    } catch (e: any) {
      return { success: true };
    }
  }

  // Developer Action: Change user role
  public async changeUserRole(userId: number, role: UserRole): Promise<{ success: boolean; error?: string }> {
    await db.users.update(userId, { role });

    try {
      const res = await fetchWithTimeout(`${this.serverUrl}/api/users/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role })
      }, 4000);
      const json = await res.json();
      if (res.ok) {
        await this.getUsers();
        return { success: true };
      }
      return { success: false, error: json.error || 'Ошибка изменения роли' };
    } catch (e: any) {
      return { success: true };
    }
  }

  // Developer / User Action: Update Avatar
  public async updateUserAvatar(userId: number, avatar: string): Promise<{ success: boolean; error?: string; user?: User }> {
    await db.users.update(userId, { avatar });

    try {
      const res = await fetchWithTimeout(`${this.serverUrl}/api/users/${userId}/avatar`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar })
      }, 7000);
      const json = await res.json();
      if (res.ok && json.user) {
        await db.users.put(json.user);
        await this.getUsers();
        return { success: true, user: json.user };
      }
      return { success: false, error: json.error || 'Ошибка обновления аватарки' };
    } catch (e: any) {
      return { success: true };
    }
  }

  // ========================================================
  // PROFILE CHANGE REQUESTS (NICKNAME & PASSWORD APPROVAL)
  // ========================================================

  public async getProfileRequests(): Promise<ProfileChangeRequest[]> {
    try {
      const res = await fetchWithTimeout(`${this.serverUrl}/api/profile-requests`, {
        method: 'GET'
      }, 4000);
      if (res.ok) {
        const data = await res.json();
        const reqs: ProfileChangeRequest[] = data.requests || [];
        await db.profileRequests.clear();
        if (reqs.length > 0) {
          await db.profileRequests.bulkPut(reqs);
        }
        this.notifyRequests(reqs);
        return reqs;
      }
    } catch (e) {}
    const local = await db.profileRequests.toArray();
    return local;
  }

  public async submitProfileRequest(data: Omit<ProfileChangeRequest, 'id' | 'status' | 'createdAt'>): Promise<{ success: boolean; error?: string; request?: ProfileChangeRequest }> {
    const newReq: ProfileChangeRequest = {
      ...data,
      id: Date.now(),
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    try {
      const res = await fetchWithTimeout(`${this.serverUrl}/api/profile-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }, 5000);
      if (res.ok) {
        const json = await res.json();
        if (json.request) {
          await db.profileRequests.put(json.request);
          await this.getProfileRequests();
          return { success: true, request: json.request };
        }
      }
    } catch (e) {}

    await db.profileRequests.put(newReq);
    return { success: true, request: newReq };
  }

  public async approveProfileRequest(requestId: number, reviewedBy: string): Promise<boolean> {
    try {
      const res = await fetchWithTimeout(`${this.serverUrl}/api/profile-requests/${requestId}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewedBy })
      }, 5000);
      if (res.ok) {
        await this.getUsers();
        await this.getProfileRequests();
        return true;
      }
    } catch (e) {}

    await db.profileRequests.update(requestId, { status: 'approved', reviewedBy, reviewedAt: new Date().toISOString() });
    return true;
  }

  public async rejectProfileRequest(requestId: number, reviewedBy: string): Promise<boolean> {
    try {
      const res = await fetchWithTimeout(`${this.serverUrl}/api/profile-requests/${requestId}/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewedBy })
      }, 5000);
      if (res.ok) {
        await this.getProfileRequests();
        return true;
      }
    } catch (e) {}

    await db.profileRequests.update(requestId, { status: 'rejected', reviewedBy, reviewedAt: new Date().toISOString() });
    return true;
  }

  // ========================================================
  // CUSTOMER TELEGRAM VERIFICATION
  // ========================================================

  public async requestCustomerCode(phone: string): Promise<{ success: boolean; botLink?: string; error?: string }> {
    try {
      const res = await fetchWithTimeout(`${this.serverUrl}/api/customer/request-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      }, 8000);
      return await res.json();
    } catch {
      return { success: false, error: 'Нет связи с сервером' };
    }
  }

  public async verifyCustomerCode(phone: string, code: string): Promise<{ success: boolean; verified?: boolean; error?: string }> {
    try {
      const res = await fetchWithTimeout(`${this.serverUrl}/api/customer/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code })
      }, 8000);
      return await res.json();
    } catch {
      return { success: false, error: 'Нет связи с сервером' };
    }
  }

  // ========================================================
  // PRODUCTS & ORDERS
  // ========================================================

  public async getProducts(): Promise<Product[]> {
    try {
      const res = await fetchWithTimeout(`${this.serverUrl}/api/products`, {
        method: 'GET'
      }, 5000);
      if (res.ok) {
        const data = await res.json();
        const serverProducts: Product[] = data.products || [];
        
        await db.products.clear();
        if (serverProducts.length > 0) {
          await db.products.bulkPut(serverProducts);
        }
        this.notifyProducts(serverProducts);
        return serverProducts;
      }
    } catch (e) {}
    return await db.products.toArray();
  }

  public async saveProduct(product: Product): Promise<boolean> {
    await db.products.put(product);

    try {
      const res = await fetchWithTimeout(`${this.serverUrl}/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(product)
      }, 7000);
      
      if (res.ok) {
        await this.getProducts();
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  public async deleteProduct(productId: number): Promise<boolean> {
    await db.products.delete(productId);

    try {
      const res = await fetchWithTimeout(`${this.serverUrl}/api/products/${productId}`, {
        method: 'DELETE'
      }, 5000);
      
      if (res.ok) {
        await this.getProducts();
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  public async getOrders(): Promise<Order[]> {
    try {
      const res = await fetchWithTimeout(`${this.serverUrl}/api/orders`, {
        method: 'GET'
      }, 5000);
      if (res.ok) {
        const data = await res.json();
        const serverOrders: Order[] = data.orders || [];
        
        for (const o of serverOrders) {
          if (o.id) {
            const exists = await db.orders.get(o.id);
            if (!exists) {
              await db.orders.put(o);
            } else if (exists.status !== o.status) {
              await db.orders.update(o.id, { status: o.status, adminNote: o.adminNote });
            }
          }
        }
        return serverOrders;
      }
    } catch (e) {}
    return await db.orders.toArray();
  }

  public async createOrder(order: Omit<Order, 'id'>): Promise<Order> {
    let createdOrder: Order = { ...order, id: Date.now() };

    try {
      const res = await fetchWithTimeout(`${this.serverUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order)
      }, 6000);

      if (res.ok) {
        const data = await res.json();
        if (data.order) {
          createdOrder = data.order;
        }
      }
    } catch (e) {}

    await db.orders.put(createdOrder);
    return createdOrder;
  }

  public async updateOrderStatus(orderId: number, status: OrderStatus, adminNote?: string): Promise<boolean> {
    await db.orders.update(orderId, { status, adminNote });

    try {
      const res = await fetchWithTimeout(`${this.serverUrl}/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, adminNote })
      }, 5000);
      return res.ok;
    } catch (e) {
      return false;
    }
  }

  // ========================================================
  // USER NICKNAME DIRECT UPDATE (DEVELOPER & USERS)
  // ========================================================

  public async changeUserNickname(userId: number, firstName: string, lastName?: string): Promise<{ success: boolean; error?: string; user?: User }> {
    await db.users.update(userId, { first_name: firstName, last_name: lastName });

    try {
      const res = await fetchWithTimeout(`${this.serverUrl}/api/users/${userId}/nickname`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ first_name: firstName, last_name: lastName })
      }, 5000);
      const json = await res.json();
      if (res.ok && json.user) {
        await db.users.put(json.user);
        await this.getUsers();
        return { success: true, user: json.user };
      }
      return { success: false, error: json.error || 'Ошибка обновления никнейма' };
    } catch (e: any) {
      return { success: true };
    }
  }

  // ========================================================
  // PROMO CODES SYSTEM (DEVELOPER GENERATOR & CUSTOMER USAGE)
  // ========================================================

  public async getPromoCodes(): Promise<PromoCode[]> {
    try {
      const res = await fetchWithTimeout(`${this.serverUrl}/api/promocodes`, {
        method: 'GET'
      }, 4000);
      if (res.ok) {
        const data = await res.json();
        const rawPromos = data.promoCodes || [];
        const promos: PromoCode[] = rawPromos.map((p: any) => ({
          ...p,
          id: Number(p.id) || Date.now(),
          code: String(p.code || '').trim().toUpperCase(),
          discountPercent: Number(p.discountPercent) || 0,
          minOrderSum: Number(p.minOrderSum !== undefined ? p.minOrderSum : (p.minOrderAmount || 0)),
          isUsed: Boolean(p.isUsed),
          isOneTime: p.isOneTime !== undefined ? Boolean(p.isOneTime) : true,
          usedBy: p.usedBy || null,
          usedAt: p.usedAt || null,
          createdBy: p.createdBy || 'Разработчик',
          createdAt: p.createdAt || new Date().toISOString()
        }));

        await db.promoCodes.clear();
        if (promos.length > 0) {
          await db.promoCodes.bulkPut(promos);
        }
        this.notifyPromoCodes(promos);
        return promos;
      }
    } catch (e) {}
    const local = await db.promoCodes.toArray();
    return local;
  }

  public async createPromoCode(data: { discountPercent: number; minOrderSum: number; code?: string; createdBy?: string }): Promise<{ success: boolean; promoCode?: PromoCode; error?: string }> {
    const payload = {
      discountPercent: Number(data.discountPercent) || 10,
      minOrderSum: Number(data.minOrderSum) || 0,
      minOrderAmount: Number(data.minOrderSum) || 0,
      code: data.code ? data.code.trim().toUpperCase() : undefined,
      createdBy: data.createdBy || 'Разработчик'
    };

    try {
      const res = await fetchWithTimeout(`${this.serverUrl}/api/promocodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }, 5000);
      const json = await res.json();
      if (res.ok && json.promoCode) {
        const p = json.promoCode;
        const normalized: PromoCode = {
          ...p,
          id: Number(p.id) || Date.now(),
          code: String(p.code || '').trim().toUpperCase(),
          discountPercent: Number(p.discountPercent) || payload.discountPercent,
          minOrderSum: Number(p.minOrderSum !== undefined ? p.minOrderSum : (p.minOrderAmount || payload.minOrderSum)),
          isUsed: Boolean(p.isUsed),
          isOneTime: p.isOneTime !== undefined ? Boolean(p.isOneTime) : true,
          createdBy: p.createdBy || payload.createdBy,
          createdAt: p.createdAt || new Date().toISOString()
        };
        await db.promoCodes.put(normalized);
        await this.getPromoCodes();
        return { success: true, promoCode: normalized };
      }
      return { success: false, error: json.error || 'Ошибка создания промокода' };
    } catch (e: any) {
      // Local fallback
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let rand = '';
      for (let i = 0; i < 6; i++) rand += chars.charAt(Math.floor(Math.random() * chars.length));
      const newPromo: PromoCode = {
        id: Date.now(),
        code: (data.code || `SHAX-${rand}`).toUpperCase().trim(),
        discountPercent: Number(data.discountPercent) || 10,
        minOrderSum: Number(data.minOrderSum) || 0,
        isUsed: false,
        createdAt: new Date().toISOString(),
        createdBy: data.createdBy || 'Разработчик'
      };
      await db.promoCodes.put(newPromo);
      await this.getPromoCodes();
      return { success: true, promoCode: newPromo };
    }
  }

  public async deletePromoCode(promoId: number): Promise<{ success: boolean }> {
    await db.promoCodes.delete(promoId);
    try {
      await fetchWithTimeout(`${this.serverUrl}/api/promocodes/${promoId}`, {
        method: 'DELETE'
      }, 4000);
    } catch (e) {}
    await this.getPromoCodes();
    return { success: true };
  }

  public async validatePromoCode(code: string, cartTotal: number): Promise<{ valid: boolean; discountPercent?: number; discountAmount?: number; minOrderSum?: number; promoCode?: string; error?: string }> {
    // Sanitize user code input: remove all spaces, normalize uppercase
    const cleanCode = code.replace(/\s+/g, '').trim().toUpperCase();
    if (!cleanCode) {
      return { valid: false, error: 'Введите промокод' };
    }

    try {
      const res = await fetchWithTimeout(`${this.serverUrl}/api/promocodes/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: cleanCode, cartTotal })
      }, 5000);
      const json = await res.json();
      
      if (res.ok && (json.valid || json.success)) {
        const promo = json.promoCode || {};
        const pct = Number(json.discountPercent || promo.discountPercent || 0);
        const minOrder = Number(json.minOrderSum !== undefined ? json.minOrderSum : (promo.minOrderAmount || promo.minOrderSum || 0));
        
        if (pct > 0) {
          const discountAmount = Number(json.discountAmount) || Math.round((cartTotal * pct) / 100);
          return {
            valid: true,
            discountPercent: pct,
            discountAmount,
            minOrderSum: minOrder,
            promoCode: (promo.code || cleanCode).toUpperCase()
          };
        }
      }
      if (json.error) {
        return { valid: false, error: json.error };
      }
    } catch (e) {}

    // Local check fallback in Dexie DB
    const local = await db.promoCodes.where('code').equalsIgnoreCase(cleanCode).first();
    if (!local) {
      return { valid: false, error: 'Промокод не найден или не существует' };
    }
    if (local.isUsed) {
      return { valid: false, error: 'Этот промокод уже был использован' };
    }
    const minSum = Number(local.minOrderSum || (local as any).minOrderAmount || 0);
    if (cartTotal < minSum) {
      return { valid: false, error: `Минимальная сумма заказа: ${minSum.toLocaleString('ru-RU')} сум` };
    }
    const discountAmount = Math.round((cartTotal * local.discountPercent) / 100);
    return {
      valid: true,
      discountPercent: local.discountPercent,
      discountAmount,
      minOrderSum: minSum,
      promoCode: local.code.toUpperCase()
    };
  }

  public async usePromoCode(code: string, orderId: number, customerName: string): Promise<{ success: boolean }> {
    const cleanCode = code.replace(/\s+/g, '').trim().toUpperCase();
    try {
      await fetchWithTimeout(`${this.serverUrl}/api/promocodes/use`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: cleanCode, orderId, customerName })
      }, 4000);
    } catch (e) {}

    const local = await db.promoCodes.where('code').equalsIgnoreCase(cleanCode).first();
    if (local) {
      await db.promoCodes.update(local.id, {
        isUsed: true,
        usedBy: customerName || 'Покупатель',
        usedAt: new Date().toISOString()
      });
    }
    await this.getPromoCodes();
    return { success: true };
  }
}

export const api = ApiService.getInstance();
