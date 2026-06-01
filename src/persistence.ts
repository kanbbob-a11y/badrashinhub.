import {
  AdminSettings,
  AttendanceRecord,
  PenaltyRecord,
  Registration,
  ReleaseRequest,
  SwapRecord,
  UserAccount,
  WaitlistEntry,
} from './types';

export const STORAGE_KEYS = {
  users: 'roster_users',
  registrations: 'roster_data',
  attendance: 'roster_attendance',
  releases: 'roster_release_requests',
  penalties: 'roster_penalties',
  settings: 'roster_admin_settings',
  waitlist: 'roster_waitlist',
  swaps: 'roster_swaps',
} as const;

export interface LocalStateSnapshot {
  users: UserAccount[];
  registrations: Registration[];
  attendance: AttendanceRecord[];
  releases: ReleaseRequest[];
  penalties: PenaltyRecord[];
  settings: AdminSettings;
  waitlist: WaitlistEntry[];
  swaps: SwapRecord[];
  updatedAt: number;
}

export function getDefaultAdminSettings(): AdminSettings {
  return {
    notificationPhone: '',
    cloudEnabled: false,
    autoExportOnFull: false,
    firebaseConfig: null,
  };
}

function parseItem<T>(key: string, fallback: T): T {
  const value = localStorage.getItem(key);
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function emitRosterChange() {
  window.dispatchEvent(new CustomEvent('roster-data-changed'));
}

export function subscribeRosterChanges(callback: () => void) {
  const handler = () => callback();
  const storageHandler = (event: StorageEvent) => {
    if (!event.key || Object.values(STORAGE_KEYS).includes(event.key as (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS])) {
      callback();
    }
  };

  window.addEventListener('roster-data-changed', handler);
  window.addEventListener('storage', storageHandler);

  return () => {
    window.removeEventListener('roster-data-changed', handler);
    window.removeEventListener('storage', storageHandler);
  };
}

export function getLocalStateSnapshot(): LocalStateSnapshot {
  return {
    users: parseItem<UserAccount[]>(STORAGE_KEYS.users, []),
    registrations: parseItem<Registration[]>(STORAGE_KEYS.registrations, []),
    attendance: parseItem<AttendanceRecord[]>(STORAGE_KEYS.attendance, []),
    releases: parseItem<ReleaseRequest[]>(STORAGE_KEYS.releases, []),
    penalties: parseItem<PenaltyRecord[]>(STORAGE_KEYS.penalties, []),
    settings: parseItem<AdminSettings>(STORAGE_KEYS.settings, getDefaultAdminSettings()),
    waitlist: parseItem<WaitlistEntry[]>(STORAGE_KEYS.waitlist, []),
    swaps: parseItem<SwapRecord[]>(STORAGE_KEYS.swaps, []),
    updatedAt: Date.now(),
  };
}

export function applyLocalStateSnapshot(snapshot: Partial<LocalStateSnapshot>) {
  if (snapshot.users) localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(snapshot.users));
  if (snapshot.registrations) localStorage.setItem(STORAGE_KEYS.registrations, JSON.stringify(snapshot.registrations));
  if (snapshot.attendance) localStorage.setItem(STORAGE_KEYS.attendance, JSON.stringify(snapshot.attendance));
  if (snapshot.releases) localStorage.setItem(STORAGE_KEYS.releases, JSON.stringify(snapshot.releases));
  if (snapshot.penalties) localStorage.setItem(STORAGE_KEYS.penalties, JSON.stringify(snapshot.penalties));
  if (snapshot.settings) localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(snapshot.settings));
  if (snapshot.waitlist) localStorage.setItem(STORAGE_KEYS.waitlist, JSON.stringify(snapshot.waitlist));
  if (snapshot.swaps) localStorage.setItem(STORAGE_KEYS.swaps, JSON.stringify(snapshot.swaps));
  emitRosterChange();
}
