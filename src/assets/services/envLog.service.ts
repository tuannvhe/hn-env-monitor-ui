// services/envLog.service.ts
import axios from 'axios';
import type { 
  RollingGridResponse, 
  AbnormalRecord, 
  UpsertCellLogRequestDto, 
  LocationLookup,
  AbnormalReport,
  CreateAbnormalReportDto,
  UpdateAbnormalReportDto
} from '../interfaces/envLog.interface';
//const API_BASE_URL = 'http://192.168.7.18:8002/api';
const API_BASE_URL = 'http://localhost:5111/api';

export const envLogService = {
  // Location API
  getLocations: async (): Promise<LocationLookup[]> => {
    const response = await axios.get(`${API_BASE_URL}/Location/lookup`);
    return response.data;
  },

  updateDeviceCode: async (locationId: number, deviceCode: string): Promise<any> => {
    const response = await axios.patch(`${API_BASE_URL}/Location/${locationId}/device-code`, null, {
      params: { deviceCode }
    });
    return response.data;
  },

  // EnvLog API
  getRollingGrid: async (locationId: number, fromDate: string, toDate: string): Promise<RollingGridResponse> => {
    const response = await axios.get(`${API_BASE_URL}/EnvLog/rolling-grid`, { 
      params: { locationId, fromDate, toDate } 
    });
    return response.data;
  },

  saveCellLog: async (payload: UpsertCellLogRequestDto): Promise<any> => {
    const response = await axios.post(`${API_BASE_URL}/EnvLog/save-cell`, payload);
    return response.data;
  },

  getAbnormalRecords: async (locationId: number, fromDate: string, toDate: string): Promise<AbnormalRecord[]> => {
    const response = await axios.get(`${API_BASE_URL}/EnvLog/abnormal-records`, { 
      params: { locationId, fromDate, toDate } 
    });
    return response.data;
  },

  saveAbnormalRecord: async (payload: { locationId: number; date: string; shiftCode: string; issue: string; action: string; }): Promise<AbnormalRecord> => {
    const response = await axios.post(`${API_BASE_URL}/EnvLog/abnormal-record`, payload);
    return response.data;
  },

  deleteAbnormalRecord: async (id: number): Promise<void> => {
    await axios.delete(`${API_BASE_URL}/EnvLog/abnormal-record/${id}`);
  },

  confirmShiftLog: async (
  locationId: number,
  date: string,
  shiftCode: string,
  confirmedBy: string,
  shiftPeriodId: number, // ← thêm param
): Promise<any> => {
  const response = await axios.post(`${API_BASE_URL}/EnvLog/confirm`, {
    locationId,
    date,
    shiftCode,
    confirmedBy,
    shiftPeriodId, // ← dùng giá trị từ SHIFTS[].periodId thay vì tự tính
  });
  return response.data;
},

  // ===================== AbnormalReport API =====================
  
  // Lấy danh sách báo cáo bất thường theo khoảng ngày
  getAbnormalReports: async (locationId: number, fromDate: string, toDate: string): Promise<AbnormalReport[]> => {
    const response = await axios.get(`${API_BASE_URL}/AbnormalReport`, {
      params: { locationId, fromDate, toDate }
    });
    return response.data;
  },

  // Tạo báo cáo bất thường mới
  createAbnormalReport: async (payload: CreateAbnormalReportDto): Promise<AbnormalReport> => {
    const response = await axios.post(`${API_BASE_URL}/AbnormalReport`, payload);
    return response.data;
  },

  // Cập nhật báo cáo bất thường
  updateAbnormalReport: async (id: number, payload: UpdateAbnormalReportDto): Promise<AbnormalReport> => {
    const response = await axios.put(`${API_BASE_URL}/AbnormalReport/${id}`, payload);
    return response.data;
  },

  // Xóa báo cáo bất thường
  deleteAbnormalReport: async (id: number): Promise<void> => {
    await axios.delete(`${API_BASE_URL}/AbnormalReport/${id}`);
  },

  // Đánh dấu đã xử lý báo cáo
  resolveAbnormalReport: async (id: number, resolvedBy: string, resolutionNote: string): Promise<AbnormalReport> => {
    const response = await axios.patch(`${API_BASE_URL}/AbnormalReport/${id}/resolve`, null, {
      params: { resolvedBy, resolutionNote }
    });
    return response.data;
  },
};