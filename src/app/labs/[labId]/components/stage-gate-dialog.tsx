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

// A lighter-weight sibling to ReasoningDialog: same "fill this in before the
// move completes" pattern, generalized to one required field per stage
// instead of Shortlist's reasoning + optional checklist. Go-Live is
// deliberately excluded — its checklist stays non-blocking per the earlier
// product decision recorded in PROJECT_NOTES.
export function StageGateDialog({
  open,
  ideaTitle,
  targetStageName,
  fieldLabel,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  ideaTitle: string;
  targetStageName: string;
  fieldLabel: string;
  onCancel: () => void;
  onConfirm: (value: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [value, setValue] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    if (!value.trim()) {
      toast.error(`${fieldLabel} is required to move this idea`);
      return;
    }
    startTransition(async () => {
      const result = await onConfirm(value.trim());
      if (!result.ok) {
        toast.error(result.error ?? "Something went wrong");
        return;
      }
      setValue("");
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
            {fieldLabel} is required before this idea can move into {targetStageName}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="gate-field">{fieldLabel}</Label>
          <Textarea
            id="gate-field"
            rows={4}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
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
