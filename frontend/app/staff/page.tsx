'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function isAdmin(role?: string | null) {
  return (role || '').toLowerCase() === 'admin';
}

interface Staff {
  id: number;
  name: string;
  email: string;
  role: string | null;
  department: string | null;
  phone: string | null;
  notes: string | null;
}

export default function StaffPage() {
  const router = useRouter();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', email: '', role: '', department: '', phone: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadStaff() {
    try {
      const res = await fetch(`${API}/api/staff`, { credentials: 'include' });
      if (res.status === 401) {
        router.replace('/login');
        return;
      }
      if (res.status === 403) {
        router.replace('/dashboard');
        return;
      }
      const data = await res.json();
      setStaff(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setError('Failed to load staff. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetch(`${API}/api/auth/me`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        if (!isAdmin(data.user?.role)) {
          router.replace('/dashboard');
          return;
        }
        loadStaff();
      })
      .catch(() => router.replace('/login'));
  }, [router]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to add');
      }
      setForm({ name: '', email: '', role: '', department: '', phone: '' });
      await loadStaff();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this staff member?')) return;
    try {
      await fetch(`${API}/api/staff/${id}`, { method: 'DELETE', credentials: 'include' });
      await loadStaff();
    } catch (e) {
      alert('Delete failed');
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tighter">Staff</h1>
          <p className="text-zinc-600 dark:text-zinc-400">Manage team members available for bookings</p>
        </div>
        <div className="text-sm text-zinc-500">{staff.length} total</div>
      </div>

      {/* Add form */}
      <form onSubmit={handleAdd} className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-3 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <input
          className="border border-zinc-300 dark:border-zinc-700 bg-transparent rounded-xl px-4 py-2 text-sm"
          placeholder="Full name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <input
          className="border border-zinc-300 dark:border-zinc-700 bg-transparent rounded-xl px-4 py-2 text-sm"
          placeholder="Email address"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
        />
        <input
          className="border border-zinc-300 dark:border-zinc-700 bg-transparent rounded-xl px-4 py-2 text-sm"
          placeholder="Role (e.g. Therapist)"
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value })}
        />
        <input
          className="border border-zinc-300 dark:border-zinc-700 bg-transparent rounded-xl px-4 py-2 text-sm"
          placeholder="Department"
          value={form.department}
          onChange={(e) => setForm({ ...form, department: e.target.value })}
        />
        <input
          className="border border-zinc-300 dark:border-zinc-700 bg-transparent rounded-xl px-4 py-2 text-sm md:col-span-2"
          placeholder="Phone (optional)"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
        <button
          type="submit"
          disabled={submitting}
          className="md:col-span-2 mt-1 rounded-xl bg-black dark:bg-white text-white dark:text-black py-2.5 text-sm font-medium disabled:opacity-50"
        >
          {submitting ? 'Adding...' : '+ Add Staff Member'}
        </button>
        {error && <p className="md:col-span-2 text-sm text-red-600">{error}</p>}
      </form>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-sm text-zinc-400">Loading staff...</div>
      ) : staff.length === 0 ? (
        <div className="text-center py-12 border border-dashed rounded-2xl text-zinc-400">
          No staff members yet. Use the form above to add your first one.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-100 dark:bg-zinc-900 text-left">
              <tr>
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Role / Dept</th>
                <th className="px-5 py-3 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 bg-white dark:bg-zinc-950">
              {staff.map((s) => (
                <tr key={s.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/60">
                  <td className="px-5 py-3 font-medium">{s.name}</td>
                  <td className="px-5 py-3 text-zinc-600 dark:text-zinc-400">{s.email}</td>
                  <td className="px-5 py-3 text-zinc-500">{[s.role, s.department].filter(Boolean).join(' • ') || '—'}</td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => handleDelete(s.id)} className="text-red-600 hover:text-red-500 text-xs">Delete</button>
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
