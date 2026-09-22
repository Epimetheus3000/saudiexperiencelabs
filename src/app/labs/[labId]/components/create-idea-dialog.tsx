"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createIdea } from "@/app/labs/[labId]/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

export function CreateIdeaDialog({
  labId,
  longlistCount,
  categories,
}: {
  labId: string;
  longlistCount: number;
  categories: string[];
}) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const atCap = longlistCount >= 50;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("category", category);
    startTransition(async () => {
      const result = await createIdea(labId, formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Idea added to Longlist");
      formRef.current?.reset();
      setCategory("");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        disabled={atCap}
        title={atCap ? "Longlist is full (50/50)" : undefined}
        className="flex w-full items-center justify-center gap-1.5 border border-dashed border-[var(--lab-primary)] py-2.5 text-sm font-medium text-[var(--lab-primary)] transition-colors hover:bg-[var(--lab-primary)]/5 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Plus className="size-4" />
        {atCap ? "Longlist full (50/50)" : "Add idea"}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Longlist idea</DialogTitle>
        </DialogHeader>
        <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="category">Category</Label>
            {categories.length > 0 ? (
              <Select value={category} onValueChange={(value) => setCategory(value ?? "")}>
                <SelectTrigger id="category" className="w-full">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="pros">Pros</Label>
              <Textarea id="pros" name="pros" rows={3} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cons">Cons</Label>
              <Textarea id="cons" name="cons" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Adding…" : "Add to Longlist"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
