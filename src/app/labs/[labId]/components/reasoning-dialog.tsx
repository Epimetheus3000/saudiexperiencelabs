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

export function ReasoningDialog({
  open,
  ideaTitle,
  targetStageName,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  ideaTitle: string;
  targetStageName: string;
  onCancel: () => void;
  onConfirm: (reasoning: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [reasoning, setReasoning] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    if (!reasoning.trim()) {
      toast.error("A reasoning note is required to move this idea");
      return;
    }
    startTransition(async () => {
      const result = await onConfirm(reasoning.trim());
      if (!result.ok) {
        toast.error(result.error ?? "Something went wrong");
        return;
      }
      setReasoning("");
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
