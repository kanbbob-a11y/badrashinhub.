export type ShiftType = 'long' | 'night' | '24';
export type AttendanceStatus = 'present' | 'absent' | 'scheduled';
export type ReleaseRequestStatus = 'open' | 'resolved';
export type WaitlistStatus = 'waiting' | 'replaced';

export interface UserAccount {
  id: string;
  employeeId: string;
  name: string;
  phone: string;
  password: string;
  createdAt: number;
}

export interface Registration {
  id: string;
  userId: string;
  employeeId: string;
  name: string;
  phone: string;
  dayKey: string;
  shiftType: ShiftType;
  timestamp: number;
}

export interface AttendanceRecord {
  id: string;
  registrationId: string;
  userId: string;
  employeeId: string;
  dayKey: string;
  name: string;
  phone: string;
  checkedInAt: number;
}

export interface ReleaseRequest {
  id: string;
  registrationId: string;
  userId: string;
  employeeId: string;
  dayKey: string;
  name: string;
  phone: string;
  shiftType: ShiftType;
  createdAt: number;
  status: ReleaseRequestStatus;
}

export interface PenaltyRecord {
  id: string;
  registrationId: string;
  userId: string;
  employeeId: string;
  dayKey: string;
  name: string;
  phone: string;
  reason: string;
  createdAt: number;
}

export interface WaitlistEntry {
  id: string;
  userId: string;
  employeeId: string;
  dayKey: string;
  name: string;
  phone: string;
  createdAt: number;
  status: WaitlistStatus;
}

export interface SwapRecord {
  id: string;
  registrationId: string;
  dayKey: string;
  shiftType: ShiftType;
  fromUserId: string;
  fromEmployeeId: string;
  fromName: string;
  toUserId: string;
  toEmployeeId: string;
  toName: string;
  createdAt: number;
}

export interface FirebasePublicConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export interface AdminSettings {
  notificationPhone: string;
  cloudEnabled: boolean;
  autoExportOnFull: boolean;
  firebaseConfig: FirebasePublicConfig | null;
}

export interface DayData {
  key: string;
  label: string;
  date: string;
  dayName: string;
  registrations: Registration[];
  isClosed: boolean;
}

export type AppView = 'login' | 'register' | 'admin';

export const SHIFT_LABELS: Record<ShiftType, string> = {
  long: 'لونج (Long)',
  night: 'نايت (Night)',
  '24': '٢٤ ساعة (24h)',
};

export const SHIFT_COLORS: Record<ShiftType, string> = {
  long: 'bg-amber-100 text-amber-800 border-amber-300',
  night: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  '24': 'bg-red-100 text-red-800 border-red-300',
};

export const MAX_SHIFTS_PER_DAY = 21;
export const ADMIN_PASSWORD = [49, 54, 49, 50, 50, 48, 49, 49]
  .map((charCode) => String.fromCharCode(charCode))
  .join('');
