"use client";
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';

type ToastType = 'success' | 'error';
type Toast = { id: string; msg: string; type: ToastType };

interface ToastContextValue {
  showToast: (msg: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((msg: string, type: ToastType = 'success') => {
    const id = String(Date.now()) + Math.random().toString(36).slice(2, 8);
    const t = { id, msg, type };
    setToasts((s) => [...s, t]);
    setTimeout(() => setToasts((s) => s.filter(x => x.id !== id)), 3000);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[200] flex flex-col items-center gap-3">
        {toasts.map(t => (
          <div key={t.id} className={`flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl animate-in slide-in-from-top duration-300 ${t.type === 'success' ? 'bg-black text-white' : 'bg-red-600 text-white'}`}>
            {t.type === 'success' ? <CheckCircle2 className="text-[#FBBE01]" size={20} /> : <AlertCircle size={20} />}
            <span className="text-sm font-black uppercase tracking-widest">{t.msg}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};

export default ToastProvider;
