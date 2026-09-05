"use client";

import { BRAND_COLORS } from "@/lib/constants";

export function BrandAccent({ primaryColor }: { primaryColor: string }) {
  const color = BRAND_COLORS[primaryColor] ?? BRAND_COLORS.indigo;
  return (
    <style id="brand-accent">{`:root{--primary:${color.light.primary};--primary-foreground:${color.light.primaryForeground};--ring:${color.light.ring}}.dark{--primary:${color.dark.primary};--primary-foreground:${color.dark.primaryForeground};--ring:${color.dark.ring}}`}</style>
  );
}