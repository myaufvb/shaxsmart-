import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, UserRole } from '../types';
import { db, initDatabase } from '../db/database';
import { api } from '../services/api';

interface AuthContextType {
  currentUser: User | null;
  isLoading: boolean;
  login: (phoneOrLogin: string, passwordHash: string) => Promise<{ 
    success: boolean; 
    error?: string; 
    user?: User;
    require2FA?: boolean;
    sessionId?: string;
    role?: UserRole;
    userName?: string;
  }>;
  verify2FA: (sessionId: string, code: string) => Promise<{ success: boolean; error?: string; user?: User }>;
  resend2FA: (sessionId: string) => Promise<{ success: boolean; error?: string }>;
  register: (data: {
    first_name: string;
    last_name?: string;
    phone_number: string;
    password_hash: string;
  }) => Promise<{ success: boolean; error?: string; user?: User }>;
  logout: () => void;
  switchRoleDebug?: (newRole: UserRole) => void;
  allUsers: User[];
  reloadUsers: () => Promise<void>;
  updateCurrentUserData: (updated: Partial<User>) => Promise<void>;
  updateAvatar: (avatar: string) => Promise<void>;
  updateNickname: (firstName: string, lastName?: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [allUsers, setAllUsers] = useState<User[]>([]);

  const reloadUsers = async () => {
    try {
      const list = await api.getUsers();
      setAllUsers(list);

      // Also refresh current user if role or name changed on server
      if (currentUser && currentUser.id) {
        const found = list.find(u => u.id === currentUser.id || u.phone_number.toLowerCase() === currentUser.phone_number.toLowerCase());
        if (found && (found.first_name !== currentUser.first_name || found.role !== currentUser.role || found.password_hash !== currentUser.password_hash)) {
          setCurrentUser(found);
        }
      }
    } catch (e) {
      console.error('Error loading users:', e);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        await initDatabase();
        await reloadUsers();

        const savedUserId = localStorage.getItem('current_user_id');
        if (savedUserId) {
          const u = await db.users.get(Number(savedUserId));
          if (u) {
            setCurrentUser(u);
          }
        }
      } catch (err) {
        console.error('Database initialization error:', err);
      } finally {
        setIsLoading(false);
      }
    };
    init();

    // Subscribe to realtime cloud user updates
    const unsubscribe = api.onUsersChange((users) => {
      setAllUsers(users);
    });
    return () => unsubscribe();
  }, []);

  const login = async (phoneOrLogin: string, passwordHash: string): Promise<{ 
    success: boolean; 
    error?: string; 
    user?: User;
    require2FA?: boolean;
    sessionId?: string;
    role?: UserRole;
    userName?: string;
  }> => {
    try {
      const cleanLogin = phoneOrLogin.trim();
      const res = await api.loginUser(cleanLogin, passwordHash);

      if (!res.success) {
        return { success: false, error: res.error || 'Неверный логин или пароль' };
      }

      if (res.require2FA) {
        return {
          success: true,
          require2FA: true,
          sessionId: res.sessionId,
          role: res.role,
          userName: res.userName
        };
      }

      if (res.user) {
        setCurrentUser(res.user);
        if (res.user.id) {
          localStorage.setItem('current_user_id', res.user.id.toString());
        }
        await reloadUsers();
        return { success: true, user: res.user };
      }

      return { success: false, error: 'Ошибка авторизации' };
    } catch (err) {
      console.error('Login error:', err);
      return { success: false, error: 'Ошибка входа в систему' };
    }
  };

  const verify2FA = async (sessionId: string, code: string): Promise<{ success: boolean; error?: string; user?: User }> => {
    try {
      const res = await api.verify2FACode(sessionId, code);
      if (!res.success || !res.user) {
        return { success: false, error: res.error || 'Неверный код подтверждения' };
      }

      setCurrentUser(res.user);
      if (res.user.id) {
        localStorage.setItem('current_user_id', res.user.id.toString());
      }
      await reloadUsers();
      return { success: true, user: res.user };
    } catch (err) {
      console.error('2FA Verify error:', err);
      return { success: false, error: 'Ошибка проверки кода 2FA' };
    }
  };

  const resend2FA = async (sessionId: string): Promise<{ success: boolean; error?: string }> => {
    return await api.resend2FACode(sessionId);
  };

  const register = async (data: {
    first_name: string;
    last_name?: string;
    phone_number: string;
    password_hash: string;
  }): Promise<{ success: boolean; error?: string; user?: User }> => {
    try {
      const res = await api.registerUser(data);
      if (!res.success || !res.user) {
        return { success: false, error: res.error || 'Ошибка при регистрации' };
      }

      setCurrentUser(res.user);
      if (res.user.id) {
        localStorage.setItem('current_user_id', res.user.id.toString());
      }
      await reloadUsers();
      return { success: true, user: res.user };
    } catch (err) {
      console.error('Registration error:', err);
      return { success: false, error: 'Ошибка при сохранении пользователя' };
    }
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('current_user_id');
  };

  const switchRoleDebug = async (newRole: UserRole) => {
    if (!currentUser || !currentUser.id) return;
    await api.changeUserRole(currentUser.id, newRole);
    await reloadUsers();
  };

  const updateCurrentUserData = async (updated: Partial<User>) => {
    if (!currentUser || !currentUser.id) return;
    const newUserData = { ...currentUser, ...updated };
    setCurrentUser(newUserData);
    await db.users.update(currentUser.id, updated);
  };

  const updateAvatar = async (avatar: string) => {
    if (!currentUser || !currentUser.id) return;
    setCurrentUser({ ...currentUser, avatar });
    await api.updateUserAvatar(currentUser.id, avatar);
    await reloadUsers();
  };

  const updateNickname = async (firstName: string, lastName?: string): Promise<{ success: boolean; error?: string }> => {
    if (!currentUser || !currentUser.id) return { success: false, error: 'Пользователь не авторизован' };
    const res = await api.changeUserNickname(currentUser.id, firstName, lastName);
    if (res.success && res.user) {
      setCurrentUser(res.user);
      await reloadUsers();
      return { success: true };
    }
    return { success: false, error: res.error || 'Ошибка смены ника' };
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isLoading,
        login,
        verify2FA,
        resend2FA,
        register,
        logout,
        switchRoleDebug,
        allUsers,
        reloadUsers,
        updateCurrentUserData,
        updateAvatar,
        updateNickname
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
