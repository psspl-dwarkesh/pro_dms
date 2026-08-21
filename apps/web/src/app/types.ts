export type AppView = "landing" | "dashboard";

export type DashView =
  | "overview"
  | "sales"
  | "service"
  | "parts"
  | "finance"
  | "vehicles"
  | "customers"
  | "marketing"
  | "usedcars"
  | "inventory"
  | "branch"
  | "group"
  | "workforce";

export type Customer360 = {
  id: string;
  displayName: string;
  mobile: string;
  email: string;
  preferredChannel: string;
  address: string;
  lifetimeValue: number;
  customerSince: string;
  serviceVisitCount: number;
  vehicles: Array<{
    id?: string;
    make: string;
    model: string;
    variant: string;
    vin: string;
    registration?: string;
  }>;
  timeline: Array<{ occurredAt: string; type: string; summary: string }>;
};

export type Vehicle360 = {
  id: string;
  vin: string;
  registration: string;
  make: string;
  model: string;
  variant: string;
  colour: string;
  modelYear: number;
  odometerKm: number;
  marketValue: number;
  status: string;
  ownerName: string;
  ownerMobile: string;
  timeline: Array<{ occurredAt: string; type: string; summary: string }>;
};

export type DomainConfig = {
  title: string;
  eyebrow: string;
  description: string;
  action: string;
  metrics: Array<{ label: string; value: string; delta: string; tone?: "good" | "warn" | "bad" | "neutral" }>;
  queueTitle: string;
  queue: Array<{ primary: string; secondary: string; meta: string; status: string; tone: "good" | "warn" | "bad" | "neutral" }>;
  insightTitle: string;
  insight: string;
};
