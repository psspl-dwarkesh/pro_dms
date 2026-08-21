export const demoCustomer = {
  id: "30000000-0000-0000-0000-000000000001",
  displayName: "James Hartley",
  customerType: "individual",
  mobile: "+61 412 345 678",
  email: "james.hartley@prakashinfotech.com",
  preferredChannel: "WhatsApp",
  address: "14 Bayside Ave, Sydney NSW",
  lifetimeValue: 127450,
  customerSince: "2021-01-04",
  vehicles: [{
    id: "40000000-0000-0000-0000-000000000001",
    vin: "WBAKS4C50J0Z12345",
    registration: "DMS-360",
    make: "BMW",
    model: "X5",
    variant: "xDrive40i",
    colour: "Alpine White",
    modelYear: 2024,
    odometerKm: 12450,
    marketValue: 109500,
    status: "customer-owned",
  }],
  serviceVisitCount: 12,
  timeline: [
    { occurredAt: "2024-12-15T10:00:00Z", type: "delivery", summary: "Vehicle delivered — BMW X5 xDrive40i" },
    { occurredAt: "2024-11-03T10:00:00Z", type: "test-drive", summary: "BMW X5 and Mercedes GLE comparison" },
    { occurredAt: "2024-09-18T10:00:00Z", type: "service", summary: "60,000 km scheduled service completed" },
    { occurredAt: "2024-06-12T10:00:00Z", type: "finance", summary: "Finance approved — trade-in $34,500, loan $89,000" },
    { occurredAt: "2021-01-04T10:00:00Z", type: "purchase", summary: "First purchase — BMW 320i Luxury Line" },
  ],
};

export const overview = {
  dataSource: "demonstration",
  kpis: [
    { key: "revenueMtd", label: "Revenue MTD", value: 7400000, change: 12.4 },
    { key: "unitsSold", label: "Units sold", value: 324, change: 8 },
    { key: "activeJobs", label: "Active jobs", value: 138, change: 15.2 },
    { key: "csi", label: "CSI score", value: 4.78, change: 0.12 },
  ],
};
