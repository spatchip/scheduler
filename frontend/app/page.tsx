'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Health {
  status: string;
  db: string;
}

interface Staff {
  id: number;
  name: string;
  email: string;
  role: string | null;
  department: string | null;
}

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function Dashboard() {
  const [health, setHealth] = useState<Health | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [h, s] = await Promise.all([
          fetch(`${API}/api/health`).then(r => r.json()),
          fetch(`${API}/api/public/staff`).then(r => r.json()),
        ]);
        setHealth(h);
        setStaff(Array.isArray(s) ? s.slice(0, 5) : []);
      } catch (e) {
        console.error('Failed to load dashboard data', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-semibold tracking-tighter">Welcome back</h1>
        <p className="text-xl text-zinc-600 dark:text-zinc-400 mt-1">
          Staff booking and scheduling overview
        </p>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
          <div className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Backend</div>
          <div className="text-2xl font-semibold">{health ? 'Online' : loading ? 'Checking...' : 'Offline'}</div>
          <div className="text-sm mt-1 text-emerald-600 dark:text-emerald-400">
            {health ? `DB: ${health.db}` : 'http://localhost:3001'}
          </div>
        </div>
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
          <div className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Staff</div>
          <div className="text-2xl font-semibold">{staff.length}</div>
          <div className="text-sm mt-1">bookable team members</div>
        </div>
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
          <div className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Admin Tools</div>
          <div className="text-2xl font-semibold">RBAC</div>
          <div className="text-sm mt-1"><Link href="/login" className="underline">Sign in as admin</Link> to manage bookings</div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3">
        <Link
          href="/login"
          className="inline-flex items-center justify-center rounded-xl bg-black dark:bg-white text-white dark:text-black px-5 py-2.5 text-sm font-medium hover:opacity-90 active:scale-[0.985] transition"
        >
          Staff Login
        </Link>
        <Link
          href="/book"
          className="inline-flex items-center justify-center rounded-xl border border-zinc-300 dark:border-zinc-700 px-5 py-2.5 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-900 transition"
        >
          Book Appointment
        </Link>
        <Link
          href="/admin"
          className="inline-flex items-center justify-center rounded-xl border border-zinc-300 dark:border-zinc-700 px-5 py-2.5 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-900 transition"
        >
          Admin Overview
        </Link>
      </div>

      {/* Recent sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Staff */}
        <div>
          <div className="flex items-baseline justify-between mb-3 px-1">
            <h2 className="font-semibold tracking-tight">Recent Staff</h2>
            <Link href="/book" className="text-sm text-zinc-500 hover:text-black dark:hover:text-white">Book →</Link>
          </div>
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-sm text-zinc-400">Loading...</div>
            ) : staff.length === 0 ? (
              <div className="p-8 text-center text-sm text-zinc-500">
                No staff yet. <Link href="/staff" className="underline">Add your first team member</Link>.
              </div>
            ) : (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {staff.map((s) => (
                  <li key={s.id} className="px-5 py-3 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-950/50">
                    <div>
                      <div className="font-medium">{s.name}</div>
                      <div className="text-sm text-zinc-500">{s.email}</div>
                    </div>
                    <div className="text-right text-xs text-zinc-400">
                      {s.role || '—'} {s.department && `• ${s.department}`}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Public booking CTA */}
        <div>
          <div className="flex items-baseline justify-between mb-3 px-1">
            <h2 className="font-semibold tracking-tight">Public Booking</h2>
            <Link href="/book" className="text-sm text-zinc-500 hover:text-black dark:hover:text-white">Book now →</Link>
          </div>
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Clients can book appointments without logging in. Trainers manage their own schedule; admins sign in for the full overview.
            </p>
            <Link href="/book" className="inline-block mt-4 text-sm font-medium underline">Go to booking page</Link>
          </div>
        </div>
      </div>

      <div className="text-xs text-zinc-400 pt-4">
        Tip: Make sure the backend is running and the database is initialized (see README).
      </div>
    </div>
  );
}
