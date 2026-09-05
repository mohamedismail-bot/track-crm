import { getSettings } from "@/lib/settings";
import { BrandAccent } from "@/components/brand-accent";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();

  return (
    <div className="relative min-h-[100dvh] bg-background">
      <BrandAccent primaryColor={settings.primaryColor} />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,var(--accent),transparent_55%),radial-gradient(ellipse_at_bottom_right,color-mix(in_oklab,var(--primary)_10%,transparent),transparent_50%)]" />
      {children}
    </div>
  );
}