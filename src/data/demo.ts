import housingBg from "@/assets/housing-bg.jpg";
import tourPanorama from "@/assets/tour-panorama.jpg";

export const images = { housingBg, tourPanorama };

export type Landlord = {
  id: string;
  name: string;
  initials: string;
  trust: number;
  verified: string;
  since: string;
  units: number;
  depositReturnRate: string;
  disputes: number;
  reviews: { by: string; stars: string; body: string; tenure: string }[];
};

export type Property = {
  id: string;
  title: string;
  suburb: string;
  rent: string;
  beds: number;
  baths: number;
  type: "Residential" | "Office";
  landlordId: string;
  flags: string[];
  deposit: string;
  amenities: string[];
};

export type Tenant = {
  id: string;
  name: string;
  initials: string;
  trust: number;
  verified: string;
  employer: string;
  income: string;
  onTimeRate: string;
  tenures: string;
  disputes: number;
  references: { by: string; stars: string; body: string }[];
};

export const landlords: Record<string, Landlord> = {
  "ll-1": {
    id: "ll-1",
    name: "R. Chikafu",
    initials: "RC",
    trust: 92,
    verified: "National ID + title deed",
    since: "2019",
    units: 7,
    depositReturnRate: "96%",
    disputes: 1,
    reviews: [
      {
        by: "T. Moyo",
        stars: "★★★★★",
        body: "Released deposit in 5 days, no hidden fees.",
        tenure: "2y 1m · Avondale",
      },
      {
        by: "P. Ncube",
        stars: "★★★★☆",
        body: "Repairs took a week but always communicated.",
        tenure: "1y 4m · Belvedere",
      },
    ],
  },
  "ll-2": {
    id: "ll-2",
    name: "M. Dube",
    initials: "MD",
    trust: 74,
    verified: "National ID only",
    since: "2022",
    units: 3,
    depositReturnRate: "81%",
    disputes: 2,
    reviews: [
      {
        by: "K. Sibanda",
        stars: "★★★☆☆",
        body: "Deposit partially withheld, resolved through TNP mediation.",
        tenure: "11m · Waterfalls",
      },
    ],
  },
};

export const properties: Property[] = [
  {
    id: "p-1",
    title: "2-Bed Garden Flat",
    suburb: "Avondale, Harare",
    rent: "$450/mo",
    beds: 2,
    baths: 1,
    type: "Residential",
    landlordId: "ll-1",
    flags: [],
    deposit: "$450 escrow",
    amenities: ["Borehole", "Solar backup", "Walled yard"],
  },
  {
    id: "p-2",
    title: "Open-Plan Office Suite",
    suburb: "Msasa, Harare",
    rent: "$1,200/mo",
    beds: 0,
    baths: 2,
    type: "Office",
    landlordId: "ll-1",
    flags: [],
    deposit: "$1,200 escrow",
    amenities: ["Fibre", "Generator", "Parking ×6"],
  },
  {
    id: "p-3",
    title: "3-Bed Family House",
    suburb: "Waterfalls, Harare",
    rent: "$600/mo",
    beds: 3,
    baths: 2,
    type: "Residential",
    landlordId: "ll-2",
    flags: ["Reused listing photo · 0.87 confidence"],
    deposit: "$600 escrow",
    amenities: ["Tiled floors", "Prepaid ZESA"],
  },
];

export const tenants: Record<string, Tenant> = {
  "tn-1": {
    id: "tn-1",
    name: "T. Moyo",
    initials: "TM",
    trust: 92,
    verified: "ID + biometric + payslip",
    employer: "Econet Wireless · 3y",
    income: "$1,450/mo declared",
    onTimeRate: "98%",
    tenures: "4y 2m across 2 leases",
    disputes: 1,
    references: [
      { by: "R. Chikafu", stars: "★★★★★", body: "Paid rent on schedule, kept the unit clean." },
      { by: "S. Marufu", stars: "★★★★☆", body: "Good tenant, gave proper notice." },
    ],
  },
  "tn-2": {
    id: "tn-2",
    name: "K. Sibanda",
    initials: "KS",
    trust: 61,
    verified: "ID only · payslip pending",
    employer: "Self-employed · retail",
    income: "$900/mo declared",
    onTimeRate: "72%",
    tenures: "11m across 1 lease",
    disputes: 2,
    references: [
      { by: "M. Dube", stars: "★★☆☆☆", body: "Two late payments, damage to kitchen fittings." },
    ],
  },
};

export type LeaseRequest = {
  id: string;
  tenantId: string;
  propertyId: string;
  submitted: string;
  moveIn: string;
  status: "Pending review" | "Escrow funded" | "Declined";
};

export const leaseRequests: LeaseRequest[] = [
  {
    id: "rq-1",
    tenantId: "tn-1",
    propertyId: "p-1",
    submitted: "28 Aug 2026",
    moveIn: "01 Oct 2026",
    status: "Escrow funded",
  },
  {
    id: "rq-2",
    tenantId: "tn-2",
    propertyId: "p-2",
    submitted: "31 Aug 2026",
    moveIn: "15 Sep 2026",
    status: "Pending review",
  },
];

/* ---------- Module 6: Disputes & resolutions ---------- */
export type Dispute = {
  id: string;
  ref: string;
  title: string;
  between: string;
  opened: string;
  stage: "Mediation" | "Awaiting evidence" | "Resolved";
  amount: string;
};

export const disputes: Dispute[] = [
  {
    id: "d-1",
    ref: "DSP-2026-0114",
    title: "Deposit withheld after move-out",
    between: "K. Sibanda ↔ M. Dube",
    opened: "12 Aug 2026",
    stage: "Mediation",
    amount: "$300",
  },
  {
    id: "d-2",
    ref: "DSP-2025-0921",
    title: "Unrepaired geyser · rent abatement",
    between: "P. Ncube ↔ R. Chikafu",
    opened: "21 Sep 2025",
    stage: "Resolved",
    amount: "$80",
  },
];

/* ---------- Module 7: Scam reporting, verification & case resolution ---------- */
export type CaseStatus =
  | "Submitted"
  | "Under Investigation"
  | "Action Required"
  | "In Progress"
  | "Resolved"
  | "Closed";

export const caseStatuses: CaseStatus[] = [
  "Submitted",
  "Under Investigation",
  "Action Required",
  "In Progress",
  "Resolved",
  "Closed",
];

export type ScamCase = {
  id: string;
  ref: string;
  type: "Fake listing" | "Deposit theft" | "Land/property assistance" | "Impersonation";
  summary: string;
  reporter: string;
  accused: string;
  loss: string;
  submitted: string;
  status: CaseStatus;
  officer: string;
  evidence: { label: string; hash: string }[];
  timeline: { at: string; what: string; by: string }[];
};

export const scamCases: ScamCase[] = [
  {
    id: "c-1",
    ref: "TNP-SC-2026-0042",
    type: "Deposit theft",
    summary: "Paid $400 deposit via EcoCash for a Belvedere flat; agent went silent, unit already occupied.",
    reporter: "K. Sibanda",
    accused: "Unverified agent · +263 77x xxx 918",
    loss: "$400",
    submitted: "29 Aug 2026",
    status: "Under Investigation",
    officer: "Case officer · N. Tafara",
    evidence: [
      { label: "EcoCash receipt.pdf", hash: "0x9d1c…44b2" },
      { label: "WhatsApp thread.zip", hash: "0x2ef0…8a17" },
    ],
    timeline: [
      { at: "29 Aug 2026", what: "Report submitted via web portal", by: "Reporter" },
      { at: "30 Aug 2026", what: "Assigned to investigation team", by: "Admin" },
      { at: "01 Sep 2026", what: "Payment reference verified with gateway", by: "Case officer" },
    ],
  },
  {
    id: "c-2",
    ref: "TNP-SC-2026-0039",
    type: "Fake listing",
    summary: "Listing photos reused from a published Avondale unit; pgvector image match at 0.87 confidence.",
    reporter: "Automated · fraud engine",
    accused: "Listing p-3 · M. Dube",
    loss: "$0 (blocked pre-payment)",
    submitted: "21 Aug 2026",
    status: "Action Required",
    officer: "Case officer · L. Mhaka",
    evidence: [{ label: "image-hash-match.json", hash: "0x77aa…1c9e" }],
    timeline: [
      { at: "21 Aug 2026", what: "Flag raised by fraud engine", by: "System" },
      { at: "22 Aug 2026", what: "Listing suspended pending response", by: "Moderator" },
      { at: "31 Aug 2026", what: "Accused party asked for proof of ownership", by: "Case officer" },
    ],
  },
  {
    id: "c-3",
    ref: "TNP-SC-2026-0031",
    type: "Land/property assistance",
    summary: "Double-allocated stand in Ruwa; reporter requested help tracing the rightful title holder.",
    reporter: "T. Moyo",
    accused: "Third-party seller",
    loss: "$1,100",
    submitted: "04 Jul 2026",
    status: "Resolved",
    officer: "Case officer · N. Tafara",
    evidence: [{ label: "deed-search.pdf", hash: "0x5b31…d902" }],
    timeline: [
      { at: "04 Jul 2026", what: "Report submitted via USSD *310#", by: "Reporter" },
      { at: "10 Jul 2026", what: "Deeds office record retrieved", by: "Case officer" },
      { at: "26 Jul 2026", what: "Settlement agreed · $1,100 recovered", by: "Case officer" },
    ],
  },
];

/* ---------- Verification queue (Profiles & Verification module) ---------- */
export const verificationQueue = [
  { id: "v-1", who: "K. Sibanda", kind: "Payslip + ID re-check", waiting: "2d", risk: "Medium" },
  { id: "v-2", who: "New landlord · S. Marufu", kind: "Title deed + biometric", waiting: "6h", risk: "Low" },
  { id: "v-3", who: "Listing p-3 photos", kind: "Image provenance", waiting: "1d", risk: "High" },
];

/* ---------- Module 8: AI assistance ---------- */
export const aiMatches = [
  { propertyId: "p-1", why: "Fits $500 budget, 2 beds, 12 min from your workplace", score: "0.94" },
  { propertyId: "p-2", why: "Matches saved search 'office, fibre, Msasa'", score: "0.71" },
];

export const priceInsights = [
  { area: "Avondale · 2 bed", median: "$470", trend: "+4% YoY" },
  { area: "Msasa · office/m²", median: "$8.50", trend: "-2% YoY" },
];
