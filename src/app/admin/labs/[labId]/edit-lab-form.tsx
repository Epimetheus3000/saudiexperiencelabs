"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { updateLab } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandColorPicker } from "@/components/admin/brand-color-picker";

export function EditLabForm({
  labId,
  name,
  primaryColor,
  logoUrl,
  partnerName,
  partnerLogoUrl,
  headerImageUrl,
}: {
  labId: string;
  name: string;
  primaryColor: string;
  logoUrl: string | null;
  partnerName: string | null;
  partnerLogoUrl: string | null;
  headerImageUrl: string | null;
}) {
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await updateLab(labId, formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Lab updated");
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="name">Lab name</Label>
        <Input id="name" name="name" defaultValue={name} required />
      </div>
      <BrandColorPicker name="primary_color" defaultValue={primaryColor} />
      <div className="space-y-1.5">
        <Label htmlFor="logo_url">Lab logo URL</Label>
        <Input id="logo_url" name="logo_url" defaultValue={logoUrl ?? ""} placeholder="https://…" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="partner_name">Partner name</Label>
        <Input id="partner_name" name="partner_name" defaultValue={partnerName ?? ""} placeholder="e.g. HiHome" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="partner_logo_url">Partner logo URL</Label>
        <Input
          id="partner_logo_url"
          name="partner_logo_url"
          defaultValue={partnerLogoUrl ?? ""}
          placeholder="https://…"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="header_image_url">Header banner image URL</Label>
        <Input
          id="header_image_url"
          name="header_image_url"
          defaultValue={headerImageUrl ?? ""}
          placeholder="https://… or /brand/lab-headers/…"
        />
        <p className="text-xs text-muted-foreground">
          When set, replaces the lab name text and partner block in the header with this image.
        </p>
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
