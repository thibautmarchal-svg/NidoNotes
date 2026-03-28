import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { Class } from '../types';
import { classesApi } from '../lib/api';

interface ClassContextValue {
  classes: Class[];
  currentClass: Class | null;
  setCurrentClass: (c: Class | null) => void;
  loadClasses: () => Promise<void>;
  loading: boolean;
}

const ClassContext = createContext<ClassContextValue | null>(null);

export function ClassProvider({ children }: { children: ReactNode }) {
  const [classes, setClasses]           = useState<Class[]>([]);
  const [currentClass, setCurrentClassState] = useState<Class | null>(() => {
    const stored = localStorage.getItem('nido_current_class');
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(true);

  const setCurrentClass = (c: Class | null) => {
    setCurrentClassState(c);
    if (c) localStorage.setItem('nido_current_class', JSON.stringify(c));
    else    localStorage.removeItem('nido_current_class');
  };

  const loadClasses = async () => {
    try {
      const list = await classesApi.list();
      setClasses(list);
      // Si la classe courante n'existe plus, la désélectionner
      if (currentClass && !list.find(c => c.id === currentClass.id)) {
        setCurrentClass(null);
      }
      // Mettre à jour les données de la classe courante si elle a changé
      if (currentClass) {
        const updated = list.find(c => c.id === currentClass.id);
        if (updated) setCurrentClass(updated);
      }
    } catch {
      // offline — conserver les données locales
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadClasses(); }, []);

  return (
    <ClassContext.Provider value={{ classes, currentClass, setCurrentClass, loadClasses, loading }}>
      {children}
    </ClassContext.Provider>
  );
}

export function useClass() {
  const ctx = useContext(ClassContext);
  if (!ctx) throw new Error('useClass doit être utilisé dans ClassProvider');
  return ctx;
}
