import { createClient } from "@/lib/supabase/server";
import { InviteUserForm } from "./invite-user-form";
import { UserRow } from "./user-row";

export default async function AdminUsersPage() {
  const supabase = await createClient();

  const [{ data: users }, { data: memberships }] = await Promise.all([
    supabase.from("users").select("id, email, is_master, is_external").order("email"),
    supabase.from("lab_memberships").select("user_id, labs(name)"),
  ]);

  const labNamesByUser = new Map<string, string[]>();
  for (const m of memberships ?? []) {
    const lab = m.labs as unknown as { name: string } | null;
    if (!lab) continue;
    const existing = labNamesByUser.get(m.user_id) ?? [];
    existing.push(lab.name);
    labNamesByUser.set(m.user_id, existing);
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="mb-4 text-lg font-semibold">Invite a user</h2>
        <InviteUserForm />
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold">All users</h2>
        <div className="divide-y rounded-md border">
          {users?.map((u) => (
            <UserRow
              key={u.id}
              userId={u.id}
              email={u.email}
              isMaster={u.is_master}
              isExternal={u.is_external}
              labNames={labNamesByUser.get(u.id) ?? []}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
