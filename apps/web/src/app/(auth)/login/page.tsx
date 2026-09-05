import { getSettings } from "@/lib/settings";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  const settings = await getSettings();

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-8 p-6">
      <div className="flex flex-col items-center gap-3">
        {settings.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={settings.logoUrl}
            alt={`${settings.name} logo`}
            className="h-12 w-12 rounded-xl object-contain"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground">
            {settings.name.slice(0, 2).toUpperCase()}
          </div>
        )}
        <h1 className="text-2xl font-semibold tracking-tight">{settings.name}</h1>
        <p className="text-sm text-muted-foreground">
          Creator outreach &amp; gifting workspace
        </p>
      </div>
      <LoginForm />
      <p className="text-center text-xs text-muted-foreground max-w-xs">
        Reach out to your workspace admin if you need credentials or a password
        reset.
      </p>
    </div>
  );
}