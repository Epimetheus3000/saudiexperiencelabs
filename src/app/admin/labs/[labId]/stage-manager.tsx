"use client";

import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { createStage, setStageDeadline } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Stage = {
  id: string;
  name: string;
  position: number;
  deadline_at: string | null;
};

function toLocalInputValue(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function StageDeadlineRow({ labId, stage }: { labId: string; stage: Stage }) {
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const raw = String(formData.get("deadline_at") ?? "");
    const iso = raw ? new Date(raw).toISOString() : null;

    startTransition(async () => {
      const result = await setStageDeadline(labId, stage.id, iso);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Deadline saved for ${stage.name}`);
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex items-center gap-3 py-2">
      <span className="w-32 text-sm font-medium">{stage.name}</span>
      <Input
        type="datetime-local"
        name="deadline_at"
        defaultValue={toLocalInputValue(stage.deadline_at)}
        className="w-56"
      />
      <Button type="submit" size="sm" variant="outline" disabled={isPending}>
        {isPending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}

export function StageManager({ labId, stages }: { labId: string; stages: Stage[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();

  function onAddStage(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await createStage(labId, formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Stage added");
      formRef.current?.reset();
    });
  }

  return (
    <div className="space-y-4">
      <div className="divide-y rounded-md border px-4">
        {stages.map((stage) => (
          <StageDeadlineRow key={stage.id} labId={labId} stage={stage} />
        ))}
      </div>

      <form ref={formRef} onSubmit={onAddStage} className="flex items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="stage-name">Add a stage after Concept</Label>
          <Input id="stage-name" name="name" placeholder="e.g. Pilot" required />
        </div>
        <Button type="submit" variant="outline" disabled={isPending}>
          {isPending ? "Adding…" : "Add stage"}
        </Button>
      </form>
    </div>
  );
}
