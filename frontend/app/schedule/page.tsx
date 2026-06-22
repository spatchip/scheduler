'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function isAdmin(role?: string | null) {
  return (role || '').toLowerCase() === 'admin';
}

interface Staff { id: number; name: string; }
interface Booking {
  id: number;
  staff_name: string;
  client_name: string;
  start_time: string;
  end_time: string;
  status: string;
}
interface Availability {
  id: number;
  staff_name: string;
  start_time: string;
  end_time: string;
  day_of_week: number | null;
  specific_date: string | null;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function SchedulePage() {
  const router = useRouter();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<string>('');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/auth/me`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        if (!isAdmin(data.user?.role)) {
          router.replace('/dashboard');
          return;
        }
        return fetch(`${API}/api/staff`, { credentials: 'include' });
      })
      .then((r) => r?.json())
      .then((d) => {
        if (Array.isArray(d)) {
          setStaff(d);
          if (d.length > 0) setSelectedStaff(String(d[0].id));
        }
      })
      .catch(() => router.replace('/login'));
  }, [router]);

  useEffect(() => {
    if (!selectedStaff) return;
    setLoading(true);
    Promise.all([
      fetch(`${API}/api/bookings?staffId=${selectedStaff}`, { credentials: 'include' }).then(r => r.json()),
      fetch(`${API}/api/availability?staffId=${selectedStaff}`, { credentials: 'include' }).then(r => r.json()),
    ]).then(([b, a]) => {
      setBookings(Array.isArray(b) ? b : []);
      setAvailability(Array.isArray(a) ? a : []);
    }).finally(() => setLoading(false));
  }, [selectedStaff]);

  const upcoming = [...bookings]
    .filter(b => b.status !== 'cancelled')
    .sort((x, y) => new Date(x.start_time).getTime() - new Date(y.start_time).getTime())
    .slice(0, 12);

  return (
    <div>
      <div className="flex justify-between items-baseline mb-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tighter">Schedule</h1>
          <p className="text-zinc-600 dark:text-zinc-400">Availability and upcoming bookings per staff member</p>
        </div>
        <select
          value={selectedStaff}
          onChange={(e) => setSelectedStaff(e.target.value)}
          className="border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-xl px-4 py-2 text-sm"
        >
          {staff.length === 0 && <option value="">No staff yet</option>}
          {staff.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {loading && <div className="text-sm py-4">Loading schedule…</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Availability */}
        <div>
          <h2 className="font-semibold mb-3 px-1 text-sm tracking-wider text-zinc-500">RECURRING / DECLARED AVAILABILITY</h2>
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 min-h-[220px]">
            {availability.length === 0 ? (
              <p className="text-sm text-zinc-400">No availability entries for this staff member yet. (Use backend API or SQL to add.)</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {availability.map(a => (
                  <li key={a.id} className="flex justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2 last:border-0 last:pb-0">
                    <div>
                      {a.day_of_week !== null ? DAYS[a.day_of_week] : a.specific_date}
                    </div>
                    <div className="font-mono">{a.start_time} – {a.end_time}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="mt-2 text-[10px] text-zinc-400 px-1">Add recurring availability via the API <code>/api/availability</code></p>
        </div>

        {/* Bookings for person */}
        <div>
          <h2 className="font-semibold mb-3 px-1 text-sm tracking-wider text-zinc-500">UPCOMING BOOKINGS</h2>
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
            {upcoming.length === 0 ? (
              <div className="p-8 text-sm text-center text-zinc-400">No upcoming bookings for selected staff.</div>
            ) : (
              <ul className="divide-y text-sm divide-zinc-100 dark:divide-zinc-800">
                {upcoming.map(b => (
                  <li key={b.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <span className="font-medium">{b.client_name}</span>
                      <span className="text-zinc-400 mx-1">·</span>
                      <span className="font-mono text-xs text-zinc-500">
                        {new Date(b.start_time).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <div className="font-mono text-xs text-right text-zinc-500">
                      {new Date(b.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {new Date(b.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8 text-xs bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
        This is a starter schedule view. In a real app you would integrate a full calendar (react-big-calendar, fullcalendar, or Cal.com-style) + drag &amp; drop availability editing.
      </div>
    </div>
  );
}
