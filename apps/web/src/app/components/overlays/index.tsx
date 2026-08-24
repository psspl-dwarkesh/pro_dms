import { ArrowRight, X } from "lucide-react";
import type { ReactNode, RefObject } from "react";
import { useRef, useState } from "react";
import { FormSummary } from "../forms";
import {
  Dialog as AriaDialog,
  Button,
  Heading,
  Modal,
  ModalOverlay,
  Menu as AriaMenu,
  MenuItem as AriaMenuItem,
  MenuTrigger,
  Popover as AriaPopover,
  Tooltip as AriaTooltip,
  TooltipTrigger,
} from "react-aria-components";

type DialogProps = {
  title: string;
  children: ReactNode;
  onClose: () => void;
  eyebrow?: string;
  footer?: ReactNode;
  className?: string;
  dismissible?: boolean;
  role?: "dialog" | "alertdialog";
  dialogRef?: RefObject<HTMLElement>;
};

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function Dialog({ title, children, onClose, eyebrow, footer, className, dismissible = true, role = "dialog", dialogRef }: DialogProps) {
  return (
    <ModalOverlay isOpen isDismissable={dismissible} onOpenChange={(open) => { if (!open) onClose(); }} className="aa-overlay-backdrop">
      <Modal className="aa-overlay-positioner">
        <AriaDialog ref={dialogRef} role={role} className={classNames("aa-dialog", className)}>
          <header className="aa-dialog-header"><div>{eyebrow && <span>{eyebrow}</span>}<Heading slot="title">{title}</Heading></div>{dismissible && <button type="button" onClick={onClose} aria-label={`Close ${title}`}><X /></button>}</header>
          <div className="aa-dialog-body">{children}</div>
          {footer && <footer className="aa-dialog-footer">{footer}</footer>}
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}

export function AlertDialog({ title, message, confirmLabel, onCancel, onConfirm, busy = false, tone = "danger" }: {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  busy?: boolean;
  tone?: "danger" | "default";
}) {
  return <Dialog title={title} onClose={onCancel} role="alertdialog" dismissible={!busy} className="aa-alert-dialog" footer={<div className="aa-alert-actions"><button autoFocus type="button" className="workspace-button" onClick={onCancel} disabled={busy}>Cancel</button><button type="button" className={`workspace-button ${tone === "danger" ? "workspace-button--danger" : "workspace-button--dark"}`} onClick={onConfirm} disabled={busy}>{busy ? "Working..." : confirmLabel}</button></div>}><p>{message}</p></Dialog>;
}

export function WorkflowDialog({ title, eyebrow, onClose, onComplete, children, completeLabel = "Save", busy = false, status }: {
  title: string;
  eyebrow: string;
  onClose: () => void;
  onComplete: () => void;
  children: ReactNode;
  completeLabel?: string;
  busy?: boolean;
  status?: ReactNode;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const [validationItems, setValidationItems] = useState<Array<{ fieldId: string; message: string }>>([]);

  function validateAndComplete() {
    const invalidControls = Array.from(dialogRef.current?.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input:invalid, select:invalid, textarea:invalid") ?? []);
    if (!invalidControls.length) { setValidationItems([]); onComplete(); return; }
    const items = invalidControls.map((control, index) => {
      if (!control.id) control.id = `workflow-invalid-${index}`;
      const label = control.labels?.[0]?.textContent?.replace(/Required/g, "").trim() || control.getAttribute("aria-label") || "This field";
      return { fieldId: control.id, message: `${label}: ${control.validationMessage || "Enter a valid value."}` };
    });
    setValidationItems(items);
    invalidControls[0]?.focus();
    invalidControls[0]?.reportValidity();
  }

  return <Dialog dialogRef={dialogRef} title={title} eyebrow={eyebrow} onClose={onClose} className="workflow-modal" footer={<><span className="aa-dialog-status" aria-live="polite">{status}</span><div><button type="button" onClick={onClose} disabled={busy}>Cancel</button><button type="button" className="workspace-button workspace-button--dark" onClick={validateAndComplete} disabled={busy}>{busy ? "Saving..." : completeLabel} <ArrowRight size={14} /></button></div></>}><div className="workflow-modal-body"><FormSummary items={validationItems} />{children}</div></Dialog>;
}

export function Drawer({ title, children, onClose, side = "right" }: { title: string; children: ReactNode; onClose: () => void; side?: "left" | "right" }) {
  return <Dialog title={title} onClose={onClose} className={`aa-drawer aa-drawer--${side}`}>{children}</Dialog>;
}

export const Popover = AriaPopover;
export const Menu = AriaMenu;
export const MenuItem = AriaMenuItem;
export { MenuTrigger };
export const Tooltip = AriaTooltip;
export { TooltipTrigger };

export type ActionMenuItem = {
  id: string;
  label: string;
  icon?: ReactNode;
  onAction?: () => void;
  href?: string;
  tone?: "danger";
};

export function ActionMenu({ label, items, trigger }: { label: string; items: ActionMenuItem[]; trigger: ReactNode }) {
  return <MenuTrigger><Button className="aa-menu-trigger" aria-label={label}>{trigger}</Button><AriaPopover className="aa-menu-popover" placement="bottom end"><AriaMenu aria-label={label} items={items} className="aa-menu-list">{(item) => <AriaMenuItem id={item.id} href={item.href} onAction={item.onAction} className={`aa-menu-item ${item.tone === "danger" ? "aa-menu-item--danger" : ""}`}>{item.icon}<span>{item.label}</span></AriaMenuItem>}</AriaMenu></AriaPopover></MenuTrigger>;
}

export function Toast({ children, tone = "success" }: { children: ReactNode; tone?: "success" | "error" | "info" }) {
  return <div className={`workspace-toast workspace-toast--${tone}`} role={tone === "error" ? "alert" : "status"} aria-live={tone === "error" ? "assertive" : "polite"}>{children}</div>;
}
