// assets/interfaces/auth.interface.ts
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  username: string;
  fullName: string;
  role: string;
  user?: UserInfo;
}

export interface UserInfo {
  id: number;
  username: string;
  fullName?: string;
  email?: string;
  role?: string;
  department?: string;
  employeeId?: string;
  // Thêm 3 dòng này vào để TypeScript hết báo lỗi
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  position?: string;
}