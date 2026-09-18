"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { ChecklistItem } from "@/app/labs/[labId]/stage-data";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export function ReasoningDialog({
  open,
  ideaTitle,
  targetStageName,
  checklistItems,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  ideaTitle: string;
  targetStageName: string;
  checklistItems: ChecklistItem[];
  onCancel: () => void;
  onConfirm: (
    reasoning: string,
    checklist: Record<string, boolean>,
  ) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [reasoning, setReasoning] = useState("");
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    if (!reasoning.trim()) {
      toast.error("A reasoning note is required to move this idea");
      return;
    }
    startTransition(async () => {
      const result = await onConfirm(reasoning.trim(), checked);
      if (!result.ok) {
        toast.error(result.error ?? "Something went wrong");
        return;
      }
      setReasoning("");
      setChecked({});
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move &quot;{ideaTitle}&quot; to {targetStageName}</DialogTitle>
          <DialogDescription>
            A reasoning note is required before this idea can move out of Longlist.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="reasoning">Reasoning</Label>
          <Textarea
            id="reasoning"
            rows={4}
            value={reasoning}
            onChange={(e) => setReasoning(e.target.value)}
            autoFocus
          />
        </div>

        {checklistItems.length > 0 && (
          <div className="space-y-2">
            <Label>Things to consider</Label>
            <div className="space-y-1.5">
              {checklistItems.map((item) => (
                <label key={item.key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={checked[item.key] ?? false}
                    onChange={(e) => setChecked((prev) => ({ ...prev, [item.key]: e.target.checked }))}
                  />
                  {item.label}
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              These are reminders, not requirements — you can move on with items unchecked.
            </p>
          </div>
        )}

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
