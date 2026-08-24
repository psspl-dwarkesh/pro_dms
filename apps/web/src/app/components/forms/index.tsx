import { ChevronDown, Search } from "lucide-react";
import {
  Button,
  ComboBox as AriaComboBox,
  FieldError as AriaFieldError,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Text,
} from "react-aria-components";
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { useId } from "react";

type FieldChromeProps = {
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  className?: string;
};

type ControlIds = {
  id: string;
  describedBy?: string;
  errorId: string;
  descriptionId: string;
};

function classNames(...values: unknown[]) {
  return values.filter(Boolean).join(" ");
}

function useControlIds(id: string | undefined, description: ReactNode, error: ReactNode): ControlIds {
  const generatedId = useId();
  const controlId = id ?? `field-${generatedId.replaceAll(":", "")}`;
  const descriptionId = `${controlId}-description`;
  const errorId = `${controlId}-error`;
  return {
    id: controlId,
    describedBy: [description ? descriptionId : "", error ? errorId : ""].filter(Boolean).join(" ") || undefined,
    errorId,
    descriptionId,
  };
}

export function Field({
  label,
  description,
  error,
  required,
  className,
  controlId,
  children,
}: FieldChromeProps & { controlId: string; children: ReactNode }) {
  return (
    <div className={classNames("aa-field", error && "aa-field--invalid", className)}>
      <label className="aa-field-label" htmlFor={controlId}>
        <span>{label}</span>
        {required && <span className="aa-field-required">Required</span>}
      </label>
      {children}
      {description && <p className="aa-field-help" id={`${controlId}-description`}>{description}</p>}
      {error && <InlineError id={`${controlId}-error`}>{error}</InlineError>}
    </div>
  );
}

export function InlineError({ id, children }: { id?: string; children: ReactNode }) {
  return <p className="aa-inline-error" id={id}><span aria-hidden="true">!</span>{children}</p>;
}

export type TextFieldProps = FieldChromeProps & Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "required">;

export function TextField({ label, description, error, className, id, required, ...props }: TextFieldProps) {
  const ids = useControlIds(id, description, error);
  return (
    <Field label={label} description={description} error={error} required={required} className={className} controlId={ids.id}>
      <input {...props} id={ids.id} required={required} aria-invalid={error ? true : undefined} aria-describedby={ids.describedBy} />
    </Field>
  );
}

export type TextAreaProps = FieldChromeProps & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className" | "required">;

export function TextArea({ label, description, error, className, id, required, ...props }: TextAreaProps) {
  const ids = useControlIds(id, description, error);
  return (
    <Field label={label} description={description} error={error} required={required} className={className} controlId={ids.id}>
      <textarea {...props} id={ids.id} required={required} aria-invalid={error ? true : undefined} aria-describedby={ids.describedBy} />
    </Field>
  );
}

export type SelectFieldProps = FieldChromeProps & Omit<SelectHTMLAttributes<HTMLSelectElement>, "className" | "required">;

export function SelectField({ label, description, error, className, id, required, children, ...props }: SelectFieldProps) {
  const ids = useControlIds(id, description, error);
  return (
    <Field label={label} description={description} error={error} required={required} className={className} controlId={ids.id}>
      <select {...props} id={ids.id} required={required} aria-invalid={error ? true : undefined} aria-describedby={ids.describedBy}>{children}</select>
    </Field>
  );
}

export function DateField(props: Omit<TextFieldProps, "type">) {
  return <TextField {...props} type="date" />;
}

export function DateTimeField(props: Omit<TextFieldProps, "type">) {
  return <TextField {...props} type="datetime-local" />;
}

export function CurrencyField({ currency = "AUD", ...props }: Omit<TextFieldProps, "type" | "inputMode"> & { currency?: string }) {
  return <TextField {...props} type="number" inputMode="decimal" min={props.min ?? 0} step={props.step ?? "0.01"} description={props.description ?? `Amount in ${currency}.`} />;
}

export function PhoneField(props: Omit<TextFieldProps, "type" | "inputMode">) {
  return <TextField {...props} type="tel" inputMode="tel" autoComplete={props.autoComplete ?? "tel"} />;
}

export type CheckboxFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className"> & {
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  className?: string;
};

export function CheckboxField({ label, description, error, className, id, ...props }: CheckboxFieldProps) {
  const ids = useControlIds(id, description, error);
  return (
    <div className={classNames("aa-checkbox-field", error && "aa-field--invalid", className)}>
      <label htmlFor={ids.id}><input {...props} id={ids.id} type="checkbox" aria-invalid={error ? true : undefined} aria-describedby={ids.describedBy} /><span>{label}</span></label>
      {description && <p className="aa-field-help" id={ids.descriptionId}>{description}</p>}
      {error && <InlineError id={ids.errorId}>{error}</InlineError>}
    </div>
  );
}

export function FieldGroup({ legend, description, children, className }: { legend: ReactNode; description?: ReactNode; children: ReactNode; className?: string }) {
  return <fieldset className={classNames("aa-field-group", className)}><legend>{legend}</legend>{description && <p>{description}</p>}<div>{children}</div></fieldset>;
}

export function FormActions({ children, destructive }: { children: ReactNode; destructive?: ReactNode }) {
  return <div className="aa-form-actions">{destructive && <div className="aa-form-actions-danger">{destructive}</div>}<div>{children}</div></div>;
}

export type FormSummaryItem = { fieldId: string; message: string };

export function FormSummary({ title = "Check the highlighted fields", items }: { title?: string; items: FormSummaryItem[] }) {
  if (!items.length) return null;
  return <div className="aa-form-summary" role="alert" tabIndex={-1}><strong>{title}</strong><ul>{items.map((item) => <li key={item.fieldId}><a href={`#${item.fieldId}`} onClick={(event) => { event.preventDefault(); document.getElementById(item.fieldId)?.focus(); }}>{item.message}</a></li>)}</ul></div>;
}

export type ComboBoxOption = {
  id: string;
  primary: string;
  secondary?: string;
  context?: string;
  status?: string;
};

export type ComboBoxFieldProps = FieldChromeProps & {
  items: ComboBoxOption[];
  inputValue: string;
  onInputChange: (value: string) => void;
  selectedKey?: string | null;
  onSelectionChange: (key: string | null) => void;
  placeholder?: string;
  isLoading?: boolean;
  emptyMessage?: string;
  disabled?: boolean;
  name?: string;
};

export function ComboBoxField({
  label,
  description,
  error,
  className,
  required,
  items,
  inputValue,
  onInputChange,
  selectedKey,
  onSelectionChange,
  placeholder,
  isLoading,
  emptyMessage = "No matching records",
  disabled,
  name,
}: ComboBoxFieldProps) {
  return (
    <AriaComboBox<ComboBoxOption>
      className={classNames("aa-field aa-combobox", error && "aa-field--invalid", className)}
      items={items}
      inputValue={inputValue}
      onInputChange={onInputChange}
      selectedKey={selectedKey}
      onSelectionChange={(key) => onSelectionChange(key === null ? null : String(key))}
      isRequired={required}
      isInvalid={Boolean(error)}
      isDisabled={disabled}
      name={name}
      allowsEmptyCollection
      menuTrigger="focus"
    >
      <Label className="aa-field-label"><span>{label}</span>{required && <span className="aa-field-required">Required</span>}</Label>
      <div className="aa-combobox-control"><Search aria-hidden="true" /><Input placeholder={placeholder} /><Button aria-label="Show options"><ChevronDown /></Button></div>
      {description && <Text className="aa-field-help" slot="description">{description}</Text>}
      {error && <AriaFieldError className="aa-inline-error"><span aria-hidden="true">!</span>{error}</AriaFieldError>}
      <Popover className="aa-combobox-popover">
        <ListBox<ComboBoxOption> className="aa-combobox-list" renderEmptyState={() => <div className="aa-combobox-empty">{isLoading ? "Searching records..." : emptyMessage}</div>}>
          {(item) => <ListBoxItem id={item.id} textValue={`${item.primary} ${item.secondary ?? ""}`} className="aa-combobox-option"><strong>{item.primary}</strong>{item.secondary && <span>{item.secondary}</span>}{(item.context || item.status) && <small>{[item.context, item.status].filter(Boolean).join(" · ")}</small>}</ListBoxItem>}
        </ListBox>
      </Popover>
    </AriaComboBox>
  );
}
