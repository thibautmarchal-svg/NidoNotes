import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ClassProvider, useClass } from './contexts/ClassContext';
import { ToastProvider } from './contexts/ToastContext';
import Layout from './components/layout/Layout';
import AuthPage from './components/auth/AuthPage';
import ResetPasswordPage from './components/auth/ResetPasswordPage';
import ClassSelectPage from './components/classes/ClassSelectPage';
import QuickEntryPage from './components/entry/QuickEntryPage';
import StudentDetailPage from './components/students/StudentDetailPage';
import Dashboard from './components/dashboard/Dashboard';
import StudentsPage from './components/students/StudentsPage';
import SubjectsPage from './components/subjects/SubjectsPage';
import PeriodsPage from './components/periods/PeriodsPage';
import EvaluationsPage from './components/evaluations/EvaluationsPage';
import GradesPage from './components/grades/GradesPage';

function AppRoutes() {
  const { user, loading } = useAuth();
  const { currentClass, loading: classLoading } = useClass();

  if (loading || classLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--ocre)', borderTopColor: 'transparent' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Chargement…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="*" element={<AuthPage />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/classes" element={<ClassSelectPage />} />
        {currentClass ? (
          <>
            <Route index element={<Dashboard />} />
            <Route path="/tableau" element={<Dashboard />} />
            <Route path="/eleves" element={<StudentsPage />} />
            <Route path="/matieres" element={<SubjectsPage />} />
            <Route path="/periodes" element={<PeriodsPage />} />
            <Route path="/evaluations" element={<EvaluationsPage />} />
            <Route path="/notes" element={<GradesPage />} />
            <Route path="/saisie" element={<QuickEntryPage />} />
            <Route path="/eleves/:studentId" element={<StudentDetailPage />} />
          </>
        ) : null}
        <Route path="*" element={<Navigate to={currentClass ? '/' : '/classes'} replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <ClassProvider>
          <ToastProvider>
            <AppRoutes />
          </ToastProvider>
        </ClassProvider>
      </AuthProvider>
    </HashRouter>
  );
}
