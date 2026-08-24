import { ArrowRight, BadgeCheck, X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";

export function Toast({ message }: { message: string }) {
  return <div className="workspace-toast" role="status"><BadgeCheck />{message}</div>;
}

export function WorkflowModal({ title, eyebrow, onClose, onComplete, children, completeLabel = "Save demonstration" }: { title: string; eyebrow: string; onClose: () => void; onComplete: () => void; children: ReactNode; completeLabel?: string }) {
  const titleId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const dialog = dialogRef.current;
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? []).filter((element) => !element.hidden);
    window.setTimeout(() => (focusable()[0] ?? dialog)?.focus(), 0);
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onCloseRef.current(); return; }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) { event.preventDefault(); dialog?.focus(); return; }
      const first = items[0]; const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", handleKey, true);
    return () => { document.removeEventListener("keydown", handleKey, true); document.body.style.overflow = previousOverflow; activeElement?.focus(); };
  }, []);

  return <div className="modal-scrim" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && onClose()}><section ref={dialogRef} tabIndex={-1} className="workflow-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}><header><div><span>{eyebrow}</span><h2 id={titleId}>{title}</h2></div><button type="button" onClick={onClose} aria-label="Close dialog"><X /></button></header><div className="workflow-modal-body">{children}</div><footer><span><i /> Demonstration workflow · resets on refresh</span><div><button type="button" onClick={onClose}>Cancel</button><button type="button" className="workspace-button workspace-button--dark" onClick={onComplete}>{completeLabel} <ArrowRight size={14} /></button></div></footer></section></div>;
}

export function WorkspacePage({ title, eyebrow, description, action, children }: { title: string; eyebrow: string; description: string; action?: ReactNode; children: ReactNode }) {
  return <div className="workspace-page"><header className="workspace-page-header"><div><span>{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action && <div className="workspace-page-action">{action}</div>}</header>{children}</div>;
}
