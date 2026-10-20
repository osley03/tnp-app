import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock3,
  DollarSign,
  FileText,
  ShieldCheck,
  Star,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { RoleSidebar } from "@/components/dashboard/RoleSidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";

const db: typeof supabase = supabase;

export const Route = createFileRoute("/_authenticated/app/landlord/portfolio")({
  component: LandlordPortfolio,
});

type Property = {
  id: string;
  owner_id: string;
  title: string | null;
  suburb: string | null;
  city: string | null;
  rent_usd: number | null;
  verified: boolean | null;
  available: boolean | null;
  fraud_flags: string[] | null;
  created_at: string;
};

type LeaseRequest = {
  id: string;
  property_id: string;
  tenant_id: string;
  status: string | null;
  move_in: string | null;
  created_at: string;
};

type Lease = {
  id: string;
  property_id?: string | null;
  tenant_id?: string | null;
  status?: string | null;
  start_date?: string | null;
  end_date?: string | null;
};

type Payment = {
  id: string;
  amount_usd?: number | string | null;
  status?: string | null;
  lease_id?: string | null;
  payment_status?: string | null;
};

type Review = {
  id: string;
  property_id?: string | null;
  rating?: number | null;
  status?: string | null;
};

type Dispute = {
  id: string;
  property_id: string | null;
  status: string | null;
  priority: string | null;
  amount: number | null;
  created_at: string;
};

function number(value: number | string | null | undefined) {
  const parsed=Number(value ?? 0); return Number.isFinite(parsed)?parsed:0;
}

function money(value: number) {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function percent(value: number) {
  return `${Math.round(value)}%`;
}

function statusIs(value: string | null | undefined, values: string[]) {
  return values.includes(String(value ?? "").toLowerCase());
}

function LandlordPortfolio() {
  const {user:session}=useRouteContext({from:"/_authenticated"});
  const sessionLoading=false;

  const userId = session?.id;

  const { data, isLoading, error } = useQuery({
    queryKey: ["landlord-portfolio", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      if (!userId) {
        throw new Error("No authenticated landlord found.");
      }

      const { data: properties, error: propertiesError } = await supabase
        .from("properties")
        .select(
          "id, owner_id, title, suburb, city, rent_usd, verified, available, fraud_flags, created_at",
        )
        .eq("owner_id", userId)
        .order("created_at", { ascending: false });

      if (propertiesError) throw propertiesError;

      const typedProperties = (properties ?? []) as Property[];
      const propertyIds = typedProperties.map((property) => property.id);

      let leaseRequests: LeaseRequest[] = [];
      let leases: Lease[] = [];
      let payments: Payment[] = [];
      let reviews: Review[] = [];
      let disputes: Dispute[] = [];

      if (propertyIds.length > 0) {
        const { data: requests, error: requestError } = await supabase
          .from("lease_requests")
          .select("id, property_id, tenant_id, status, move_in, created_at")
          .in("property_id", propertyIds);

        if (requestError) throw requestError;
        leaseRequests = (requests ?? []) as LeaseRequest[];

        const { data: disputeRows, error: disputeError } = await supabase
          .from("disputes" as never)
          .select("id, property_id, status, priority, amount, created_at")
          .in("property_id", propertyIds);

        if (disputeError) throw disputeError;
        disputes = (disputeRows ?? []) as Dispute[];

        try {
          const { data: reviewRows } = await supabase
            .from("reviews")
            .select("id, property_id, rating")
            .in("property_id", propertyIds);

          reviews = (reviewRows ?? []) as Review[];
        } catch {
          reviews = [];
        }
      }

      const leaseResult=await supabase.from('leases' as never).select('*').eq('landlord_id',userId);
      if(leaseResult.error)throw leaseResult.error;
      leases=(leaseResult.data??[]) as Lease[];
      const leaseIds=leases.map(lease=>lease.id);
      if(leaseIds.length){const result=await supabase.from('lease_payments' as never).select('*').in('lease_id',leaseIds);if(result.error)throw result.error;payments=(result.data??[]) as Payment[];}

      return {
        properties: typedProperties,
        leaseRequests,
        leases,
        payments,
        reviews,
        disputes,
      };
    },
  });

  const properties = data?.properties ?? [];
  const leaseRequests = data?.leaseRequests ?? [];
  const leases = data?.leases ?? [];
  const payments = data?.payments ?? [];
  const reviews = data?.reviews ?? [];
  const disputes = data?.disputes ?? [];

  const totalProperties = properties.length;

  const verifiedProperties = properties.filter((property) => property.verified === true).length;

  const availableProperties = properties.filter((property) => property.available === true).length;

  const occupiedProperties = properties.filter((property) => property.available === false).length;

  const propertiesWithIssues = properties.filter(
    (property) => Array.isArray(property.fraud_flags) && property.fraud_flags.length > 0,
  ).length;

  const criticalProperties = properties.filter((property) =>
    (property.fraud_flags ?? []).some((flag) => /critical|fraud|scam/i.test(flag)),
  ).length;

  const occupancyRate = totalProperties > 0 ? (occupiedProperties / totalProperties) * 100 : 0;

  const verificationRate = totalProperties > 0 ? (verifiedProperties / totalProperties) * 100 : 0;

  const expectedMonthlyRent = properties
    .filter((property) => property.available === false)
    .reduce((total, property) => total + number(property.rent_usd), 0);

  const portfolioMonthlyRent = properties.reduce(
    (total, property) => total + number(property.rent_usd),
    0,
  );

  const expectedAnnualRent = expectedMonthlyRent * 12;

  const averageRent = totalProperties > 0 ? portfolioMonthlyRent / totalProperties : 0;

  const pendingRequests = leaseRequests.filter((request) =>
    statusIs(request.status, ["pending", "pending review", "pending_review", "submitted", "under review", "under_review"]),
  ).length;

  const approvedRequests = leaseRequests.filter((request) =>
    statusIs(request.status, ["approved", "accepted"]),
  ).length;

  const rejectedRequests = leaseRequests.filter((request) =>
    statusIs(request.status, ["rejected", "declined"]),
  ).length;

  const leaseConversionRate =
    leaseRequests.length > 0 ? (approvedRequests / leaseRequests.length) * 100 : 0;

  const activeLeases = leases.filter((lease) =>
    statusIs(lease.status, ["active", "signed", "running", "disputed"]),
  ).length;

  const totalPaymentValue = payments.reduce((total, payment) => total + number(payment.amount_usd), 0);

  const collectedPayments = payments
    .filter((payment) =>
      statusIs(payment.status ?? payment.payment_status, [
        "paid",
        "completed",
        "released",
        "collected",
      ]),
    )
    .reduce((total, payment) => total + number(payment.amount_usd), 0);

  const pendingPayments = payments
    .filter((payment) =>
      statusIs(payment.status ?? payment.payment_status, ["pending", "processing", "awaiting"]),
    )
    .reduce((total, payment) => total + number(payment.amount_usd), 0);

  const heldPayments = payments
    .filter((payment) => statusIs(payment.status ?? payment.payment_status, ["held", "escrow"]))
    .reduce((total, payment) => total + number(payment.amount_usd), 0);

  const collectionRate = totalPaymentValue > 0 ? (collectedPayments / totalPaymentValue) * 100 : 0;

  const averageRating =
    reviews.length > 0
      ? reviews.reduce((total, review) => total + number(review.rating), 0) / reviews.length
      : 0;

  const openDisputes = disputes.filter((dispute) => statusIs(dispute.status, ["open"])).length;

  const underReviewDisputes = disputes.filter((dispute) =>
    statusIs(dispute.status, ["under_review"]),
  ).length;

  const resolvedDisputes = disputes.filter((dispute) =>
    statusIs(dispute.status, ["resolved", "closed"]),
  ).length;

  const criticalDisputes = disputes.filter((dispute) =>
    statusIs(dispute.priority, ["critical"]),
  ).length;

  const disputedAmount = disputes.reduce((total, dispute) => total + number(dispute.amount), 0);

  const disputeResolutionRate =
    disputes.length > 0 ? (resolvedDisputes / disputes.length) * 100 : 0;

  const listingHealth =
    totalProperties === 0
      ? 0
      : Math.max(
          0,
          Math.round(
            ((verifiedProperties - Math.min(propertiesWithIssues, verifiedProperties)) /
              totalProperties) *
              100,
          ),
        );

  const loading = sessionLoading || isLoading;

  return (
    <SidebarProvider><div className="tnp-module tnp-module-light min-h-screen w-full bg-white text-slate-900">
      <div className="flex min-h-screen">
        <RoleSidebar role="landlord" />

        <main className="min-w-0 flex-1 bg-slate-50">
          <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
            {/* Header */}
            <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-500">
                    <BarChart3 className="h-4 w-4" />
                    Landlord Portal / Portfolio Insights
                  </div>

                  <h1 className="text-2xl font-bold tracking-tight text-slate-950">
                    Portfolio Insights
                  </h1>

                  <p className="mt-1 max-w-3xl text-sm text-slate-500">
                    Live analytics calculated from your properties, lease activity, payments,
                    reviews and disputes.
                  </p>
                </div>

                <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <Activity className="h-4 w-4 text-emerald-600" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                      Analytics Status
                    </p>
                    <p className="text-sm font-semibold text-emerald-800">Live portfolio data</p>
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                Unable to load portfolio analytics. Please refresh and try again.
              </div>
            )}

            {/* Primary metrics */}
            <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                icon={<Building2 className="h-5 w-5" />}
                label="Total Properties"
                value={loading ? "—" : totalProperties.toString()}
                helper={`${verifiedProperties} verified`}
              />

              <MetricCard
                icon={<TrendingUp className="h-5 w-5" />}
                label="Occupancy Rate"
                value={loading ? "—" : percent(occupancyRate)}
                helper={`${occupiedProperties} occupied`}
              />

              <MetricCard
                icon={<FileText className="h-5 w-5" />}
                label="Active Leases"
                value={loading ? "—" : activeLeases.toString()}
                helper={`${pendingRequests} pending requests`}
              />

              <MetricCard
                icon={<DollarSign className="h-5 w-5" />}
                label="Expected Monthly Rent"
                value={loading ? "—" : money(expectedMonthlyRent)}
                helper={`${money(expectedAnnualRent)} annual`}
              />
            </section>

            {/* Performance + Financial */}
            <section className="mb-6 grid gap-6 xl:grid-cols-2">
              <AnalyticsPanel
                title="Portfolio Performance"
                subtitle="Property-level performance across your portfolio."
                icon={<BarChart3 className="h-5 w-5" />}
              >
                <InsightRow label="Total properties" value={totalProperties.toString()} />
                <InsightRow
                  label="Verified listings"
                  value={`${verifiedProperties} (${percent(verificationRate)})`}
                  positive={verifiedProperties > 0}
                />
                <InsightRow label="Available properties" value={availableProperties.toString()} />
                <InsightRow label="Occupied properties" value={occupiedProperties.toString()} />
                <InsightRow
                  label="Properties with integrity issues"
                  value={propertiesWithIssues.toString()}
                  warning={propertiesWithIssues > 0}
                />
                <InsightRow
                  label="Critical listings"
                  value={criticalProperties.toString()}
                  danger={criticalProperties > 0}
                />

                <ProgressBar label="Portfolio occupancy" value={occupancyRate} />
                <ProgressBar label="Listing verification" value={verificationRate} />
              </AnalyticsPanel>

              <AnalyticsPanel
                title="Financial Performance"
                subtitle="Rental and escrow activity from the portfolio."
                icon={<Wallet className="h-5 w-5" />}
              >
                <InsightRow label="Portfolio monthly rent" value={money(portfolioMonthlyRent)} />
                <InsightRow label="Expected monthly rent" value={money(expectedMonthlyRent)} />
                <InsightRow label="Expected annual rent" value={money(expectedAnnualRent)} />
                <InsightRow label="Payments recorded" value={money(totalPaymentValue)} />
                <InsightRow
                  label="Payments collected"
                  value={money(collectedPayments)}
                  positive={collectedPayments > 0}
                />
                <InsightRow
                  label="Payments pending"
                  value={money(pendingPayments)}
                  warning={pendingPayments > 0}
                />
                <InsightRow
                  label="Escrow / held payments"
                  value={money(heldPayments)}
                  warning={heldPayments > 0}
                />

                <ProgressBar label="Payment collection rate" value={collectionRate} />
              </AnalyticsPanel>
            </section>

            {/* Lease + Trust */}
            <section className="mb-6 grid gap-6 xl:grid-cols-2">
              <AnalyticsPanel
                title="Lease Performance"
                subtitle="Conversion and activity across lease applications."
                icon={<FileText className="h-5 w-5" />}
              >
                <InsightRow label="Lease requests" value={leaseRequests.length.toString()} />
                <InsightRow
                  label="Pending requests"
                  value={pendingRequests.toString()}
                  warning={pendingRequests > 0}
                />
                <InsightRow
                  label="Approved requests"
                  value={approvedRequests.toString()}
                  positive={approvedRequests > 0}
                />
                <InsightRow label="Rejected requests" value={rejectedRequests.toString()} />
                <InsightRow
                  label="Active leases"
                  value={activeLeases.toString()}
                  positive={activeLeases > 0}
                />

                <ProgressBar label="Request approval rate" value={leaseConversionRate} />
              </AnalyticsPanel>

              <AnalyticsPanel
                title="Trust & Risk"
                subtitle="Reviews, disputes and portfolio risk indicators."
                icon={<ShieldCheck className="h-5 w-5" />}
              >
                <InsightRow label="Reviews" value={reviews.length.toString()} />
                <InsightRow
                  label="Average rating"
                  value={reviews.length > 0 ? `${averageRating.toFixed(1)} / 5` : "No ratings"}
                  positive={averageRating >= 4}
                />
                <InsightRow
                  label="Open disputes"
                  value={openDisputes.toString()}
                  warning={openDisputes > 0}
                />
                <InsightRow
                  label="Under review"
                  value={underReviewDisputes.toString()}
                  warning={underReviewDisputes > 0}
                />
                <InsightRow
                  label="Critical disputes"
                  value={criticalDisputes.toString()}
                  danger={criticalDisputes > 0}
                />
                <InsightRow
                  label="Disputed amount"
                  value={money(disputedAmount)}
                  danger={disputedAmount > 0}
                />

                <ProgressBar label="Dispute resolution rate" value={disputeResolutionRate} />
              </AnalyticsPanel>
            </section>

            {/* Health */}
            <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-950">Portfolio Health</h2>
                  <p className="text-sm text-slate-500">
                    A high-level view of listing quality and operational risk.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {listingHealth >= 80 ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                  )}

                  <span className="text-sm font-semibold text-slate-700">
                    {listingHealth}% portfolio health
                  </span>
                </div>
              </div>

              <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-slate-900 transition-all"
                  style={{ width: `${Math.min(listingHealth, 100)}%` }}
                />
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <HealthCard
                  icon={<CheckCircle2 className="h-4 w-4" />}
                  label="Healthy listings"
                  value={Math.max(0, totalProperties - propertiesWithIssues)}
                />

                <HealthCard
                  icon={<AlertTriangle className="h-4 w-4" />}
                  label="Needs attention"
                  value={propertiesWithIssues}
                />

                <HealthCard
                  icon={<ShieldCheck className="h-4 w-4" />}
                  label="Verified"
                  value={verifiedProperties}
                />
              </div>
            </section>

            {/* Activity + Quick actions */}
            <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-950">Portfolio Activity</h2>
                    <p className="text-sm text-slate-500">
                      Latest activity detected across your portfolio.
                    </p>
                  </div>

                  <Clock3 className="h-5 w-5 text-slate-400" />
                </div>

                <div className="space-y-3">
                  <ActivityItem
                    icon={<Building2 className="h-4 w-4" />}
                    title={`${totalProperties} properties in portfolio`}
                    description={`${verifiedProperties} verified and ${availableProperties} currently available.`}
                  />

                  <ActivityItem
                    icon={<FileText className="h-4 w-4" />}
                    title={`${leaseRequests.length} lease requests`}
                    description={`${pendingRequests} pending and ${approvedRequests} approved.`}
                  />

                  <ActivityItem
                    icon={<Wallet className="h-4 w-4" />}
                    title={`${payments.length} payment records`}
                    description={`${money(heldPayments)} currently held in escrow.`}
                  />

                  <ActivityItem
                    icon={<Star className="h-4 w-4" />}
                    title={`${reviews.length} reviews`}
                    description={
                      reviews.length > 0
                        ? `Average rating ${averageRating.toFixed(1)} out of 5.`
                        : "No tenant reviews yet."
                    }
                  />

                  <ActivityItem
                    icon={<AlertTriangle className="h-4 w-4" />}
                    title={`${disputes.length} disputes`}
                    description={`${openDisputes} open and ${criticalDisputes} critical.`}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-5">
                  <h2 className="text-lg font-bold text-slate-950">Quick Actions</h2>
                  <p className="text-sm text-slate-500">
                    Manage the areas contributing to your portfolio insights.
                  </p>
                </div>

                <div className="space-y-3">
                  <QuickAction
                    icon={<Building2 className="h-4 w-4" />}
                    title="Manage Properties"
                    description="Review listings and integrity"
                    href="/app/landlord/properties"
                  />

                  <QuickAction
                    icon={<FileText className="h-4 w-4" />}
                    title="Lease Requests"
                    description="Review tenant applications"
                    href="/app/landlord/requests"
                  />

                  <QuickAction
                    icon={<Wallet className="h-4 w-4" />}
                    title="Escrow Ledger"
                    description="Review payment activity"
                    href="/app/landlord/escrow"
                  />

                  <QuickAction
                    icon={<Users className="h-4 w-4" />}
                    title="Trust Profiles"
                    description="Review tenant trust"
                    href="/app/landlord/trust-profiles"
                  />

                  <QuickAction
                    icon={<AlertTriangle className="h-4 w-4" />}
                    title="Disputes"
                    description="Review active cases"
                    href="/app/landlord/disputes"
                  />
                </div>
              </div>
            </section>

            <div className="mt-8 border-t border-slate-200 pt-5 text-center text-xs text-slate-400">
              TNP · Mutual Trust Ledger · Harare
            </div>
          </div>
        </main>
      </div>
    </div></SidebarProvider>
  );
}

function MetricCard({
  icon,
  label,
  value,
  helper,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
          {icon}
        </div>
      </div>

      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-slate-950">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{helper}</p>
    </div>
  );
}

function AnalyticsPanel({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
          {icon}
        </div>

        <div>
          <h2 className="text-lg font-bold text-slate-950">{title}</h2>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
      </div>

      <div className="divide-y divide-slate-100">{children}</div>
    </div>
  );
}

function InsightRow({
  label,
  value,
  positive,
  warning,
  danger,
}: {
  label: string;
  value: string;
  positive?: boolean;
  warning?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <span className="text-sm text-slate-500">{label}</span>

      <span
        className={[
          "text-sm font-semibold",
          danger
            ? "text-red-600"
            : warning
              ? "text-amber-600"
              : positive
                ? "text-emerald-600"
                : "text-slate-900",
        ].join(" ")}
      >
        {value}
      </span>
    </div>
  );
}

function ProgressBar({ label, value }: { label: string; value: number }) {
  const safeValue = Math.max(0, Math.min(value, 100));

  return (
    <div className="mt-4 border-t border-slate-100 pt-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <span className="text-xs font-bold text-slate-700">{Math.round(safeValue)}%</span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-slate-900 transition-all"
          style={{ width: `${safeValue}%` }}
        />
      </div>
    </div>
  );
}

function HealthCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-2 flex items-center gap-2 text-slate-500">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>

      <p className="text-xl font-bold text-slate-950">{value}</p>
    </div>
  );
}

function ActivityItem({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-slate-600 shadow-sm">
        {icon}
      </div>

      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      </div>
    </div>
  );
}

function QuickAction({
  icon,
  title,
  description,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="group flex items-center gap-3 rounded-xl border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
        {icon}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        <p className="text-xs text-slate-500">{description}</p>
      </div>

      <ChevronRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-1" />
    </a>
  );
}
