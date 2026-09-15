"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { removeUser } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

export function UserRow({
  userId,
  email,
  isMaster,
  isExternal,
  labNames,
}: {
  userId: string;
  email: string;
  isMaster: boolean;
  isExternal: boolean;
  labNames: string[];
}) {
  const [isPending, startTransition] = useTransition();

  function onRemove() {
    startTransition(async () => {
      const result = await removeUser(userId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("User removed");
    });
  }

  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{email}</span>
          {isMaster && <Badge>Master</Badge>}
          {!isMaster && <Badge variant={isExternal ? "secondary" : "outline"}>
            {isExternal ? "Partner" : "Team member"}
          </Badge>}
        </div>
        <span className="text-xs text-muted-foreground">
          {labNames.length > 0 ? labNames.join(", ") : "No labs assigned"}
        </span>
      </div>
      {!isMaster && (
        <AlertDialog>
          <AlertDialogTrigger render={<Button size="sm" variant="ghost" disabled={isPending} />}>
            Remove
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove {email}?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently deletes their account and all lab memberships. This can&apos;t
                be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onRemove}>Remove</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
