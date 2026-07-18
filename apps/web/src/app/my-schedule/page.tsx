'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { getShifts } from '@/lib/db';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from 'date-fns';
import { ChevronLeft, ChevronRight, Zap, LogOut, Clock, MapPin, Users } from 'lucide-react';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function MySchedulePage() {
  const { user, profile, logout, loading } = useAuth();
  const router = useRouter();
  const [weekBase, setWeekBase] = useState(new Date());
  const [shifts, setShifts] = useState<any[]>([]);
  const [fetching, setFetching] = useState(true);

  const wStart = startOfWeek(weekBase, { weekStartsOn: 0 });
  const wEnd   = endOfWeek(weekBase,   { weekStartsOn: 0 });
  const weekLabel = `${format(wStart, 'MMM d')} – ${format(wEnd, 'MMM d, yyyy')}`;

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace('/login'); return; }
  }, [loading, user]);

  useEffect(() => {
    if (!profile?.orgId) return;
    setFetching(true);
    getShifts(profile.orgId, format(wStart, 'yyyy-MM-dd'), format(wEnd, 'yyyy-MM-dd'))
      .then(docs => {
        // Filter to shifts assigned to this employee
        const mine = docs.filter((s: any) => s.assignedEmployeeIds?.includes(profile.employeeId));
        setShifts(mine);
      })
      .finally(() => setFetching(false));
  }, [profile?.orgId, weekBase]);

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  // Group by day
  const byDay: Record<string, any[]> = {};
  for (let i = 0; i < 7; i++) {
    const d = format(addWeeks(wStart, 0), 'yyyy-MM-dd');
    const day = new Date(wStart);
    day.setDate(day.getDate() + i);
    byDay[format(day, 'yyyy-MM-dd')] = [];
  }
  shifts.forEach(s => {
    if (byDay[s.date]) byDay[s.date].push(s);
  });

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Zap size={16} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">TimeSync</p>
            <p className="text-xs text-gray-500">My Schedule</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-medium text-white">{profile?.firstName} {profile?.lastName}</p>
            <p className="text-xs text-gray-500 capitalize">{profile?.role}</p>
          </div>
          <button onClick={handleLogout}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-gray-400 hover:text-red-400 hover:bg-gray-800 transition-colors">
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </header>

      {/* Week nav */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <button onClick={() => setWeekBase(w => subWeeks(w, 1))}
          className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors">
          <ChevronLeft size={18} />
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold text-white">{weekLabel}</p>
          <p className="text-xs text-gray-500">{shifts.length} shift{shifts.length !== 1 ? 's' : ''} this week</p>
        </div>
        <button onClick={() => setWeekBase(w => addWeeks(w, 1))}
          className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors">
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Week grid */}
      <div className="flex-1 p-6">
        {fetching ? (
          <div className="flex items-center justify-center h-48">
            <div className="h-6 w-6 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-3">
            {Object.entries(byDay).map(([date, dayShifts], i) => {
              const d = new Date(date + 'T12:00:00');
              const isToday = format(new Date(), 'yyyy-MM-dd') === date;
              return (
                <div key={date} className="min-h-32">
                  <div className={`text-center mb-2 pb-2 border-b border-gray-800`}>
                    <p className="text-xs text-gray-500">{DAY_LABELS[i]}</p>
                    <p className={`text-lg font-bold mt-0.5 ${isToday ? 'text-indigo-400' : 'text-white'}`}>
                      {format(d, 'd')}
                    </p>
                  </div>
                  <div className="space-y-2">
                    {dayShifts.length === 0 ? (
                      <p className="text-xs text-gray-700 text-center pt-2">–</p>
                    ) : dayShifts.map((s: any) => (
                      <div key={s.$id} className="rounded-lg p-2.5 text-xs" style={{ backgroundColor: (s.color ?? '#6366f1') + '25', borderLeft: `3px solid ${s.color ?? '#6366f1'}` }}>
                        <p className="font-semibold text-white truncate">{s.title ?? 'Shift'}</p>
                        <div className="flex items-center gap-1 mt-1 text-gray-400">
                          <Clock size={10} />
                          <span>{s.startTime?.slice(0,5)} – {s.endTime?.slice(0,5)}</span>
                        </div>
                        {s.locationName && (
                          <div className="flex items-center gap-1 mt-0.5 text-gray-500">
                            <MapPin size={10} />
                            <span className="truncate">{s.locationName}</span>
                          </div>
                        )}
                        {s.departmentName && (
                          <div className="flex items-center gap-1 mt-0.5 text-gray-500">
                            <Users size={10} />
                            <span className="truncate">{s.departmentName}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!fetching && shifts.length === 0 && (
          <div className="text-center py-16">
            <p className="text-gray-600 text-sm">No shifts scheduled for this week.</p>
            <p className="text-gray-700 text-xs mt-1">Check back after your manager publishes the schedule.</p>
          </div>
        )}
      </div>
    </div>
  );
}
