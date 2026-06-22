'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { DateTime } from 'luxon';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Staff {
  id: number;
  name: string;
  role: string | null;
  department: string | null;
}

interface Slot {
  start_time: string;
  end_time: string;
}

interface DaySlots {
  date: string;
  slots: Slot[];
}

interface SuccessBooking {
  id: number;
  staff_name?: string;
  localStart: DateTime;
  localEnd: DateTime;
  client_name: string;
}

export default function PublicBookingPage() {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null);
  const [slotsByDate, setSlotsByDate] = useState<Record<string, Slot[]>>({});
  const [loading, setLoading] = useState(true);

  const [selectedDate, setSelectedDate] = useState<DateTime | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [bookError, setBookError] = useState<string | null>(null);
  const [successBooking, setSuccessBooking] = useState<SuccessBooking | null>(null);

  const next14Days = useMemo(() => {
    const start = DateTime.now().startOf('day');
    return Array.from({ length: 14 }, (_, i) => start.plus({ days: i }));
  }, []);

  const rangeFrom = next14Days[0]?.toISODate();
  const rangeTo = next14Days[next14Days.length - 1]?.toISODate();

  const fetchSlots = useCallback(async (staffId: number) => {
    if (!rangeFrom || !rangeTo) return;

    const res = await fetch(
      `${API}/api/slots?staffId=${staffId}&from=${rangeFrom}&to=${rangeTo}`
    );
    if (!res.ok) throw new Error('Failed to load available slots');

    const data = await res.json();
    const days: DaySlots[] = Array.isArray(data.days) ? data.days : [];
    const map: Record<string, Slot[]> = {};
    for (const day of days) {
      map[day.date] = day.slots;
    }
    setSlotsByDate(map);
  }, [rangeFrom, rangeTo]);

  useEffect(() => {
    fetch(`${API}/api/staff`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const minimalStaff: Staff[] = data.map((s: Staff) => ({
            id: s.id,
            name: s.name,
            role: s.role,
            department: s.department,
          }));
          setStaffList(minimalStaff);
          setSelectedStaffId(minimalStaff[0].id);
        }
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedStaffId) return;

    setLoading(true);
    setSelectedDate(null);
    setSelectedSlot(null);
    setSuccessBooking(null);
    setBookError(null);
    setSlotsByDate({});

    fetchSlots(selectedStaffId)
      .catch(() => setSlotsByDate({}))
      .finally(() => setLoading(false));
  }, [selectedStaffId, fetchSlots]);

  useEffect(() => {
    if (!selectedStaffId || loading) return;

    const firstWithSlots = next14Days.find((d) => {
      const dateStr = d.toISODate()!;
      return (slotsByDate[dateStr]?.length ?? 0) > 0;
    });

    if (firstWithSlots) {
      setSelectedDate(firstWithSlots);
    } else if (next14Days.length > 0) {
      setSelectedDate(next14Days[0]);
    }
  }, [selectedStaffId, slotsByDate, next14Days, loading]);

  const freeSlotsForSelected = useMemo(() => {
    if (!selectedDate) return [];
    return slotsByDate[selectedDate.toISODate()!] ?? [];
  }, [selectedDate, slotsByDate]);

  function selectStaff(id: number) {
    if (id === selectedStaffId) return;
    setSelectedStaffId(id);
  }

  function selectDate(date: DateTime) {
    setSelectedDate(date);
    setSelectedSlot(null);
  }

  function selectTimeSlot(slot: Slot) {
    setSelectedSlot(slot);
    setBookError(null);
    setTimeout(() => {
      const formEl = document.getElementById('booking-form');
      if (formEl) formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  async function handleBookingSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedStaffId || !selectedSlot || !clientName.trim() || !clientEmail.trim()) {
      setBookError('Please fill in your name and email.');
      return;
    }

    setSubmitting(true);
    setBookError(null);

    const payload = {
      staff_id: selectedStaffId,
      start_time: selectedSlot.start_time,
      end_time: selectedSlot.end_time,
      client_name: clientName.trim(),
      client_email: clientEmail.trim(),
      client_phone: clientPhone.trim() || null,
      notes: notes.trim() || null,
    };

    try {
      const res = await fetch(`${API}/api/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Could not create booking. The slot may no longer be available.');
      }

      const created = await res.json();

      const localStart = DateTime.fromISO(selectedSlot.start_time, { zone: 'utc' }).setZone('local');
      const localEnd = DateTime.fromISO(selectedSlot.end_time, { zone: 'utc' }).setZone('local');

      setSuccessBooking({
        id: created.id,
        localStart,
        localEnd,
        client_name: clientName.trim(),
      });

      await fetchSlots(selectedStaffId);

      setSelectedSlot(null);
      setClientName('');
      setClientEmail('');
      setClientPhone('');
      setNotes('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setBookError(message);
    } finally {
      setSubmitting(false);
    }
  }

  function resetForNewBooking() {
    setSuccessBooking(null);
    setSelectedSlot(null);
    setClientName('');
    setClientEmail('');
    setClientPhone('');
    setNotes('');
    setBookError(null);
  }

  const tzName = DateTime.local().zoneName || 'your local time';

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-semibold tracking-tighter">Book an Appointment</h1>
        <p className="mt-2 text-xl text-zinc-600 dark:text-zinc-400">
          Select a team member and choose a time. All times are shown in your local timezone.
        </p>
        <p className="mt-1 text-sm text-zinc-500">
          Current timezone: <span className="font-mono">{tzName}</span>
        </p>
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="text-sm font-medium tracking-wider text-zinc-500">SELECT TEAM MEMBER</div>
          {loading && <div className="text-xs text-zinc-400">Loading…</div>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {staffList.length === 0 && !loading && (
            <div className="col-span-full text-sm text-zinc-500 border border-dashed rounded-2xl p-6 text-center">
              No staff members available yet.
            </div>
          )}
          {staffList.map((staff) => {
            const isSelected = staff.id === selectedStaffId;
            return (
              <button
                key={staff.id}
                onClick={() => selectStaff(staff.id)}
                className={`text-left border rounded-2xl p-5 transition-all ${
                  isSelected
                    ? 'border-black dark:border-white ring-2 ring-black/10 dark:ring-white/20 bg-zinc-50 dark:bg-zinc-900'
                    : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 bg-white dark:bg-zinc-950'
                }`}
              >
                <div className="font-semibold text-lg tracking-tight">{staff.name}</div>
                <div className="text-sm text-zinc-500 mt-0.5">
                  {[staff.role, staff.department].filter(Boolean).join(' • ') || 'Team Member'}
                </div>
                {isSelected && <div className="mt-3 text-xs text-emerald-600 font-medium">SELECTED</div>}
              </button>
            );
          })}
        </div>
      </div>

      {selectedStaffId && (
        <>
          <div className="mb-8">
            <div className="flex items-baseline justify-between mb-3 px-1">
              <div>
                <div className="text-sm font-medium tracking-wider text-zinc-500">CHOOSE A DATE</div>
                <div className="text-xs text-zinc-400">Next 2 weeks • times shown in local timezone</div>
              </div>
              {selectedDate && (
                <div className="text-sm text-zinc-500">
                  {selectedDate.toFormat('cccc, LLL dd')}
                </div>
              )}
            </div>

            <div className="flex gap-2.5 overflow-x-auto pb-3 snap-x snap-mandatory -mx-1 px-1 scrollbar-thin">
              {next14Days.map((date) => {
                const dateStr = date.toISODate()!;
                const numFree = slotsByDate[dateStr]?.length ?? 0;
                const isSelected = selectedDate?.toISODate() === dateStr;
                const isToday = dateStr === DateTime.now().toISODate();

                return (
                  <button
                    key={dateStr}
                    onClick={() => selectDate(date)}
                    disabled={numFree === 0}
                    className={`snap-start flex-shrink-0 w-[78px] rounded-2xl border p-3 text-center transition-all active:scale-[0.985] ${
                      isSelected
                        ? 'border-black dark:border-white bg-black dark:bg-white text-white dark:text-black'
                        : numFree > 0
                        ? 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900'
                        : 'border-zinc-100 dark:border-zinc-900 bg-zinc-100 dark:bg-zinc-900 text-zinc-400 cursor-not-allowed'
                    }`}
                  >
                    <div className={`text-[10px] font-medium tracking-widest ${isSelected ? 'text-white/70 dark:text-black/70' : 'text-zinc-500'}`}>
                      {date.toFormat('ccc').toUpperCase()}
                    </div>
                    <div className="text-2xl font-semibold tabular-nums mt-0.5">{date.toFormat('dd')}</div>
                    <div className={`text-[10px] mt-1 ${isSelected ? 'text-white/60' : numFree > 0 ? 'text-emerald-600' : 'text-zinc-400'}`}>
                      {isToday && 'TODAY • '}
                      {numFree > 0 ? `${numFree} slot${numFree === 1 ? '' : 's'}` : 'Fully booked'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedDate && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-3 px-1">
                <div>
                  <span className="text-sm font-medium tracking-wider text-zinc-500">AVAILABLE TIMES</span>{' '}
                  <span className="text-sm text-zinc-400">on {selectedDate.toFormat('cccc, LLL dd')}</span>
                </div>
                <div className="text-xs text-emerald-600">All times in {tzName}</div>
              </div>

              {loading ? (
                <div className="text-sm text-zinc-400 py-8">Loading availability…</div>
              ) : freeSlotsForSelected.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-zinc-500">
                  No available time slots on this date (or all slots are already booked).
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {freeSlotsForSelected.map((slot) => {
                    const localStart = DateTime.fromISO(slot.start_time, { zone: 'utc' }).setZone('local');
                    const localEnd = DateTime.fromISO(slot.end_time, { zone: 'utc' }).setZone('local');
                    const isSel = selectedSlot?.start_time === slot.start_time;
                    return (
                      <button
                        key={slot.start_time}
                        onClick={() => selectTimeSlot(slot)}
                        className={`rounded-2xl border px-4 py-3 text-sm font-medium transition-all text-left ${
                          isSel
                            ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black'
                            : 'border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900'
                        }`}
                      >
                        {localStart.toFormat('h:mm a')} – {localEnd.toFormat('h:mm a')}
                        <div className="text-[10px] text-zinc-400 mt-0.5 font-normal">
                          {localStart.toFormat('ZZZZ')}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {selectedSlot && !successBooking && (
            <div id="booking-form" className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 md:p-8 mb-8">
              <div className="mb-6">
                <div className="uppercase text-xs tracking-[2px] text-emerald-600 font-medium">Confirm your slot</div>
                <div className="text-2xl font-semibold tracking-tighter mt-1">
                  {DateTime.fromISO(selectedSlot.start_time, { zone: 'utc' }).setZone('local').toFormat('h:mm a')} –{' '}
                  {DateTime.fromISO(selectedSlot.end_time, { zone: 'utc' }).setZone('local').toFormat('h:mm a')}
                </div>
                <div className="text-sm text-zinc-500">{selectedDate?.toFormat('cccc, LLL dd yyyy')} • {tzName}</div>
              </div>

              <form onSubmit={handleBookingSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    type="text"
                    required
                    placeholder="Your full name"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="border border-zinc-300 dark:border-zinc-700 bg-transparent rounded-xl px-4 py-2.5 text-sm focus:ring-1 focus:ring-black dark:focus:ring-white outline-none"
                  />
                  <input
                    type="email"
                    required
                    placeholder="Email address"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    className="border border-zinc-300 dark:border-zinc-700 bg-transparent rounded-xl px-4 py-2.5 text-sm focus:ring-1 focus:ring-black dark:focus:ring-white outline-none"
                  />
                  <input
                    type="tel"
                    placeholder="Phone number (optional)"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    className="border border-zinc-300 dark:border-zinc-700 bg-transparent rounded-xl px-4 py-2.5 text-sm md:col-span-2 focus:ring-1 focus:ring-black dark:focus:ring-white outline-none"
                  />
                  <textarea
                    placeholder="Notes (optional)"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="border border-zinc-300 dark:border-zinc-700 bg-transparent rounded-2xl px-4 py-3 text-sm md:col-span-2 focus:ring-1 focus:ring-black dark:focus:ring-white outline-none"
                  />
                </div>

                {bookError && <div className="text-sm text-red-600">{bookError}</div>}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full mt-2 rounded-2xl bg-black py-3.5 text-sm font-semibold text-white active:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-black dark:active:bg-zinc-200"
                >
                  {submitting ? 'Confirming your booking…' : 'Confirm Booking'}
                </button>
                <p className="text-center text-xs text-zinc-400">You’ll receive a confirmation for this time slot.</p>
              </form>
            </div>
          )}

          {successBooking && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40 p-8 mb-8">
              <div className="text-emerald-600 text-sm font-medium tracking-widest">BOOKING CONFIRMED</div>
              <div className="mt-2 text-2xl font-semibold tracking-tighter text-emerald-900 dark:text-emerald-200">
                Thank you, {successBooking.client_name}!
              </div>
              <div className="mt-4 text-[15px] leading-relaxed text-emerald-800 dark:text-emerald-300">
                Your appointment is confirmed for <strong>{successBooking.localStart.toFormat('cccc, LLL dd')}</strong> at{' '}
                <strong>{successBooking.localStart.toFormat('h:mm a')} – {successBooking.localEnd.toFormat('h:mm a')}</strong> (local time).
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  onClick={resetForNewBooking}
                  className="rounded-2xl border border-emerald-300 px-5 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:text-emerald-200 dark:hover:bg-emerald-950"
                >
                  Book another time
                </button>
                <button
                  onClick={() => {
                    setSuccessBooking(null);
                    setSelectedStaffId(null);
                    setSelectedDate(null);
                    setSelectedSlot(null);
                  }}
                  className="rounded-2xl px-5 py-2 text-sm font-medium text-emerald-600 hover:text-emerald-800"
                >
                  Choose a different team member
                </button>
              </div>
            </div>
          )}

          {!selectedDate && !loading && selectedStaffId && (
            <div className="text-sm text-zinc-400 px-1">Select a date above to see available time slots.</div>
          )}
        </>
      )}

      {!selectedStaffId && !loading && (
        <div className="text-sm text-zinc-500 border border-dashed rounded-2xl p-8 text-center">
          Please select a team member above to view their availability.
        </div>
      )}

      <div className="mt-10 text-xs text-zinc-400 px-1">
        Available slots are computed server-side from staff availability and existing bookings. All times are displayed in your browser’s local timezone.
      </div>
    </div>
  );
}