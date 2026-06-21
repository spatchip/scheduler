'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function TrainerLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Success - redirect to trainer dashboard
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Unable to log in. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto mt-12">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-semibold tracking-tighter">Trainer Login</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Sign in with your staff credentials to access your dashboard.
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Demo: Use any seeded staff email + password <span className="font-mono">password123</span>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 md:p-8">
        <div>
          <label className="block text-sm font-medium mb-1.5 text-zinc-600 dark:text-zinc-400">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="alice.chen@example.com"
            className="w-full border border-zinc-300 dark:border-zinc-700 bg-transparent rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5 text-zinc-600 dark:text-zinc-400">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="password123"
            className="w-full border border-zinc-300 dark:border-zinc-700 bg-transparent rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
          />
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl p-3">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-2xl bg-black py-3 text-sm font-semibold text-white active:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-black dark:active:bg-zinc-200 mt-2"
        >
          {loading ? 'Signing in…' : 'Sign In'}
        </button>

        <p className="text-center text-xs text-zinc-500 pt-2">
          After logging in you will be taken to your protected Trainer Dashboard.
        </p>
      </form>
    </div>
  );
}
