// interfaces/envLog.interface.ts

export interface LocationLookup {
  id: number;
  name: string;
  code?: string;
  deviceCode?: string;
}

export interface RollingGridResponse {
  dailyData: {
    [date: string]: DailyData;
  };
}

export interface DailyData {
  isConfirmed: boolean;
  confirmedBy: string | null;
  note: string | null;
  shifts: {
    [shiftCode: string]: ShiftData;
  };
}

export interface ShiftData {
  temperature: number | null;
  humidity: number | null;
  recordedBy: string | null;
  isConfirmed: boolean;
  confirmedBy: string | null;
}

export interface AbnormalRecord {
  id: number;
  locationId: number;
  date: string;
  shiftCode: string;
  issue: string;
  action: string;
  createdAt?: string;
  updatedAt?: string;
}

// Interface cho AbnormalReport mới
export interface AbnormalReport {
  id: number;
  locationId: number;
  locationName?: string;
  reportDate: string;
  shiftPeriodId: number;
  shiftCode?: string;
  shiftName?: string;
  issue: string;
  action: string | null;
  reportedBy: string | null;
  reportedAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionNote: string | null;
  isResolved: boolean;
}

export interface CreateAbnormalReportDto {
  locationId: number;
  reportDate: string;
  shiftCode: string;
  issue: string;
  action?: string;
  reportedBy?: string;
}

export interface UpdateAbnormalReportDto {
  action?: string;
  isResolved?: boolean;
  resolutionNote?: string;
  resolvedBy?: string;
}

export interface UpsertCellLogRequestDto {
  locationId: number;
  date: string;
  shiftCode: string;
  temperature?: number | null;
  humidity?: number | null;
  userAction?: string;
  clearTemperature?: boolean;
  clearHumidity?: boolean;
}

export interface ConfirmShiftLogRequestDto {
  locationId: number;
  date: string;
  shiftCode: string;
  confirmedBy: string;
  note?: string;
}