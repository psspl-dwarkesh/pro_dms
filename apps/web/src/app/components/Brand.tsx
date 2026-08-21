import type { ReactNode } from "react";

export function Mark({ compact = false }: { compact?: boolean }) {
  const size = compact ? 31 : 38;
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" aria-hidden="true">
      <path d="M6 10h7.5c7.5 0 8.1 24 16.3 24H38" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <path d="M6 34h7.5c7.5 0 8.1-24 16.3-24H38" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <circle cx="22" cy="22" r="4.2" fill="var(--brand-signal, #ff6b35)" stroke="var(--brand-mark-ink, #071c2a)" strokeWidth="2" />
    </svg>
  );
}

export function Brand({ inverse = false, compact = false }: { inverse?: boolean; compact?: boolean }) {
  return (
    <div className={`brand-lockup ${inverse ? "brand-lockup--inverse" : ""}`}>
      <span className="brand-mark"><Mark compact={compact} /></span>
      {!compact && <span className="brand-copy"><span className="brand-word">AutoAxis</span><span className="brand-product">DEALER OPERATING SYSTEM</span></span>}
    </div>
  );
}

export function IconFrame({ children, tone = "signal" }: { children: ReactNode; tone?: "signal" | "teal" | "ink" }) {
  return <span className={`icon-frame icon-frame--${tone}`}>{children}</span>;
}
