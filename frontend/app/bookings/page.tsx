'use client';

import { useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    staff_id: '',
    client_name: '',
    client_email: '',
    start_time: '',
    end_time: '',
    service_type: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  async function loadAll() {
    try {
      const [bRes, sRes] = await Promise.all([
        fetch(`${API}/api/bookings`),
        fetch(`${API}/api/staff`),
      ]);
      const bData = await bRes.json();
      const sData = await sRes.json();
      setBookings(Array.isArray(bData) ? bData : []);
      setStaff(Array.isArray(sData) ? sData : []);
    } catch (e) {
      setError('Failed to load data — make sure backend + DB are running');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function createBooking(e: React.FormEvent) {
    e.preventDefault();
    if (!form.staff_id || !form.client_name || !form.start_time || !form.end_time) {
      setError('Please fill required fields');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          staff_id: Number(form.staff_id),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Create failed');
      }
      setForm({ staff_id: '', client_name: '', client_email: '', start_time: '', end_time: '', service_type: '', notes: '' });
      await loadAll();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelBooking(id: number) {
    if (!confirm('Cancel this booking?')) return;
    try {
      await fetch(`${API}/api/bookings/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      });
      await loadAll();
    } catch {
      alert('Failed to cancel');
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tighter mb-1">Bookings</h1>
      <p className="text-zinc-600 dark:text-zinc-400 mb-6">Create and manage appointments</p>

      {/* Create booking form */}
      <form onSubmit={createBooking} className="mb-10 grid grid-cols-1 md:grid-cols-2 gap-x-3 gap-y-3 p-6 rounded-2xl border bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
        <div className="md:col-span-2 font-medium text-sm mb-1 text-zinc-500">New Booking</div>

        <select
          className="border border-zinc-300 dark:border-zinc-700 rounded-xl bg-transparent px-4 py-2 text-sm"
          value={form.staff_id}
          onChange={(e) => setForm({ ...form, staff_id: e.target.value })}
          required
        >
          <option value="">Select staff member…</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Client name"
          className="border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm bg-transparent"
          value={form.client_name}
          onChange={(e) => setForm({ ...form, client_name: e.target.value })}
          required
        />

        <input
          type="datetime-local"
          className="border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm bg-transparent font-mono"
          value={form.start_time}
          onChange={(e) => setForm({ ...form, start_time: e.target.value })}
          required
        />
        <input
          type="datetime-local"
          className="border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm bg-transparent font-mono"
          value={form.end_time}
          onChange={(e) => setForm({ ...form, end_time: e.target.value })}
          required
        />

        <input
          type="email"
          placeholder="Client email (optional)"
          className="border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm bg-transparent"
          value={form.client_email}
          onChange={(e) => setForm({ ...form, client_email: e.target.value })}
        />
        <input
          type="text"
          placeholder="Service / type (optional)"
          className="border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm bg-transparent"
          value={form.service_type}
          onChange={(e) => setForm({ ...form, service_type: e.target.value })}
        />

        <textarea
          placeholder="Notes"
          className="md:col-span-2 border border-zinc-300 dark:border-zinc-700 rounded-2xl px-4 py-3 text-sm bg-transparent min-h-[60px]"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />

        <button
          disabled={submitting}
          className="md:col-span-2 mt-2 rounded-xl bg-black dark:bg-white text-white dark:text-black py-2.5 font-medium disabled:opacity-60"
        >
          {submitting ? 'Creating booking...' : 'Create Booking'}
        </button>
        {error && <div className="md:col-span-2 text-sm text-red-600">{error}</div>}
      </form>

      {/* Bookings table */}
      <h2 className="font-medium mb-3 px-1">All Bookings</h2>
      {loading ? (
        <div className="text-sm py-8 text-center text-zinc-400">Loading...</div>
      ) : bookings.length === 0 ? (
        <div className="border border-dashed rounded-2xl p-8 text-center text-zinc-400">No bookings yet.</div>
      ) : (
        <div className="rounded-2xl border overflow-hidden border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-100 dark:bg-zinc-950 text-left text-xs tracking-wider text-zinc-500">
                <th className="px-5 py-3">When</th>
                <th className="px-5 py-3">Client</th>
                <th className="px-5 py-3">Staff</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {bookings.map((b) => (
                <tr key={b.id}>
                  <td className="px-5 py-3 font-mono text-xs whitespace-nowrap">
                    {new Date(b.start_time).toLocaleString([], { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' })} — {new Date(b.end_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </td>
                  <td className="px-5 py-3">
                    {b.client_name}
                    {b.client_email && <div className="text-[11px] text-zinc-400">{b.client_email}</div>}
                  </td>
                  <td className="px-5 py-3">{b.staff_name}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-block rounded px-2 py-0.5 text-xs ${b.status === 'cancelled' ? 'bg-red-100 text-red-700 dark:bg-red-900/30' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30'}`}>
                      {b.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {b.status !== 'cancelled' && (
                      <button onClick={() => cancelBooking(b.id)} className="text-red-600 text-xs hover:underline">Cancel</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
