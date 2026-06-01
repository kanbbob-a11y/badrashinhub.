import { useCallback, useEffect, useMemo, useState } from 'react';
import { AttendanceStatus, SHIFT_COLORS, SHIFT_LABELS, ShiftType, UserAccount } from '../types';
import {
  addRegistration,
  assignWaitlistReplacement,
  canSwapOnPreviousDay,
  createShiftReleaseRequest,
  generateDays,
  getAttendanceStatus,
  getDayRegistrations,
  getDayWaitlist,
  getDaysUntil,
  getRegistrationReleaseRequest,
  getTodayKey,
  getUserPenalties,
  getUserRegistrations,
  getUserTodayRegistration,
  getUserWarnings,
  getUserWaitlistEntries,
  joinWaitlist,
  leaveWaitlist,
  markTodayAttendance,
} from '../store';
import { calcSlotStatus, SlotStatus } from '../slotLogic';
import { subscribeRosterChanges } from '../persistence';

interface RegisterPageProps {
  user: UserAccount;
  onLogout: () => void;
  cloudStatus: 'local' | 'connected' | 'error';
}

export default function RegisterPage({ user, onLogout, cloudStatus }: RegisterPageProps) {
  const [days] = useState(generateDays());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedShift, setSelectedShift] = useState<ShiftType | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [dayStatuses, setDayStatuses] = useState<Record<string, SlotStatus>>({});
  const [waitlistCounts, setWaitlistCounts] = useState<Record<string, number>>({});
  const [userRegistrations, setUserRegistrations] = useState(() => getUserRegistrations(user.id));
  const [userWaitlistEntries, setUserWaitlistEntries] = useState(() => getUserWaitlistEntries(user.id));
  const [todayRegistrationId, setTodayRegistrationId] = useState<string | null>(null);
  const [todayAttendanceStatus, setTodayAttendanceStatus] = useState<AttendanceStatus | null>(null);
  const [todayReleaseSent, setTodayReleaseSent] = useState(false);
  const [warningDays, setWarningDays] = useState(() => getUserWarnings(user.id));
  const [penalties, setPenalties] = useState(() => getUserPenalties(user.id));

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    window.setTimeout(() => setMessage(null), 4000);
  };

  const refreshAll = useCallback(() => {
    const statuses: Record<string, SlotStatus> = {};
    const counts: Record<string, number> = {};

    days.forEach((d) => {
      statuses[d.key] = calcSlotStatus(getDayRegistrations(d.key));
      counts[d.key] = getDayWaitlist(d.key).length;
    });

    setDayStatuses(statuses);
    setWaitlistCounts(counts);

    const registrations = getUserRegistrations(user.id);
    setUserRegistrations(registrations);
    setUserWaitlistEntries(getUserWaitlistEntries(user.id));

    const todayRegistration = getUserTodayRegistration(user.id);
    setTodayRegistrationId(todayRegistration?.id ?? null);
    setTodayAttendanceStatus(todayRegistration ? getAttendanceStatus(todayRegistration) : null);
    setTodayReleaseSent(todayRegistration ? !!getRegistrationReleaseRequest(todayRegistration.id) : false);
    setWarningDays(getUserWarnings(user.id));
    setPenalties(getUserPenalties(user.id));
  }, [days, user.id]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    return subscribeRosterChanges(() => {
      refreshAll();
    });
  }, [refreshAll]);

  const selectedDayData = days.find((d) => d.key === selectedDay);
  const selectedStatus = selectedDay ? dayStatuses[selectedDay] : null;
  const selectedUserRegistration = selectedDay ? userRegistrations.find((reg) => reg.dayKey === selectedDay) : undefined;
  const selectedDayWaitlist = selectedDay ? getDayWaitlist(selectedDay) : [];
  const selectedUserWaitlistEntry = selectedDayWaitlist.find((entry) => entry.userId === user.id);

  const swappableRegistrations = useMemo(
    () => userRegistrations.filter((reg) => canSwapOnPreviousDay(reg.dayKey)),
    [userRegistrations],
  );

  const handleRegister = () => {
    if (!selectedDay || !selectedShift) {
      showMessage('من فضلك اختار اليوم والشيفت', 'error');
      return;
    }

    const result = addRegistration({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      userId: user.id,
      employeeId: user.employeeId,
      name: user.name,
      phone: user.phone,
      dayKey: selectedDay,
      shiftType: selectedShift,
      timestamp: Date.now(),
    });

    showMessage(result.message, result.success ? 'success' : 'error');
    if (result.success) {
      setSelectedShift(null);
      refreshAll();
    }
  };

  const handleAttendance = () => {
    const result = markTodayAttendance(user.id);
    showMessage(result.message, result.success ? 'success' : 'error');
    if (result.success) refreshAll();
  };

  const handleReleaseRequest = () => {
    const result = createShiftReleaseRequest(user.id);
    showMessage(result.message, result.success ? 'success' : 'error');
    if (result.success && result.whatsappUrl) {
      window.open(result.whatsappUrl, '_blank', 'noopener,noreferrer');
    }
    if (result.success) refreshAll();
  };

  const handleJoinWaitlist = () => {
    if (!selectedDay) return;
    const result = joinWaitlist(user.id, selectedDay);
    showMessage(result.message, result.success ? 'success' : 'error');
    if (result.success) refreshAll();
  };

  const handleLeaveWaitlist = (entryId: string) => {
    const result = leaveWaitlist(entryId);
    showMessage(result.message, result.success ? 'success' : 'error');
    if (result.success) refreshAll();
  };

  const handleChooseReplacement = (registrationId: string, replacementUserId: string) => {
    const result = assignWaitlistReplacement(registrationId, replacementUserId);
    showMessage(result.message, result.success ? 'success' : 'error');
    if (result.success) refreshAll();
  };

  const todayRegistration = userRegistrations.find((reg) => reg.id === todayRegistrationId) ?? null;
  const upcomingRegistrations = userRegistrations.filter((reg) => reg.dayKey >= getTodayKey()).slice(0, 6);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="bg-gradient-to-l from-blue-700 to-blue-800 text-white shadow-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
              <span className="text-lg">👤</span>
            </div>
            <div>
              <p className="text-sm font-bold">{user.name}</p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-blue-200">
                <span dir="ltr">{user.phone}</span>
                <span className="rounded-full bg-white/10 px-2 py-0.5 font-bold text-white">ID {user.employeeId}</span>
                <span className={`rounded-full px-2 py-0.5 font-bold ${cloudStatus === 'connected' ? 'bg-emerald-500/30 text-emerald-100' : cloudStatus === 'error' ? 'bg-red-500/30 text-red-100' : 'bg-white/10 text-white'}`}>
                  {cloudStatus === 'connected' ? 'مزامنة مباشرة' : cloudStatus === 'error' ? 'خطأ سحابي' : 'وضع محلي'}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onLogout} className="rounded-lg bg-white/10 px-4 py-2 text-sm transition-colors hover:bg-white/20">
            خروج 🚪
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6">
        {message && (
          <div
            className={`mb-4 rounded-2xl px-4 py-3 text-center font-semibold animate-fadeIn ${
              message.type === 'success'
                ? 'border border-green-200 bg-green-50 text-green-700'
                : 'border border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {message.text}
          </div>
        )}

        {(warningDays.length > 0 || penalties.length > 0) && (
          <div className="mb-5 grid gap-4 lg:grid-cols-2">
            {warningDays.length > 0 && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-extrabold text-amber-700">⚠️ إنذارات غياب</h3>
                    <p className="mt-1 text-sm text-amber-700">عندك {warningDays.length} غياب بدون حضور مسجل، وده مسجل عليك كإنذار.</p>
                  </div>
                  <span className="rounded-full bg-amber-500 px-3 py-1 text-xs font-bold text-white">{warningDays.length} إنذار</span>
                </div>
              </div>
            )}

            {penalties.length > 0 && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-extrabold text-red-700">⛔ جزاءات مسجلة</h3>
                    <p className="mt-1 text-sm text-red-700">عندك {penalties.length} جزاء مسجل من لوحة الإشراف.</p>
                  </div>
                  <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white">{penalties.length} جزاء</span>
                </div>
              </div>
            )}
          </div>
        )}

        {swappableRegistrations.length > 0 && (
          <div className="mb-6 rounded-3xl border border-indigo-200 bg-indigo-50 p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-extrabold text-indigo-800">🔄 اختيار بديل قبل الشيفت بيوم</h2>
                <p className="text-sm text-indigo-700">لو مش هتقدر تيجي بكرة، اختار البديل من قائمة الانتظار الخاصة بنفس اليوم.</p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-indigo-700">
                {swappableRegistrations.length} شيفت قابل للاستبدال
              </span>
            </div>

            <div className="space-y-4">
              {swappableRegistrations.map((registration) => {
                const waiters = getDayWaitlist(registration.dayKey);
                return (
                  <div key={registration.id} className="rounded-2xl border border-indigo-100 bg-white p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-extrabold text-gray-800">{registration.dayKey} — {SHIFT_LABELS[registration.shiftType]}</p>
                        <p className="text-sm text-gray-500">الاستبدال يفتح قبل الشيفت بيوم فقط، واليوم ده فاضل له {getDaysUntil(registration.dayKey)} يوم.</p>
                      </div>
                      <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700">
                        {waiters.length} في الانتظار
                      </span>
                    </div>

                    {waiters.length === 0 ? (
                      <div className="rounded-2xl bg-slate-50 p-4 text-center text-sm text-gray-500">لا يوجد أحد في قائمة الانتظار لهذا اليوم حتى الآن.</div>
                    ) : (
                      <div className="space-y-2">
                        {waiters.map((entry) => (
                          <div key={entry.id} className="flex flex-col gap-3 rounded-2xl border border-gray-100 p-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="text-right">
                              <p className="font-bold text-gray-800">{entry.name}</p>
                              <p className="text-xs text-gray-500">ID {entry.employeeId}</p>
                              <p className="text-xs text-gray-400" dir="ltr">{entry.phone}</p>
                            </div>
                            <button
                              onClick={() => handleChooseReplacement(registration.id, entry.userId)}
                              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700"
                            >
                              اختاره كبديل
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mb-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-blue-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-extrabold text-gray-800">🖐️ حضور اليوم</h2>
                <p className="text-sm text-gray-500">بعد البصمة سجل حضورك، ولو مش هتحضر ابعت إتاحة الشيفت.</p>
              </div>
              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">اليوم {getTodayKey().split('-').reverse().join('/')}</span>
            </div>

            {!todayRegistration && (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-5 text-center text-sm text-gray-500">لا يوجد لك شيفت مسجل اليوم.</div>
            )}

            {todayRegistration && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-gray-100 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm text-gray-500">شيفت اليوم</p>
                      <p className="text-lg font-bold text-gray-800">{SHIFT_LABELS[todayRegistration.shiftType]}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-700">ID {todayRegistration.employeeId}</span>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${todayAttendanceStatus === 'present' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {todayAttendanceStatus === 'present' ? 'تم تسجيل الحضور ✅' : 'بانتظار الحضور'}
                      </span>
                      {todayReleaseSent && <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">تم إرسال الإتاحة</span>}
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    onClick={handleAttendance}
                    disabled={todayAttendanceStatus === 'present'}
                    className={`rounded-2xl py-4 text-lg font-extrabold shadow-lg transition-all ${todayAttendanceStatus === 'present' ? 'cursor-not-allowed bg-gray-200 text-gray-500' : 'bg-gradient-to-l from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700'}`}
                  >
                    {todayAttendanceStatus === 'present' ? 'الحضور مسجل بالفعل' : 'تمت البصمة - سجل حضوري ✅'}
                  </button>

                  <button
                    onClick={handleReleaseRequest}
                    disabled={todayAttendanceStatus === 'present' || todayReleaseSent}
                    className={`rounded-2xl py-4 text-lg font-extrabold shadow-lg transition-all ${todayAttendanceStatus === 'present' || todayReleaseSent ? 'cursor-not-allowed bg-gray-200 text-gray-500' : 'bg-gradient-to-l from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600'}`}
                  >
                    {todayReleaseSent ? 'تم إرسال الإتاحة' : 'مش هحضر - إتاحة الشيفت 📩'}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-xl font-extrabold text-gray-800">📌 شيفتاتي والانتظار</h2>
            <div className="space-y-3">
              {upcomingRegistrations.length === 0 && userWaitlistEntries.length === 0 && (
                <div className="rounded-2xl bg-gray-50 p-4 text-center text-sm text-gray-500">لا توجد شيفتات أو طلبات انتظار حالياً.</div>
              )}

              {upcomingRegistrations.map((item) => {
                const status = getAttendanceStatus(item);
                return (
                  <div key={item.id} className="rounded-2xl border border-gray-100 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${SHIFT_COLORS[item.shiftType]}`}>{SHIFT_LABELS[item.shiftType]}</span>
                      <span className="text-xs font-bold text-gray-500">{item.dayKey}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-700">ID {item.employeeId}</p>
                      <p className="text-xs font-bold text-gray-500">{status === 'present' ? 'حاضر' : status === 'absent' ? 'غائب' : canSwapOnPreviousDay(item.dayKey) ? 'بديل متاح' : 'محجوز'}</p>
                    </div>
                  </div>
                );
              })}

              {userWaitlistEntries.slice(0, 4).map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-indigo-100 bg-indigo-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-indigo-600 px-2.5 py-1 text-[11px] font-bold text-white">انتظار</span>
                    <span className="text-xs font-bold text-indigo-700">{entry.dayKey}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-sm font-semibold text-indigo-800">ID {entry.employeeId}</p>
                    <p className="text-xs font-bold text-indigo-600">بديل محتمل</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <h2 className="mb-4 text-xl font-extrabold text-gray-800">📅 اختار اليوم</h2>

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {days.map((day) => {
            const status = dayStatuses[day.key];
            if (!status) return null;
            const isSelected = selectedDay === day.key;
            const userBooked = userRegistrations.some((reg) => reg.dayKey === day.key);
            const userWaiting = userWaitlistEntries.some((entry) => entry.dayKey === day.key);
            const waitCount = waitlistCounts[day.key] || 0;

            return (
              <button
                key={day.key}
                onClick={() => setSelectedDay(day.key)}
                className={`relative rounded-2xl border-2 p-3 text-right transition-all ${
                  isSelected
                    ? 'scale-[1.02] border-blue-500 bg-blue-50 shadow-lg shadow-blue-100'
                    : status.isDayClosed
                    ? 'border-gray-200 bg-gray-100 hover:border-gray-300'
                    : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-md'
                }`}
              >
                {status.isDayClosed && <span className="absolute left-1 top-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">مقفل</span>}
                {userBooked && <span className="absolute left-1 top-7 rounded-full bg-green-500 px-1.5 py-0.5 text-[10px] font-bold text-white">محجوز</span>}
                {userWaiting && <span className="absolute left-1 top-14 rounded-full bg-indigo-500 px-1.5 py-0.5 text-[10px] font-bold text-white">انتظار</span>}
                <p className="text-sm font-bold text-gray-800">{day.dayName}</p>
                <p className="text-lg font-semibold text-blue-600" dir="ltr">{day.date}</p>
                <div className="mt-2">
                  <div className="mb-1 flex justify-between text-[10px] text-gray-500">
                    <span>{status.slotsUsed}/{status.totalSlots} خانة</span>
                    {waitCount > 0 && <span className="text-indigo-600">{waitCount} انتظار</span>}
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-gray-200">
                    <div className={`h-full rounded-full ${status.isDayClosed ? 'bg-red-500' : status.percentage > 70 ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${status.percentage}%` }} />
                  </div>
                </div>
                <div className="mt-1.5 flex justify-end gap-1">
                  {status.can24 && <span className="rounded bg-red-100 px-1 text-[10px] text-red-600">24</span>}
                  {status.canLong && <span className="rounded bg-amber-100 px-1 text-[10px] text-amber-600">L</span>}
                  {status.canNight && <span className="rounded bg-indigo-100 px-1 text-[10px] text-indigo-600">N</span>}
                </div>
              </button>
            );
          })}
        </div>

        {selectedDay && selectedDayData && selectedStatus && (
          <div className="animate-fadeIn rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="mb-2 text-xl font-extrabold text-gray-800">⏰ {selectedDayData.label}</h2>
                <p className="text-sm text-gray-500">
                  الخانات المستخدمة: <span className="font-bold text-blue-600">{selectedStatus.slotsUsed}</span> / {selectedStatus.totalSlots}
                  {selectedStatus.remaining > 0 && <span className="mr-1 text-green-600">(باقي {selectedStatus.remaining} خانة)</span>}
                  {selectedStatus.unpairedLong > 0 && <span className="mr-1 text-indigo-600">(محتاج {selectedStatus.unpairedLong} نايت)</span>}
                  {selectedStatus.unpairedNight > 0 && <span className="mr-1 text-amber-600">(محتاج {selectedStatus.unpairedNight} لونج)</span>}
                </p>
                <p className="mt-1 text-xs text-indigo-600">قائمة الانتظار لهذا اليوم: {selectedDayWaitlist.length} شخص</p>
              </div>

              {!selectedUserRegistration && (
                <div className="flex flex-wrap gap-2">
                  {!selectedUserWaitlistEntry ? (
                    <button onClick={handleJoinWaitlist} className="rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700">
                      انضم لقائمة الانتظار
                    </button>
                  ) : (
                    <button onClick={() => handleLeaveWaitlist(selectedUserWaitlistEntry.id)} className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-bold text-indigo-700 hover:bg-indigo-100">
                      خروج من الانتظار
                    </button>
                  )}
                </div>
              )}
            </div>

            {selectedUserRegistration && (
              <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-700">
                أنت مسجل بالفعل في هذا اليوم على شيفت {SHIFT_LABELS[selectedUserRegistration.shiftType]} — ممنوع تسجيل شيفت تاني أو دخول قائمة الانتظار لنفس اليوم.
              </div>
            )}

            {!selectedUserRegistration && selectedUserWaitlistEntry && (
              <div className="mb-4 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm font-semibold text-indigo-700">
                أنت حالياً داخل قائمة الانتظار لهذا اليوم، ولو حد استبدل شيفته قبلها بيوم يقدر يختارك كبديل.
              </div>
            )}

            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {(Object.keys(SHIFT_LABELS) as ShiftType[]).map((shift) => {
                const canOpen = shift === '24' ? selectedStatus.can24 : shift === 'long' ? selectedStatus.canLong : selectedStatus.canNight;
                const isAvailable = canOpen && !selectedUserRegistration;
                const isSelected = selectedShift === shift;

                return (
                  <button
                    key={shift}
                    onClick={() => isAvailable && setSelectedShift(shift)}
                    disabled={!isAvailable}
                    className={`rounded-2xl border-2 p-4 transition-all ${
                      !isAvailable
                        ? 'cursor-not-allowed border-gray-200 bg-gray-100 opacity-50'
                        : isSelected
                        ? `${SHIFT_COLORS[shift]} scale-[1.02] border-current shadow-lg`
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
                    }`}
                  >
                    <div className="text-center">
                      <span className="text-3xl">{shift === 'long' ? '☀️' : shift === 'night' ? '🌙' : '⏰'}</span>
                      <p className="mt-2 text-lg font-bold">{SHIFT_LABELS[shift]}</p>
                      {!canOpen && <p className="mt-1 text-xs font-semibold text-red-500">مقفول 🔒</p>}
                      {selectedUserRegistration && <p className="mt-1 text-xs font-semibold text-gray-500">لديك حجز مسبق في نفس اليوم</p>}
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              onClick={handleRegister}
              disabled={!selectedShift || !!selectedUserRegistration}
              className={`w-full rounded-2xl py-4 text-lg font-extrabold shadow-lg transition-all ${selectedShift && !selectedUserRegistration ? 'bg-gradient-to-l from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700' : 'cursor-not-allowed bg-gray-200 text-gray-400'}`}
            >
              تسجيل الشيفت ✅
            </button>

            <div className="mt-6 rounded-2xl border border-gray-100 bg-slate-50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-extrabold text-gray-800">🕒 قائمة الانتظار</h3>
                <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700">{selectedDayWaitlist.length} شخص</span>
              </div>

              {selectedDayWaitlist.length === 0 ? (
                <div className="text-center text-sm text-gray-500">لا يوجد أحد في قائمة الانتظار لهذا اليوم.</div>
              ) : (
                <div className="space-y-2">
                  {selectedDayWaitlist.map((entry, index) => (
                    <div key={entry.id} className="flex items-center justify-between rounded-2xl bg-white p-3 border border-gray-100">
                      <div className="text-right">
                        <p className="font-bold text-gray-800">{entry.name}</p>
                        <p className="text-xs text-gray-500">ID {entry.employeeId}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {entry.userId === user.id && <span className="rounded-full bg-indigo-600 px-3 py-1 text-[11px] font-bold text-white">أنت</span>}
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">{index + 1}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {!canSwapOnPreviousDay(selectedDay) && selectedUserRegistration && getDaysUntil(selectedDay) > 1 && (
              <p className="mt-4 text-center text-xs font-semibold text-indigo-600">اختيار البديل من الانتظار يفتح قبل الشيفت بيوم فقط.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
