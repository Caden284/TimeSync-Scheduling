import { createAdminClient, jsonError } from '@/lib/supabase-server';
import { addDaysISO, todayISO } from '@/lib/dates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Personal calendar feed (iCal). The unguessable token in the URL is the only
// credential, so calendar apps can subscribe without signing in; staff can
// replace it from My Schedule. Only shifts in published weeks are included.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function esc(v: string) {
  return v.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

// Lines longer than 75 octets are folded (RFC 5545 §3.1).
function fold(line: string) {
  const out: string[] = [];
  let rest = line;
  while (Buffer.byteLength(rest) > 75) {
    let cut = 75;
    while (Buffer.byteLength(rest.slice(0, cut)) > 75) cut--;
    out.push(rest.slice(0, cut));
    rest = ' ' + rest.slice(cut);
  }
  out.push(rest);
  return out.join('\r\n');
}

const stamp = (date: string, time: string) => `${date.replace(/-/g, '')}T${time.slice(0, 5).replace(':', '')}00`;

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const clean = token.replace(/\.ics$/, '');
    if (!UUID.test(clean)) return new Response('Not found', { status: 404 });

    const db = createAdminClient();
    const { data: emp } = await db.from('employees')
      .select('id, org_id, first_name, is_active').eq('calendar_token', clean).maybeSingle();
    if (!emp || !emp.is_active) return new Response('Not found', { status: 404 });

    const from = addDaysISO(todayISO(), -30), to = addDaysISO(todayISO(), 120);
    const [{ data: org }, { data: weeks }, { data: shifts, error }] = await Promise.all([
      db.from('organizations').select('name, timezone').eq('id', emp.org_id).maybeSingle(),
      db.from('schedules').select('week_start, week_end').eq('org_id', emp.org_id).eq('status', 'published')
        .lte('week_start', to).gte('week_end', from),
      db.from('shifts').select('id, date, start_time, end_time, title, location_name, notes, assigned_employee_names, assigned_employee_ids, updated_at')
        .eq('org_id', emp.org_id).contains('assigned_employee_ids', [emp.id]).gte('date', from).lte('date', to).order('date'),
    ]);
    if (error) throw new Error(error.message);
    const published = (d: string) => (weeks ?? []).some(w => d >= w.week_start && d <= w.week_end);

    const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const lines = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//TimeSync//Schedule//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      `X-WR-CALNAME:${esc(`${org?.name ?? 'TimeSync'} shifts`)}`,
      ...(org?.timezone ? [`X-WR-TIMEZONE:${org.timezone}`] : []),
      'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H',
    ];
    for (const s of (shifts ?? []).filter(s => published(s.date))) {
      const endDate = s.end_time.slice(0, 5) <= s.start_time.slice(0, 5) ? addDaysISO(s.date, 1) : s.date;
      const others = (s.assigned_employee_names ?? []).filter((_: string, i: number) => s.assigned_employee_ids[i] !== emp.id);
      const desc = [others.length ? `With ${others.join(', ')}` : '', s.notes ?? ''].filter(Boolean).join('\n');
      lines.push(
        'BEGIN:VEVENT',
        `UID:${s.id}@timesync`,
        `DTSTAMP:${now}`,
        `LAST-MODIFIED:${new Date(s.updated_at).toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')}`,
        // Floating local times: shown at the organization's wall-clock time.
        `DTSTART:${stamp(s.date, s.start_time)}`,
        `DTEND:${stamp(endDate, s.end_time)}`,
        `SUMMARY:${esc(s.title ?? 'Shift')}`,
        ...(s.location_name ? [`LOCATION:${esc(s.location_name)}`] : []),
        ...(desc ? [`DESCRIPTION:${esc(desc)}`] : []),
        'END:VEVENT',
      );
    }
    lines.push('END:VCALENDAR');

    return new Response(lines.map(fold).join('\r\n') + '\r\n', {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="timesync.ics"',
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (e) {
    return jsonError(e);
  }
}
