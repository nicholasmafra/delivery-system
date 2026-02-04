"use client";
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

interface LoadingContextValue {
  startLoading: () => void;
  stopLoading: () => void;
}

const LoadingContext = createContext<LoadingContextValue | null>(null);

export const LoadingProvider = ({ children }: { children: React.ReactNode }) => {
  const [count, setCount] = useState(0);

  const startLoading = useCallback(() => setCount((c) => c + 1), []);
  const stopLoading = useCallback(() => setCount((c) => Math.max(0, c - 1)), []);

  const value = useMemo(() => ({ startLoading, stopLoading }), [startLoading, stopLoading]);

  return (
    <LoadingContext.Provider value={value}>
      {children}
      {count > 0 && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="w-20 h-20 rounded-full border-4 border-t-transparent border-white animate-spin" />
        </div>
      )}
    </LoadingContext.Provider>
  );
};

export const useLoading = () => {
  const ctx = useContext(LoadingContext);
  if (!ctx) throw new Error('useLoading must be used within LoadingProvider');
  return ctx;
};

export default LoadingProvider;
