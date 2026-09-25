"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { updateStageData } from "@/app/labs/[labId]/actions";
import type { Visual } from "@/app/labs/[labId]/stage-data";
import { Button } from "@/components/ui/button";

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export function VisualsUploader({
  ideaId,
  labId,
  visuals,
  currentUserId,
}: {
  ideaId: string;
  labId: string;
  visuals: Visual[];
  currentUserId: string;
}) {
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function loadUrls() {
      const entries = await Promise.all(
        visuals.map(async (v) => {
          const { data } = await supabase.storage
            .from("idea-visuals")
            .createSignedUrl(v.path, 3600);
          return [v.path, data?.signedUrl ?? null] as const;
        }),
      );
      if (!cancelled) {
        const valid = entries.filter((e): e is [string, string] => e[1] !== null);
        setSignedUrls(Object.fromEntries(valid));
      }
    }

    if (visuals.length > 0) loadUrls();
    return () => {
      cancelled = true;
    };
  }, [visuals]);

  async function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error("Only PNG, JPEG, WebP, or GIF images are allowed");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Image must be 10MB or smaller");
      return;
    }

    setIsUploading(true);
    const supabase = createClient();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${labId}/${ideaId}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage.from("idea-visuals").upload(path, file);
    if (uploadError) {
      toast.error(uploadError.message);
      setIsUploading(false);
      return;
    }

    const newVisual: Visual = { path, uploadedBy: currentUserId, createdAt: new Date().toISOString() };
    const result = await updateStageData(ideaId, labId, "concept", {
      visuals: [...visuals, newVisual],
    });
    setIsUploading(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    router.refresh();
  }

  function onRemove(visual: Visual) {
    startTransition(async () => {
      const supabase = createClient();
      await supabase.storage.from("idea-visuals").remove([visual.path]);
      const result = await updateStageData(ideaId, labId, "concept", {
        visuals: visuals.filter((v) => v.path !== visual.path),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      {visuals.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {visuals.map((v) => (
            <div key={v.path} className="group relative aspect-square overflow-hidden rounded-md border">
              {signedUrls[v.path] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={signedUrls[v.path]} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full animate-pulse bg-muted" />
              )}
              <button
                type="button"
                onClick={() => onRemove(v)}
                disabled={isPending}
                className="absolute top-1 right-1 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        onChange={onFileSelected}
        className="hidden"
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isUploading}
        onClick={() => inputRef.current?.click()}
      >
        {isUploading ? "Uploading…" : "Add image"}
      </Button>
    </div>
  );
}
