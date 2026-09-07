"use client";

import type { Platform } from "@prisma/client";

const ICON_SIZE = 16;

interface IconProps {
  size?: number;
  className?: string;
}

export function InstagramIcon({ size = ICON_SIZE, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <defs>
        <linearGradient id="ig-grad" x1="2" y1="22" x2="22" y2="2" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFDC80" />
          <stop offset="25%" stopColor="#F77737" />
          <stop offset="50%" stopColor="#FD1D1D" />
          <stop offset="75%" stopColor="#C13584" />
          <stop offset="100%" stopColor="#405DE6" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="20" height="20" rx="5" stroke="url(#ig-grad)" strokeWidth="2" fill="none" />
      <circle cx="12" cy="12" r="5" stroke="url(#ig-grad)" strokeWidth="2" fill="none" />
      <circle cx="17.5" cy="6.5" r="1.5" fill="url(#ig-grad)" />
    </svg>
  );
}

export function TiktokIcon({ size = ICON_SIZE, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05A6.34 6.34 0 003.15 15.3a6.34 6.34 0 0010.86 4.48V13.2a8.16 8.16 0 005.58 2.17v-3.45a4.85 4.85 0 01-3.77-1.76V6.69h3.77z" />
    </svg>
  );
}

export function YoutubeIcon({ size = ICON_SIZE, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

export function XIcon({ size = ICON_SIZE, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function SnapchatIcon({ size = ICON_SIZE, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12.922-.214a.47.47 0 01.254-.02c.175.045.293.194.41.34.195.224.44.503.756.503.084 0 .18-.015.286-.043a.65.65 0 01.3.028.936.936 0 01.42.375c.12.196.165.397.134.578-.06.39-.375.659-.81.809-.32.105-.662.12-.868.104a3.275 3.275 0 00-.654.105c-.36.09-.72.254-.87.449-.225.285-.09.645.195.975.555.66 2.334 1.605 3.134 2.039.346.185.645.345.87.48.39.225.675.405.81.525.135.12.075.345-.195.6-.39.375-1.14.779-1.89.99-.286.075-.585.135-.87.18-.375.06-.72.105-1.005.33-.09.075-.18.195-.36.57-.254.524-.585.99-.99 1.29-.496.36-1.17.555-2.01.555h-.09c-.855 0-1.635-.165-2.43-.615-.45-.24-.87-.585-1.335-.975a17.044 17.044 0 01-1.32-.96c-.36-.27-.66-.48-.96-.615a8.825 8.825 0 00-1.08-.405c-.33.06-.66.105-1.005.15l-.075.015c-.36.045-.66.06-.975.06h-.15c-.855 0-1.575-.27-2.07-.75-.66-.63-.975-1.53-1.035-2.205 0-.075-.015-.15-.015-.225v-.045c-.015-.09-.03-.195-.03-.3a.627.627 0 01.075-.32 1.05 1.05 0 01-.045-.27c.015-.195.09-.375.165-.465.165-.225.39-.375.555-.435.135-.045.255-.06.375-.075.06-.015.12-.015.18-.015.12 0 .24.015.36.045.3-.075.615-.225.96-.465.45-.3.96-.72 1.65-.72h.03c.39 0 .735.075 1.05.225l.045.03c.165.09.315.195.48.33.27.195.585.465 1.11.465.21 0 .435-.045.66-.12a.574.574 0 01.24-.03c.18 0 .345.09.525.225.33.255.645.585 1.08.585h.015c.345 0 .645-.135.885-.375.135-.135.24-.27.345-.405.075-.105.165-.21.3-.375.27-.36.63-.675 1.08-.765z" />
    </svg>
  );
}

export function FacebookIcon({ size = ICON_SIZE, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

export function LinkedinIcon({ size = ICON_SIZE, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

export function TwitchIcon({ size = ICON_SIZE, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
    </svg>
  );
}

export function ShopifyIcon({ size = ICON_SIZE, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M15.337 23.979l7.216-1.851-4.284-15.319-10.055 2.722-.56 3.952 5.899 1.517 2.487 8.168c.146.478.253.96.32 1.443l5.273-1.356v-.276zm-3.468-12.298l-1.694.458 1.559 5.812-3.679.989-3.924-13.838 2.433-.655 1.694.458 1.694 5.812 1.918-.518zm-4.209-5.401L4.036 1.798l-.179.608-4.266 14.625 2.199.591 1.125-4.173 1.724-.467c.146-.039.253-.134.253-.276 0-.039-.014-.078-.039-.117L4.36 3.41l1.263-.343 3.827 12.963 2.277-.611c.301-.156.524-.403.524-.687 0-.039-.014-.078-.039-.117l-2.095-7.432 2.391-.642c.253.117.32.343.32.458 0 .039-.014.117-.039.156l-1.263 4.514-.674 2.407-.854 3.019 1.148.307c.146.039.291.117.437.156l-1.599 5.697 1.263.343 1.599-5.697c.253-.078.481-.175.713-.276l3.491.937-2.742 8.566c-.063.195-.229.343-.423.371l-2.944.761c-.146.039-.291-.014-.41-.117L7.952 22.952l1.953-.507-1.291-4.341c.253-.117.437-.362.437-.629 0-.039-.014-.078-.039-.117l-2.433 6.339 1.388.371 2.617-7.109.878-2.407.812-2.139c.146-.382.014-.756-.291-.998-.301-.244-.698-.343-1.068-.237L9.038 11.84c-.146-.382-.014-.756.291-.998.301-.244.698-.343 1.068-.237l.239.429z" />
    </svg>
  );
}

const ICON_MAP: Record<string, React.ComponentType<IconProps>> = {
  INSTAGRAM: InstagramIcon,
  TIKTOK: TiktokIcon,
  YOUTUBE: YoutubeIcon,
  X: XIcon,
  SNAPCHAT: SnapchatIcon,
  FACEBOOK: FacebookIcon,
  LINKEDIN: LinkedinIcon,
  TWITCH: TwitchIcon,
  OTHER: () => null,
};

export function PlatformLogoIcon({ platform, size = 16, className }: { platform: Platform | string; size?: number; className?: string }) {
  const Icon = ICON_MAP[platform];
  if (!Icon) return null;
  return <Icon size={size} className={className} />;
}

export function PlatformLogoBadge({
  platform,
  url,
  handle,
  size = 16,
}: {
  platform: Platform | string;
  url?: string | null;
  handle?: string | null;
  size?: number;
}) {
  const COLORS: Record<string, string> = {
    INSTAGRAM: "#E4405F",
    TIKTOK: "#000000",
    YOUTUBE: "#FF0000",
    X: "#000000",
    SNAPCHAT: "#FFFC00",
    FACEBOOK: "#1877F2",
    LINKEDIN: "#0A66C2",
    TWITCH: "#9146FF",
    OTHER: "#6b7280",
  };
  const color = COLORS[platform] ?? "#6b7280";
  const content = (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium text-white"
      style={{ backgroundColor: color }}
    >
      <PlatformLogoIcon platform={platform} size={size} />
      {handle ? <span className="max-w-[80px] truncate">{handle}</span> : null}
    </span>
  );

  if (!url) return content;

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center transition-opacity hover:opacity-80"
      onClick={(e) => e.stopPropagation()}
    >
      {content}
    </a>
  );
}
