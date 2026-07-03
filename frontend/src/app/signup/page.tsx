'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiFetch } from '../../lib/api';
import { useAuthStore } from '../../hooks/useAuthStore';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Layers, Mail, Lock, User, ArrowRight, AlertCircle, Sparkles } from 'lucide-react';

const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type SignupFormInputs = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<SignupFormInputs>({
    resolver: zodResolver(signupSchema),
  });

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const emailParam = params.get('email');
      if (emailParam) {
        setValue('email', emailParam);
      }
    }
  }, [setValue]);

  const onSubmit = async (data: SignupFormInputs) => {
    setLoading(true);
    setServerError(null);
    try {
      const response = await apiFetch('/auth/signup', {
        method: 'POST',
        body: JSON.stringify(data),
        skipAuth: true,
      });

      // Automatically authorize user on signup
      login(response.user, response.accessToken, response.refreshToken);
      router.push('/dashboard');
    } catch (err: any) {
      setServerError(err.message || 'Registration failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-center items-center p-4 relative overflow-hidden selection:bg-black/10 selection:text-black">
      {/* Background Gradients */}
      <div className="absolute top-[10%] left-[5%] w-96 h-96 bg-muted/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[10%] right-[5%] w-96 h-96 bg-muted/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-[440px] flex flex-col items-center relative z-10">
        {/* Title Logo */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="w-16 h-16 mb-4 rounded-2xl overflow-hidden shadow-sm border border-border/60 bg-card flex items-center justify-center p-2">
            <img src="/logo.png" alt="Echo Logo" className="h-7 w-7 object-contain" />
          </div>
          <h1 className="text-3xl font-bold font-outfit tracking-tight text-foreground">Create Account</h1>
          <p className="text-sm text-muted-foreground font-normal">
            Get started with Echo workspaces today
          </p>
        </div>

        {/* Card Body */}
        <div className="w-full bg-card text-card-foreground border border-border/60 rounded-2xl p-6 md:p-8 shadow-xl space-y-6">
          {serverError && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Full Name Field */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="John Doe"
                  {...register('name')}
                  className="w-full pl-10 pr-4 py-3 bg-muted text-foreground border border-border/60 rounded-xl text-sm focus:outline-none focus:border-primary transition-colors placeholder:text-muted-foreground/60"
                />
              </div>
              {errors.name && (
                <span className="text-[10px] text-red-400 font-medium block">{errors.name.message}</span>
              )}
            </div>

            {/* Email Field */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-muted-foreground" />
                <input
                  type="email"
                  placeholder="name@company.com"
                  {...register('email')}
                  className="w-full pl-10 pr-4 py-3 bg-muted text-foreground border border-border/60 rounded-xl text-sm focus:outline-none focus:border-primary transition-colors placeholder:text-muted-foreground/60"
                />
              </div>
              {errors.email && (
                <span className="text-[10px] text-red-400 font-medium block">{errors.email.message}</span>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-muted-foreground" />
                <input
                  type="password"
                  placeholder="••••••••"
                  {...register('password')}
                  className="w-full pl-10 pr-4 py-3 bg-muted text-foreground border border-border/60 rounded-xl text-sm focus:outline-none focus:border-primary transition-colors placeholder:text-muted-foreground/60"
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
                  <Sparkles className="h-4 w-4 animate-spin text-primary-foreground" /> Creating account...
                </span>
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="text-foreground font-extrabold hover:underline decoration-2 underline-offset-4 transition-all">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
