"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { createStage, setStageDeadline, updateStageDetails } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";

type ChecklistItem = { key: string; label: string };

type Stage = {
  id: string;
  name: string;
  position: number;
  description: string | null;
  gateChecklist: ChecklistItem[];
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

function slugify(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "item";
}

function StageDetailsDialog({ labId, stage }: { labId: string; stage: Stage }) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState(stage.description ?? "");
  const [items, setItems] = useState<ChecklistItem[]>(stage.gateChecklist);
  const [newLabel, setNewLabel] = useState("");
  const [isPending, startTransition] = useTransition();

  function onAddItem() {
    if (!newLabel.trim()) return;
    const key = slugify(newLabel);
    const uniqueKey = items.some((i) => i.key === key) ? `${key}_${items.length}` : key;
    setItems([...items, { key: uniqueKey, label: newLabel.trim() }]);
    setNewLabel("");
  }

  function onRemoveItem(key: string) {
    setItems(items.filter((i) => i.key !== key));
  }

  function onSave() {
    startTransition(async () => {
      const result = await updateStageDetails(labId, stage.id, description, items);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${stage.name} updated`);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>Edit details</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{stage.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor={`desc-${stage.id}`}>Column description</Label>
            <Textarea
              id={`desc-${stage.id}`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Checklist (tracked, doesn&apos;t block moving forward)</Label>
            <div className="space-y-1">
              {items.map((item) => (
                <div key={item.key} className="flex items-center justify-between text-sm">
                  <span>{item.label}</span>
                  <button
                    type="button"
                    onClick={() => onRemoveItem(item.key)}
                    className="text-xs text-muted-foreground hover:text-destructive"
                  >
                    Remove
                  </button>
                </div>
              ))}
              {items.length === 0 && (
                <p className="text-xs text-muted-foreground">No checklist items yet.</p>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Add a checklist item…"
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), onAddItem())}
              />
              <Button type="button" variant="outline" size="sm" onClick={onAddItem}>
                Add
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onSave} disabled={isPending}>
            {isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StageDeadlineForm({ labId, stage }: { labId: string; stage: Stage }) {
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
    <form onSubmit={onSubmit} className="flex items-center gap-2">
      <Input
        type="datetime-local"
        name="deadline_at"
        defaultValue={toLocalInputValue(stage.deadline_at)}
        className="w-52"
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
          <div key={stage.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <span className="w-40 shrink-0 text-sm font-medium">{stage.name}</span>
            <StageDeadlineForm labId={labId} stage={stage} />
            <StageDetailsDialog labId={labId} stage={stage} />
          </div>
        ))}
      </div>

      <form ref={formRef} onSubmit={onAddStage} className="flex items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="stage-name">Add a stage after Distribution</Label>
          <Input id="stage-name" name="name" placeholder="e.g. Retrospective" required />
        </div>
        <Button type="submit" variant="outline" disabled={isPending}>
          {isPending ? "Adding…" : "Add stage"}
        </Button>
      </form>
    </div>
  );
}
