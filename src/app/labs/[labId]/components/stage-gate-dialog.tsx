"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export type GateField = { key: string; label: string; initialValue?: string };

// A lighter-weight sibling to ReasoningDialog: same "fill this in before the
// move completes" pattern, generalized to one or more required fields per
// stage instead of Shortlist's reasoning + optional checklist. Go-Live is
// deliberately excluded — its checklist stays non-blocking per the earlier
// product decision recorded in PROJECT_NOTES.
export function StageGateDialog({
  open,
  ideaTitle,
  targetStageName,
  fields,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  ideaTitle: string;
  targetStageName: string;
  fields: GateField[];
  onCancel: () => void;
  onConfirm: (values: Record<string, string>) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, f.initialValue ?? ""])),
  );
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    const missing = fields.find((f) => !values[f.key]?.trim());
    if (missing) {
      toast.error(`${missing.label} is required to move this idea`);
      return;
    }
    startTransition(async () => {
      const trimmed = Object.fromEntries(
        Object.entries(values).map(([k, v]) => [k, v.trim()]),
      );
      const result = await onConfirm(trimmed);
      if (!result.ok) {
        toast.error(result.error ?? "Something went wrong");
        return;
      }
      setValues(Object.fromEntries(fields.map((f) => [f.key, ""])));
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Move &quot;{ideaTitle}&quot; to {targetStageName}
          </DialogTitle>
          <DialogDescription>
            {fields.length === 1 ? fields[0].label : "The details below"} are required before this
            idea can move into {targetStageName}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {fields.map((f, i) => (
            <div key={f.key} className="space-y-1.5">
              <Label htmlFor={`gate-field-${f.key}`}>{f.label}</Label>
              <Textarea
                id={`gate-field-${f.key}`}
                rows={3}
                value={values[f.key] ?? ""}
                onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                autoFocus={i === 0}
              />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isPending}>
            {isPending ? "Moving…" : "Confirm move"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
