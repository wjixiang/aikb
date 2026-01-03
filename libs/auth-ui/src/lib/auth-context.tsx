// src/context/AuthContext.jsx
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
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
  refreshAccessToken: () => Promise<boolean>;
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
  const [tokenExpiry, setTokenExpiry] = useState<number | null>(null);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isRefreshingRef = useRef(false);

  // Helper function to build full API URL
  const getApiUrl = useCallback(
    (path: string) => {
      return `${baseUrl}${path}`;
    },
    [baseUrl],
  );

  // 解析JWT token获取过期时间
  const parseTokenExpiry = useCallback((token: string): number | null => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp ? payload.exp * 1000 : null;
    } catch {
      return null;
    }
  }, []);

  // 获取当前token
  const getToken = useCallback(() => {
    return localStorage.getItem('token');
  }, []);

  // 登出函数
  const logout = useCallback(() => {
    // 清除状态
    setUser(null);
    setIsAuthenticated(false);
    setTokenExpiry(null);

    // 清除本地存储
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('tokenExpiry');

    // 清除刷新定时器
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  // 封装登出逻辑供外部使用（如token失效时）
  const handleLogout = useCallback(() => {
    logout();
  }, [logout]);

  // 安排token刷新定时器
  const scheduleTokenRefresh = useCallback((expiryTime: number) => {
    // 清除之前的定时器
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }

    // 在token过期前5分钟刷新
    const now = Date.now();
    const refreshDelay = Math.max(0, expiryTime - now - 5 * 60 * 1000);

    refreshTimerRef.current = setTimeout(() => {
      refreshAccessToken();
    }, refreshDelay);
  }, []);

  // 刷新访问令牌
  const refreshAccessToken = useCallback(async (): Promise<boolean> => {
    // 防止并发刷新
    if (isRefreshingRef.current) {
      return false;
    }

    const currentToken = localStorage.getItem('token');
    if (!currentToken) {
      return false;
    }

    isRefreshingRef.current = true;

    try {
      const response = await fetch(getApiUrl('/api/auth/refresh'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentToken}`,
        },
      });

      if (!response.ok) {
        // 刷新失败，登出
        handleLogout();
        return false;
      }

      const data = await response.json();
      const { accessToken, expiresIn } = data;

      // 更新token
      localStorage.setItem('token', accessToken);

      // 更新过期时间
      const expiryTime = Date.now() + (expiresIn || 3600) * 1000;
      setTokenExpiry(expiryTime);
      localStorage.setItem('tokenExpiry', expiryTime.toString());

      // 安排下一次刷新
      scheduleTokenRefresh(expiryTime);

      return true;
    } catch (error) {
      console.error('Token refresh failed:', error);
      handleLogout();
      return false;
    } finally {
      isRefreshingRef.current = false;
    }
  }, [getApiUrl, handleLogout, scheduleTokenRefresh]);

  // 带自动重试的fetch包装器
  const fetchWithAuth = useCallback(
    async (url: string, options: RequestInit = {}): Promise<Response> => {
      const token = getToken();
      const headers = {
        ...options.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      let response = await fetch(url, { ...options, headers });

      // 如果收到401，尝试刷新token并重试
      if (response.status === 401 && token) {
        const refreshSuccess = await refreshAccessToken();
        if (refreshSuccess) {
          const newToken = getToken();
          const newHeaders = {
            ...options.headers,
            ...(newToken ? { Authorization: `Bearer ${newToken}` } : {}),
          };
          response = await fetch(url, { ...options, headers: newHeaders });
        }
      }

      return response;
    },
    [getToken, refreshAccessToken],
  );

  // 应用启动时检查本地存储的token
  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = localStorage.getItem('token');
        const savedUser = localStorage.getItem('user');
        const savedExpiry = localStorage.getItem('tokenExpiry');

        if (token && savedUser) {
          // 检查token是否已过期
          const expiryTime = savedExpiry ? parseInt(savedExpiry, 10) : parseTokenExpiry(token);
          const now = Date.now();

          if (expiryTime && expiryTime < now) {
            // Token已过期，尝试刷新
            const refreshSuccess = await refreshAccessToken();
            if (!refreshSuccess) {
              handleLogout();
              return;
            }
          }

          // 验证token有效性（可选）
          const response = await fetch(getApiUrl('/api/auth/validate'), {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (response.ok) {
            setUser(JSON.parse(savedUser));
            setIsAuthenticated(true);

            // 如果有过期时间，安排自动刷新
            if (expiryTime && expiryTime > now) {
              setTokenExpiry(expiryTime);
              scheduleTokenRefresh(expiryTime);
            }
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

    // 组件卸载时清除定时器
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, [getApiUrl, handleLogout, parseTokenExpiry, refreshAccessToken, scheduleTokenRefresh]);

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
        // resturn structure: { accessToken: '...', user: { id: 1, name: '...', role: '...' } }
        const { accessToken, user: userData, expiresIn } = data;

        // Update User status
        setUser(userData);
        setIsAuthenticated(true);

        // Store authentication information
        localStorage.setItem('token', accessToken);
        localStorage.setItem('user', JSON.stringify(userData));

        // Store token expiry time (default 1 hour if not provided)
        const expiryTime = Date.now() + (expiresIn || 3600) * 1000;
        setTokenExpiry(expiryTime);
        localStorage.setItem('tokenExpiry', expiryTime.toString());

        // Start auto-refresh timer
        scheduleTokenRefresh(expiryTime);

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
    [getApiUrl, scheduleTokenRefresh],
  );

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
        const { accessToken, user: userData, expiresIn } = data;

        // Update User status
        setUser(userData);
        setIsAuthenticated(true);

        // Store authentication information
        localStorage.setItem('token', accessToken);
        localStorage.setItem('user', JSON.stringify(userData));

        // Store token expiry time (default 1 hour if not provided)
        const expiryTime = Date.now() + (expiresIn || 3600) * 1000;
        setTokenExpiry(expiryTime);
        localStorage.setItem('tokenExpiry', expiryTime.toString());

        // Start auto-refresh timer
        scheduleTokenRefresh(expiryTime);

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
    [getApiUrl, scheduleTokenRefresh],
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
    refreshAccessToken,
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
