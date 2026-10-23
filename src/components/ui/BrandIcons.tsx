interface IconProps {
  size?: number;
  className?: string;
}

export function GitHubIcon({ size = 18, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 0C5.37 0 0 5.5 0 12.3c0 5.43 3.44 10.03 8.21 11.66.6.11.82-.27.82-.6 0-.29-.01-1.06-.02-2.08-3.34.75-4.04-1.65-4.04-1.65-.55-1.44-1.34-1.82-1.34-1.82-1.09-.77.08-.76.08-.76 1.21.09 1.84 1.28 1.84 1.28 1.07 1.87 2.81 1.33 3.5 1.01.11-.79.42-1.33.76-1.63-2.67-.31-5.47-1.38-5.47-6.13 0-1.35.46-2.46 1.22-3.32-.12-.31-.53-1.55.12-3.23 0 0 1-.33 3.3 1.27a11.2 11.2 0 0 1 6 0c2.28-1.6 3.29-1.27 3.29-1.27.65 1.68.24 2.92.12 3.23.76.86 1.22 1.97 1.22 3.32 0 4.76-2.81 5.82-5.48 6.12.43.38.81 1.14.81 2.3 0 1.66-.02 2.99-.02 3.4 0 .33.22.72.83.6C20.57 22.32 24 17.72 24 12.3 24 5.5 18.63 0 12 0Z" />
    </svg>
  );
}

export function XIcon({ size = 18, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M18.3 2H21l-6.6 7.53L22.2 22h-6.1l-4.78-6.27L5.8 22H3.1l7.06-8.06L2 2h6.25l4.32 5.72L18.3 2Zm-1.07 18.17h1.68L7.86 3.74H6.06L17.23 20.17Z" />
    </svg>
  );
}

export function LinkedInIcon({ size = 18, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0Z" />
    </svg>
  );
}

/** One lookup for every surface that renders `SOCIAL_LINKS` by icon key. */
export const SOCIAL_ICONS: Record<string, (props: IconProps) => React.JSX.Element> = {
  github: GitHubIcon,
  twitter: XIcon,
  linkedin: LinkedInIcon,
};
