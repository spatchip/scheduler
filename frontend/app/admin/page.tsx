'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DateTime } from 'luxon';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface User {
  id: number;
  name: string;
  email: string;
  role?: string | null;
}

interface Staff {
  id: number;
  name: string;
}

interface Booking {
  id: number;
  staff_id: number;
  staff_name: string;
  client_name: string;
  client_email: string | null;
  start_time: string;
  end_time: string;
  status: string;
  service_type: string | null;
  notes: string | null;
}

function isAdmin(role?: string | null) {
  return (role || '').toLowerCase() === 'admin';
}

export default function AdminOverviewPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [filterStaffId, setFilterStaffId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => {
    fetch(`${API}/api/auth/me`, { credentials: 'include' })
      .then((r) => {
        if (!r.ok) throw new Error('unauthenticated');
        return r.json();
      })
      .then((data) => {
        if (!isAdmin(data.user?.role)) {
          router.replace('/dashboard');
          return;
        }
        setUser(data.user);
      })
      .catch(() => router.replace('/login'))
      .finally(() => setLoadingUser(false));
  }, [router]);

  async function loadAdminData() {
    setLoadingData(true);
    try {
      const params = new URLSearchParams();
      if (filterStaffId) params.set('staffId', filterStaffId);
      if (filterStatus) params.set('status', filterStatus);
      const qs = params.toString();

      const [bookingsRes, staffRes] = await Promise.all([
        fetch(`${API}/api/bookings${qs ? `?${qs}` : ''}`, { credentials: 'include' }),
        fetch(`${API}/api/staff`, { credentials: 'include' }),
      ]);

      if (bookingsRes.status === 403 || staffRes.status === 403) {
        router.replace('/dashboard');
        return;
      }

      const bookingsData = await bookingsRes.json();
      const staffData = await staffRes.json();
      setBookings(Array.isArray(bookingsData) ? bookingsData : []);
      setStaff(Array.isArray(staffData) ? staffData.map((s: Staff) => ({ id: s.id, name: s.name })) : []);
    } catch {
      setBookings([]);
      setStaff([]);
    } finally {
      setLoadingData(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    loadAdminData();
  }, [user, filterStaffId, filterStatus]);

  async function cancelBooking(id: number) {
    if (!confirm('Mark this booking as cancelled?')) return;
    try {
      const res = await fetch(`${API}/api/bookings/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'cancelled' }),
      });
      if (!res.ok) throw new Error('Cancel failed');
      await loadAdminData();
    } catch {
      alert('Failed to cancel booking');
    }
  }

  async function handleLogout() {
    await fetch(`${API}/api/auth/logout`, { method: 'POST', credentials: 'include' });
    router.replace('/login');
  }

  function formatWhen(iso: string) {
    return DateTime.fromISO(iso, { zone: 'utc' }).setZone('local').toFormat('ccc, LLL dd • h:mm a');
  }

  if (loadingUser) {
    return <div className="text-center py-12 text-sm text-zinc-500">Loading admin overview…</div>;
  }

  if (!user) return null;

  const confirmedCount = bookings.filter((b) => b.status === 'confirmed').length;
  const cancelledCount = bookings.filter((b) => b.status === 'cancelled').length;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tighter">Admin Overview</h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Manage all trainers&apos; bookings — signed in as <span className="font-medium">{user.name}</span>
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="self-start rounded-xl border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900"
        >
          Log out
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5">
          <div className="text-xs uppercase tracking-widest text-zinc-500 mb-1">Trainers</div>
          <div className="text-2xl font-semibold">{staff.length}</div>
        </div>
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5">
          <div className="text-xs uppercase tracking-widest text-zinc-500 mb-1">Confirmed</div>
          <div className="text-2xl font-semibold text-emerald-600">{confirmedCount}</div>
        </div>
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5">
          <div className="text-xs uppercase tracking-widest text-zinc-500 mb-1">Cancelled</div>
          <div className="text-2xl font-semibold text-red-500">{cancelledCount}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <Link href="/staff" className="rounded-xl border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900">
          Manage Staff
        </Link>
        <Link href="/schedule" className="rounded-xl border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900">
          View Schedules
        </Link>
        <Link href="/bookings" className="rounded-xl border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900">
          Full Bookings Admin
        </Link>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={filterStaffId}
          onChange={(e) => setFilterStaffId(e.target.value)}
          className="border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm bg-transparent"
        >
          <option value="">All trainers</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm bg-transparent"
        >
          <option value="">All statuses</option>
          <option value="confirmed">Confirmed</option>
          <option value="cancelled">Cancelled</option>
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
        {loadingData ? (
          <div className="p-8 text-center text-sm text-zinc-400">Loading bookings…</div>
        ) : bookings.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-500">No bookings match the current filters.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-100 dark:bg-zinc-900 text-left text-xs tracking-wider text-zinc-500">
                <th className="px-5 py-3">When</th>
                <th className="px-5 py-3">Client</th>
                <th className="px-5 py-3">Trainer</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {bookings.map((b) => (
                <tr key={b.id}>
                  <td className="px-5 py-3 font-mono text-xs whitespace-nowrap">{formatWhen(b.start_time)}</td>
                  <td className="px-5 py-3">
                    {b.client_name}
                    {b.client_email && <div className="text-[11px] text-zinc-400">{b.client_email}</div>}
                  </td>
                  <td className="px-5 py-3">{b.staff_name}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-block rounded px-2 py-0.5 text-xs ${
                      b.status === 'cancelled'
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30'
                    }`}>
                      {b.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {b.status !== 'cancelled' && (
                      <button onClick={() => cancelBooking(b.id)} className="text-red-600 text-xs hover:underline">
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}