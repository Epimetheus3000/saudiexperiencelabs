"use client";

import { useRef, useState, useTransition } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { updateLabCategories } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

// Curated per lab so the new-idea dropdown reflects that lab's actual
// theme — no fixed "correct" list per theme, so this stays admin-editable
// rather than hardcoded by lab name/type.
export function LabCategoriesManager({
  labId,
  categories,
}: {
  labId: string;
  categories: string[];
}) {
  const [list, setList] = useState(categories);
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();

  function save(next: string[]) {
    startTransition(async () => {
      const result = await updateLabCategories(labId, next);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setList(next);
    });
  }

  function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const value = String(formData.get("category") ?? "").trim();
    if (!value || list.includes(value)) return;
    save([...list, value]);
    formRef.current?.reset();
  }

  function onRemove(value: string) {
    save(list.filter((c) => c !== value));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {list.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No categories set — the new-idea form falls back to a free-text field.
          </p>
        )}
        {list.map((c) => (
          <Badge key={c} variant="outline" className="gap-1 py-1 pr-1">
            {c}
            <button
              type="button"
              onClick={() => onRemove(c)}
              disabled={isPending}
              className="rounded-full p-0.5 hover:bg-muted"
              title={`Remove ${c}`}
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}
      </div>
      <form ref={formRef} onSubmit={onAdd} className="flex items-end gap-2">
        <Input name="category" placeholder="Add a category" className="w-56" />
        <Button type="submit" size="sm" variant="outline" disabled={isPending}>
          Add
        </Button>
      </form>
    </div>
  );
}
