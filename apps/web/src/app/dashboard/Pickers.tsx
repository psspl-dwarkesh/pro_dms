import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { apiGet } from "../../lib/api";
import type { Customer, Vehicle } from "../types";

function useDebouncedSearch<T>(query: string, fetcher: (term: string) => Promise<T[]>, minLength = 2) {
  const [results, setResults] = useState<T[]>([]);
  useEffect(() => {
    const term = query.trim();
    if (term.length < minLength) { setResults([]); return; }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      fetcher(term).then(setResults).catch(() => setResults([]));
    }, 250);
    return () => { controller.abort(); window.clearTimeout(timeout); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);
  return results;
}

type CustomerPickerProps = { value: string; onSelect: (customer: Customer) => void; placeholder?: string };

export function CustomerPicker({ value, onSelect, placeholder = "Search customer by name or mobile" }: CustomerPickerProps) {
  const [query, setQuery] = useState("");
  const results = useDebouncedSearch<Customer>(query, (term) =>
    apiGet<{ customers: Customer[] }>(`/api/v1/customers?q=${encodeURIComponent(term)}&limit=6`).then((result) => result.customers));

  return (
    <div className="picker-field">
      <div className="picker-input"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={placeholder} /></div>
      {value && <span className="picker-selected">Selected: {value}</span>}
      {results.length > 0 && <div className="picker-results">{results.map((customer) => <button type="button" key={customer.id} onClick={() => { onSelect(customer); setQuery(""); }}>{customer.displayName} - {customer.mobile ?? customer.email ?? "no contact"}</button>)}</div>}
    </div>
  );
}

type VehiclePickerProps = { value: string; onSelect: (vehicle: Vehicle) => void; placeholder?: string };

export function VehiclePicker({ value, onSelect, placeholder = "Search vehicle by VIN, registration or model" }: VehiclePickerProps) {
  const [query, setQuery] = useState("");
  const results = useDebouncedSearch<Vehicle>(query, (term) =>
    apiGet<{ vehicles: Vehicle[] }>(`/api/v1/vehicles?q=${encodeURIComponent(term)}&limit=6`).then((result) => result.vehicles));

  return (
    <div className="picker-field">
      <div className="picker-input"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={placeholder} /></div>
      {value && <span className="picker-selected">Selected: {value}</span>}
      {results.length > 0 && <div className="picker-results">{results.map((vehicle) => <button type="button" key={vehicle.id} onClick={() => { onSelect(vehicle); setQuery(""); }}>{vehicle.make} {vehicle.model} - {vehicle.registration ?? vehicle.vin}</button>)}</div>}
    </div>
  );
}
