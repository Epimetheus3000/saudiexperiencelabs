"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { addMembership, removeMembership } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Member = {
  membershipId: string;
  userId: string;
  email: string;
  isExternal: boolean;
};

type AvailableUser = {
  id: string;
  email: string;
  isExternal: boolean;
};

export function MembershipManager({
  labId,
  members,
  availableUsers,
}: {
  labId: string;
  members: Member[];
  availableUsers: AvailableUser[];
}) {
  const [isPending, startTransition] = useTransition();

  function onAdd(userId: string | null) {
    if (!userId) return;
    startTransition(async () => {
      const result = await addMembership(userId, labId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Member added");
    });
  }

  function onRemove(membershipId: string) {
    startTransition(async () => {
      const result = await removeMembership(membershipId, labId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Member removed");
    });
  }

  return (
    <div className="space-y-4">
      <div className="divide-y rounded-md border">
        {members.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">No members yet.</p>
        )}
        {members.map((m) => (
          <div key={m.membershipId} className="flex items-center justify-between px-4 py-2">
            <div className="flex items-center gap-2">
              <span className="text-sm">{m.email}</span>
              <Badge variant={m.isExternal ? "secondary" : "outline"}>
                {m.isExternal ? "Partner" : "Team member"}
              </Badge>
            </div>
            <Button
              size="sm"
              variant="ghost"
              disabled={isPending}
              onClick={() => onRemove(m.membershipId)}
            >
              Remove
            </Button>
          </div>
        ))}
      </div>

      {availableUsers.length > 0 && (
        <Select onValueChange={onAdd} disabled={isPending}>
          <SelectTrigger className="w-72">
            <SelectValue placeholder="Add a member…" />
          </SelectTrigger>
          <SelectContent>
            {availableUsers.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.email} {u.isExternal ? "(Partner)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
