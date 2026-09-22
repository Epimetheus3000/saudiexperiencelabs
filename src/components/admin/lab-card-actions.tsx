"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteLab } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function RemoveLabButton({ labId, labName }: { labId: string; labName: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function onRemove() {
    startTransition(async () => {
      const result = await deleteLab(labId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Lab removed");
      router.refresh();
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button size="sm" variant="ghost" disabled={isPending} />}>
        Remove
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {labName}?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the lab and everything in it — stages, ideas, comments,
            ratings, and member assignments. This can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onRemove}>Remove</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
