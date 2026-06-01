import { useEffect, useState } from 'react';
import LoginPage from './components/LoginPage';
import RegisterPage from './components/RegisterPage';
import AdminPage from './components/AdminPage';
import MobileInstallPrompt from './components/MobileInstallPrompt';
import { AppView, UserAccount } from './types';
import { getAdminSettings } from './store';
import { subscribeToCloudState } from './cloudSync';
import { subscribeRosterChanges } from './persistence';

function App() {
  const [view, setView] = useState<AppView>('login');
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [cloudStatus, setCloudStatus] = useState<'local' | 'connected' | 'error'>('local');
  const [settings, setSettings] = useState(getAdminSettings());

  useEffect(() => {
    return subscribeRosterChanges(() => {
      setSettings(getAdminSettings());
    });
  }, []);

  const cloudConfigKey = JSON.stringify(settings.firebaseConfig ?? {});

  useEffect(() => {
    return subscribeToCloudState(settings.firebaseConfig, settings.cloudEnabled, setCloudStatus);
  }, [settings.cloudEnabled, cloudConfigKey]);

  const handleLogin = (user: UserAccount) => {
    setCurrentUser(user);
    setView('register');
  };

  const handleAdminLogin = () => {
    setView('admin');
  };

  const handleLogout = () => {
    setView('login');
    setCurrentUser(null);
  };

  return (
    <div className="mobile-app-root relative min-h-screen overflow-x-hidden">
      {view === 'login' && <LoginPage onLogin={handleLogin} onAdminLogin={handleAdminLogin} />}
      {view === 'register' && currentUser && (
        <RegisterPage user={currentUser} onLogout={handleLogout} cloudStatus={cloudStatus} />
      )}
      {view === 'admin' && <AdminPage onLogout={handleLogout} cloudStatus={cloudStatus} />}
      <MobileInstallPrompt />
    </div>
  );
}

export default App;
