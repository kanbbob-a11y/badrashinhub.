import { useEffect, useState } from 'react';

export default function MobileInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const installApp = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  if (installed || dismissed || !deferredPrompt) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-md animate-fadeIn">
      <div className="rounded-3xl border border-blue-200 bg-white/95 p-4 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-2xl text-white shadow-lg">
            📱
          </div>
          <div className="flex-1 text-right">
            <p className="text-sm font-extrabold text-gray-800">ثبت التطبيق على الموبايل</p>
            <p className="text-xs text-gray-500">نفس النظام لكن بشكل أبليكشن أسرع وأسهل من الشاشة الرئيسية.</p>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => setDismissed(true)}
            className="flex-1 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-600"
          >
            لاحقاً
          </button>
          <button
            onClick={installApp}
            className="flex-1 rounded-2xl bg-gradient-to-l from-blue-600 to-indigo-700 px-4 py-3 text-sm font-extrabold text-white shadow-lg"
          >
            تثبيت الآن
          </button>
        </div>
      </div>
    </div>
  );
}
