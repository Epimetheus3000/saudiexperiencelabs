"use client";

import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { inviteUser } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function InviteUserForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await inviteUser(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Invite sent");
      formRef.current?.reset();
    });
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" placeholder="name@company.com" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="role">Role</Label>
        <Select name="role" defaultValue="team">
          <SelectTrigger id="role" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="team">Team member</SelectItem>
            <SelectItem value="partner">Partner (external)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Sending…" : "Send invite"}
      </Button>
    </form>
  );
}
