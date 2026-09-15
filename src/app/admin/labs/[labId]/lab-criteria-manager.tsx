"use client";

import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { createRatingCriterion, deleteRatingCriterion } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Criterion = { id: string; name: string; scale: number };

export function LabCriteriaManager({
  labId,
  criteria,
  emptyMessage = "No lab-specific criteria — global criteria still apply.",
}: {
  labId: string | null;
  criteria: Criterion[];
  emptyMessage?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();

  function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await createRatingCriterion(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Criterion added");
      formRef.current?.reset();
    });
  }

  function onDelete(id: string) {
    startTransition(async () => {
      const result = await deleteRatingCriterion(id, labId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Criterion removed");
    });
  }

  return (
    <div className="space-y-4">
      <div className="divide-y rounded-md border">
        {criteria.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">{emptyMessage}</p>
        )}
        {criteria.map((c) => (
          <div key={c.id} className="flex items-center justify-between px-4 py-2">
            <span className="text-sm">
              {c.name} <span className="text-muted-foreground">/ {c.scale}</span>
            </span>
            <Button size="sm" variant="ghost" disabled={isPending} onClick={() => onDelete(c.id)}>
              Remove
            </Button>
          </div>
        ))}
      </div>

      <form ref={formRef} onSubmit={onAdd} className="flex items-end gap-3">
        <input type="hidden" name="lab_id" value={labId ?? ""} />
        <Input name="name" placeholder="Criterion name" required className="w-48" />
        <Input name="scale" type="number" min={2} max={10} defaultValue={5} className="w-20" />
        <Button type="submit" variant="outline" disabled={isPending}>
          {isPending ? "Adding…" : "Add"}
        </Button>
      </form>
    </div>
  );
}
