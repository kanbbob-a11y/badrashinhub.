import {
  AdminSettings,
  AttendanceRecord,
  AttendanceStatus,
  DayData,
  PenaltyRecord,
  Registration,
  ReleaseRequest,
  SwapRecord,
  UserAccount,
  WaitlistEntry,
} from './types';
import { calcSlotStatus } from './slotLogic';
import { pushLocalStateToCloud } from './cloudSync';
import { emitRosterChange, getDefaultAdminSettings, STORAGE_KEYS } from './persistence';

function parseStorage<T>(key: string, fallback: T): T {
  const saved = localStorage.getItem(key);
  if (!saved) return fallback;

  try {
    return JSON.parse(saved) as T;
  } catch {
    return fallback;
  }
}

function normalizePhone(phone: string) {
  return phone.replace(/\s+/g, '').trim();
}

function normalizeEmployeeId(employeeId: string) {
  return employeeId.trim();
}

function generateNumericId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getNextEmployeeId(users: UserAccount[]) {
  const maxId = users.reduce((max, user) => {
    const parsed = Number(user.employeeId);
    return Number.isFinite(parsed) ? Math.max(max, parsed) : max;
  }, 0);

  return String(maxId + 1).padStart(3, '0');
}

function getSettingsForSync(overriddenSettings?: AdminSettings) {
  return overriddenSettings ?? parseStorage<AdminSettings>(STORAGE_KEYS.settings, getDefaultAdminSettings());
}

function persistChanges(entries: Array<[string, unknown]>, overriddenSettings?: AdminSettings, shouldSync = true) {
  entries.forEach(([key, value]) => {
    localStorage.setItem(key, JSON.stringify(value));
  });

  emitRosterChange();

  if (!shouldSync) return;

  const settings = getSettingsForSync(overriddenSettings);
  void pushLocalStateToCloud(settings.firebaseConfig, settings.cloudEnabled);
}

export function getTodayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function getDaysUntil(dayKey: string) {
  const [year, month, day] = dayKey.split('-').map(Number);
  const target = new Date(year, month - 1, day);
  target.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diff = target.getTime() - today.getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

function isPastDay(dayKey: string) {
  return dayKey < getTodayKey();
}

export function canSwapOnPreviousDay(dayKey: string) {
  return getDaysUntil(dayKey) === 1;
}

export function getAdminSettings(): AdminSettings {
  return parseStorage<AdminSettings>(STORAGE_KEYS.settings, getDefaultAdminSettings());
}

export function saveAdminSettings(settings: AdminSettings) {
  const normalizedSettings: AdminSettings = {
    notificationPhone: normalizePhone(settings.notificationPhone),
    cloudEnabled: settings.cloudEnabled,
    autoExportOnFull: settings.autoExportOnFull,
    firebaseConfig: settings.firebaseConfig,
  };

  persistChanges([[STORAGE_KEYS.settings, normalizedSettings]], normalizedSettings, false);
}

export function getAllUsers(): UserAccount[] {
  return parseStorage<UserAccount[]>(STORAGE_KEYS.users, []);
}

export function getUserById(userId: string): UserAccount | null {
  return getAllUsers().find((user) => user.id === userId) ?? null;
}

export function registerUser(input: {
  name: string;
  phone: string;
  password: string;
}): { success: boolean; message: string; user?: UserAccount } {
  const users = getAllUsers();
  const phone = normalizePhone(input.phone);

  if (users.some((user) => normalizePhone(user.phone) === phone)) {
    return { success: false, message: 'رقم الهاتف مسجل بالفعل، سجل دخول بالـ ID والباسورد.' };
  }

  const user: UserAccount = {
    id: generateNumericId(),
    employeeId: getNextEmployeeId(users),
    name: input.name.trim(),
    phone,
    password: input.password,
    createdAt: Date.now(),
  };

  const updatedUsers = [...users, user];
  persistChanges([[STORAGE_KEYS.users, updatedUsers]]);
  return { success: true, message: `تم إنشاء الحساب ورقمك الوظيفي هو ${user.employeeId}`, user };
}

export function loginUser(employeeId: string, password: string): { success: boolean; message: string; user?: UserAccount } {
  const normalizedId = normalizeEmployeeId(employeeId);
  const user = getAllUsers().find((item) => item.employeeId === normalizedId && item.password === password);

  if (!user) {
    return { success: false, message: 'الـ ID أو الباسورد غير صحيح.' };
  }

  return { success: true, message: 'تم تسجيل الدخول بنجاح', user };
}

export function generateDays(): DayData[] {
  const days: DayData[] = [];
  const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let endDate = new Date(today.getFullYear(), 7, 30);
  if (endDate < today) {
    endDate = new Date(today.getFullYear() + 1, 7, 30);
  }

  const regs = getAllRegistrations();
  const currentDate = new Date(today);

  while (currentDate <= endDate) {
    const dayName = dayNames[currentDate.getDay()];
    const dateStr = `${currentDate.getDate()}/${currentDate.getMonth() + 1}`;
    const key = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
    const dayRegs = regs.filter((r) => r.dayKey === key);
    const status = calcSlotStatus(dayRegs);

    days.push({
      key,
      label: `${dayName} ${dateStr}`,
      date: dateStr,
      dayName,
      registrations: dayRegs,
      isClosed: status.isDayClosed,
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return days;
}

export function getAllRegistrations(): Registration[] {
  const registrations = parseStorage<Registration[]>(STORAGE_KEYS.registrations, []);
  return registrations.map((item) => ({
    ...item,
    phone: normalizePhone(item.phone),
    employeeId: item.employeeId ?? '---',
    userId: item.userId ?? item.phone,
  }));
}

export function getAllAttendance(): AttendanceRecord[] {
  return parseStorage<AttendanceRecord[]>(STORAGE_KEYS.attendance, []);
}

export function getAllReleaseRequests(): ReleaseRequest[] {
  return parseStorage<ReleaseRequest[]>(STORAGE_KEYS.releases, []);
}

export function getAllPenalties(): PenaltyRecord[] {
  return parseStorage<PenaltyRecord[]>(STORAGE_KEYS.penalties, []);
}

export function getAllWaitlistEntries(): WaitlistEntry[] {
  return parseStorage<WaitlistEntry[]>(STORAGE_KEYS.waitlist, []);
}

export function getAllSwaps(): SwapRecord[] {
  return parseStorage<SwapRecord[]>(STORAGE_KEYS.swaps, []);
}

export function getDayRegistrations(dayKey: string): Registration[] {
  return getAllRegistrations().filter((r) => r.dayKey === dayKey);
}

export function getUserRegistrations(userId: string): Registration[] {
  return getAllRegistrations()
    .filter((r) => r.userId === userId)
    .sort((a, b) => a.dayKey.localeCompare(b.dayKey));
}

export function getUserTodayRegistration(userId: string): Registration | null {
  return getUserRegistrations(userId).find((r) => r.dayKey === getTodayKey()) ?? null;
}

export function getRegistrationReleaseRequest(registrationId: string): ReleaseRequest | null {
  return getAllReleaseRequests().find((item) => item.registrationId === registrationId && item.status === 'open') ?? null;
}

export function getDayReleaseRequests(dayKey: string): ReleaseRequest[] {
  return getAllReleaseRequests().filter((item) => item.dayKey === dayKey && item.status === 'open');
}

export function getDayWaitlist(dayKey: string): WaitlistEntry[] {
  return getAllWaitlistEntries()
    .filter((item) => item.dayKey === dayKey && item.status === 'waiting')
    .sort((a, b) => a.createdAt - b.createdAt);
}

export function getUserWaitlistEntries(userId: string): WaitlistEntry[] {
  return getAllWaitlistEntries().filter((item) => item.userId === userId && item.status === 'waiting');
}

export function getDaySwaps(dayKey: string): SwapRecord[] {
  return getAllSwaps().filter((item) => item.dayKey === dayKey).sort((a, b) => b.createdAt - a.createdAt);
}

export function hasPenalty(registrationId: string) {
  return getAllPenalties().some((item) => item.registrationId === registrationId);
}

export function getUserPenalties(userId: string): PenaltyRecord[] {
  return getAllPenalties().filter((item) => item.userId === userId);
}

export function getAttendanceStatus(registration: Registration, attendance = getAllAttendance()): AttendanceStatus {
  const isPresent = attendance.some((item) => item.registrationId === registration.id);
  if (isPresent) return 'present';
  if (isPastDay(registration.dayKey)) return 'absent';
  return 'scheduled';
}

export function getUserWarnings(userId: string): Registration[] {
  const attendance = getAllAttendance();
  return getUserRegistrations(userId).filter((reg) => getAttendanceStatus(reg, attendance) === 'absent');
}

export function addRegistration(reg: Registration): { success: boolean; message: string } {
  const regs = getAllRegistrations();
  const dayRegs = regs.filter((r) => r.dayKey === reg.dayKey);
  const status = calcSlotStatus(dayRegs);
  const existingForUser = dayRegs.find((r) => r.userId === reg.userId);

  if (existingForUser) {
    return { success: false, message: 'لا يمكن تسجيل أكثر من شيفت في نفس اليوم، اختار يوم تاني.' };
  }

  if (reg.shiftType === '24' && !status.can24) {
    return { success: false, message: 'عذراً، خانات الـ 24 ساعة مقفولة لهذا اليوم' };
  }

  if (reg.shiftType === 'long' && !status.canLong) {
    return { success: false, message: 'عذراً، خانات اللونج مقفولة لهذا اليوم' };
  }

  if (reg.shiftType === 'night' && !status.canNight) {
    return { success: false, message: 'عذراً، خانات النايت مقفولة لهذا اليوم' };
  }

  const updated = [
    ...regs,
    {
      ...reg,
      phone: normalizePhone(reg.phone),
      employeeId: normalizeEmployeeId(reg.employeeId),
    },
  ];

  persistChanges([[STORAGE_KEYS.registrations, updated]]);
  return { success: true, message: 'تم تسجيل الشيفت بنجاح ✅' };
}

export function joinWaitlist(userId: string, dayKey: string): { success: boolean; message: string } {
  if (getDaysUntil(dayKey) < 0) {
    return { success: false, message: 'لا يمكن الانضمام لقائمة انتظار يوم قديم.' };
  }

  const user = getUserById(userId);
  if (!user) {
    return { success: false, message: 'المستخدم غير موجود.' };
  }

  const hasRegistration = getDayRegistrations(dayKey).some((item) => item.userId === userId);
  if (hasRegistration) {
    return { success: false, message: 'أنت مسجل بالفعل في هذا اليوم، لا يمكن دخول قائمة الانتظار.' };
  }

  const waitlist = getAllWaitlistEntries();
  const existing = waitlist.find((item) => item.userId === userId && item.dayKey === dayKey && item.status === 'waiting');
  if (existing) {
    return { success: false, message: 'أنت موجود بالفعل في قائمة الانتظار لهذا اليوم.' };
  }

  const updated = [
    ...waitlist,
    {
      id: generateNumericId(),
      userId: user.id,
      employeeId: user.employeeId,
      dayKey,
      name: user.name,
      phone: user.phone,
      createdAt: Date.now(),
      status: 'waiting' as const,
    },
  ];

  persistChanges([[STORAGE_KEYS.waitlist, updated]]);
  return { success: true, message: 'تمت إضافتك إلى قائمة الانتظار ✅' };
}

export function leaveWaitlist(waitlistEntryId: string): { success: boolean; message: string } {
  const waitlist = getAllWaitlistEntries();
  const exists = waitlist.some((item) => item.id === waitlistEntryId && item.status === 'waiting');
  if (!exists) {
    return { success: false, message: 'طلب الانتظار غير موجود.' };
  }

  const updated = waitlist.filter((item) => item.id !== waitlistEntryId);
  persistChanges([[STORAGE_KEYS.waitlist, updated]]);
  return { success: true, message: 'تم الخروج من قائمة الانتظار.' };
}

export function markTodayAttendance(userId: string): { success: boolean; message: string } {
  const todayRegistration = getUserTodayRegistration(userId);
  if (!todayRegistration) {
    return { success: false, message: 'لا يوجد لك شيفت مسجل اليوم لتسجيل الحضور.' };
  }

  const attendance = getAllAttendance();
  const alreadyChecked = attendance.some((item) => item.registrationId === todayRegistration.id);
  if (alreadyChecked) {
    return { success: false, message: 'تم تسجيل حضورك اليوم بالفعل.' };
  }

  const updated = [
    ...attendance,
    {
      id: generateNumericId(),
      registrationId: todayRegistration.id,
      userId: todayRegistration.userId,
      employeeId: todayRegistration.employeeId,
      dayKey: todayRegistration.dayKey,
      name: todayRegistration.name,
      phone: todayRegistration.phone,
      checkedInAt: Date.now(),
    },
  ];

  persistChanges([[STORAGE_KEYS.attendance, updated]]);
  return { success: true, message: 'تم تسجيل الحضور بعد البصمة ✅' };
}

export function createShiftReleaseRequest(userId: string): { success: boolean; message: string; whatsappUrl?: string } {
  const registration = getUserTodayRegistration(userId);
  if (!registration) {
    return { success: false, message: 'لا يوجد شيفت اليوم لإتاحته.' };
  }

  if (getAttendanceStatus(registration) === 'present') {
    return { success: false, message: 'لا يمكن إتاحة الشيفت بعد تسجيل الحضور.' };
  }

  const requests = getAllReleaseRequests();
  const existing = requests.find((item) => item.registrationId === registration.id && item.status === 'open');
  if (existing) {
    return { success: false, message: 'تم إرسال طلب إتاحة الشيفت بالفعل.' };
  }

  const updated = [
    ...requests,
    {
      id: generateNumericId(),
      registrationId: registration.id,
      userId: registration.userId,
      employeeId: registration.employeeId,
      dayKey: registration.dayKey,
      name: registration.name,
      phone: registration.phone,
      shiftType: registration.shiftType,
      createdAt: Date.now(),
      status: 'open' as const,
    },
  ];

  persistChanges([[STORAGE_KEYS.releases, updated]]);

  const settings = getAdminSettings();
  const messageText = `السلام عليكم، الشيفت متاح الآن: ${registration.name} - ID ${registration.employeeId} - ${registration.dayKey} - ${registration.shiftType}`;
  const whatsappUrl = settings.notificationPhone
    ? `https://wa.me/${settings.notificationPhone}?text=${encodeURIComponent(messageText)}`
    : undefined;

  return {
    success: true,
    message: settings.notificationPhone
      ? 'تم تسجيل الاعتذار وفتح رسالة واتساب للإدارة.'
      : 'تم تسجيل الاعتذار داخل النظام. أضيفي رقم الإدارة من لوحة الإشراف لتفعيل واتساب.',
    whatsappUrl,
  };
}

export function assignWaitlistReplacement(registrationId: string, replacementUserId: string): { success: boolean; message: string } {
  const registrations = getAllRegistrations();
  const registrationIndex = registrations.findIndex((item) => item.id === registrationId);
  if (registrationIndex === -1) {
    return { success: false, message: 'الشيفت المطلوب استبداله غير موجود.' };
  }

  const registration = registrations[registrationIndex];

  if (!canSwapOnPreviousDay(registration.dayKey)) {
    return { success: false, message: 'اختيار البديل متاح فقط قبل الشيفت بيوم.' };
  }

  if (getAttendanceStatus(registration) === 'present') {
    return { success: false, message: 'لا يمكن الاستبدال بعد تسجيل الحضور.' };
  }

  const replacementUser = getUserById(replacementUserId);
  if (!replacementUser) {
    return { success: false, message: 'الشخص البديل غير موجود.' };
  }

  const dayWaitlist = getDayWaitlist(registration.dayKey);
  const waitlistEntry = dayWaitlist.find((item) => item.userId === replacementUserId);
  if (!waitlistEntry) {
    return { success: false, message: 'الشخص المختار ليس في قائمة الانتظار لهذا اليوم.' };
  }

  const replacementAlreadyBooked = registrations.some((item) => item.dayKey === registration.dayKey && item.userId === replacementUserId);
  if (replacementAlreadyBooked) {
    return { success: false, message: 'هذا الشخص مسجل بالفعل في نفس اليوم.' };
  }

  const oldOwner = { ...registration };
  const updatedRegistrations = [...registrations];
  updatedRegistrations[registrationIndex] = {
    ...registration,
    userId: replacementUser.id,
    employeeId: replacementUser.employeeId,
    name: replacementUser.name,
    phone: replacementUser.phone,
    timestamp: Date.now(),
  };

  const updatedWaitlist = getAllWaitlistEntries().map((item) =>
    item.id === waitlistEntry.id ? { ...item, status: 'replaced' as const } : item,
  );

  const updatedReleases = getAllReleaseRequests().map((item) =>
    item.registrationId === registration.id && item.status === 'open' ? { ...item, status: 'resolved' as const } : item,
  );

  const updatedSwaps = [
    ...getAllSwaps(),
    {
      id: generateNumericId(),
      registrationId: registration.id,
      dayKey: registration.dayKey,
      shiftType: registration.shiftType,
      fromUserId: oldOwner.userId,
      fromEmployeeId: oldOwner.employeeId,
      fromName: oldOwner.name,
      toUserId: replacementUser.id,
      toEmployeeId: replacementUser.employeeId,
      toName: replacementUser.name,
      createdAt: Date.now(),
    },
  ];

  persistChanges([
    [STORAGE_KEYS.registrations, updatedRegistrations],
    [STORAGE_KEYS.waitlist, updatedWaitlist],
    [STORAGE_KEYS.releases, updatedReleases],
    [STORAGE_KEYS.swaps, updatedSwaps],
  ]);

  return { success: true, message: `تم تحويل الشيفت إلى ${replacementUser.name} بنجاح ✅` };
}

export function resolveReleaseRequest(requestId: string) {
  const updated = getAllReleaseRequests().map((item) => (item.id === requestId ? { ...item, status: 'resolved' as const } : item));
  persistChanges([[STORAGE_KEYS.releases, updated]]);
}

export function issuePenalty(registrationId: string, reason = 'جزاء غياب عمد'): { success: boolean; message: string } {
  const registration = getAllRegistrations().find((item) => item.id === registrationId);
  if (!registration) {
    return { success: false, message: 'السجل غير موجود.' };
  }

  if (hasPenalty(registrationId)) {
    return { success: false, message: 'تم تسجيل الجزاء بالفعل.' };
  }

  const updated = [
    ...getAllPenalties(),
    {
      id: generateNumericId(),
      registrationId: registration.id,
      userId: registration.userId,
      employeeId: registration.employeeId,
      dayKey: registration.dayKey,
      name: registration.name,
      phone: registration.phone,
      reason,
      createdAt: Date.now(),
    },
  ];

  persistChanges([[STORAGE_KEYS.penalties, updated]]);
  return { success: true, message: 'تم تسجيل الجزاء بنجاح.' };
}

export function removeRegistration(id: string): void {
  const updatedRegs = getAllRegistrations().filter((reg) => reg.id !== id);
  const updatedAttendance = getAllAttendance().filter((item) => item.registrationId !== id);
  const updatedReleases = getAllReleaseRequests().filter((item) => item.registrationId !== id);
  const updatedPenalties = getAllPenalties().filter((item) => item.registrationId !== id);
  const updatedSwaps = getAllSwaps().filter((item) => item.registrationId !== id);

  persistChanges([
    [STORAGE_KEYS.registrations, updatedRegs],
    [STORAGE_KEYS.attendance, updatedAttendance],
    [STORAGE_KEYS.releases, updatedReleases],
    [STORAGE_KEYS.penalties, updatedPenalties],
    [STORAGE_KEYS.swaps, updatedSwaps],
  ]);
}

export function clearDayRegistrations(dayKey: string): void {
  const updatedRegs = getAllRegistrations().filter((reg) => reg.dayKey !== dayKey);
  const updatedAttendance = getAllAttendance().filter((item) => item.dayKey !== dayKey);
  const updatedReleases = getAllReleaseRequests().filter((item) => item.dayKey !== dayKey);
  const updatedPenalties = getAllPenalties().filter((item) => item.dayKey !== dayKey);
  const updatedWaitlist = getAllWaitlistEntries().filter((item) => item.dayKey !== dayKey);
  const updatedSwaps = getAllSwaps().filter((item) => item.dayKey !== dayKey);

  persistChanges([
    [STORAGE_KEYS.registrations, updatedRegs],
    [STORAGE_KEYS.attendance, updatedAttendance],
    [STORAGE_KEYS.releases, updatedReleases],
    [STORAGE_KEYS.penalties, updatedPenalties],
    [STORAGE_KEYS.waitlist, updatedWaitlist],
    [STORAGE_KEYS.swaps, updatedSwaps],
  ]);
}

export function clearAllData(): void {
  Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
  emitRosterChange();
}
