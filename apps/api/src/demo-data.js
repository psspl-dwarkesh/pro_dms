const commonTimeline = [
  { occurredAt: "2026-08-18T10:00:00Z", type: "service", summary: "Scheduled service and inspection completed" },
  { occurredAt: "2026-06-12T10:00:00Z", type: "communication", summary: "Ownership review preference confirmed" },
  { occurredAt: "2025-11-14T10:00:00Z", type: "insurance", summary: "Comprehensive insurance policy verified" },
];

function vehicle(id, values) {
  return { id, variant: "Connected demonstration", colour: "Manufacturer finish", odometerKm: 28640, status: "customer-owned", ...values };
}

const vehicles = [
  vehicle("40000000-0000-0000-0000-000000000001", { vin: "WBAKS4C50J0Z12345", registration: "DMS-360", make: "BMW", model: "X5", variant: "xDrive40i", colour: "Alpine White", modelYear: 2024, odometerKm: 12450, marketValue: 109500 }),
  vehicle("40000000-0000-0000-0000-000000000002", { vin: "WAUZZZ4M5PD002204", registration: "ANQ-707", make: "Audi", model: "Q7", modelYear: 2025, marketValue: 148900, status: "enquiry" }),
  vehicle("40000000-0000-0000-0000-000000000003", { vin: "MPBUMFF50PX498814", registration: "PMG-814", make: "Ford", model: "Ranger", modelYear: 2023, marketValue: 67200 }),
  vehicle("40000000-0000-0000-0000-000000000004", { vin: "YV1UZBFV7R1120012", registration: "ECX-620", make: "Volvo", model: "XC60", modelYear: 2024, marketValue: 88900 }),
  vehicle("40000000-0000-0000-0000-000000000005", { vin: "JTMHV05J304188417", registration: "NWW-417", make: "Toyota", model: "LandCruiser", modelYear: 2025, marketValue: 119990, status: "enquiry" }),
  vehicle("40000000-0000-0000-0000-000000000006", { vin: "JM0KF4WLA004771906", registration: "MIA-425", make: "Mazda", model: "CX-5", modelYear: 2022, marketValue: 53400 }),
  vehicle("40000000-0000-0000-0000-000000000007", { vin: "W1NKM4HB8RF987772", registration: "LMW-882", make: "Mercedes-Benz", model: "GLC", modelYear: 2024, marketValue: 121400 }),
];

const customerDefinitions = [
  ["30000000-0000-0000-0000-000000000001", "James Hartley", "+61 412 345 678", "james.hartley@prakashinfotech.com", "WhatsApp", 127450, 0],
  ["30000000-0000-0000-0000-000000000002", "Ava Nguyen", "+61 417 220 184", "ava.nguyen@prakashinfotech.com", "Email", 148900, 1],
  ["30000000-0000-0000-0000-000000000003", "Rohan Mehta", "+61 409 518 230", "rohan.mehta@prakashinfotech.com", "SMS", 78450, 2],
  ["30000000-0000-0000-0000-000000000004", "Emily Chen", "+61 421 620 775", "emily.chen@prakashinfotech.com", "Email", 96800, 3],
  ["30000000-0000-0000-0000-000000000005", "Noah Williams", "+61 431 882 417", "noah.williams@prakashinfotech.com", "Phone", 119990, 4],
  ["30000000-0000-0000-0000-000000000006", "Mia Thompson", "+61 402 771 906", "mia.thompson@prakashinfotech.com", "SMS", 53400, 5],
  ["30000000-0000-0000-0000-000000000007", "Liam Wilson", "+61 418 450 992", "liam.wilson@prakashinfotech.com", "Email", 184250, 6],
];

export const demoCustomers = customerDefinitions.map(([id, displayName, mobile, email, preferredChannel, lifetimeValue, vehicleIndex]) => ({
  id,
  displayName,
  customerType: "individual",
  mobile,
  email,
  preferredChannel,
  address: "Pacific Motor Group customer · Australia",
  lifetimeValue,
  customerSince: "2021-01-04",
  serviceVisitCount: vehicleIndex % 3 === 1 ? 6 : 12,
  vehicles: [vehicles[vehicleIndex]],
  timeline: commonTimeline,
}));

export const demoVehicles = vehicles.map((item, index) => ({
  ...item,
  ownerId: demoCustomers[index].id,
  ownerName: demoCustomers[index].displayName,
  ownerMobile: demoCustomers[index].mobile,
  timeline: commonTimeline,
}));

export const demoCustomer = demoCustomers[0];

export const demoOperationalRecords = [
  { id: "RO-18506", kind: "repair-order", title: "RO-18506", subtitle: "Digital approval waiting", meta: "BMW X5 · James Hartley", view: "service" },
  { id: "RO-18492", kind: "repair-order", title: "RO-18492", subtitle: "Diagnostic support blocked", meta: "Volvo XC60 · Emily Chen", view: "service" },
  { id: "S-10982", kind: "deal", title: "Deal S-10982", subtitle: "Delivery pack ready", meta: "BMW X5 · James Hartley", view: "sales" },
  { id: "FI-62014", kind: "finance", title: "Finance FI-62014", subtitle: "Income evidence required", meta: "Audi Q7 · Ava Nguyen", view: "finance" },
  { id: "AP-1042", kind: "appraisal", title: "Appraisal AP-1042", subtitle: "Condition and market value complete", meta: "BMW X5 · DMS-360", view: "usedcars" },
];

export const overview = {
  dataSource: "demonstration",
  kpis: [
    { key: "revenueMtd", label: "Revenue MTD", value: 7400000, change: 12.4 },
    { key: "unitsSold", label: "Units sold", value: 324, change: 8 },
    { key: "activeJobs", label: "Active jobs", value: 138, change: 15.2 },
    { key: "csi", label: "CSI score", value: 4.78, change: 0.12 },
  ],
};
