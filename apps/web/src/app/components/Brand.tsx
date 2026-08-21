import type { CSSProperties, ReactNode } from "react";

export function Mark({ compact = false }: { compact?: boolean }) {
  const size = compact ? 28 : 34;
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="36" height="36" rx="9" fill="#1463ff" />
      <path d="M8 18L18 8L28 18L18 28L8 18Z" fill="#ffffff" fillOpacity="0.95" />
      <circle cx="18" cy="18" r="4.5" fill="#000714" />
      <circle cx="18" cy="9" r="2.2" fill="#6deab7" />
      <circle cx="27" cy="18" r="2.2" fill="#6deab7" />
      <circle cx="18" cy="27" r="2.2" fill="#6deab7" />
      <circle cx="9" cy="18" r="2.2" fill="#6deab7" />
    </svg>
  );
}

export function Brand({ inverse = false, compact = false, style }: { inverse?: boolean; compact?: boolean; style?: CSSProperties }) {
  return (
    <div className={`brand-lockup ${inverse ? "brand-lockup--inverse" : ""}`} style={style}>
      <span className="brand-mark"><Mark compact={compact} /></span>
      {!compact && (
        <div className="brand-copy">
          <strong className="brand-word">AutoAxis</strong>
          <span className="brand-product">Connected DMS</span>
        </div>
      )}
    </div>
  );
}

export function IconFrame({ children, tone = "signal" }: { children: ReactNode; tone?: "signal" | "teal" | "ink" }) {
  return <span className={`icon-frame icon-frame--${tone}`}>{children}</span>;
}
