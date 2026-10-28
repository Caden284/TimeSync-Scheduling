import { NextRequest } from 'next/server';
import { requireCaller, jsonError } from '@/lib/supabase-server';
import { listClaimable, staffContext } from '@/lib/open-shifts-server';

export const runtime = 'nodejs';

// Open shifts the signed-in employee could pick up.
export async function GET(req: NextRequest) {
  try {
    const caller = await requireCaller(req);
    const { admin, employeeId } = await staffContext(caller);
    return Response.json({ shifts: await listClaimable(admin, employeeId) });
  } catch (e) {
    return jsonError(e);
  }
}
