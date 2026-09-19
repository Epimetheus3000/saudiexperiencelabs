"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";

// The 7 on-brand accent options: 6 secondary colors + vibrant purple, per
// the Visit Saudi comprehensive guidelines (p.20). A custom color remains
// available for edge cases, but these are what keeps labs on-brand.
const BRAND_ACCENTS = [
  { label: "Red", value: "#FF4664" },
  { label: "Orange", value: "#FA783C" },
  { label: "Dark blue", value: "#646EC8" },
  { label: "Blue", value: "#64A0DC" },
  { label: "Dark green", value: "#3CA06E" },
  { label: "Green", value: "#46C8A0" },
  { label: "Vibrant purple", value: "#BE008C" },
];

export function BrandColorPicker({
  name,
  defaultValue,
}: {
  name: string;
  defaultValue?: string;
}) {
  const [value, setValue] = useState(defaultValue ?? BRAND_ACCENTS[0].value);
  const isCustom = !BRAND_ACCENTS.some((c) => c.value.toLowerCase() === value.toLowerCase());

  return (
    <div className="space-y-1.5">
      <Label>Accent color</Label>
      <input type="hidden" name={name} value={value} />
      <div className="flex flex-wrap items-center gap-1.5">
        {BRAND_ACCENTS.map((c) => (
          <button
            key={c.value}
            type="button"
            title={c.label}
            onClick={() => setValue(c.value)}
            className="h-7 w-7 shrink-0 rounded-full ring-offset-2 transition-shadow"
            style={{
              backgroundColor: c.value,
              boxShadow: value.toLowerCase() === c.value.toLowerCase() ? "0 0 0 2px var(--ring)" : undefined,
            }}
          />
        ))}
        <input
          type="color"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          title="Custom color (off-brand — use only if the palette above doesn't fit)"
          className="h-7 w-7 shrink-0 rounded-full border p-0"
          style={isCustom ? { boxShadow: "0 0 0 2px var(--ring)" } : undefined}
        />
      </div>
    </div>
  );
}
