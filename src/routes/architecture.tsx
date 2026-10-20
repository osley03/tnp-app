import { createFileRoute } from "@tanstack/react-router";
import { Page, TopBar, Card } from "@/components/tnp/Shell";

export const Route = createFileRoute("/architecture")({
  head: () => ({
    meta: [
      { title: "System architecture — TNP core modules & integrations" },
      {
        name: "description",
        content:
          "TNP architecture: nine core modules, client/application/service/data layers, external integrations for payments, KYC, 360° tours, SMS and ledger anchoring.",
      },
      { property: "og:title", content: "System architecture — TNP" },
      {
        property: "og:description",
        content:
          "Core modules, service layer, data layer and external integrations of the TNP platform.",
      },
    ],
  }),
  component: Architecture,
});

const modules = [
  { n: "1", t: "Profiles & Verification", d: "Registration · ID/KYC · trust scoring" },
  { n: "2", t: "Property & Listings", d: "Add/edit · search & filter · listing history" },
  { n: "3", t: "Leases & Documents", d: "Digital lease · e-signature · secure storage" },
  { n: "4", t: "Payments & Escrow", d: "Deposits · rent · payouts & refunds" },
  { n: "5", t: "Reviews & Reputation", d: "Two-way reviews · verified badges" },
  { n: "6", t: "Disputes & Resolutions", d: "Submission · mediation · comms log" },
  { n: "7", t: "Scam Reporting & Cases", d: "Report · investigate · resolve · track" },
  { n: "8", t: "AI Assistance", d: "Matching · fraud risk · price insights" },
  { n: "9", t: "Accessibility (USSD/SMS)", d: "*310# lookups · low-data & offline" },
];

const integrations = [
  { k: "PAYMENTS", v: "EcoCash · OneMoney · bank transfer" },
  { k: "DIGITAL ID", v: "ID verification · biometric · KYC checks" },
  { k: "360° TOURS", v: "Photo Sphere · room-to-room · CDN media" },
  { k: "SMS / EMAIL", v: "Notifications · alerts · OTP" },
  { k: "LEDGER", v: "Tenancy hash · timestamp · tamper evidence" },
  { k: "THIRD PARTY", v: "Credit & risk · blacklist · gov't verification" },
];

const services = [
  "Auth",
  "User",
  "Property",
  "Lease",
  "Payment",
  "Review",
  "Dispute",
  "Case",
  "Notification",
];

const dataStores = [
  "User DB",
  "Property DB",
  "Transaction DB",
  "Lease DB",
  "Review DB",
  "Dispute DB",
  "Case DB",
  "Logs & Audit",
  "Media Storage",
];

function Architecture() {
  return (
    <Page>
      <TopBar role="ADMIN" who="System architecture" back={{ to: "/", label: "Roles" }} />

      <div className="space-y-3">
        <Card index="a" title="Client layer" meta="web · mobile · USSD">
          <div className="flex flex-wrap gap-1.5">
            {["Web portal", "Android app", "USSD *310#", "SMS", "Email", "Push"].map((c) => (
              <span
                key={c}
                className="rounded bg-panel-2 px-2 py-1 font-mono text-[9px] text-mut ring-1 ring-line"
              >
                {c}
              </span>
            ))}
          </div>
        </Card>

        <Card index="b" title="Application layer" meta="9 core modules">
          <div className="grid grid-cols-1 gap-2">
            {modules.map((m) => (
              <div
                key={m.n}
                className="flex gap-2.5 rounded-lg bg-panel-2 px-2.5 py-2 ring-1 ring-line"
              >
                <span className="mt-0.5 font-mono text-[9px] text-ochre">{m.n}</span>
                <div>
                  <p className="font-display text-[12px] font-medium">{m.t}</p>
                  <p className="mt-0.5 text-[11px] text-mut">{m.d}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card index="c" title="Service layer" meta="microservices">
          <div className="flex flex-wrap gap-1.5">
            {services.map((s) => (
              <span
                key={s}
                className="rounded bg-terra/10 px-2 py-1 font-mono text-[9px] text-terra ring-1 ring-terra/25"
              >
                {s}
              </span>
            ))}
          </div>
        </Card>

        <Card index="d" title="Data layer" meta="Postgres · object storage">
          <div className="flex flex-wrap gap-1.5">
            {dataStores.map((s) => (
              <span
                key={s}
                className="rounded bg-panel-2 px-2 py-1 font-mono text-[9px] text-mut ring-1 ring-line"
              >
                {s}
              </span>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-mut">
            Redis cache · message queue for jobs and alerts.
          </p>
        </Card>

        <Card index="e" title="External integrations" meta="APIs">
          <div className="space-y-2">
            {integrations.map((i) => (
              <div key={i.k} className="rounded-lg bg-panel-2 px-2.5 py-2 ring-1 ring-line">
                <p className="font-mono text-[9px] text-ochre">{i.k}</p>
                <p className="mt-0.5 text-[11px]">{i.v}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card index="f" title="Security & governance" meta="across all layers">
          <p className="text-[11px] text-mut">
            RBAC · MFA · session management · encryption in transit and at rest · audit logging ·
            backup & disaster recovery · POPIA/GDPR-ready privacy controls.
          </p>
        </Card>
      </div>
    </Page>
  );
}
