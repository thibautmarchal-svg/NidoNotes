import { Outlet, useNavigate } from 'react-router-dom';
import BottomNav from './BottomNav';
import ConnectionStatus from '../ui/ConnectionStatus';
import { useAuth } from '../../contexts/AuthContext';
import { useClass } from '../../contexts/ClassContext';
import { useState } from 'react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useInstallPrompt } from '../../hooks/useInstallPrompt';

export default function Layout() {
  const { user, logout } = useAuth();
  const { currentClass } = useClass();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const isOnline = useOnlineStatus();
  const { canInstall, install, dismiss } = useInstallPrompt();

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-base)' }}>
      {/* Header */}
      <header style={{ background: 'var(--terre)', boxShadow: 'var(--shadow-md)' }} className="sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--ocre)' }}>
              <svg className="w-5 h-5" viewBox="0 0 100 100" fill="none">
                <rect x="28" y="20" width="48" height="60" rx="5" fill="white"/>
                <rect x="37" y="33" width="26" height="3" rx="1.5" fill="#412402"/>
                <rect x="37" y="41" width="26" height="3" rx="1.5" fill="#412402"/>
                <rect x="37" y="49" width="18" height="3" rx="1.5" fill="#412402"/>
                <circle cx="67" cy="67" r="14" fill="#412402"/>
                <path d="M61 67 l4 4 l8-8" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-base leading-tight" style={{ color: 'var(--creme)' }}>Nido Notes</span>
              {currentClass && (
                <button
                  onClick={() => navigate('/classes')}
                  className="text-xs truncate text-left transition-opacity hover:opacity-70 max-w-[140px] sm:max-w-[200px]"
                  style={{ color: 'var(--sable)' }}
                  title="Changer de classe"
                >
                  {currentClass.name}{currentClass.school_year ? ` · ${currentClass.school_year}` : ''}
                </button>
              )}
            </div>
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
                <div className="absolute right-0 top-10 rounded-xl shadow-xl min-w-[180px] overflow-hidden z-50"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}>
                  <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Connecté en tant que</p>
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{user?.email}</p>
                  </div>
                  <button
                    onClick={() => { setMenuOpen(false); navigate('/classes'); }}
                    className="w-full text-left px-4 py-3 text-sm transition-colors hover:opacity-80"
                    style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-subtle)' }}
                  >
                    Changer de classe
                  </button>
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

      {/* Bandeau installation PWA */}
      {canInstall && (
        <div
          className="flex items-center gap-3 px-4 py-2.5"
          style={{ background: 'var(--ocre)', color: 'var(--terre)' }}
        >
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <span className="flex-1 text-sm font-medium">
            Installer Nido Notes comme application
          </span>
          <button
            onClick={install}
            className="text-sm font-bold px-3 py-1 rounded-lg transition-opacity hover:opacity-80 flex-shrink-0"
            style={{ background: 'var(--terre)', color: 'var(--creme)' }}
          >
            Installer
          </button>
          <button
            onClick={dismiss}
            className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
            aria-label="Fermer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 pb-24">
        <Outlet />
      </main>

      <BottomNav />
    </div>
  );
}
