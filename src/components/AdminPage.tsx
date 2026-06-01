import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Registration, SHIFT_COLORS, ShiftType } from '../types';
import {
  clearDayRegistrations,
  generateDays,
  getAdminSettings,
  getAttendanceStatus,
  getDayRegistrations,
  getDayReleaseRequests,
  getDaySwaps,
  getDayWaitlist,
  hasPenalty,
  issuePenalty,
  removeRegistration,
  resolveReleaseRequest,
  saveAdminSettings,
} from '../store';
import { calcSlotStatus, SlotStatus } from '../slotLogic';
import { generatePDF } from '../pdfGenerator';
import { generateExcel } from '../excelGenerator';
import { pushLocalStateToCloud } from '../cloudSync';
import { subscribeRosterChanges } from '../persistence';

interface AdminPageProps {
  onLogout: () => void;
  cloudStatus: 'local' | 'connected' | 'error';
}

function statusBadge(status: 'present' | 'absent' | 'scheduled') {
  if (status === 'present') return 'bg-green-100 text-green-700';
  if (status === 'absent') return 'bg-red-100 text-red-700';
  return 'bg-amber-100 text-amber-700';
}

function statusLabel(status: 'present' | 'absent' | 'scheduled') {
  if (status === 'present') return 'حاضر';
  if (status === 'absent') return 'غائب';
  return 'منتظر';
}

export default function AdminPage({ onLogout, cloudStatus }: AdminPageProps) {
  const [days] = useState(generateDays());
  const initialSettings = getAdminSettings();
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [dayStatuses, setDayStatuses] = useState<Record<string, SlotStatus>>({});
  const [confirmClear, setConfirmClear] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [settingsPhone, setSettingsPhone] = useState(initialSettings.notificationPhone);
  const [cloudEnabled, setCloudEnabled] = useState(initialSettings.cloudEnabled);
  const [autoExportOnFull, setAutoExportOnFull] = useState(initialSettings.autoExportOnFull);
  const [firebaseJson, setFirebaseJson] = useState(initialSettings.firebaseConfig ? JSON.stringify(initialSettings.firebaseConfig, null, 2) : '');
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const autoExportedDaysRef = useRef<Set<string>>(new Set());

  const showToast = (text: string, type: 'success' | 'error') => {
    setToast({ text, type });
    window.setTimeout(() => setToast(null), 3000);
  };

  const refreshStatuses = useCallback(() => {
    const statuses: Record<string, SlotStatus> = {};
    days.forEach((d) => {
      statuses[d.key] = calcSlotStatus(getDayRegistrations(d.key));
    });
    setDayStatuses(statuses);
  }, [days]);

  const refreshDay = useCallback(() => {
    if (!selectedDay) return;
    setRegistrations(getDayRegistrations(selectedDay));
    refreshStatuses();
  }, [refreshStatuses, selectedDay]);

  useEffect(() => {
    refreshStatuses();
  }, [refreshStatuses]);

  useEffect(() => {
    if (selectedDay) {
      setRegistrations(getDayRegistrations(selectedDay));
    }
  }, [selectedDay]);

  useEffect(() => {
    return subscribeRosterChanges(() => {
      const latestSettings = getAdminSettings();
      setSettingsPhone(latestSettings.notificationPhone);
      setCloudEnabled(latestSettings.cloudEnabled);
      setAutoExportOnFull(latestSettings.autoExportOnFull);
      setFirebaseJson(latestSettings.firebaseConfig ? JSON.stringify(latestSettings.firebaseConfig, null, 2) : '');
      if (selectedDay) {
        setRegistrations(getDayRegistrations(selectedDay));
      }
      refreshStatuses();
    });
  }, [refreshStatuses, selectedDay]);

  const selectedDayData = days.find((d) => d.key === selectedDay);
  const selectedStatus = selectedDay ? dayStatuses[selectedDay] : null;

  const releaseRequests = useMemo(() => (selectedDay ? getDayReleaseRequests(selectedDay) : []), [selectedDay, registrations]);
  const waitlistEntries = useMemo(() => (selectedDay ? getDayWaitlist(selectedDay) : []), [selectedDay, registrations]);
  const swapRecords = useMemo(() => (selectedDay ? getDaySwaps(selectedDay) : []), [selectedDay, registrations]);

  const recordsWithMeta = useMemo(() => {
    return registrations.map((reg) => ({
      ...reg,
      attendanceStatus: getAttendanceStatus(reg),
      releaseRequested: !!releaseRequests.find((item) => item.registrationId === reg.id),
      penalized: hasPenalty(reg.id),
    }));
  }, [registrations, releaseRequests]);

  const attendanceSummary = useMemo(
    () => ({
      present: recordsWithMeta.filter((item) => item.attendanceStatus === 'present').length,
      absent: recordsWithMeta.filter((item) => item.attendanceStatus === 'absent').length,
      scheduled: recordsWithMeta.filter((item) => item.attendanceStatus === 'scheduled').length,
      penalties: recordsWithMeta.filter((item) => item.penalized).length,
    }),
    [recordsWithMeta],
  );

  const longRegs = recordsWithMeta.filter((r) => r.shiftType === 'long');
  const nightRegs = recordsWithMeta.filter((r) => r.shiftType === 'night');
  const h24Regs = recordsWithMeta.filter((r) => r.shiftType === '24');

  const filteredDays = searchTerm
    ? days.filter((d) => d.label.includes(searchTerm) || d.date.includes(searchTerm) || d.dayName.includes(searchTerm))
    : days;

  const handleRemove = (id: string) => {
    removeRegistration(id);
    refreshDay();
  };

  const handlePenalty = (registrationId: string) => {
    const result = issuePenalty(registrationId);
    showToast(result.message, result.success ? 'success' : 'error');
    refreshDay();
  };

  const handleResolveRelease = (requestId: string) => {
    resolveReleaseRequest(requestId);
    showToast('تم إنهاء طلب إتاحة الشيفت.', 'success');
    refreshDay();
  };

  const handleClearDay = () => {
    if (selectedDay && confirmClear) {
      clearDayRegistrations(selectedDay);
      setRegistrations([]);
      refreshStatuses();
      setConfirmClear(false);
      showToast('تم مسح اليوم بالكامل.', 'success');
      return;
    }

    setConfirmClear(true);
    window.setTimeout(() => setConfirmClear(false), 3000);
  };

  const handleExportPDF = () => {
    if (!selectedDayData) return;
    generatePDF(selectedDayData.label, registrations);
  };

  const handleExportExcel = () => {
    if (!selectedDayData) return;
    generateExcel(selectedDayData.label, registrations);
  };

  const handleSaveSettings = () => {
    try {
      const parsedConfig = firebaseJson.trim() ? JSON.parse(firebaseJson) : null;
      const nextSettings = {
        notificationPhone: settingsPhone,
        cloudEnabled,
        autoExportOnFull,
        firebaseConfig: parsedConfig,
      };

      saveAdminSettings(nextSettings);
      showToast('تم حفظ إعدادات السحابة والتصدير.', 'success');
    } catch {
      showToast('JSON الخاص بـ Firebase غير صحيح.', 'error');
    }
  };

  const handlePushCloud = async () => {
    try {
      const parsedConfig = firebaseJson.trim() ? JSON.parse(firebaseJson) : null;
      if (!cloudEnabled || !parsedConfig) {
        showToast('فعّل السحابة وأضف إعدادات Firebase أولاً.', 'error');
        return;
      }
      await pushLocalStateToCloud(parsedConfig, cloudEnabled);
      showToast('تم رفع بيانات الجهاز الحالي إلى السحابة.', 'success');
    } catch {
      showToast('تعذر رفع البيانات. راجع إعدادات Firebase أولاً.', 'error');
    }
  };

  useEffect(() => {
    if (!selectedDay || !selectedDayData || !selectedStatus?.isDayClosed || !autoExportOnFull) return;
    if (autoExportedDaysRef.current.has(selectedDay)) return;

    autoExportedDaysRef.current.add(selectedDay);
    generatePDF(selectedDayData.label, registrations);
    generateExcel(selectedDayData.label, registrations);
    showToast('اكتمل اليوم وتم تجهيز PDF وExcel تلقائيًا.', 'success');
  }, [autoExportOnFull, registrations, selectedDay, selectedDayData, selectedStatus]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50">
      <div className="bg-gradient-to-l from-purple-700 to-purple-800 text-white shadow-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
              <span className="text-lg">🔐</span>
            </div>
            <div>
              <p className="font-bold">لوحة الإشراف</p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-purple-200">
                <span>إدارة الشيفتات والحضور والانتظار والاستبدال والجزاءات</span>
                <span className={`rounded-full px-2 py-0.5 font-bold ${cloudStatus === 'connected' ? 'bg-emerald-500/25 text-emerald-100' : cloudStatus === 'error' ? 'bg-red-500/25 text-red-100' : 'bg-white/10 text-white'}`}>
                  {cloudStatus === 'connected' ? 'سحابة متصلة' : cloudStatus === 'error' ? 'فشل اتصال سحابي' : 'وضع محلي'}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onLogout} className="rounded-lg bg-white/10 px-4 py-2 text-sm transition-colors hover:bg-white/20">
            خروج 🚪
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6">
        {toast && (
          <div className={`mb-4 rounded-2xl border px-4 py-3 text-center font-bold animate-fadeIn ${toast.type === 'success' ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
            {toast.text}
          </div>
        )}

        <div className="mb-6 rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-4">
              <div>
                <h3 className="mb-1 text-lg font-extrabold text-gray-800">📲 رقم استقبال رسائل الاعتذار</h3>
                <p className="mb-3 text-sm text-gray-500">هيتفتح عليه واتساب لما الشخص يضغط «مش هحضر - إتاحة الشيفت».</p>
                <input
                  type="tel"
                  value={settingsPhone}
                  onChange={(e) => setSettingsPhone(e.target.value)}
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-right focus:border-purple-400 focus:outline-none"
                  placeholder="اكتب رقم الواتساب"
                  dir="ltr"
                />
              </div>

              <label className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-slate-50 px-4 py-3">
                <input type="checkbox" checked={cloudEnabled} onChange={(e) => setCloudEnabled(e.target.checked)} className="h-4 w-4" />
                <span className="text-sm font-bold text-gray-700">تفعيل التزامن السحابي بين الأجهزة</span>
              </label>

              <label className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-slate-50 px-4 py-3">
                <input type="checkbox" checked={autoExportOnFull} onChange={(e) => setAutoExportOnFull(e.target.checked)} className="h-4 w-4" />
                <span className="text-sm font-bold text-gray-700">تصدير PDF + Excel تلقائيًا عند اكتمال اليوم</span>
              </label>
            </div>

            <div className="space-y-3">
              <div>
                <h3 className="mb-1 text-lg font-extrabold text-gray-800">☁️ إعداد Firebase</h3>
                <p className="mb-3 text-sm text-gray-500">الصق JSON إعدادات Firebase Web App لتفعيل Firestore Realtime Sync بين الأجهزة.</p>
                <textarea
                  value={firebaseJson}
                  onChange={(e) => setFirebaseJson(e.target.value)}
                  className="h-48 w-full rounded-2xl border border-gray-200 px-4 py-3 text-left text-sm focus:border-purple-400 focus:outline-none"
                  placeholder='{
  "apiKey": "...",
  "authDomain": "...",
  "projectId": "...",
  "storageBucket": "...",
  "messagingSenderId": "...",
  "appId": "..."
}'
                  dir="ltr"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button onClick={handleSaveSettings} className="rounded-2xl bg-gradient-to-l from-purple-600 to-purple-700 px-5 py-3 font-extrabold text-white shadow-lg transition-all hover:from-purple-700 hover:to-purple-800">
                  حفظ الإعدادات
                </button>
                <button onClick={handlePushCloud} className="rounded-2xl border border-purple-200 bg-purple-50 px-5 py-3 font-extrabold text-purple-700 transition-all hover:bg-purple-100">
                  رفع البيانات الحالية للسحابة
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="lg:w-80 lg:shrink-0">
            <div className="sticky top-4 rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
              <h3 className="mb-3 flex items-center gap-2 font-extrabold text-gray-800">📅 الأيام</h3>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="mb-3 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-purple-400 focus:outline-none"
                placeholder="🔍 بحث عن يوم..."
              />

              <div className="max-h-[70vh] space-y-2 overflow-y-auto pl-1">
                {filteredDays.map((day) => {
                  const status = dayStatuses[day.key];
                  if (!status) return null;
                  const isSelected = selectedDay === day.key;
                  const dayRegs = getDayRegistrations(day.key);
                  const absentCount = dayRegs.filter((reg) => getAttendanceStatus(reg) === 'absent').length;
                  const releaseCount = getDayReleaseRequests(day.key).length;
                  const waitCount = getDayWaitlist(day.key).length;
                  const swapCount = getDaySwaps(day.key).length;

                  return (
                    <button
                      key={day.key}
                      onClick={() => setSelectedDay(day.key)}
                      className={`w-full rounded-2xl border-2 p-3 text-right transition-all ${isSelected ? 'border-purple-500 bg-purple-50 shadow-md' : 'border-transparent bg-gray-50 hover:border-gray-200 hover:bg-gray-100'}`}
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <div className="flex flex-wrap items-center gap-1">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${status.isDayClosed ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>{status.slotsUsed}/{status.totalSlots}</span>
                          {absentCount > 0 && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">{absentCount} غياب</span>}
                          {releaseCount > 0 && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">{releaseCount} إتاحة</span>}
                        </div>
                        <span className="text-sm font-bold text-gray-800">{day.dayName}</span>
                      </div>
                      <p className="text-sm font-semibold text-purple-600" dir="ltr">{day.date}</p>
                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-gray-200">
                        <div className={`h-full rounded-full ${status.isDayClosed ? 'bg-red-500' : status.percentage > 70 ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${status.percentage}%` }} />
                      </div>
                      <div className="mt-1 flex flex-wrap justify-start gap-1">
                        {waitCount > 0 && <span className="rounded bg-indigo-100 px-1 text-[9px] text-indigo-700">{waitCount} انتظار</span>}
                        {swapCount > 0 && <span className="rounded bg-emerald-100 px-1 text-[9px] text-emerald-700">{swapCount} بدّل</span>}
                        {status.can24 && <span className="rounded bg-red-100 px-1 text-[9px] text-red-600">24</span>}
                        {status.canLong && <span className="rounded bg-amber-100 px-1 text-[9px] text-amber-600">L</span>}
                        {status.canNight && <span className="rounded bg-indigo-100 px-1 text-[9px] text-indigo-600">N</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex-1">
            {!selectedDay ? (
              <div className="rounded-3xl border border-gray-100 bg-white p-12 text-center shadow-sm">
                <span className="text-6xl">📋</span>
                <h3 className="mt-4 text-xl font-extrabold text-gray-700">اختار يوم من القائمة</h3>
                <p className="mt-2 text-gray-400">هتشوفي الحضور والانتظار وطلبات الإتاحة وعمليات الاستبدال والجزاءات مع PDF وExcel.</p>
              </div>
            ) : (
              <div className="space-y-4 animate-fadeIn">
                <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-2xl font-extrabold text-gray-800">{selectedDayData?.label}</h2>
                      <p className="mt-1 text-sm text-gray-500">الخانات المستخدمة: <span className="font-bold text-purple-600">{selectedStatus?.slotsUsed ?? 0}</span> / {selectedStatus?.totalSlots ?? 21}</p>
                      {selectedStatus?.isDayClosed && <p className="mt-1 text-xs font-extrabold text-emerald-700">✅ اليوم مكتمل والتصدير الذكي جاهز</p>}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button onClick={handleExportPDF} disabled={registrations.length === 0} className="rounded-2xl bg-gradient-to-l from-green-500 to-green-600 px-4 py-2 text-sm font-bold text-white transition-all hover:from-green-600 hover:to-green-700 disabled:cursor-not-allowed disabled:opacity-40">📄 تصدير PDF</button>
                      <button onClick={handleExportExcel} disabled={registrations.length === 0} className="rounded-2xl bg-gradient-to-l from-emerald-500 to-teal-600 px-4 py-2 text-sm font-bold text-white transition-all hover:from-emerald-600 hover:to-teal-700 disabled:cursor-not-allowed disabled:opacity-40">📊 تصدير Excel</button>
                      <button onClick={handleClearDay} disabled={registrations.length === 0} className={`rounded-2xl px-4 py-2 text-sm font-bold transition-all disabled:cursor-not-allowed disabled:opacity-40 ${confirmClear ? 'animate-pulse bg-red-600 text-white' : 'border border-red-200 bg-red-50 text-red-600 hover:bg-red-100'}`}>🗑️ {confirmClear ? 'تأكيد المسح؟' : 'مسح الكل'}</button>
                    </div>
                  </div>

                  <div className="mt-4 h-3 overflow-hidden rounded-full bg-gray-100">
                    <div className={`h-full rounded-full ${selectedStatus?.isDayClosed ? 'bg-red-500' : (selectedStatus?.percentage ?? 0) > 70 ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${selectedStatus?.percentage ?? 0}%` }} />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-4 lg:grid-cols-8">
                  <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-center"><p className="text-2xl font-extrabold text-green-700">{attendanceSummary.present}</p><p className="text-xs font-bold text-green-600">حضور</p></div>
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-center"><p className="text-2xl font-extrabold text-red-700">{attendanceSummary.absent}</p><p className="text-xs font-bold text-red-600">غياب</p></div>
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center"><p className="text-2xl font-extrabold text-amber-700">{attendanceSummary.scheduled}</p><p className="text-xs font-bold text-amber-600">منتظر</p></div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center"><p className="text-2xl font-extrabold text-slate-700">{attendanceSummary.penalties}</p><p className="text-xs font-bold text-slate-600">جزاءات</p></div>
                  <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-center"><p className="text-2xl font-extrabold text-blue-700">{releaseRequests.length}</p><p className="text-xs font-bold text-blue-600">إتاحة</p></div>
                  <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-center"><p className="text-2xl font-extrabold text-indigo-800">{waitlistEntries.length}</p><p className="text-xs font-bold text-indigo-600">انتظار</p></div>
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center"><p className="text-2xl font-extrabold text-emerald-800">{swapRecords.length}</p><p className="text-xs font-bold text-emerald-600">استبدال</p></div>
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-center"><p className="text-2xl font-extrabold text-red-800">{registrations.length}</p><p className="text-xs font-bold text-red-600">إجمالي السجلات</p></div>
                </div>

                {waitlistEntries.length > 0 && (
                  <div className="rounded-3xl border border-indigo-200 bg-indigo-50 p-5">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-lg font-extrabold text-indigo-800">🕒 قائمة الانتظار</h3>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-indigo-700">{waitlistEntries.length} شخص</span>
                    </div>
                    <div className="space-y-3">
                      {waitlistEntries.map((entry, index) => (
                        <div key={entry.id} className="flex items-center justify-between gap-3 rounded-2xl border border-indigo-100 bg-white p-4">
                          <div className="text-right">
                            <p className="font-bold text-gray-800">{entry.name}</p>
                            <p className="text-xs text-gray-500">ID {entry.employeeId}</p>
                            <p className="text-xs text-gray-400" dir="ltr">{entry.phone}</p>
                          </div>
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">{index + 1}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {swapRecords.length > 0 && (
                  <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-lg font-extrabold text-emerald-800">🔁 سجل الاستبدال</h3>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-emerald-700">{swapRecords.length} عملية</span>
                    </div>
                    <div className="space-y-3">
                      {swapRecords.map((swap) => (
                        <div key={swap.id} className="rounded-2xl border border-emerald-100 bg-white p-4">
                          <p className="font-bold text-gray-800">{swap.fromName} (ID {swap.fromEmployeeId}) ⟶ {swap.toName} (ID {swap.toEmployeeId})</p>
                          <p className="mt-1 text-xs font-semibold text-emerald-700">الشيفت: {swap.shiftType} / {swap.dayKey}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {releaseRequests.length > 0 && (
                  <div className="rounded-3xl border border-blue-200 bg-blue-50 p-5">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-lg font-extrabold text-blue-800">📩 طلبات إتاحة الشيفت</h3>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-blue-700">{releaseRequests.length} طلب</span>
                    </div>
                    <div className="space-y-3">
                      {releaseRequests.map((request) => (
                        <div key={request.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-white p-4">
                          <div className="text-right">
                            <p className="font-bold text-gray-800">{request.name} — ID {request.employeeId}</p>
                            <p className="text-sm text-gray-500" dir="ltr">{request.phone}</p>
                            <p className="mt-1 text-xs font-semibold text-blue-700">الشيفت المتاح: {request.shiftType} / {request.dayKey}</p>
                          </div>
                          <button onClick={() => handleResolveRelease(request.id)} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">تم التعامل</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-xl font-extrabold text-gray-800">📝 قائمة الحضور والشيفتات</h3>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{recordsWithMeta.length} سجل</span>
                  </div>

                  {recordsWithMeta.length === 0 ? (
                    <div className="rounded-2xl bg-gray-50 p-10 text-center text-gray-400">لا توجد تسجيلات في هذا اليوم.</div>
                  ) : (
                    <div className="space-y-3">
                      {([
                        { label: 'لونج (Long) ☀️', data: longRegs, type: 'long' as ShiftType },
                        { label: 'نايت (Night) 🌙', data: nightRegs, type: 'night' as ShiftType },
                        { label: '٢٤ ساعة (24h) ⏰', data: h24Regs, type: '24' as ShiftType },
                      ]).map((group) => (
                        <div key={group.type} className="overflow-hidden rounded-2xl border border-gray-100">
                          <div className={`flex items-center justify-between border-b-2 px-4 py-3 ${SHIFT_COLORS[group.type]}`}>
                            <span className="font-extrabold">{group.label}</span>
                            <span className="text-sm font-bold">({group.data.length})</span>
                          </div>

                          {group.data.length === 0 ? (
                            <div className="p-5 text-center text-sm text-gray-400">لا يوجد أسماء في هذا الشيفت</div>
                          ) : (
                            <div className="divide-y divide-gray-100">
                              {group.data.map((reg, index) => (
                                <div key={reg.id} className="flex flex-col gap-3 px-4 py-3 hover:bg-gray-50 lg:flex-row lg:items-center lg:justify-between">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusBadge(reg.attendanceStatus)}`}>{statusLabel(reg.attendanceStatus)}</span>
                                    {reg.releaseRequested && <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">إتاحة شيفت</span>}
                                    {reg.penalized && <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-bold text-white">تم الجزاء</span>}
                                  </div>

                                  <div className="flex flex-1 items-center justify-between gap-3">
                                    <div className="flex flex-wrap gap-2">
                                      <button onClick={() => handleRemove(reg.id)} className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-100">حذف</button>
                                      <button onClick={() => handlePenalty(reg.id)} disabled={reg.penalized} className={`rounded-xl px-3 py-2 text-xs font-bold ${reg.penalized ? 'cursor-not-allowed bg-gray-200 text-gray-500' : 'bg-slate-800 text-white hover:bg-black'}`}>{reg.penalized ? 'تم الجزاء' : 'جزاء'}</button>
                                    </div>

                                    <div className="flex items-center gap-3">
                                      <div className="text-right">
                                        <p className="text-sm font-bold text-gray-800">{reg.name}</p>
                                        <p className="text-xs text-gray-500">ID {reg.employeeId}</p>
                                        <p className="text-xs text-gray-400" dir="ltr">{reg.phone}</p>
                                      </div>
                                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 text-xs font-bold text-purple-700">{index + 1}</div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
