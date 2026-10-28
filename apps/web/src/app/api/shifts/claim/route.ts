import { NextRequest } from 'next/server';
import { requireCaller, jsonError, HttpError } from '@/lib/supabase-server';
import { claim, staffContext } from '@/lib/open-shifts-server';

export const runtime = 'nodejs';

// The signed-in employee picks up an open shift (all rules re-checked).
export async function POST(req: NextRequest) {
  try {
    const caller = await requireCaller(req);
    const body = await req.json().catch(() => ({}));
    if (typeof body?.shiftId !== 'string') throw new HttpError(400, 'shiftId is required.');
    const { admin, employeeId } = await staffContext(caller);
    return Response.json(await claim(admin, employeeId, body.shiftId));
  } catch (e) {
    return jsonError(e);
  }
}
