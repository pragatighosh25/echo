'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiFetch } from '../../lib/api';
import { useAuthStore } from '../../hooks/useAuthStore';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, Lock, ArrowRight, AlertCircle, Sparkles } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormInputs = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormInputs>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormInputs) => {
    setLoading(true);
    setServerError(null);
    try {
      const response = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
        skipAuth: true,
      });

      // Save user details & tokens in Zustand
      login(response.user, response.accessToken, response.refreshToken);
      router.push('/dashboard');
    } catch (err: any) {
      setServerError(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-center items-center p-4 relative overflow-hidden selection:bg-black/10 selection:text-black">
      {/* Background gradients */}
      <div className="absolute top-[10%] right-[5%] w-96 h-96 bg-muted/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[10%] left-[5%] w-96 h-96 bg-muted/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-[440px] flex flex-col items-center relative z-10">
        {/* Logo Header */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="w-16 h-16 mb-4 rounded-2xl overflow-hidden shadow-sm border border-border/60 bg-card flex items-center justify-center p-2">
            <img alt="Echo" className="w-full h-full object-contain" src="/logo.png" />
          </div>
          <h1 className="font-outfit text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-1">
            Welcome Back
          </h1>
          <p className="text-sm text-muted-foreground max-w-[320px]">
            Sign in to access your Echo collaborative workspace
          </p>
        </div>

        {/* Login Card */}
        <div className="w-full bg-card text-card-foreground border border-border/60 p-6 md:p-8 rounded-2xl shadow-xl space-y-6">
          {serverError && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Email Field */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block" htmlFor="email">
                EMAIL ADDRESS
              </label>
              <div className="relative group">
                <Mail className="absolute left-4 top-3.5 h-4.5 w-4.5 text-muted-foreground group-focus-within:text-foreground transition-colors" />
                <input
                  id="email"
                  type="email"
                  placeholder="testuser@gmail.com"
                  {...register('email')}
                  className="w-full bg-muted text-foreground text-sm h-12 pl-11 pr-4 rounded-xl border border-border/60 focus:border-primary focus:ring-0 outline-none transition-all placeholder:text-muted-foreground/60"
                  required
                />
              </div>
              {errors.email && (
                <span className="text-[10px] text-red-400 font-medium block">{errors.email.message}</span>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block" htmlFor="password">
                  PASSWORD
                </label>
                <Link
                  href="/forgot-password"
                  className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                >
                  Forgot Password?
                </Link>
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-3.5 h-4.5 w-4.5 text-muted-foreground group-focus-within:text-foreground transition-colors" />
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  {...register('password')}
                  className="w-full bg-muted text-foreground text-sm h-12 pl-11 pr-4 rounded-xl border border-border/60 focus:border-primary focus:ring-0 outline-none transition-all placeholder:text-muted-foreground/60"
                  required
                />
              </div>
              {errors.password && (
                <span className="text-[10px] text-red-400 font-medium block">{errors.password.message}</span>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground font-bold text-sm h-12 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] hover:opacity-90 shadow-md shadow-primary/10 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 animate-spin text-primary-foreground" /> Signing in...
                </span>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer Links */}
        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            Don't have an account?{' '}
            <Link
              href="/signup"
              className="text-foreground font-extrabold hover:underline decoration-2 underline-offset-4 transition-all"
            >
              Sign up now
            </Link>
          </p>
        </div>

        {/* Atmosphere Subtle Particles */}
        <div className="mt-8 flex items-center gap-3 opacity-25">
          <div className="w-2 h-2 rounded-full bg-foreground animate-pulse"></div>
          <div className="w-2 h-2 rounded-full bg-foreground animate-pulse delay-75"></div>
          <div className="w-2 h-2 rounded-full bg-foreground animate-pulse delay-150"></div>
        </div>
      </div>
    </div>
  );
}
