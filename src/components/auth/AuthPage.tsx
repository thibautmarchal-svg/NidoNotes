import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { authApi } from '../../lib/api';

type View = 'login' | 'register' | 'forgot';

export default function AuthPage() {
  const { login, register } = useAuth();
  const [view, setView] = useState<View>('login');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');

  // Forgot form
  const [forgotEmail, setForgotEmail] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await login(loginEmail, loginPassword);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await register(regName, regEmail, regPassword);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'inscription');
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await authApi.forgotPassword(forgotEmail);
      setSuccess('Si cet email existe, un lien de réinitialisation a été envoyé.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-800 to-primary-900 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-8">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-primary-800 rounded-2xl flex items-center justify-center mb-3">
            <svg className="w-10 h-10" viewBox="0 0 100 100" fill="none">
              <rect x="26" y="22" width="52" height="64" rx="5" fill="white"/>
              <rect x="35" y="35" width="30" height="3" rx="1.5" fill="#1e40af"/>
              <rect x="35" y="43" width="30" height="3" rx="1.5" fill="#1e40af"/>
              <rect x="35" y="51" width="22" height="3" rx="1.5" fill="#1e40af"/>
              <circle cx="68" cy="68" r="14" fill="#1e40af"/>
              <path d="M62 68 l4 4 l8-8" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Nido Notes</h1>
          <p className="text-slate-500 text-sm mt-1">
            {view === 'login' ? 'Connexion à votre espace' :
             view === 'register' ? 'Créer un compte enseignant' :
             'Réinitialiser le mot de passe'}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mb-4">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm mb-4">
            {success}
          </div>
        )}

        {/* Login */}
        {view === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
              <input
                type="email" required autoFocus
                value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition"
                placeholder="vous@exemple.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Mot de passe</label>
              <input
                type="password" required
                value={loginPassword} onChange={e => setLoginPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit" disabled={loading}
              className="w-full bg-primary-700 hover:bg-primary-800 text-white font-semibold py-3 rounded-xl transition disabled:opacity-50"
            >
              {loading ? 'Connexion…' : 'Se connecter'}
            </button>
            <div className="flex justify-between text-sm text-slate-500">
              <button type="button" onClick={() => { setView('forgot'); setError(''); }} className="hover:text-primary-600">Mot de passe oublié ?</button>
              <button type="button" onClick={() => { setView('register'); setError(''); }} className="hover:text-primary-600">Créer un compte</button>
            </div>
          </form>
        )}

        {/* Register */}
        {view === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nom complet</label>
              <input
                type="text" required autoFocus
                value={regName} onChange={e => setRegName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition"
                placeholder="Marie Dupont"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
              <input
                type="email" required
                value={regEmail} onChange={e => setRegEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition"
                placeholder="vous@exemple.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Mot de passe (min. 8 caractères)</label>
              <input
                type="password" required minLength={8}
                value={regPassword} onChange={e => setRegPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit" disabled={loading}
              className="w-full bg-primary-700 hover:bg-primary-800 text-white font-semibold py-3 rounded-xl transition disabled:opacity-50"
            >
              {loading ? 'Création…' : 'Créer mon compte'}
            </button>
            <button
              type="button" onClick={() => { setView('login'); setError(''); }}
              className="w-full text-sm text-slate-500 hover:text-primary-600 text-center"
            >
              ← Retour à la connexion
            </button>
          </form>
        )}

        {/* Forgot password */}
        {view === 'forgot' && (
          <form onSubmit={handleForgot} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Votre email</label>
              <input
                type="email" required autoFocus
                value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition"
                placeholder="vous@exemple.com"
              />
            </div>
            <button
              type="submit" disabled={loading}
              className="w-full bg-primary-700 hover:bg-primary-800 text-white font-semibold py-3 rounded-xl transition disabled:opacity-50"
            >
              {loading ? 'Envoi…' : 'Envoyer le lien'}
            </button>
            <button
              type="button" onClick={() => { setView('login'); setError(''); setSuccess(''); }}
              className="w-full text-sm text-slate-500 hover:text-primary-600 text-center"
            >
              ← Retour à la connexion
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
