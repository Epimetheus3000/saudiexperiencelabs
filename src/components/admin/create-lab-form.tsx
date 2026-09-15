"use client";

import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { createLab } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CreateLabForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await createLab(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Lab created");
      formRef.current?.reset();
    });
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="name">Lab name</Label>
        <Input id="name" name="name" placeholder="e.g. AlUla Lab" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="primary_color">Brand color</Label>
        <Input
          id="primary_color"
          name="primary_color"
          type="color"
          defaultValue="#0f172a"
          className="h-9 w-16 p-1"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="logo_url">Logo URL (optional)</Label>
        <Input id="logo_url" name="logo_url" placeholder="https://…" />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Creating…" : "Create lab"}
      </Button>
    </form>
  );
}
