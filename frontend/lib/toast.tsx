'use client';
import { useState, useCallback, useEffect } from 'react';

interface Toast { id: number; message: string; type: 'success' | 'error'; }

let toastId = 0;
let globalAddToast: ((msg: string, type: 'success' | 'error') => void) | null = null;
const pendingToasts: { message: string; type: 'success' | 'error' }[] = [];

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  useEffect(() => {
    globalAddToast = addToast;
    // Flush any toasts that were queued before the hook mounted
    while (pendingToasts.length > 0) {
      const t = pendingToasts.shift()!;
      addToast(t.message, t.type);
    }
    return () => { globalAddToast = null; };
  }, [addToast]);

  return { toasts, addToast };
}

export function toast(message: string, type: 'success' | 'error' = 'success') {
  if (globalAddToast) {
    globalAddToast(message, type);
  } else {
    // Queue for when the hook mounts
    pendingToasts.push({ message, type });
  }
}

export function ToastContainer({ toasts }: { toasts: { id: number; message: string; type: string }[] }) {
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <span>{t.type === 'success' ? '✅' : '❌'}</span>
          {t.message}
        </div>
      ))}
    </div>
  );
}
