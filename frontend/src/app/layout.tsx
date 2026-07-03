'use client';

import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '../hooks/useAuthStore';
import './globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  }));

  const initializeAuth = useAuthStore((state) => state.initialize);

  useEffect(() => {
    // Initialize authentication tokens from localStorage on mount
    initializeAuth();

    // Set default theme to dark
    if (typeof window !== 'undefined') {
      const isDark = localStorage.getItem('theme') !== 'light';
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [initializeAuth]);

  return (
    <html lang="en">
      <body className="antialiased bg-background text-foreground transition-colors duration-200">
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </body>
    </html>
  );
}
