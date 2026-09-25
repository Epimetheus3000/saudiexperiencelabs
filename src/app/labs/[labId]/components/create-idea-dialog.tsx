"use client";

import { useRef, useState } from "react";
import { Plus } from "lucide-react";
import type { IdeaWithExtras } from "@/app/labs/[labId]/types";
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
  stageId,
  longlistCount,
  categories,
  currentUserEmail,
  onCreateIdea,
}: {
  labId: string;
  stageId: string;
  longlistCount: number;
  categories: string[];
  currentUserEmail: string;
  onCreateIdea: (tempIdea: IdeaWithExtras, formData: FormData) => void;
}) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const atCap = longlistCount >= 50;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (atCap) return;
    const formData = new FormData(e.currentTarget);
    formData.set("category", category);

    const title = String(formData.get("title") ?? "").trim();
    if (!title) return;

    // Optimistic: the card appears the instant you submit, and the real id
    // from the server is reconciled in the background — see
    // PipelineBoard.commitCreateIdea. No router.refresh() needed on success.
    const tempIdea: IdeaWithExtras = {
      id: crypto.randomUUID(),
      labId,
      stageId,
      title,
      category: category || null,
      description: String(formData.get("description") ?? "") || null,
      pros: String(formData.get("pros") ?? "") || null,
      cons: String(formData.get("cons") ?? "") || null,
      stageData: {},
      createdByEmail: currentUserEmail,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ratings: [],
      comments: [],
      favoritedByCurrentUser: false,
      favoriteCount: 0,
      requirements: [],
    };

    onCreateIdea(tempIdea, formData);
    formRef.current?.reset();
    setCategory("");
    setOpen(false);
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
            <Button type="submit">Add to Longlist</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
