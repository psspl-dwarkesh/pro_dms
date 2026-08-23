// Real brand marks for channel actions (WhatsApp, Gmail), sourced from the SVGs in
// src/assets/brand-icons/. Inlined as JSX (rather than imported as <img src="..." />) so they
// drop into the same call sites as lucide-react icons, e.g. `<Icon size={17} />`, including
// places typed as `LucideIcon` (see SidebarAction in dashboard/SidebarActions.tsx) — cast with
// `as LucideIcon` at the call site, since these match the only part of that type actually used
// at runtime (a component rendering from a `size` prop) without matching its full shape.
type BrandIconProps = { size?: number; className?: string };

export function WhatsAppIcon({ size = 17, className }: BrandIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" className={className} aria-hidden="true" focusable="false">
      <rect width="512" height="512" rx="15%" fill="#25d366" />
      <path fill="#25d366" stroke="#ffffff" strokeWidth="26" d="M123 393l14-65a138 138 0 1150 47z" />
      <path
        fill="#ffffff"
        d="M308 273c-3-2-6-3-9 1l-12 16c-3 2-5 3-9 1-15-8-36-17-54-47-1-4 1-6 3-8l9-14c2-2 1-4 0-6l-12-29c-3-8-6-7-9-7h-8c-2 0-6 1-10 5-22 22-13 53 3 73 3 4 23 40 66 59 32 14 39 12 48 10 11-1 22-10 27-19 1-3 6-16 2-18"
      />
    </svg>
  );
}

export function GmailIcon({ size = 17, className }: BrandIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" className={className} aria-hidden="true" focusable="false">
      <rect width="512" height="512" rx="15%" fill="#ffffff" />
      <path d="M158 391v-142l-82-63V361q0 30 30 30" fill="#4285f4" />
      <path d="M 154 248l102 77l102-77v-98l-102 77l-102-77" fill="#ea4335" />
      <path d="M354 391v-142l82-63V361q0 30-30 30" fill="#34a853" />
      <path d="M76 188l82 63v-98l-30-23c-27-21-52 0-52 26" fill="#c5221f" />
      <path d="M436 188l-82 63v-98l30-23c27-21 52 0 52 26" fill="#fbbc04" />
    </svg>
  );
}
