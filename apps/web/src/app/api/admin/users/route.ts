import { z } from 'zod';
import { requireCaller, createAdminClient, HttpError, jsonError } from '@/lib/supabase-server';

export const runtime = 'nodejs';

const InviteSchema = z.object({
  email:      z.string().trim().email(),
  password:   z.string().min(8, 'Password must be at least 8 characters.'),
  firstName:  z.string().trim().min(1).max(60),
  lastName:   z.string().trim().min(1).max(60),
  role:       z.enum(['admin', 'staff']),
  employeeId: z.string().uuid().optional(),
  // Create a matching employee record and link it (staff who aren't on the roster yet).
  createEmployee: z.boolean().optional(),
});

// Creates a login for a new admin or staff member in the caller's organization.
export async function POST(req: Request) {
  try {
    const caller = await requireCaller(req);
    if (caller.role !== 'admin') throw new HttpError(403, 'Only admins can add users.');

    const parsed = InviteSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Invalid request.');
    const input = parsed.data;

    // The linked employee must belong to the caller's org (RLS-scoped lookup).
    if (input.employeeId) {
      const { data: emp } = await caller.client.from('employees')
        .select('id').eq('id', input.employeeId).maybeSingle();
      if (!emp) throw new HttpError(400, 'Employee not found in your organization.');
    }

    const admin = createAdminClient();
    let employeeId = input.employeeId ?? null;
    let createdEmployeeId: string | null = null;
    if (!employeeId && input.createEmployee) {
      const { data: emp, error: empErr } = await caller.client.from('employees').insert({
        org_id: caller.orgId, first_name: input.firstName, last_name: input.lastName,
        email: input.email, employment_type: 'full_time', is_active: true,
      }).select('id').single();
      if (empErr) throw new HttpError(500, empErr.message);
      employeeId = createdEmployeeId = emp.id;
    }
    // Undo the employee record if the login can't be created.
    const rollbackEmployee = async () => {
      if (createdEmployeeId) await admin.from('employees').delete().eq('id', createdEmployeeId);
    };

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: { first_name: input.firstName, last_name: input.lastName },
    });
    if (createErr || !created.user) {
      await rollbackEmployee();
      throw new HttpError(400, createErr?.message ?? 'Could not create user.');
    }

    const { error: profileErr } = await admin.from('user_profiles').insert({
      user_id: created.user.id,
      org_id: caller.orgId,
      role: input.role,
      first_name: input.firstName,
      last_name: input.lastName,
      email: input.email,
      employee_id: employeeId,
    });
    if (profileErr) {
      // Don't leave an orphaned login that can't reach any organization.
      await admin.auth.admin.deleteUser(created.user.id);
      await rollbackEmployee();
      throw new HttpError(500, profileErr.message);
    }

    return Response.json({ userId: created.user.id }, { status: 201 });
  } catch (e) {
    return jsonError(e);
  }
}
