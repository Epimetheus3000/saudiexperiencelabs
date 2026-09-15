"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { updateLab } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function EditLabForm({
  labId,
  name,
  primaryColor,
  logoUrl,
}: {
  labId: string;
  name: string;
  primaryColor: string;
  logoUrl: string | null;
}) {
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await updateLab(labId, formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Lab updated");
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="name">Lab name</Label>
        <Input id="name" name="name" defaultValue={name} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="primary_color">Brand color</Label>
        <Input
          id="primary_color"
          name="primary_color"
          type="color"
          defaultValue={primaryColor}
          className="h-9 w-16 p-1"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="logo_url">Logo URL</Label>
        <Input id="logo_url" name="logo_url" defaultValue={logoUrl ?? ""} placeholder="https://…" />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
