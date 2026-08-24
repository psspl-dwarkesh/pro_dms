import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ComboBoxField, FormSummary, TextField } from ".";

describe("shared form fields", () => {
  it("owns the persistent label, required state, help, and error relationships", () => {
    render(<TextField label="Work email" required description="Use the dealership address." error="Enter a valid email." value="bad" onChange={() => undefined} />);

    const input = screen.getByRole("textbox", { name: /work email/i });
    expect(input).toBeRequired();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Use the dealership address. Enter a valid email.");
    expect(screen.getByText("Required")).toBeVisible();
  });

  it("links a validation summary back to invalid controls and moves focus", async () => {
    const user = userEvent.setup();
    render(<><TextField id="customer-name" label="Customer name" error="Enter a name." /><FormSummary items={[{ fieldId: "customer-name", message: "Enter a customer name." }]} /></>);
    expect(screen.getByRole("link", { name: "Enter a customer name." })).toHaveAttribute("href", "#customer-name");
    await user.click(screen.getByRole("link", { name: "Enter a customer name." }));
    expect(screen.getByRole("textbox", { name: "Customer name" })).toHaveFocus();
  });

  it("supports keyboard selection in the shared record combobox", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    render(<ComboBoxField label="Customer" inputValue="pr" onInputChange={() => undefined} selectedKey={null} onSelectionChange={onSelectionChange} items={[{ id: "customer-1", primary: "Priya Shah", secondary: "+61 400 000 000" }]} />);

    const input = screen.getByRole("combobox", { name: "Customer" });
    await user.click(input);
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onSelectionChange).toHaveBeenCalledWith("customer-1");
  });
});
