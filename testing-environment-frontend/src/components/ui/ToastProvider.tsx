import { useMemo, useState, type ReactNode } from 'react';
import { ToastContext, type ToastContextValue, type ToastTone } from './toastContext';

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const value = useMemo<ToastContextValue>(
    () => ({
      showToast: (message, tone = 'info') => {
        const id = Date.now();
        setToasts((items) => [...items, { id, message, tone }]);
        window.setTimeout(() => setToasts((items) => items.filter((toast) => toast.id !== id)), 3500);
      },
    }),
    [],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="fixed right-4 top-4 z-50 space-y-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`rounded-md px-4 py-3 text-sm font-medium shadow-soft ${
              toast.tone === 'success'
                ? 'bg-emerald-600 text-white'
                : toast.tone === 'error'
                  ? 'bg-red-600 text-white'
                  : 'bg-slate-900 text-white'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
