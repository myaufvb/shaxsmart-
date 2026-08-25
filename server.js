import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, 'server_database.json');
const PORT = process.env.PORT || 4000;
const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

// Helper to get all local network Wi-Fi / LAN IPs
function getAllLocalIPs() {
  const nets = os.networkInterfaces();
  const results = [];
  
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        const isWifiOrLan = net.address.startsWith('192.168.') || 
                            net.address.startsWith('10.') || 
                            (net.address.startsWith('172.') && !net.address.startsWith('169.254.'));
        results.push({
          name,
          address: net.address,
          isPreferred: isWifiOrLan
        });
      }
    }
  }

  results.sort((a, b) => (b.isPreferred ? 1 : 0) - (a.isPreferred ? 1 : 0));
  return results;
}

function getPrimaryWifiIP() {
  const ips = getAllLocalIPs();
  return ips.length > 0 ? ips[0].address : 'localhost';
}

// Initial DB state with master accounts
const INITIAL_MASTER_USERS = [
  {
    id: 1,
    first_name: 'Главный',
    last_name: 'Администратор',
    phone_number: 'Admin_log',
    password_hash: 'M2010090900',
    role: 'admin',
    created_at: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 2,
    first_name: 'Александр',
    last_name: 'Лерман',
    phone_number: 'Lerman_dev',
    password_hash: '2010090900',
    role: 'developer',
    created_at: '2026-01-01T00:00:00.000Z'
  }
];

let database = {
  orders: [],
  products: [],
  users: [...INITIAL_MASTER_USERS],
  profileRequests: [],
  lastUpdated: new Date().toISOString()
};

// PostgreSQL Integration for 24/7 Persistent Storage on Railway
let pgPool = null;

async function initDatabase() {
  if (DATABASE_URL) {
    try {
      pgPool = new Pool({
        connectionString: DATABASE_URL,
        ssl: DATABASE_URL.includes('railway') || DATABASE_URL.includes('render') ? { rejectUnauthorized: false } : false
      });

      console.log('[PostgreSQL] Подключение к облачной базе данных Railway...');
      
      // Create tables for store data
      await pgPool.query(`
        CREATE TABLE IF NOT EXISTS store_data (
          key VARCHAR(64) PRIMARY KEY,
          value JSONB NOT NULL,
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `);

      // Load initial state from Postgres if exists
      const res = await pgPool.query('SELECT key, value FROM store_data');
      if (res.rows && res.rows.length > 0) {
        for (const row of res.rows) {
          if (row.key === 'database') {
            database = {
              orders: row.value.orders || [],
              products: row.value.products || [],
              users: row.value.users || [...INITIAL_MASTER_USERS],
              profileRequests: row.value.profileRequests || [],
              lastUpdated: row.value.lastUpdated || new Date().toISOString()
            };

            // Ensure master developer & admin always present and have correct credentials
            for (const master of INITIAL_MASTER_USERS) {
              const existingIdx = database.users.findIndex(u => u.phone_number.toLowerCase() === master.phone_number.toLowerCase());
              if (existingIdx === -1) {
                database.users.push(master);
              } else {
                // Keep master role and default master password synchronized
                database.users[existingIdx].role = master.role;
                if (!database.users[existingIdx].password_hash) {
                  database.users[existingIdx].password_hash = master.password_hash;
                }
              }
            }
            console.log(`[PostgreSQL] Загружено из облака: заказов: ${database.orders.length}, товаров: ${database.products.length}, пользователей: ${database.users.length}`);
          }
        }
      } else {
        // Save initial default database state
        await pgPool.query(
          'INSERT INTO store_data (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
          ['database', database]
        );
        console.log('[PostgreSQL] Инициализирована новая облачная база данных.');
      }
      return;
    } catch (e) {
      console.error('[PostgreSQL Error]:', e.message);
      console.warn('[DB] Переключение на резервный файл server_database.json');
    }
  }

  // Fallback to local JSON file if Postgres is not configured
  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed.orders) database.orders = parsed.orders;
      if (parsed.products) database.products = parsed.products;
      if (parsed.users) database.users = parsed.users;
      if (parsed.profileRequests) database.profileRequests = parsed.profileRequests;
      
      for (const master of INITIAL_MASTER_USERS) {
        if (!database.users.some(u => u.phone_number === master.phone_number)) {
          database.users.push(master);
        }
      }
      console.log(`[DB JSON] Загружено заказов: ${database.orders.length}, товаров: ${database.products.length}, пользователей: ${database.users.length}`);
    } catch (e) {
      console.error('[DB JSON Error]:', e.message);
    }
  }
}

async function saveDB() {
  database.lastUpdated = new Date().toISOString();

  // 1. Save to PostgreSQL if connected
  if (pgPool) {
    try {
      await pgPool.query(
        'INSERT INTO store_data (key, value, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()',
        ['database', database]
      );
    } catch (e) {
      console.error('[PostgreSQL Save Error]:', e.message);
    }
  }

  // 2. Also save to local JSON file backup
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(database, null, 2), 'utf-8');
  } catch (e) {}
}

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8904780342:AAEw8pV30VBd8UkC-NJr-9ejqOFlLz0UkxY';
const TELEGRAM_ADMIN_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '8532929082';

// Active 2FA Sessions Map: sessionId -> { user, code, expiresAt }
const active2FASessions = new Map();

// Customer verification codes: phone -> { code, chatId, expiresAt }
const customerVerifyCodes = new Map();

// Pending phone verification requests: chatId -> { phone, code, expiresAt }
const pendingBotVerifications = new Map();

// Helper to send 2FA verification code to Telegram
async function sendTelegram2FACode(code, role, userName, clientIp) {
  const roleTitle = role === 'developer' ? '💻 РАЗРАБОТЧИКА (Lerman_dev)' : '🛡️ АДМИНИСТРАТОРА (Admin_log)';
  const text = `🔐 <b>ЗАПРОС НА ВХОД В ПАНЕЛЬ</b>\n` +
    `Права: <b>${roleTitle}</b>\n` +
    `Пользователь: <b>${userName}</b>\n\n` +
    `🔢 <b>Ваш одноразовый код 2FA:</b>\n` +
    `👉 <code>${code}</code> 👈\n\n` +
    `⏱️ Код действует: <b>3 минуты</b>\n` +
    `🌐 IP: <code>${clientIp}</code>\n\n` +
    `⚠️ <i>Если это не вы пытаетесь войти — ни в коем случае не передавайте этот код!</i>`;

  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_ADMIN_CHAT_ID,
        text,
        parse_mode: 'HTML'
      })
    });
    const resJson = await res.json();
    return resJson.ok;
  } catch (err) {
    console.error('[Telegram 2FA Error]:', err.message);
    return false;
  }
}

// Helper to notify Telegram about successful master login
async function sendTelegramLoginSuccess(role, userName, clientIp) {
  const roleTitle = role === 'developer' ? '💻 РАЗРАБОТЧИК' : '🛡️ АДМИНИСТРАТОР';
  const text = `✅ <b>УСПЕШНЫЙ ВХОД В СИСТЕМУ</b>\n\n` +
    `Права: <b>${roleTitle}</b>\n` +
    `Пользователь: <b>${userName}</b>\n` +
    `🌐 IP: <code>${clientIp}</code>\n` +
    `⏰ Время: ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Tashkent' })}`;

  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_ADMIN_CHAT_ID,
        text,
        parse_mode: 'HTML'
      })
    });
  } catch (e) {}
}

// Telegram order notification sender
async function sendTelegramAlert(order) {
  const botToken = TELEGRAM_BOT_TOKEN;
  const chatId = TELEGRAM_ADMIN_CHAT_ID;
  if (!botToken || !chatId) return;

  const text = `🛍 <b>НОВЫЙ ЗАКАЗ #${order.id} (SHAXSMART STORE)</b>\n\n` +
    `👤 <b>Покупатель:</b> ${order.customerName}\n` +
    `📞 <b>Телефон:</b> ${order.phone}\n` +
    `📍 <b>Адрес:</b> ${order.address}\n` +
    `💰 <b>Сумма:</b> ${Number(order.totalPrice).toLocaleString('ru-RU')} сум\n` +
    `💳 <b>Оплата на карту:</b> <code>${order.paymentCard}</code>\n` +
    `📦 <b>Товары:</b>\n` +
    (order.items || []).map(i => `• ${i.name} (x${i.quantity}) — ${(i.price * i.quantity).toLocaleString('ru-RU')} сум`).join('\n') +
    `\n\n⏳ <i>Проверьте поступление оплаты в течение 10 минут в приложении!</i>`;

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML'
      })
    });
    console.log('[Telegram] Уведомление успешно отправлено админу!');
  } catch (err) {
    console.error('[Telegram] Ошибка отправки:', err.message);
  }
}

// HTTP Server
const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Actor-Role');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname.replace(/\/+$/, '') || '/';

  const sendJSON = (data, statusCode = 200) => {
    res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data));
  };

  const getBody = () => {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch (e) {
          reject(e);
        }
      });
    });
  };

  try {
    // 1. Health check & Server / Wi-Fi Info
    if (pathname === '/api/health' || pathname === '/' || pathname === '/api/wifi-info') {
      const clientIp = req.socket.remoteAddress || req.headers['x-forwarded-for'] || 'устройство';
      const primaryIP = getPrimaryWifiIP();
      const allIPs = getAllLocalIPs();
      return sendJSON({
        status: 'online',
        message: 'Сервер SHAXSMART STORE активен 24/7!',
        serverTime: new Date().toISOString(),
        databaseType: pgPool ? 'PostgreSQL (Railway Cloud 24/7)' : 'JSON Persistence',
        primaryIP,
        port: PORT,
        wifiUrl: `http://${primaryIP}:${PORT}`,
        allInterfaces: allIPs,
        stats: {
          ordersCount: database.orders.length,
          productsCount: database.products.length,
          usersCount: database.users.length,
          pendingRequestsCount: (database.profileRequests || []).filter(r => r.status === 'pending').length
        }
      });
    }

    // 1.5 Version & In-App Update API
    if (pathname === '/api/version' && req.method === 'GET') {
      return sendJSON({
        latestVersion: '1.2.0',
        minSupportedVersion: '1.0.0',
        releaseNotes: 'Добавлены отзывы и оценки к товарам, отображение количества на складе, улучшена стабильность формы регистрации.',
        downloadUrl: 'https://shaxsmart-production.up.railway.app/download/app-debug.apk'
      });
    }

    // ========================================================
    // 2. USER AUTHENTICATION & DEVELOPER MANAGEMENT
    // ========================================================

    // GET /api/users — List all registered accounts
    if (pathname === '/api/users' && req.method === 'GET') {
      return sendJSON({ users: database.users || [] });
    }

    // POST /api/users/register — Cloud user registration
    if ((pathname === '/api/users/register' || pathname === '/api/auth/register' || pathname === '/api/register') && req.method === 'POST') {
      const { first_name, last_name, phone_number, password_hash } = await getBody();
      if (!first_name || !phone_number || !password_hash) {
        return sendJSON({ success: false, error: 'Заполните обязательные поля' }, 400);
      }

      const cleanPhone = phone_number.trim();
      const exists = database.users.some(u => u.phone_number.toLowerCase() === cleanPhone.toLowerCase());
      if (exists) {
        return sendJSON({ success: false, error: 'Пользователь с таким номером/логином уже существует' }, 400);
      }

      const newUser = {
        id: Date.now(),
        first_name: first_name.trim(),
        last_name: last_name ? last_name.trim() : '',
        phone_number: cleanPhone,
        password_hash: password_hash,
        role: 'user',
        created_at: new Date().toISOString()
      };

      database.users.push(newUser);
      await saveDB();
      console.log(`[USER] Зарегистрирован новый пользователь: ${newUser.first_name} (${newUser.phone_number})`);
      return sendJSON({ success: true, user: newUser }, 201);
    }

    // POST /api/users/login — Cloud user authentication with 2FA Protection for Admins/Devs
    if ((pathname === '/api/users/login' || pathname === '/api/auth/login' || pathname === '/api/login') && req.method === 'POST') {
      const { phone_number, password_hash } = await getBody();
      const cleanPhone = (phone_number || '').trim().toLowerCase();
      const cleanPass = (password_hash || '').trim();
      const clientIp = req.socket.remoteAddress || req.headers['x-forwarded-for'] || 'устройство';

      let targetUser = null;

      // 1. Check Master accounts
      if (cleanPhone === 'lerman_dev' && cleanPass === '2010090900') {
        let devUser = database.users.find(u => u.phone_number.toLowerCase() === 'lerman_dev');
        if (!devUser) {
          devUser = INITIAL_MASTER_USERS[1];
          database.users.push(devUser);
          await saveDB();
        }
        targetUser = devUser;
      } else if ((cleanPhone === '+998334906969' || cleanPhone === '998334906969') && cleanPass === '2010090900') {
        // Developer login by phone number
        let devUser = database.users.find(u => u.phone_number.toLowerCase() === 'lerman_dev');
        if (!devUser) {
          devUser = INITIAL_MASTER_USERS[1];
          database.users.push(devUser);
          await saveDB();
        }
        targetUser = devUser;
      } else if (cleanPhone === 'admin_log' && (cleanPass === 'm2010090900' || cleanPass === 'M2010090900')) {
        let adminUser = database.users.find(u => u.phone_number.toLowerCase() === 'admin_log');
        if (!adminUser) {
          adminUser = INITIAL_MASTER_USERS[0];
          database.users.push(adminUser);
          await saveDB();
        }
        targetUser = adminUser;
      } else {
        // Standard user verification
        const user = database.users.find(u => u.phone_number.toLowerCase() === cleanPhone);
        if (!user) {
          return sendJSON({ success: false, error: 'Пользователь с таким логином/телефоном не найден' }, 404);
        }

        if (user.password_hash !== cleanPass && user.password_hash.toLowerCase() !== cleanPass.toLowerCase()) {
          return sendJSON({ success: false, error: 'Неверный пароль' }, 401);
        }

        targetUser = user;
      }

      // 2. High Security Check: If user is Developer or Admin, require 2FA code via Telegram!
      if (targetUser.role === 'developer' || targetUser.role === 'admin') {
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const sessionId = '2fa_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);

        active2FASessions.set(sessionId, {
          user: targetUser,
          code,
          expiresAt: Date.now() + 180000 // 3 minutes
        });

        // Send 2FA verification code to Telegram bot
        sendTelegram2FACode(code, targetUser.role, targetUser.first_name, clientIp);
        console.log(`[2FA Telegram] Отправлен код ${code} для ${targetUser.first_name} (${targetUser.role})`);

        return sendJSON({
          success: true,
          require2FA: true,
          sessionId,
          role: targetUser.role,
          userName: targetUser.first_name
        });
      }

      // Normal users log in without 2FA
      return sendJSON({ success: true, user: targetUser });
    }

    // POST /api/auth/2fa/verify — Verify Telegram 2FA Code
    if ((pathname === '/api/auth/2fa/verify' || pathname === '/api/users/2fa/verify') && req.method === 'POST') {
      const { sessionId, code } = await getBody();
      const clientIp = req.socket.remoteAddress || req.headers['x-forwarded-for'] || 'устройство';

      if (!sessionId || !code) {
        return sendJSON({ success: false, error: 'Введите 6-значный код' }, 400);
      }

      const session = active2FASessions.get(sessionId);
      if (!session) {
        return sendJSON({ success: false, error: 'Сессия устарела или не найдена. Попробуйте войти снова.' }, 400);
      }

      if (Date.now() > session.expiresAt) {
        active2FASessions.delete(sessionId);
        return sendJSON({ success: false, error: 'Срок действия кода истек. Запросите новый код.' }, 400);
      }

      if (session.code !== code.trim()) {
        return sendJSON({ success: false, error: 'Неверный 6-значный код подтверждения' }, 401);
      }

      // Success: Clear session and return authorized user
      const authorizedUser = session.user;
      active2FASessions.delete(sessionId);

      sendTelegramLoginSuccess(authorizedUser.role, authorizedUser.first_name, clientIp);
      console.log(`[2FA SUCCESS] Успешный 2FA вход: ${authorizedUser.first_name} (${authorizedUser.role})`);

      return sendJSON({ success: true, user: authorizedUser });
    }

    // POST /api/auth/2fa/resend — Resend Telegram 2FA Code
    if ((pathname === '/api/auth/2fa/resend' || pathname === '/api/users/2fa/resend') && req.method === 'POST') {
      const { sessionId } = await getBody();
      const clientIp = req.socket.remoteAddress || req.headers['x-forwarded-for'] || 'устройство';

      if (!sessionId) {
        return sendJSON({ success: false, error: 'Не указан идентификатор сессии' }, 400);
      }

      const session = active2FASessions.get(sessionId);
      if (!session) {
        return sendJSON({ success: false, error: 'Сессия не найдена. Начните вход заново.' }, 400);
      }

      const newCode = Math.floor(100000 + Math.random() * 900000).toString();
      session.code = newCode;
      session.expiresAt = Date.now() + 180000;
      active2FASessions.set(sessionId, session);

      sendTelegram2FACode(newCode, session.user.role, session.user.first_name, clientIp);
      console.log(`[2FA RESEND] Повторный код ${newCode} отправлен для ${session.user.first_name}`);

      return sendJSON({ success: true, message: 'Новый код отправлен в Telegram' });
    }

    // DELETE /api/users/:id — Developer Master deletion of an account
    if (pathname.startsWith('/api/users/') && req.method === 'DELETE') {
      const userId = parseInt(pathname.split('/')[3], 10);
      const user = database.users.find(u => u.id === userId);

      if (!user) {
        return sendJSON({ success: false, error: 'Пользователь не найден' }, 404);
      }

      // Security: Developer account cannot be deleted
      if (user.role === 'developer' || user.phone_number === 'Lerman_dev') {
        return sendJSON({ success: false, error: 'Нельзя удалить главный аккаунт разработчика' }, 403);
      }

      database.users = database.users.filter(u => u.id !== userId);
      await saveDB();
      console.log(`[DEVELOPER] Удален аккаунт: ${user.first_name} (${user.phone_number})`);
      return sendJSON({ success: true });
    }

    // PUT /api/users/:id/password — Developer Master password reset
    if (pathname.startsWith('/api/users/') && pathname.endsWith('/password') && req.method === 'PUT') {
      const userId = parseInt(pathname.split('/')[3], 10);
      const { newPassword } = await getBody();

      if (!newPassword || newPassword.length < 4) {
        return sendJSON({ success: false, error: 'Пароль должен содержать не менее 4 символов' }, 400);
      }

      const userIdx = database.users.findIndex(u => u.id === userId);
      if (userIdx === -1) {
        return sendJSON({ success: false, error: 'Пользователь не найден' }, 404);
      }

      database.users[userIdx].password_hash = newPassword;
      await saveDB();
      console.log(`[DEVELOPER] Сменен пароль для аккаунта: ${database.users[userIdx].first_name} (${database.users[userIdx].phone_number})`);
      return sendJSON({ success: true, user: database.users[userIdx] });
    }

    // PUT /api/users/:id/role — Developer Role change
    if (pathname.startsWith('/api/users/') && pathname.endsWith('/role') && req.method === 'PUT') {
      const userId = parseInt(pathname.split('/')[3], 10);
      const { role } = await getBody();

      if (!['user', 'admin', 'developer'].includes(role)) {
        return sendJSON({ success: false, error: 'Недопустимая роль' }, 400);
      }

      const userIdx = database.users.findIndex(u => u.id === userId);
      if (userIdx === -1) {
        return sendJSON({ success: false, error: 'Пользователь не найден' }, 404);
      }

      if (database.users[userIdx].phone_number === 'Lerman_dev') {
        return sendJSON({ success: false, error: 'Нельзя изменить роль главного разработчика' }, 403);
      }

      database.users[userIdx].role = role;
      await saveDB();
      return sendJSON({ success: true, user: database.users[userIdx] });
    }

    // PUT /api/users/:id/avatar — Update user avatar
    if (pathname.startsWith('/api/users/') && pathname.endsWith('/avatar') && req.method === 'PUT') {
      const userId = parseInt(pathname.split('/')[3], 10);
      const { avatar } = await getBody();

      const userIdx = database.users.findIndex(u => u.id === userId);
      if (userIdx === -1) {
        return sendJSON({ success: false, error: 'Пользователь не найден' }, 404);
      }

      database.users[userIdx].avatar = avatar;
      await saveDB();
      console.log(`[USER] Обновлена аватарка для: ${database.users[userIdx].first_name} (${database.users[userIdx].phone_number})`);
      return sendJSON({ success: true, user: database.users[userIdx] });
    }

    // ========================================================
    // 3. PROFILE CHANGE REQUESTS (NICKNAME & PASSWORD APPROVAL)
    // ========================================================

    // GET /api/profile-requests
    if (pathname === '/api/profile-requests' && req.method === 'GET') {
      return sendJSON({ requests: database.profileRequests || [] });
    }

    // POST /api/profile-requests — User submits request to change nickname/phone/password
    if (pathname === '/api/profile-requests' && req.method === 'POST') {
      const reqData = await getBody();
      if (!reqData.userId || !reqData.type || !reqData.newValue) {
        return sendJSON({ success: false, error: 'Некорректные данные запроса' }, 400);
      }

      const newRequest = {
        id: Date.now(),
        userId: reqData.userId,
        userName: reqData.userName || 'Пользователь',
        userPhone: reqData.userPhone || '',
        type: reqData.type, // 'name' | 'phone' | 'password'
        oldValue: reqData.oldValue || '',
        newValue: reqData.newValue.trim(),
        newLastName: reqData.newLastName ? reqData.newLastName.trim() : undefined,
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      if (!database.profileRequests) database.profileRequests = [];
      database.profileRequests.unshift(newRequest);
      await saveDB();

      console.log(`[PROFILE REQ] Новый запрос #${newRequest.id} от ${newRequest.userName} на изменение: ${newRequest.type}`);
      return sendJSON({ success: true, request: newRequest }, 201);
    }

    // PUT /api/profile-requests/:id/approve — Admin / Developer Approves Request
    if (pathname.startsWith('/api/profile-requests/') && pathname.endsWith('/approve') && req.method === 'PUT') {
      const reqId = parseInt(pathname.split('/')[3], 10);
      const { reviewedBy } = await getBody();

      const rIndex = (database.profileRequests || []).findIndex(r => r.id === reqId);
      if (rIndex === -1) {
        return sendJSON({ success: false, error: 'Запрос не найден' }, 404);
      }

      const reqObj = database.profileRequests[rIndex];
      const userIdx = database.users.findIndex(u => u.id === reqObj.userId);

      if (userIdx !== -1) {
        // Apply approved changes to user account
        if (reqObj.type === 'name') {
          database.users[userIdx].first_name = reqObj.newValue;
          if (reqObj.newLastName !== undefined) {
            database.users[userIdx].last_name = reqObj.newLastName;
          }
        } else if (reqObj.type === 'phone') {
          database.users[userIdx].phone_number = reqObj.newValue;
        } else if (reqObj.type === 'password') {
          database.users[userIdx].password_hash = reqObj.newValue;
        }
      }

      database.profileRequests[rIndex].status = 'approved';
      database.profileRequests[rIndex].reviewedBy = reviewedBy || 'Администратор';
      database.profileRequests[rIndex].reviewedAt = new Date().toISOString();
      await saveDB();

      console.log(`[PROFILE REQ] Запрос #${reqId} ОДОБРЕН (${reqObj.type})`);
      return sendJSON({ success: true, request: database.profileRequests[rIndex] });
    }

    // PUT /api/profile-requests/:id/reject — Admin / Developer Rejects Request
    if (pathname.startsWith('/api/profile-requests/') && pathname.endsWith('/reject') && req.method === 'PUT') {
      const reqId = parseInt(pathname.split('/')[3], 10);
      const { reviewedBy } = await getBody();

      const rIndex = (database.profileRequests || []).findIndex(r => r.id === reqId);
      if (rIndex === -1) {
        return sendJSON({ success: false, error: 'Запрос не найден' }, 404);
      }

      database.profileRequests[rIndex].status = 'rejected';
      database.profileRequests[rIndex].reviewedBy = reviewedBy || 'Администратор';
      database.profileRequests[rIndex].reviewedAt = new Date().toISOString();
      await saveDB();

      console.log(`[PROFILE REQ] Запрос #${reqId} ОТКЛОНЕН`);
      return sendJSON({ success: true, request: database.profileRequests[rIndex] });
    }

    // ========================================================
    // 4. ORDERS & PRODUCTS
    // ========================================================

    // GET /api/orders
    if (pathname === '/api/orders' && req.method === 'GET') {
      return sendJSON({ orders: database.orders || [] });
    }

    // POST /api/orders (Customer creates order)
    if (pathname === '/api/orders' && req.method === 'POST') {
      const orderData = await getBody();
      const newOrder = {
        id: orderData.id || Date.now(),
        ...orderData,
        createdAt: new Date().toISOString(),
        status: orderData.status || 'awaiting_payment'
      };

      database.orders.unshift(newOrder);
      await saveDB();

      console.log(`\n🔔 [НОВЫЙ ЗАКАЗ] #${newOrder.id}`);
      console.log(`   👤 Покупатель: ${newOrder.customerName} (${newOrder.phone})`);
      console.log(`   💰 Сумма: ${Number(newOrder.totalPrice).toLocaleString('ru-RU')} сум`);
      
      sendTelegramAlert(newOrder);
      return sendJSON({ success: true, order: newOrder }, 201);
    }

    // PUT /api/orders/:id/status (Admin updates order status)
    if (pathname.startsWith('/api/orders/') && pathname.endsWith('/status') && req.method === 'PUT') {
      const parts = pathname.split('/');
      const orderId = parseInt(parts[3], 10);
      const { status, adminNote } = await getBody();

      const orderIndex = database.orders.findIndex(o => o.id === orderId);
      if (orderIndex === -1) {
        return sendJSON({ success: false, error: 'Заказ не найден' }, 404);
      }

      database.orders[orderIndex].status = status;
      if (adminNote) database.orders[orderIndex].adminNote = adminNote;
      database.orders[orderIndex].updatedAt = new Date().toISOString();
      await saveDB();

      console.log(`[СТАТУС] Заказ #${orderId} изменен на: ${status}`);
      return sendJSON({ success: true, order: database.orders[orderIndex] });
    }

    // GET /api/products
    if (pathname === '/api/products' && req.method === 'GET') {
      return sendJSON({ products: database.products || [] });
    }

    // POST /api/products (Admin creates / edits product)
    if (pathname === '/api/products' && req.method === 'POST') {
      const product = await getBody();
      if (!product.id) product.id = Date.now();
      
      const existingIdx = database.products.findIndex(p => p.id === product.id);
      if (existingIdx !== -1) {
        database.products[existingIdx] = product;
      } else {
        database.products.push(product);
      }
      await saveDB();
      console.log(`[ТОВАР] "${product.name}" сохранен (${product.price} сум)`);
      return sendJSON({ success: true, product });
    }

    // DELETE /api/products/:id
    if (pathname.startsWith('/api/products/') && req.method === 'DELETE') {
      const parts = pathname.split('/');
      const prodId = parseInt(parts[3], 10);
      database.products = database.products.filter(p => p.id !== prodId);
      await saveDB();
      console.log(`[ТОВАР] Товар #${prodId} удален`);
      return sendJSON({ success: true });
    }

    // PUT /api/users/:id/nickname — Direct Nickname Change (Developer & User)
    if (pathname.startsWith('/api/users/') && pathname.endsWith('/nickname') && req.method === 'PUT') {
      const userId = parseInt(pathname.split('/')[3], 10);
      const { first_name, last_name } = await getBody();

      if (!first_name || first_name.trim().length < 2) {
        return sendJSON({ success: false, error: 'Никнейм должен содержать не менее 2 символов' }, 400);
      }

      const userIdx = database.users.findIndex(u => u.id === userId);
      if (userIdx === -1) {
        return sendJSON({ success: false, error: 'Пользователь не найден' }, 404);
      }

      database.users[userIdx].first_name = first_name.trim();
      if (last_name !== undefined) {
        database.users[userIdx].last_name = (last_name || '').trim();
      }
      await saveDB();
      console.log(`[USER NICK] Изменен никнейм пользователя #${userId}: ${database.users[userIdx].first_name}`);
      return sendJSON({ success: true, user: database.users[userIdx] });
    }

    // ========================================================
    // 5. SINGLE-USE PROMO CODES SYSTEM (DEVELOPER GENERATOR)
    // ========================================================

    // GET /api/promocodes — List all promo codes (Developer)
    if (pathname === '/api/promocodes' && req.method === 'GET') {
      return sendJSON({ promoCodes: database.promoCodes || [] });
    }

    // POST /api/promocodes — Generate / Create single-use promo code
    if (pathname === '/api/promocodes' && req.method === 'POST') {
      const { discountPercent, minOrderSum, code, createdBy } = await getBody();

      let promoCodeStr = (code || '').trim().toUpperCase();
      if (!promoCodeStr) {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let rand = '';
        for (let i = 0; i < 6; i++) {
          rand += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        promoCodeStr = `SHAX-${rand}`;
      }

      if (!database.promoCodes) database.promoCodes = [];

      const exists = database.promoCodes.some(p => p.code.toUpperCase() === promoCodeStr);
      if (exists) {
        return sendJSON({ success: false, error: 'Промокод с таким названием уже существует' }, 400);
      }

      const newPromo = {
        id: Date.now(),
        code: promoCodeStr,
        discountPercent: Number(discountPercent) || 10,
        minOrderSum: Number(minOrderSum) || 0,
        isUsed: false,
        usedBy: null,
        usedAt: null,
        createdAt: new Date().toISOString(),
        createdBy: createdBy || 'Developer'
      };

      database.promoCodes.unshift(newPromo);
      await saveDB();
      console.log(`[PROMO] Создан одноразовый промокод "${newPromo.code}" на ${newPromo.discountPercent}% (от ${newPromo.minOrderSum} сум)`);
      return sendJSON({ success: true, promoCode: newPromo }, 201);
    }

    // DELETE /api/promocodes/:id — Delete promo code
    if (pathname.startsWith('/api/promocodes/') && req.method === 'DELETE') {
      const promoId = parseInt(pathname.split('/')[3], 10);
      if (!database.promoCodes) database.promoCodes = [];
      database.promoCodes = database.promoCodes.filter(p => p.id !== promoId);
      await saveDB();
      console.log(`[PROMO] Удален промокод #${promoId}`);
      return sendJSON({ success: true });
    }

    // POST /api/promocodes/validate — Customer validates promo code in cart
    if (pathname === '/api/promocodes/validate' && req.method === 'POST') {
      const { code, cartTotal } = await getBody();
      const cleanCode = (code || '').trim().toUpperCase();

      if (!cleanCode) {
        return sendJSON({ valid: false, error: 'Введите промокод' }, 400);
      }

      const promo = (database.promoCodes || []).find(p => p.code.toUpperCase() === cleanCode);
      if (!promo) {
        return sendJSON({ valid: false, error: 'Промокод не существует или срок действия истек' }, 404);
      }

      if (promo.isUsed) {
        return sendJSON({ valid: false, error: 'Этот одноразовый промокод уже был использован' }, 400);
      }

      const total = Number(cartTotal) || 0;
      if (total < promo.minOrderSum) {
        return sendJSON({
          valid: false,
          error: `Минимальная сумма заказа для промокода: ${Number(promo.minOrderSum).toLocaleString('ru-RU')} сум`
        }, 400);
      }

      const discountAmount = Math.round((total * promo.discountPercent) / 100);
      return sendJSON({
        valid: true,
        promoCode: promo.code,
        discountPercent: promo.discountPercent,
        discountAmount,
        minOrderSum: promo.minOrderSum
      });
    }

    // POST /api/promocodes/use — Mark promo code as used after placing order
    if (pathname === '/api/promocodes/use' && req.method === 'POST') {
      const { code, orderId, customerName } = await getBody();
      const cleanCode = (code || '').trim().toUpperCase();

      const promoIdx = (database.promoCodes || []).findIndex(p => p.code.toUpperCase() === cleanCode);
      if (promoIdx !== -1) {
        database.promoCodes[promoIdx].isUsed = true;
        database.promoCodes[promoIdx].usedBy = customerName || 'Покупатель';
        database.promoCodes[promoIdx].usedAt = new Date().toISOString();
        database.promoCodes[promoIdx].orderId = orderId;
        await saveDB();
        console.log(`[PROMO USED] Промокод "${cleanCode}" использован покупателем ${customerName}`);
      }
      return sendJSON({ success: true });
    }

    // ============================================================
    // CUSTOMER TELEGRAM VERIFICATION SYSTEM
    // ============================================================

    // POST /api/customer/request-code — customer requests verification code
    // App calls this, then customer goes to bot and sends their phone number
    if (pathname === '/api/customer/request-code' && req.method === 'POST') {
      const { phone } = await getBody();
      const cleanPhone = (phone || '').trim();
      
      if (!cleanPhone || cleanPhone.length < 9) {
        return sendJSON({ success: false, error: 'Укажите корректный номер телефона' }, 400);
      }

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Store code linked to phone number, expires in 5 minutes
      customerVerifyCodes.set(cleanPhone, {
        code,
        expiresAt: Date.now() + 300000, // 5 minutes
        verified: false
      });

      console.log(`[CUSTOMER VERIFY] Запрошен код для ${cleanPhone}: ${code}`);
      
      return sendJSON({ 
        success: true, 
        message: 'Перейдите в Telegram бот и отправьте свой номер телефона для получения кода',
        botLink: `https://t.me/shaxsmartadmins_bot`
      });
    }

    // POST /api/customer/verify-code — verify the code customer received in Telegram
    if (pathname === '/api/customer/verify-code' && req.method === 'POST') {
      const { phone, code } = await getBody();
      const cleanPhone = (phone || '').trim();
      const cleanCode = (code || '').trim();

      if (!cleanPhone || !cleanCode) {
        return sendJSON({ success: false, error: 'Укажите телефон и код' }, 400);
      }

      const session = customerVerifyCodes.get(cleanPhone);
      if (!session) {
        return sendJSON({ success: false, error: 'Код не запрашивался. Нажмите "Получить код" заново.' }, 400);
      }

      if (Date.now() > session.expiresAt) {
        customerVerifyCodes.delete(cleanPhone);
        return sendJSON({ success: false, error: 'Срок действия кода истёк. Запросите новый.' }, 400);
      }

      if (session.code !== cleanCode) {
        return sendJSON({ success: false, error: 'Неверный код подтверждения' }, 401);
      }

      // Mark as verified
      customerVerifyCodes.delete(cleanPhone);
      console.log(`[CUSTOMER VERIFY] Телефон ${cleanPhone} успешно подтверждён!`);
      
      return sendJSON({ success: true, verified: true });
    }

    // POST /telegram/webhook — Handle incoming Telegram bot messages (contact verification)
    if (pathname === '/telegram/webhook' && req.method === 'POST') {
      const update = await getBody();
      
      try {
        const message = update.message;
        if (!message) return sendJSON({ ok: true });

        const chatId = message.chat.id;
        const firstName = message.from?.first_name || 'Пользователь';
        // Helper: send message
        const botSend = async (text, extra) => {
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', ...(extra || {}) })
          });
        };

        // Helper: normalize phone to +998XXXXXXXXX
        const normalizePhone = (p) => {
          let ph = (p || '').toString().replace(/[\s\-\(\)]/g, '');
          if (!ph.startsWith('+')) ph = '+' + ph;
          if (ph.startsWith('+998') && ph.length === 13) return ph;
          return ph;
        };

        // Contact share keyboard
        const contactKeyboard = {
          reply_markup: JSON.stringify({
            keyboard: [[{ text: '📱 Отправить мой номер', request_contact: true }]],
            resize_keyboard: true,
            one_time_keyboard: true
          })
        };

        // 1) /start — welcome + share contact button
        if (message.text && message.text.trim() === '/start') {
          await botSend(
            `👋 Привет, <b>${firstName}</b>!\n\n` +
            `🛒 Это бот магазина <b>SHAXSMART STORE</b>\n\n` +
            `🔐 Для подтверждения регистрации:\n` +
            `1️⃣ Нажмите <b>"Получить код"</b> в приложении\n` +
            `2️⃣ Нажмите кнопку <b>"📱 Отправить мой номер"</b> ниже\n` +
            `3️⃣ Бот проверит совпадение номера и выдаст код\n` +
            `4️⃣ Введите код в приложении\n\n` +
            `⬇️ Нажмите кнопку ниже:`,
            contactKeyboard
          );
          return sendJSON({ ok: true });
        }

        // 2) Contact shared — Telegram sends real phone number
        if (message.contact) {
          const contactPhone = normalizePhone(message.contact.phone_number);
          const contactUserId = message.contact.user_id;
          const senderId = message.from?.id;

          // Security: contact must belong to sender
          if (contactUserId && senderId && contactUserId !== senderId) {
            await botSend('⚠️ Отправьте <b>свой собственный</b> контакт, а не чужой!');
            return sendJSON({ ok: true });
          }

          // Find matching pending verification by phone
          let foundPhone = null;
          for (const [key] of customerVerifyCodes.entries()) {
            if (normalizePhone(key) === contactPhone) {
              foundPhone = key;
              break;
            }
          }

          if (foundPhone) {
            const session = customerVerifyCodes.get(foundPhone);
            if (session && Date.now() < session.expiresAt) {
              // Send verification code to customer
              await botSend(
                '\u2705 \u041d\u043e\u043c\u0435\u0440 \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043d!\n\n\ud83d\udd10 \u0412\u0430\u0448 \u043a\u043e\u0434: <code>' + session.code + '</code>\n\n\u23f1 \u041a\u043e\u0434 \u0434\u0435\u0439\u0441\u0442\u0432\u0443\u0435\u0442 5 \u043c\u0438\u043d\u0443\u0442\n\ud83d\udcf1 \u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0435\u0433\u043e \u0432 \u043f\u0440\u0438\u043b\u043e\u0436\u0435\u043d\u0438\u0438\n\n\u26a0\ufe0f <i>\u041d\u0438\u043a\u043e\u043c\u0443 \u043d\u0435 \u0441\u043e\u043e\u0431\u0449\u0430\u0439\u0442\u0435!</i>',
                { reply_markup: JSON.stringify({ remove_keyboard: true }) }
              );
              // Notify admin
              fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: TELEGRAM_ADMIN_CHAT_ID, text: '\ud83d\udc64 \u0412\u0435\u0440\u0438\u0444\u0438\u043a\u0430\u0446\u0438\u044f: ' + contactPhone + ' / ' + firstName, parse_mode: 'HTML' })
              }).catch(() => {});
              console.log('[BOT] Code ' + session.code + ' -> ' + firstName + ' (' + contactPhone + ')');
            } else {
              await botSend('\u23f3 \u0421\u0440\u043e\u043a \u0438\u0441\u0442\u0451\u043a. \u041d\u0430\u0436\u043c\u0438\u0442\u0435 "\u041f\u043e\u043b\u0443\u0447\u0438\u0442\u044c \u043a\u043e\u0434" \u0432 \u043f\u0440\u0438\u043b\u043e\u0436\u0435\u043d\u0438\u0438 \u0437\u0430\u043d\u043e\u0432\u043e.',
                { reply_markup: JSON.stringify({ remove_keyboard: true }) }
              );
            }
          } else {
            await botSend(
              '\u274c <b>\u041d\u043e\u043c\u0435\u0440 \u043d\u0435 \u0441\u043e\u0432\u043f\u0430\u0434\u0430\u0435\u0442!</b>\n\n\ud83d\udcde \u0412\u0430\u0448 Telegram: <code>' + contactPhone + '</code>\n\n\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0432 \u043f\u0440\u0438\u043b\u043e\u0436\u0435\u043d\u0438\u0438 \u0442\u043e\u0442 \u0436\u0435 \u043d\u043e\u043c\u0435\u0440, \u0447\u0442\u043e \u043f\u0440\u0438\u0432\u044f\u0437\u0430\u043d \u043a Telegram.',
              contactKeyboard
            );
            console.log('[BOT] Phone ' + contactPhone + ' mismatch. Rejected.');
          }
          return sendJSON({ ok: true });
        }

        // 3) Any text message - prompt to use contact button
        if (message.text) {
          await botSend(
            '\ud83d\udcf1 \u041d\u0430\u0436\u043c\u0438\u0442\u0435 \u043a\u043d\u043e\u043f\u043a\u0443 "\ud83d\udcf1 \u041e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c \u043c\u043e\u0439 \u043d\u043e\u043c\u0435\u0440" \u043d\u0438\u0436\u0435.',
            contactKeyboard
          );
        }
        return sendJSON({ ok: true });
      } catch (botErr) {
        console.error('[BOT Webhook Error]:', botErr.message);
        return sendJSON({ ok: true });
      }
    }

    // Serve Static Files (Live Web-View Frontend Engine)
    const distPath = path.join(__dirname, 'dist');
    if (fs.existsSync(distPath) && !pathname.startsWith('/api/') && !pathname.startsWith('/telegram/')) {
      let filePath = path.join(distPath, pathname === '/' ? 'index.html' : pathname);
      if (!fs.existsSync(filePath)) {
        filePath = path.join(distPath, 'index.html');
      }

      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'text/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2'
      };

      const contentType = mimeTypes[ext] || 'application/octet-stream';
      try {
        const fileData = fs.readFileSync(filePath);
        res.writeHead(200, {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*'
        });
        return res.end(fileData);
      } catch {
        // Fallback to API 404
      }
    }

    // 404 Fallback
    sendJSON({ error: 'Маршрут не найден' }, 404);
  } catch (err) {
    console.error('[API Error]:', err);
    sendJSON({ error: err.message }, 500);
  }
});

// Initialize database and start listening
initDatabase().then(() => {
  server.listen(PORT, '0.0.0.0', async () => {
    const primaryIP = getPrimaryWifiIP();
    console.log('========================================================================');
    console.log('  🚀 СЕРВЕР SHAXSMART STORE УСПЕШНО ЗАПУЩЕН 24/7!                      ');
    console.log('========================================================================');
    console.log(`  🌐 Порт: ${PORT} | База данных: ${pgPool ? 'PostgreSQL (Railway Cloud)' : 'JSON Persistence'}`);
    console.log(`  🏠 Локальный адрес: http://localhost:${PORT}`);
    console.log(`  📱 Wi-Fi адрес:     http://${primaryIP}:${PORT}`);
    console.log('========================================================================\n');

    // Auto-setup Telegram Bot Webhook for customer verification
    try {
      const serverUrl = process.env.RENDER_EXTERNAL_URL 
        ? process.env.RENDER_EXTERNAL_URL 
        : (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : `https://shaxsmart-store.onrender.com`);
      const webhookUrl = `${serverUrl}/telegram/webhook`;
      
      const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl })
      });
      const data = await res.json();
      if (data.ok) {
        console.log(`  🤖 Telegram Bot Webhook установлен: ${webhookUrl}`);
      } else {
        console.log(`  ⚠️ Webhook ошибка: ${data.description}`);
      }
    } catch (e) {
      console.log(`  ⚠️ Не удалось установить webhook: ${e.message}`);
    }
  });
});
