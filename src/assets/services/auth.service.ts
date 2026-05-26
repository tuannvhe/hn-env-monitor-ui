import axios from 'axios';
import type { UserInfo } from '../interfaces/auth.interface';

const API_BASE_URL = 'http://localhost:5111/api';

// Sự kiện logout toàn cục
export const LOGOUT_EVENT = 'auth:logout';

export const authService = {
  // 1. Đăng nhập và lưu quyền
  login: async (username: string, password: string): Promise<any> => {
    const response = await axios.post(`${API_BASE_URL}/Auth/login`, {
      username: username,
      password: password
    });

    if (response.data && response.data.token) {
      // Decode để lấy các claim (CanCreate, CanUpdate, CanDelete)
      const decoded = authService.decodeToken(response.data.token);
      //console.log("Decoded JWT:", decoded);
      
      const userInfo: UserInfo = {
        id: decoded.userId || 0,
        username: decoded.username || username,
        fullName: decoded.fullName || username,
        role: decoded.role,
        // Map quyền từ JWT Claims (Backend gửi về dưới dạng string "True"/"False")
        canCreate: decoded.CanCreate === "True",
        canUpdate: decoded.CanUpdate === "True",
        canDelete: decoded.CanDelete === "True",
        position: decoded.position || "-",
      };

      // Lưu trữ
      localStorage.setItem('accessToken', response.data.token);
      localStorage.setItem('user', JSON.stringify(userInfo));

      return { token: response.data.token, user: userInfo };
    }
    throw new Error('No token in response');
  },

  getCurrentUser: (): UserInfo | null => {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },

  logout: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    delete axios.defaults.headers.common['Authorization'];
    // Không gọi window.location.href ở đây để App kiểm soát
  },

  // Logout và chuyển hướng (dùng khi cần force logout)
  forceLogout: () => {
    authService.logout();
    window.location.href = '/';
  },

  isAuthenticated: (): boolean => !!localStorage.getItem('accessToken'),

  decodeToken: (token: string): any => {
    try {
      const payload = token.split('.')[1];
      const decoded = decodeURIComponent(
        atob(payload)
          .split("")
          .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
          .join("")
      );
      return JSON.parse(decoded);
    } catch {
      return null;
    }
  },

  // Kiểm tra token còn hạn không
  isTokenExpired: (token: string): boolean => {
    const decoded = authService.decodeToken(token);
    if (!decoded || !decoded.exp) return true;
    
    const expirationTime = decoded.exp * 1000;
    const currentTime = Date.now();
    
    return currentTime >= expirationTime;
  },

  // Lấy thời gian hết hạn của token (milliseconds)
  getTokenExpiryTime: (token: string): number | null => {
    const decoded = authService.decodeToken(token);
    if (!decoded || !decoded.exp) return null;
    return decoded.exp * 1000;
  }
};

// 2. Interceptors: Xử lý request tự động đính kèm token
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 3. Interceptors: Xử lý lỗi 401 - Tự động logout

axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      console.error("Phiên đăng nhập hết hạn hoặc không có quyền.");
      
      // Trigger logout event
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(LOGOUT_EVENT));
      }
      
      // Xóa token và user
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
      delete axios.defaults.headers.common['Authorization'];
    }
    
    return Promise.reject(error);
  }
);