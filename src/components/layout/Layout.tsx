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
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-base)' }}>
      {/* Header */}
      <header style={{ background: 'var(--terre)', boxShadow: 'var(--shadow-md)' }} className="sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--ocre)' }}>
              <svg className="w-5 h-5" viewBox="0 0 100 100" fill="none">
                <rect x="28" y="20" width="48" height="60" rx="5" fill="white"/>
                <rect x="37" y="33" width="26" height="3" rx="1.5" fill="#412402"/>
                <rect x="37" y="41" width="26" height="3" rx="1.5" fill="#412402"/>
                <rect x="37" y="49" width="18" height="3" rx="1.5" fill="#412402"/>
                <circle cx="67" cy="67" r="14" fill="#412402"/>
                <path d="M61 67 l4 4 l8-8" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="font-semibold text-lg tracking-tight" style={{ color: 'var(--creme)' }}>Nido Notes</span>
          </div>

          <div className="flex items-center gap-3">
            <ConnectionStatus isOnline={isOnline} />
            <div className="relative">
              <button
                onClick={() => setMenuOpen(v => !v)}
                className="flex items-center gap-2 transition-opacity hover:opacity-80"
                style={{ color: 'var(--sable)' }}
              >
                <span className="hidden sm:block text-sm">{user?.name}</span>
                <div className="w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm"
                  style={{ background: 'var(--ocre)', color: 'var(--terre)' }}>
                  {user?.name?.charAt(0).toUpperCase()}
                </div>
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-10 rounded-xl shadow-xl min-w-[170px] overflow-hidden z-50"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}>
                  <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Connecté en tant que</p>
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{user?.email}</p>
                  </div>
                  <button
                    onClick={() => { setMenuOpen(false); logout(); }}
                    className="w-full text-left px-4 py-3 text-sm transition-colors hover:opacity-80"
                    style={{ color: '#E05050' }}
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

      <BottomNav />
    </div>
  );
}
