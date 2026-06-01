import { useState } from 'react';
import { ADMIN_PASSWORD, UserAccount } from '../types';
import { loginUser, registerUser } from '../store';

interface LoginPageProps {
  onLogin: (user: UserAccount) => void;
  onAdminLogin: () => void;
}

type AuthMode = 'login' | 'signup' | 'admin';

export default function LoginPage({ onLogin, onAdminLogin }: LoginPageProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [employeeId, setEmployeeId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [adminPass, setAdminPass] = useState('');

  const resetMessages = () => {
    setError('');
    setSuccess('');
  };

  const handleSignup = () => {
    resetMessages();

    if (!name.trim()) {
      setError('من فضلك اكتب الاسم بالكامل.');
      return;
    }

    if (!phone.trim() || phone.trim().length < 10) {
      setError('من فضلك اكتب رقم هاتف صحيح.');
      return;
    }

    if (signupPassword.length < 4) {
      setError('الباسورد لازم يكون 4 أرقام أو حروف على الأقل.');
      return;
    }

    if (signupPassword !== confirmPassword) {
      setError('تأكيد الباسورد غير مطابق.');
      return;
    }

    const result = registerUser({
      name: name.trim(),
      phone: phone.trim(),
      password: signupPassword,
    });

    if (!result.success || !result.user) {
      setError(result.message);
      return;
    }

    setSuccess(`${result.message} — احتفظ بالـ ID للدخول بعد كده.`);
    onLogin(result.user);
  };

  const handleLogin = () => {
    resetMessages();

    if (!employeeId.trim() || !loginPassword.trim()) {
      setError('اكتب الـ ID والباسورد.');
      return;
    }

    const result = loginUser(employeeId, loginPassword);
    if (!result.success || !result.user) {
      setError(result.message);
      return;
    }

    onLogin(result.user);
  };

  const handleAdminLogin = () => {
    resetMessages();
    if (adminPass === ADMIN_PASSWORD) {
      onAdminLogin();
      return;
    }

    setError('كلمة سر الإشراف غير صحيحة.');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fadeIn">
        <div className="text-center mb-8">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-2xl border border-white/20 bg-white/10 backdrop-blur-sm mb-4">
            <span className="text-4xl">📋</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white mb-2">نظام الروستر والحضور</h1>
          <p className="text-sm text-blue-200">حساب لكل شخص بالـ ID والباسورد مع حجز شيفت وتسجيل حضور.</p>
        </div>

        <div className="overflow-hidden rounded-3xl bg-white shadow-2xl">
          <div className="grid grid-cols-3 border-b border-gray-100 text-sm font-bold">
            <button
              onClick={() => { setMode('login'); resetMessages(); }}
              className={`px-3 py-3 transition-colors ${mode === 'login' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
            >
              دخول
            </button>
            <button
              onClick={() => { setMode('signup'); resetMessages(); }}
              className={`px-3 py-3 transition-colors ${mode === 'signup' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
            >
              حساب جديد
            </button>
            <button
              onClick={() => { setMode('admin'); resetMessages(); }}
              className={`px-3 py-3 transition-colors ${mode === 'admin' ? 'bg-purple-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
            >
              إشراف
            </button>
          </div>

          <div className="p-6 space-y-4">
            <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-center text-sm text-blue-700">
              باستخدام التطبيق فأنت توافق على
              {' '}
              <a href="/privacy-policy.html" target="_blank" rel="noreferrer" className="font-extrabold text-blue-800 underline underline-offset-2">
                سياسة الخصوصية
              </a>
              {' '}
              الخاصة بـ Badrashin Hub.
            </div>

            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm font-semibold text-red-700">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-center text-sm font-semibold text-green-700">
                {success}
              </div>
            )}

            {mode === 'login' && (
              <>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-gray-700">الـ ID الوظيفي</label>
                  <input
                    type="text"
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                    className="w-full rounded-2xl border-2 border-gray-200 bg-gray-50 px-4 py-3 text-center text-lg font-bold tracking-widest focus:border-blue-500 focus:outline-none"
                    placeholder="مثال: 001"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-gray-700">الباسورد</label>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                    className="w-full rounded-2xl border-2 border-gray-200 bg-gray-50 px-4 py-3 text-center text-lg focus:border-blue-500 focus:outline-none"
                    placeholder="••••••"
                  />
                </div>
                <button
                  onClick={handleLogin}
                  className="w-full rounded-2xl bg-gradient-to-l from-blue-600 to-blue-700 py-3 text-lg font-extrabold text-white shadow-lg transition-all hover:from-blue-700 hover:to-blue-800"
                >
                  دخول المستخدم ✅
                </button>
              </>
            )}

            {mode === 'signup' && (
              <>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-gray-700">الاسم بالكامل</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-2xl border-2 border-gray-200 bg-gray-50 px-4 py-3 text-right focus:border-blue-500 focus:outline-none"
                    placeholder="اكتب الاسم هنا"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-gray-700">رقم الهاتف</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-2xl border-2 border-gray-200 bg-gray-50 px-4 py-3 text-right focus:border-blue-500 focus:outline-none"
                    placeholder="01xxxxxxxxx"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-gray-700">اعمل باسورد</label>
                  <input
                    type="password"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    className="w-full rounded-2xl border-2 border-gray-200 bg-gray-50 px-4 py-3 text-center focus:border-blue-500 focus:outline-none"
                    placeholder="باسورد جديد"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-gray-700">تأكيد الباسورد</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSignup()}
                    className="w-full rounded-2xl border-2 border-gray-200 bg-gray-50 px-4 py-3 text-center focus:border-blue-500 focus:outline-none"
                    placeholder="أعد كتابة الباسورد"
                  />
                </div>
                <div className="rounded-2xl bg-blue-50 p-3 text-sm text-blue-700 border border-blue-100">
                  بعد التسجيل هيتم إنشاء ID تلقائي ليك زي 001 و002 وهتدخل بيه بعد كده.
                </div>
                <button
                  onClick={handleSignup}
                  className="w-full rounded-2xl bg-gradient-to-l from-emerald-500 to-emerald-600 py-3 text-lg font-extrabold text-white shadow-lg transition-all hover:from-emerald-600 hover:to-emerald-700"
                >
                  إنشاء الحساب 🎉
                </button>
              </>
            )}

            {mode === 'admin' && (
              <>
                <div className="text-center mb-2">
                  <span className="text-3xl">🔐</span>
                  <h2 className="mt-2 text-xl font-bold text-gray-800">لوحة الإشراف</h2>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-gray-700">كلمة السر</label>
                  <input
                    type="password"
                    value={adminPass}
                    onChange={(e) => setAdminPass(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
                    className="w-full rounded-2xl border-2 border-gray-200 bg-gray-50 px-4 py-3 text-center text-lg tracking-widest focus:border-purple-500 focus:outline-none"
                    placeholder="••••••••"
                  />
                </div>
                <button
                  onClick={handleAdminLogin}
                  className="w-full rounded-2xl bg-gradient-to-l from-purple-600 to-purple-700 py-3 text-lg font-extrabold text-white shadow-lg transition-all hover:from-purple-700 hover:to-purple-800"
                >
                  دخول الإشراف 🔑
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
