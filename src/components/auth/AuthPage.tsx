import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useClass } from '../../contexts/ClassContext';
import { authApi } from '../../lib/api';

type View = 'login' | 'register' | 'forgot';

const inputClass = "w-full px-4 py-3 rounded-xl text-sm outline-none transition-all";
const inputStyle = {
  background: 'var(--bg-raised)',
  border: '1.5px solid var(--border-default)',
  color: 'var(--text-primary)',
};
const inputFocusStyle = {
  borderColor: 'var(--ocre)',
  boxShadow: '0 0 0 3px rgba(239,159,39,.15)',
};

function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      {...props}
      className={inputClass}
      style={{ ...inputStyle, ...(focused ? inputFocusStyle : {}) }}
      onFocus={e => { setFocused(true); props.onFocus?.(e); }}
      onBlur={e => { setFocused(false); props.onBlur?.(e); }}
    />
  );
}

export default function AuthPage() {
  const { login, register } = useAuth();
  const { loadClasses } = useClass();
  const [view, setView] = useState<View>('login');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const [loginEmail, setLoginEmail]       = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [regName, setRegName]             = useState('');
  const [regEmail, setRegEmail]           = useState('');
  const [regPassword, setRegPassword]     = useState('');
  const [forgotEmail, setForgotEmail]     = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      await login(loginEmail, loginPassword);
      await loadClasses();
    }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'Erreur de connexion'); }
    finally { setLoading(false); }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try { await register(regName, regEmail, regPassword); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'Erreur lors de l\'inscription'); }
    finally { setLoading(false); }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      await authApi.forgotPassword(forgotEmail);
      setSuccess('Si cet email existe, un lien de réinitialisation a été envoyé.');
    }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'Erreur'); }
    finally { setLoading(false); }
  };

  const switchView = (v: View) => { setView(v); setError(''); setSuccess(''); };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-base)' }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4 shadow-nido"
            style={{ background: 'var(--creme)', border: '2px solid var(--sable)' }}>
            <svg className="w-12 h-12" viewBox="0 0 100 100" fill="none">
              <rect x="22" y="18" width="48" height="60" rx="6" fill="#FAC775"/>
              <rect x="26" y="22" width="48" height="60" rx="5" fill="white"/>
              <rect x="37" y="35" width="26" height="3.5" rx="1.75" fill="#EF9F27"/>
              <rect x="37" y="44" width="26" height="3.5" rx="1.75" fill="#EF9F27"/>
              <rect x="37" y="53" width="18" height="3.5" rx="1.75" fill="#EF9F27"/>
              <circle cx="68" cy="68" r="16" fill="#EF9F27"/>
              <path d="M62 68 l4 4 l8-8" stroke="#412402" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--terre)' }}>Nido Notes</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {view === 'login'    ? 'Connexion à votre espace' :
             view === 'register' ? 'Créer un compte enseignant' :
             'Réinitialiser le mot de passe'}
          </p>
        </div>

        <div className="rounded-2xl p-8 shadow-nido" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
          {error && (
            <div className="px-4 py-3 rounded-xl text-sm mb-5" style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#E05050' }}>
              {error}
            </div>
          )}
          {success && (
            <div className="px-4 py-3 rounded-xl text-sm mb-5" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#4CAF78' }}>
              {success}
            </div>
          )}

          {/* Login */}
          {view === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Email</label>
                <Input type="email" required autoFocus value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="vous@exemple.com" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Mot de passe</label>
                <Input type="password" required value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="••••••••" />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
                {loading ? 'Connexion…' : 'Se connecter'}
              </button>
              <div className="flex justify-between text-sm mt-2">
                <button type="button" onClick={() => switchView('forgot')} style={{ color: 'var(--ocre)' }} className="hover:opacity-70 transition-opacity">
                  Mot de passe oublié ?
                </button>
                <button type="button" onClick={() => switchView('register')} style={{ color: 'var(--ocre)' }} className="hover:opacity-70 transition-opacity">
                  Créer un compte
                </button>
              </div>
            </form>
          )}

          {/* Register */}
          {view === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Nom complet</label>
                <Input type="text" required autoFocus value={regName} onChange={e => setRegName(e.target.value)} placeholder="Marie Dupont" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Email</label>
                <Input type="email" required value={regEmail} onChange={e => setRegEmail(e.target.value)} placeholder="vous@exemple.com" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Mot de passe <span style={{ color: 'var(--text-muted)' }}>(min. 8 caractères)</span></label>
                <Input type="password" required minLength={8} value={regPassword} onChange={e => setRegPassword(e.target.value)} placeholder="••••••••" />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
                {loading ? 'Création…' : 'Créer mon compte'}
              </button>
              <button type="button" onClick={() => switchView('login')} className="w-full text-sm text-center mt-2 hover:opacity-70 transition-opacity" style={{ color: 'var(--text-muted)' }}>
                ← Retour à la connexion
              </button>
            </form>
          )}

          {/* Forgot */}
          {view === 'forgot' && (
            <form onSubmit={handleForgot} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Votre email</label>
                <Input type="email" required autoFocus value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} placeholder="vous@exemple.com" />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
                {loading ? 'Envoi…' : 'Envoyer le lien'}
              </button>
              <button type="button" onClick={() => switchView('login')} className="w-full text-sm text-center mt-2 hover:opacity-70 transition-opacity" style={{ color: 'var(--text-muted)' }}>
                ← Retour à la connexion
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
