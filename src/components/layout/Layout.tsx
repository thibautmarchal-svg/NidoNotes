import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav';
import ConnectionStatus from '../ui/ConnectionStatus';
import { useAuth } from '../../contexts/AuthContext';
import { useState } from 'react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export default function Layout() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const isOnline = useOnlineStatus();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <header className="bg-primary-800 text-white shadow-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-7 h-7" viewBox="0 0 100 100" fill="none">
              <rect width="100" height="100" rx="20" fill="white" fillOpacity="0.15"/>
              <rect x="26" y="22" width="52" height="64" rx="5" fill="white"/>
              <rect x="35" y="35" width="30" height="3" rx="1.5" fill="#1e40af"/>
              <rect x="35" y="43" width="30" height="3" rx="1.5" fill="#1e40af"/>
              <rect x="35" y="51" width="22" height="3" rx="1.5" fill="#1e40af"/>
              <circle cx="68" cy="68" r="14" fill="#1e40af"/>
              <path d="M62 68 l4 4 l8-8" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="font-semibold text-lg tracking-tight">Nido Notes</span>
          </div>

          <div className="flex items-center gap-3">
            <ConnectionStatus isOnline={isOnline} />
            <div className="relative">
              <button
                onClick={() => setMenuOpen(v => !v)}
                className="flex items-center gap-2 text-sm text-white/80 hover:text-white transition-colors"
              >
                <span className="hidden sm:block">{user?.name}</span>
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-medium text-sm">
                  {user?.name?.charAt(0).toUpperCase()}
                </div>
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-10 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 min-w-[160px] overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                    <p className="text-xs text-slate-500">Connecté en tant que</p>
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{user?.email}</p>
                  </div>
                  <button
                    onClick={() => { setMenuOpen(false); logout(); }}
                    className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    Se déconnecter
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 pb-24 md:pb-6">
        <Outlet />
      </main>

      {/* Bottom nav mobile */}
      <BottomNav />
    </div>
  );
}
