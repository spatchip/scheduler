'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DateTime } from 'luxon';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface User {
  id: number;
  name: string;
  email: string;
  role?: string | null;
  department?: string | null;
}

interface Booking {
  id: number;
  client_name: string;
  client_email: string | null;
  start_time: string;
  end_time: string;
  status: string;
  service_type: string | null;
  notes: string | null;
}

interface AvailabilityBlock {
  id: number;
  start_time: string;
  end_time: string;
  day_of_week: number | null;
  specific_date: string | null;
  is_available: boolean;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function TrainerDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [upcoming, setUpcoming] = useState<Booking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);

  const [availability, setAvailability] = useState<AvailabilityBlock[]>([]);
  const [loadingAvail, setLoadingAvail] = useState(true);

  // New availability form
  const [newDow, setNewDow] = useState<number>(1); // Monday default
  const [newStart, setNewStart] = useState('09:00');
  const [newEnd, setNewEnd] = useState('17:00');
  const [adding, setAdding] = useState(false);
  const [availError, setAvailError] = useState<string | null>(null);

  const [logoutLoading, setLogoutLoading] = useState(false);

  // Fetch current user (protected)
  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      try {
        const res = await fetch(`${API}/api/auth/me`, { credentials: 'include' });
        if (!res.ok) {
          router.replace('/login');
          return;
        }
        const data = await res.json();
        if (mounted) setUser(data.user);
      } catch (e) {
        router.replace('/login');
      } finally {
        if (mounted) setLoadingUser(false);
      }
    }

    loadUser();
    return () => { mounted = false; };
  }, [router]);

  // Load trainer-specific data once we have a user
  useEffect(() => {
    if (!user) return;

    // Upcoming bookings
    setLoadingBookings(true);
    fetch(`${API}/api/trainer/bookings`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => setUpcoming(Array.isArray(data) ? data : []))
      .catch(() => setUpcoming([]))
      .finally(() => setLoadingBookings(false));

    // Availability
    setLoadingAvail(true);
    fetch(`${API}/api/trainer/availability`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => setAvailability(Array.isArray(data) ? data : []))
      .catch(() => setAvailability([]))
      .finally(() => setLoadingAvail(false));
  }, [user]);

  async function handleLogout() {
    setLogoutLoading(true);
    try {
      await fetch(`${API}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } finally {
      router.replace('/login');
    }
  }

  // Format a booking time to local using Luxon (same pattern as public booking page)
  function formatBookingTime(iso: string) {
    try {
      const dt = DateTime.fromISO(iso, { zone: 'utc' }).setZone('local');
      return dt.toFormat('ccc, LLL dd • h:mm a');
    } catch {
      return iso;
    }
  }

  function formatTimeRange(startIso: string, endIso: string) {
    try {
      const s = DateTime.fromISO(startIso, { zone: 'utc' }).setZone('local');
      const e = DateTime.fromISO(endIso, { zone: 'utc' }).setZone('local');
      return `${s.toFormat('h:mm a')} – ${e.toFormat('h:mm a')}`;
    } catch {
      return `${startIso} – ${endIso}`;
    }
  }

  // Availability manager actions
  async function addAvailability() {
    if (!user) return;
    setAvailError(null);
    setAdding(true);

    try {
      const res = await fetch(`${API}/api/trainer/availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          day_of_week: newDow,
          start_time: newStart,
          end_time: newEnd,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to add block');
      }

      // Refetch
      const refreshed = await fetch(`${API}/api/trainer/availability`, { credentials: 'include' });
      const data = await refreshed.json();
      setAvailability(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setAvailError(e.message);
    } finally {
      setAdding(false);
    }
  }

  async function deleteAvailability(id: number) {
    if (!confirm('Delete this availability block?')) return;

    try {
      const res = await fetch(`${API}/api/trainer/availability/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Delete failed');

      setAvailability((prev) => prev.filter((a) => a.id !== id));
    } catch (e: any) {
      alert(e.message || 'Failed to delete');
    }
  }

  if (loadingUser) {
    return (
      <div className="max-w-4xl mx-auto py-12">
        <div className="text-center text-sm text-zinc-500">Loading your dashboard…</div>
      </div>
    );
  }

  if (!user) {
    return null; // redirect happened
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tighter">Trainer Dashboard</h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Welcome back, <span className="font-medium text-zinc-900 dark:text-zinc-100">{user.name}</span>
          </p>
        </div>
        <button
          onClick={handleLogout}
          disabled={logoutLoading}
          className="self-start sm:self-auto rounded-xl border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900 disabled:opacity-50"
        >
          {logoutLoading ? 'Logging out…' : 'Log out'}
        </button>
      </div>

      {/* Section 1: Upcoming Sittings */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="font-semibold tracking-tight text-xl">Upcoming Sittings</h2>
          <span className="text-xs text-zinc-500">Confirmed • local time</span>
        </div>

        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
          {loadingBookings ? (
            <div className="p-8 text-center text-sm text-zinc-400">Loading your bookings…</div>
          ) : upcoming.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-zinc-500">No upcoming confirmed sittings.</p>
              <p className="text-xs text-zinc-400 mt-1">New bookings made via the public page will appear here.</p>
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {upcoming.map((b) => (
                <li key={b.id} className="p-5 md:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <div className="font-medium">{b.client_name}</div>
                    {b.client_email && <div className="text-sm text-zinc-500">{b.client_email}</div>}
                    {b.service_type && <div className="text-xs text-zinc-400 mt-0.5">{b.service_type}</div>}
                  </div>

                  <div className="text-right font-mono text-sm">
                    <div>{formatBookingTime(b.start_time)}</div>
                    <div className="text-zinc-400">→ {formatTimeRange(b.start_time, b.end_time)}</div>
                  </div>

                  {b.notes && (
                    <div className="text-sm text-zinc-500 md:max-w-[260px] md:text-right italic">“{b.notes}”</div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="text-[10px] text-zinc-400 mt-2 px-1">Times converted from UTC to your browser’s local timezone using Luxon.</p>
      </div>

      {/* Section 2: Availability Manager */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="font-semibold tracking-tight text-xl">Availability Manager</h2>
          <span className="text-xs text-zinc-500">Recurring weekly blocks</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Current blocks */}
          <div className="lg:col-span-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5">
            <div className="text-sm font-medium text-zinc-500 mb-3">Your current availability</div>

            {loadingAvail ? (
              <div className="text-sm text-zinc-400 py-6">Loading…</div>
            ) : availability.length === 0 ? (
              <div className="text-sm text-zinc-500 py-6">No recurring availability blocks yet. Add some below.</div>
            ) : (
              <ul className="space-y-2">
                {availability.map((block) => {
                  const dayLabel = block.day_of_week !== null ? DAYS[block.day_of_week] : (block.specific_date || 'One-off');
                  return (
                    <li key={block.id} className="flex items-center justify-between rounded-xl border border-zinc-100 dark:border-zinc-800 px-4 py-2 text-sm">
                      <div>
                        <span className="font-medium">{dayLabel}</span>
                        <span className="mx-2 text-zinc-400">•</span>
                        <span className="font-mono">{block.start_time} – {block.end_time}</span>
                      </div>
                      <button
                        onClick={() => deleteAvailability(block.id)}
                        className="text-red-600 hover:text-red-500 text-xs px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-950"
                      >
                        Delete
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Add new block */}
          <div className="lg:col-span-2 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5">
            <div className="text-sm font-medium text-zinc-500 mb-3">Add weekly block</div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Day of week</label>
                <select
                  value={newDow}
                  onChange={(e) => setNewDow(parseInt(e.target.value, 10))}
                  className="w-full border border-zinc-300 dark:border-zinc-700 bg-transparent rounded-xl px-3 py-2 text-sm"
                >
                  {DAYS.map((d, i) => (
                    <option key={i} value={i}>{d}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Start time</label>
                  <input
                    type="time"
                    value={newStart}
                    onChange={(e) => setNewStart(e.target.value)}
                    className="w-full border border-zinc-300 dark:border-zinc-700 bg-transparent rounded-xl px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">End time</label>
                  <input
                    type="time"
                    value={newEnd}
                    onChange={(e) => setNewEnd(e.target.value)}
                    className="w-full border border-zinc-300 dark:border-zinc-700 bg-transparent rounded-xl px-3 py-2 text-sm font-mono"
                  />
                </div>
              </div>

              {availError && <div className="text-xs text-red-600">{availError}</div>}

              <button
                onClick={addAvailability}
                disabled={adding}
                className="w-full mt-1 rounded-xl bg-black py-2.5 text-sm font-semibold text-white active:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-black dark:active:bg-zinc-200"
              >
                {adding ? 'Adding…' : '+ Add Availability Block'}
              </button>

              <p className="text-[10px] text-zinc-400">These blocks define when you are generally available for public bookings. Times are stored as-is (matching the public page behavior).</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-10 text-xs text-zinc-400 px-1">
        This dashboard is protected. API calls include credentials and are validated server-side with JWT.
      </div>
    </div>
  );
}
