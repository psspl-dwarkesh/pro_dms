import { useEffect, useState } from "react";
import { apiGet } from "../../lib/api";
import { ComboBoxField } from "../components/forms";
import type { Customer, Vehicle } from "../types";

function useDebouncedSearch<T>(query: string, fetcher: (term: string, signal: AbortSignal) => Promise<T[]>) {
  const [results, setResults] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const term = query.trim();
    const normalizedPhone = term.replace(/\D/g, "");
    const canSearch = /[a-z]/i.test(term) ? term.length >= 2 : normalizedPhone.length >= 4;
    if (!canSearch) { setResults([]); setLoading(false); return; }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setLoading(true);
      fetcher(term, controller.signal)
        .then(setResults)
        .catch(() => { if (!controller.signal.aborted) setResults([]); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 250);
    return () => { controller.abort(); window.clearTimeout(timeout); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);
  return { results, loading };
}

type CustomerPickerProps = { selectedId: string; value: string; onSelect: (customer: Customer) => void; onClear?: () => void; placeholder?: string; label?: string; required?: boolean; className?: string };

export function CustomerPicker({ selectedId, value, onSelect, onClear, placeholder = "Search customer by name or mobile", label = "Customer", required, className }: CustomerPickerProps) {
  const [query, setQuery] = useState("");
  const { results, loading } = useDebouncedSearch<Customer>(query, (term, signal) =>
    apiGet<{ customers: Customer[] }>(`/api/v1/customers?q=${encodeURIComponent(term)}&limit=6`, { signal }).then((result) => result.customers));

  return <ComboBoxField className={className} label={label} required={required} items={results.map((customer) => ({ id: customer.id, primary: customer.displayName, secondary: customer.mobile ?? customer.email ?? "No contact on file", context: customer.customerType }))} inputValue={query || value} onInputChange={(next) => { if (selectedId && next !== value) onClear?.(); setQuery(next); }} selectedKey={selectedId || null} onSelectionChange={(key) => { const customer = results.find((item) => item.id === key); if (customer) { onSelect(customer); setQuery(customer.displayName); } else if (!key) onClear?.(); }} placeholder={placeholder} isLoading={loading} emptyMessage={query.trim() ? "No matching customers" : "Type a name or four phone digits"} />;
}

type VehiclePickerProps = { selectedId: string; value: string; onSelect: (vehicle: Vehicle) => void; onClear?: () => void; placeholder?: string; label?: string; required?: boolean; className?: string };

export function VehiclePicker({ selectedId, value, onSelect, onClear, placeholder = "Search vehicle by VIN, registration or model", label = "Vehicle", required, className }: VehiclePickerProps) {
  const [query, setQuery] = useState("");
  const { results, loading } = useDebouncedSearch<Vehicle>(query, (term, signal) =>
    apiGet<{ vehicles: Vehicle[] }>(`/api/v1/vehicles?q=${encodeURIComponent(term)}&limit=6`, { signal }).then((result) => result.vehicles));

  return <ComboBoxField className={className} label={label} required={required} items={results.map((vehicle) => ({ id: vehicle.id, primary: `${vehicle.make} ${vehicle.model}`, secondary: vehicle.registration ?? vehicle.vin, context: vehicle.status }))} inputValue={query || value} onInputChange={(next) => { if (selectedId && next !== value) onClear?.(); setQuery(next); }} selectedKey={selectedId || null} onSelectionChange={(key) => { const vehicle = results.find((item) => item.id === key); if (vehicle) { onSelect(vehicle); setQuery(`${vehicle.make} ${vehicle.model}`); } else if (!key) onClear?.(); }} placeholder={placeholder} isLoading={loading} emptyMessage={query.trim() ? "No matching vehicles" : "Type a VIN, registration, make, or model"} />;
}
