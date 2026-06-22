'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface AuthUser {
  id: number;
  name: string;
  email: string;
  role?: string | null;
}

const publicLinks = [
  { href: '/', label: 'Home' },
  { href: '/book', label: 'Book Now' },
  { href: '/login', label: 'Login' },
];

const trainerLinks = [
  { href: '/dashboard', label: 'Trainer Dashboard' },
];

const adminLinks = [
  { href: '/admin', label: 'Admin Overview' },
  { href: '/staff', label: 'Staff' },
  { href: '/bookings', label: 'Bookings' },
  { href: '/schedule', label: 'Schedule' },
];

function isAdmin(role?: string | null) {
  return (role || '').toLowerCase() === 'admin';
}

export default function AppNav() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/auth/me`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user) setUser(data.user);
      })
      .finally(() => setChecked(true));
  }, []);

  const links = user
    ? isAdmin(user.role)
      ? adminLinks
      : [...trainerLinks, { href: '/book', label: 'Book Now' }]
    : publicLinks;

  return (
    <nav className="flex items-center gap-1 text-sm font-medium">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="px-4 py-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
        >
          {link.label}
        </Link>
      ))}
      {checked && user && (
        <span className="hidden lg:inline text-xs text-zinc-400 ml-2">
          {user.name} ({user.role || 'staff'})
        </span>
      )}
    </nav>
  );
}