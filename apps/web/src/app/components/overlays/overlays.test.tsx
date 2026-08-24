import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { AlertDialog, Dialog, WorkflowDialog } from ".";
import { TextField } from "../forms";

describe("shared overlay primitives", () => {
  it("dismisses with Escape and restores focus to the trigger", async () => {
    const user = userEvent.setup();
    function Harness() {
      const [open, setOpen] = useState(false);
      return <><button type="button" onClick={() => setOpen(true)}>Open dialog</button>{open && <Dialog title="Edit customer" onClose={() => setOpen(false)}><button type="button">Inside action</button></Dialog>}</>;
    }

    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Open dialog" });
    await user.click(trigger);
    expect(screen.getByRole("dialog", { name: "Edit customer" })).toBeVisible();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it("keeps destructive confirmation focus on Cancel initially", async () => {
    const onCancel = vi.fn();
    render(<AlertDialog title="Delete customer?" message="This cannot be undone." confirmLabel="Delete" onCancel={onCancel} onConfirm={() => undefined} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus());
    expect(screen.getByRole("alertdialog", { name: "Delete customer?" })).toBeVisible();
  });

  it("keeps Tab and Shift+Tab within a modal", async () => {
    const user = userEvent.setup();
    render(<Dialog title="Contained dialog" onClose={() => undefined}><button type="button">First action</button><button type="button">Last action</button></Dialog>);
    const dialog = screen.getByRole("dialog", { name: "Contained dialog" });
    const last = screen.getByRole("button", { name: "Last action" });
    await waitFor(() => expect(dialog).toHaveFocus());
    await user.tab({ shift: true });
    expect(last).toHaveFocus();
  });

  it("focuses the first invalid workflow field and renders linked validation summary", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<WorkflowDialog title="Create customer" eyebrow="Customer master" onClose={() => undefined} onComplete={onComplete}><TextField id="customer-name" label="Customer name" required value="" onChange={() => undefined} /></WorkflowDialog>);
    await user.click(screen.getByRole("button", { name: /save/i }));
    const field = screen.getByRole("textbox", { name: /customer name/i });
    expect(field).toHaveFocus();
    expect(screen.getByRole("link", { name: /customer name/i })).toHaveAttribute("href", "#customer-name");
    expect(onComplete).not.toHaveBeenCalled();
  });
});
