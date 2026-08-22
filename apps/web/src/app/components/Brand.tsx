import type { ReactNode } from "react";

export function Mark({ compact = false }: { compact?: boolean }) {
  const size = compact ? 30 : 36;
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" aria-hidden="true">
      <rect width="36" height="36" rx="8" fill="currentColor" />
      <path d="M8.5 18 18 8.5l9.5 9.5-9.5 9.5L8.5 18Z" fill="white" />
      <circle cx="18" cy="18" r="4.2" fill="#000714" />
      <circle cx="18" cy="9.2" r="1.8" fill="#79e4bd" />
      <circle cx="26.8" cy="18" r="1.8" fill="#79e4bd" />
      <circle cx="18" cy="26.8" r="1.8" fill="#79e4bd" />
      <circle cx="9.2" cy="18" r="1.8" fill="#79e4bd" />
    </svg>
  );
}

export function Brand({ inverse = false, compact = false }: { inverse?: boolean; compact?: boolean }) {
  return (
    <div className={`brand-lockup ${inverse ? "brand-lockup--inverse" : ""}`}>
      <span className="brand-mark"><Mark compact={compact} /></span>
      {!compact && <span className="brand-copy"><span className="brand-word">AutoAxis</span><span className="brand-product">CONNECTED DMS</span></span>}
    </div>
  );
}

export function IconFrame({ children, tone = "signal" }: { children: ReactNode; tone?: "signal" | "teal" | "ink" }) {
  return <span className={`icon-frame icon-frame--${tone}`}>{children}</span>;
}
