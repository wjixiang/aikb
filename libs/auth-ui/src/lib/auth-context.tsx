// src/context/AuthContext.jsx
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from 'react';

// Define the shape of the context value
interface AuthContextType {
  user: UserData | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (credentials: {
    email: string;
    password: string;
  }) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  signup: (credentials: {
    name: string;
    email: string;
    password: string;
  }) => Promise<{ success: boolean; error?: string }>;
  updateUser: (userData: Partial<UserData>) => void;
  getToken: () => string | null;
  handleLogout: () => void;
  baseUrl: string;
  setBaseUrl: (url: string) => void;
}

interface UserData {
  sub: string; // 用户ID
  email: string;
  name: string;
  isActive: boolean;
}

interface AuthProviderProps {
  children: React.ReactNode;
  baseUrl: string;
}

// Create Context with proper type and default null value
const AuthContext = createContext<AuthContextType | null>(null);

// Create Provider component with proper children type
export const AuthProvider = ({
  children,
  baseUrl: initialBaseUrl = '',
}: AuthProviderProps) => {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true); // 初始加载状态
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [baseUrl, setBaseUrl] = useState(initialBaseUrl);

  // Helper function to build full API URL
  const getApiUrl = useCallback(
    (path: string) => {
      return `${baseUrl}${path}`;
    },
    [baseUrl],
  );

  // 应用启动时检查本地存储的token
  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = localStorage.getItem('token');
        const savedUser = localStorage.getItem('user');

        if (token && savedUser) {
          // 验证token有效性（可选）
          const response = await fetch(getApiUrl('/api/auth/verify'), {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (response.ok) {
            setUser(JSON.parse(savedUser));
            setIsAuthenticated(true);
          } else {
            // Token无效，清除本地存储
            handleLogout();
          }
        }
      } catch (error) {
        console.error('Auth initialization failed:', error);
        handleLogout();
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, [getApiUrl]);

  // 登录函数
  const login = useCallback(
    async (credentials: { email: string; password: string }) => {
      try {
        setLoading(true);

        // 发送登录请求
        const response = await fetch(getApiUrl('/api/auth/login'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(credentials),
        });

        if (!response.ok) {
          throw new Error(`登录失败: ${response.status}`);
        }

        const data = await response.json();

        // resturn structure: { token: '...', user: { id: 1, name: '...', role: '...' } }
        const { token, user: userData } = data;

        // Update User status
        setUser(userData);
        setIsAuthenticated(true);

        // Store authentication information
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(userData));

        return { success: true };
      } catch (error) {
        console.error(`Login error: ${JSON.stringify(error)}`);
        return {
          success: false,
          error:
            error instanceof Error ? error.message : 'Unknown error occurred',
        };
      } finally {
        setLoading(false);
      }
    },
    [getApiUrl],
  );

  // 登出函数
  const logout = useCallback(() => {
    // 清除状态
    setUser(null);
    setIsAuthenticated(false);

    // 清除本地存储
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }, []);

  // 封装登出逻辑供外部使用（如token失效时）
  const handleLogout = useCallback(() => {
    logout();
  }, [logout]);

  const signup = useCallback(
    async (credentials: { name: string; email: string; password: string }) => {
      try {
        setLoading(true);

        const response = await fetch(getApiUrl('/api/auth/register'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(credentials),
        });

        if (!response.ok) {
          throw new Error('Signup failed');
        }

        const data = await response.json();

        // resturn structure: { token: '...', user: { id: 1, name: '...', role: '...' } }
        const { token, user: userData } = data;

        // Update User status
        setUser(userData);
        setIsAuthenticated(true);

        // Store authentication information
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(userData));

        return { success: true };
      } catch (error) {
        console.error('Signup error:', error);
        return {
          success: false,
          error:
            error instanceof Error ? error.message : 'Unknown error occurred',
        };
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // 更新用户信息 - Fixed: use functional state update to avoid stale closure
  const updateUser = useCallback((userData: Partial<UserData>) => {
    setUser((prev) => {
      const updatedUser = prev ? { ...prev, ...userData } : null;

      // 更新本地存储
      if (updatedUser) {
        localStorage.setItem('user', JSON.stringify(updatedUser));
      }

      return updatedUser;
    });
  }, []);

  // 获取当前token
  const getToken = useCallback(() => {
    return localStorage.getItem('token');
  }, []);

  // Context值
  const value: AuthContextType = {
    user,
    isAuthenticated,
    loading,
    login,
    logout,
    signup,
    updateUser,
    getToken,
    handleLogout,
    baseUrl,
    setBaseUrl,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// 创建自定义Hook
export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
};
