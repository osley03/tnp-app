import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Building2,
  Check,
  CheckCircle2,
  Clock3,
  FileText,
  Mail,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Star,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app/admin/profiles")({
  component: AdminProfilesPage,
});

type Role = "tenant" | "landlord" | "admin";

type Profile = {
  id: string;
  full_name: string;
  phone: string | null;
  bio: string | null;
  verification: string;
  trust_score: number;
  created_at: string;
  updated_at: string;
};

type UserRole = {
  id: string;
  user_id: string;
  role: Role;
};

type Property = {
  id: string;
  owner_id: string;
  title: string;
  city: string;
  suburb: string;
  property_type: string;
  rent_usd: number;
  verified: boolean;
  available: boolean;
  fraud_flags: string[];
  created_at: string;
};

type Review = {
  id: string;
  author_id: string;
  subject_id: string;
  property_id: string | null;
  rating: number;
  body: string;
  lease_confirmed: boolean;
  created_at: string;
};

type LeaseRequest = {
  id: string;
  tenant_id: string;
  property_id: string;
  status: string;
  message: string | null;
  move_in: string | null;
  created_at: string;
};

type ProfileBundle = {
  profiles: Profile[];
  roles: UserRole[];
  properties: Property[];
  reviews: Review[];
  leaseRequests: LeaseRequest[];
};

function AdminProfilesPage() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [verificationFilter, setVerificationFilter] = useState("all");
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  const profilesQuery = useQuery({
    queryKey: ["admin", "profiles", "complete"],
    queryFn: async (): Promise<ProfileBundle> => {
      const [profilesResult, rolesResult, propertiesResult, reviewsResult, leaseRequestsResult] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("id, full_name, phone, bio, verification, trust_score, created_at, updated_at")
            .order("created_at", { ascending: false }),

          supabase.from("user_roles").select("id, user_id, role"),

          supabase
            .from("properties")
            .select(
              "id, owner_id, title, city, suburb, property_type, rent_usd, verified, available, fraud_flags, created_at",
            )
            .order("created_at", { ascending: false }),

          supabase
            .from("reviews")
            .select(
              "id, author_id, subject_id, property_id, rating, body, lease_confirmed, created_at",
            )
            .order("created_at", { ascending: false }),

          supabase
            .from("lease_requests")
            .select("id, tenant_id, property_id, status, message, move_in, created_at")
            .order("created_at", { ascending: false }),
        ]);

      if (profilesResult.error) {
        throw new Error(`Profiles: ${profilesResult.error.message}`);
      }

      if (rolesResult.error) {
        throw new Error(`Roles: ${rolesResult.error.message}`);
      }

      if (propertiesResult.error) {
        throw new Error(`Properties: ${propertiesResult.error.message}`);
      }

      if (reviewsResult.error) {
        throw new Error(`Reviews: ${reviewsResult.error.message}`);
      }

      if (leaseRequestsResult.error) {
        throw new Error(`Lease requests: ${leaseRequestsResult.error.message}`);
      }

      return {
        profiles: (profilesResult.data ?? []) as Profile[],
        roles: (rolesResult.data ?? []) as UserRole[],
        properties: (propertiesResult.data ?? []) as Property[],
        reviews: (reviewsResult.data ?? []) as Review[],
        leaseRequests: (leaseRequestsResult.data ?? []) as LeaseRequest[],
      };
    },
  });

  const bundle = profilesQuery.data;

  const profiles = useMemo(() => bundle?.profiles ?? [], [bundle]);
  const roles = useMemo(() => bundle?.roles ?? [], [bundle]);
  const properties = bundle?.properties ?? [];
  const reviews = bundle?.reviews ?? [];
  const leaseRequests = bundle?.leaseRequests ?? [];

  const getRole = useCallback(
    (userId: string): Role | null => {
      return roles.find((item) => item.user_id === userId)?.role ?? null;
    },
    [roles],
  );

  const verifiedCount = profiles.filter(
    (profile) => profile.verification.toLowerCase() === "verified",
  ).length;

  const emailVerifiedCount = profiles.filter(
    (profile) => profile.verification.toLowerCase() === "email",
  ).length;

  const averageTrust =
    profiles.length > 0
      ? Math.round(
          profiles.reduce((total, profile) => total + (profile.trust_score ?? 0), 0) /
            profiles.length,
        )
      : 0;

  const flaggedTrustCount = profiles.filter((profile) => (profile.trust_score ?? 0) < 40).length;

  const landlordCount = profiles.filter((profile) => getRole(profile.id) === "landlord").length;

  const tenantCount = profiles.filter((profile) => getRole(profile.id) === "tenant").length;

  const adminCount = profiles.filter((profile) => getRole(profile.id) === "admin").length;

  const filteredProfiles = useMemo(() => {
    const query = search.trim().toLowerCase();

    return profiles.filter((profile) => {
      const role = getRole(profile.id);
      const name = profile.full_name.toLowerCase();
      const id = profile.id.toLowerCase();
      const phone = profile.phone?.toLowerCase() ?? "";
      const verification = profile.verification.toLowerCase();

      const matchesSearch =
        query.length === 0 || name.includes(query) || id.includes(query) || phone.includes(query);

      const matchesRole = roleFilter === "all" || role?.toLowerCase() === roleFilter;

      const matchesVerification =
        verificationFilter === "all" || verification === verificationFilter.toLowerCase();

      return matchesSearch && matchesRole && matchesVerification;
    });
  }, [profiles, search, roleFilter, verificationFilter, getRole]);

  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId);

  const refresh = async () => {
    await queryClient.invalidateQueries({
      queryKey: ["admin", "profiles", "complete"],
    });
  };

  return (
    <div className="tnp-module tnp-module-light min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-6">
          <Link
            to="/app/admin"
            className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Admin Dashboard
          </Link>

          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
                <Users className="h-7 w-7" />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                    Profile & Trust Centre
                  </h1>

                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Admin
                  </span>
                </div>

                <p className="mt-1 text-sm text-slate-500">
                  Monitor identity, roles, verification and trust activity across TNP.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={refresh}
              disabled={profilesQuery.isFetching}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${profilesQuery.isFetching ? "animate-spin" : ""}`} />
              Refresh Data
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-6 py-6">
        {/* Intelligence metrics */}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric
            label="Total Accounts"
            value={profiles.length}
            icon={<Users className="h-5 w-5" />}
            description={`${tenantCount} tenants · ${landlordCount} landlords`}
          />

          <Metric
            label="Verified"
            value={verifiedCount}
            icon={<CheckCircle2 className="h-5 w-5" />}
            description={`${emailVerifiedCount} email-level profiles`}
          />

          <Metric
            label="Average Trust"
            value={`${averageTrust}/100`}
            icon={<ShieldCheck className="h-5 w-5" />}
            description="Across registered profiles"
          />

          <Metric
            label="Risk Review"
            value={flaggedTrustCount}
            icon={<ShieldAlert className="h-5 w-5" />}
            description="Profiles below 40 trust"
            warning={flaggedTrustCount > 0}
          />
        </section>

        {/* Role overview */}
        <section className="grid gap-4 md:grid-cols-3">
          <RoleSummary
            label="Tenants"
            count={tenantCount}
            description="Registered tenant accounts"
          />

          <RoleSummary
            label="Landlords"
            count={landlordCount}
            description={`${properties.length} properties in system`}
          />

          <RoleSummary
            label="Administrators"
            count={adminCount}
            description="Privileged TNP accounts"
          />
        </section>

        {/* Filters */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 xl:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name, phone number or user ID..."
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-200"
              />
            </div>

            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            >
              <option value="all">All roles</option>
              <option value="tenant">Tenants</option>
              <option value="landlord">Landlords</option>
              <option value="admin">Administrators</option>
            </select>

            <select
              value={verificationFilter}
              onChange={(event) => setVerificationFilter(event.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            >
              <option value="all">All verification</option>
              <option value="verified">Verified</option>
              <option value="email">Email</option>
            </select>
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
            <p className="text-xs text-slate-500">
              Showing{" "}
              <span className="font-semibold text-slate-700">{filteredProfiles.length}</span> of{" "}
              <span className="font-semibold text-slate-700">{profiles.length}</span> profiles
            </p>

            {(search || roleFilter !== "all" || verificationFilter !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setRoleFilter("all");
                  setVerificationFilter("all");
                }}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Clear filters
              </button>
            )}
          </div>
        </section>

        {/* Loading */}
        {profilesQuery.isLoading && (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-white"
              />
            ))}
          </section>
        )}

        {/* Error */}
        {profilesQuery.isError && (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 h-5 w-5 text-red-600" />

              <div>
                <h2 className="font-semibold text-red-900">Unable to load profile intelligence</h2>

                <p className="mt-2 text-sm leading-6 text-red-700">
                  {profilesQuery.error instanceof Error
                    ? profilesQuery.error.message
                    : "An unexpected error occurred while loading the profile data."}
                </p>

                <button
                  type="button"
                  onClick={refresh}
                  className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
                >
                  Try Again
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Profiles */}
        {!profilesQuery.isLoading && !profilesQuery.isError && filteredProfiles.length > 0 && (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredProfiles.map((profile) => (
              <ProfileCard
                key={profile.id}
                profile={profile}
                role={getRole(profile.id)}
                propertyCount={
                  properties.filter((property) => property.owner_id === profile.id).length
                }
                reviewCount={reviews.filter((review) => review.subject_id === profile.id).length}
                leaseRequestCount={
                  leaseRequests.filter((request) => request.tenant_id === profile.id).length
                }
                onView={() => setSelectedProfileId(profile.id)}
              />
            ))}
          </section>
        )}

        {/* Empty */}
        {!profilesQuery.isLoading && !profilesQuery.isError && filteredProfiles.length === 0 && (
          <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
              <UserRound className="h-7 w-7 text-slate-400" />
            </div>

            <h2 className="mt-4 text-lg font-semibold text-slate-900">No profiles found</h2>

            <p className="mt-1 text-sm text-slate-500">Try changing your search or filters.</p>
          </section>
        )}
      </main>

      {/* Detail drawer */}
      {selectedProfile && (
        <ProfileDetailDrawer
          profile={selectedProfile}
          role={getRole(selectedProfile.id)}
          properties={properties.filter((property) => property.owner_id === selectedProfile.id)}
          reviews={reviews.filter(
            (review) =>
              review.subject_id === selectedProfile.id || review.author_id === selectedProfile.id,
          )}
          leaseRequests={leaseRequests.filter(
            (request) => request.tenant_id === selectedProfile.id,
          )}
          onClose={() => setSelectedProfileId(null)}
          onUpdated={refresh}
        />
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  icon,
  description,
  warning = false,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  description: string;
  warning?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border bg-white p-5 shadow-sm ${
        warning ? "border-amber-200" : "border-slate-200"
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>

        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${
            warning ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-700"
          }`}
        >
          {icon}
        </div>
      </div>

      <p className="mt-4 text-3xl font-bold text-slate-900">{value}</p>

      <p className="mt-1 text-xs text-slate-400">{description}</p>
    </div>
  );
}

function RoleSummary({
  label,
  count,
  description,
}: {
  label: string;
  count: number;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">{label}</p>
          <p className="mt-1 text-xs text-slate-400">{description}</p>
        </div>

        <span className="rounded-xl bg-slate-100 px-3 py-2 text-lg font-bold text-slate-900">
          {count}
        </span>
      </div>
    </div>
  );
}

function ProfileCard({
  profile,
  role,
  propertyCount,
  reviewCount,
  leaseRequestCount,
  onView,
}: {
  profile: Profile;
  role: Role | null;
  propertyCount: number;
  reviewCount: number;
  leaseRequestCount: number;
  onView: () => void;
}) {
  const verification = profile.verification || "Email";
  const isVerified = verification.toLowerCase() === "verified";
  const trustScore = profile.trust_score ?? 50;

  const initials =
    profile.full_name
      ?.split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join("") || "U";

  const trustLabel =
    trustScore >= 80
      ? "High trust"
      : trustScore >= 60
        ? "Good standing"
        : trustScore >= 40
          ? "Review recommended"
          : "Risk review";

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md">
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
              {initials}
            </div>

            <div className="min-w-0">
              <h2 className="truncate font-semibold text-slate-900">
                {profile.full_name || "Unnamed User"}
              </h2>

              <div className="mt-1 flex items-center gap-2">
                <RoleBadge role={role} />

                <span className="truncate text-xs text-slate-400">{profile.id}</span>
              </div>
            </div>
          </div>

          {isVerified ? (
            <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-500" />
          ) : (
            <ShieldAlert className="h-5 w-5 shrink-0 text-amber-500" />
          )}
        </div>

        {/* Trust score */}
        <div className="mt-5 rounded-xl bg-slate-50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400">Trust Score</p>

              <p className="mt-1 text-xl font-bold text-slate-900">
                {trustScore}
                <span className="text-sm font-medium text-slate-400">/100</span>
              </p>
            </div>

            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                trustScore >= 80
                  ? "bg-emerald-50 text-emerald-700"
                  : trustScore >= 60
                    ? "bg-blue-50 text-blue-700"
                    : trustScore >= 40
                      ? "bg-amber-50 text-amber-700"
                      : "bg-red-50 text-red-700"
              }`}
            >
              {trustLabel}
            </span>
          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className={`h-full rounded-full ${
                trustScore >= 80
                  ? "bg-emerald-500"
                  : trustScore >= 60
                    ? "bg-blue-500"
                    : trustScore >= 40
                      ? "bg-amber-500"
                      : "bg-red-500"
              }`}
              style={{
                width: `${Math.min(Math.max(trustScore, 0), 100)}%`,
              }}
            />
          </div>
        </div>

        {/* Verification */}
        <div className="mt-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400">Verification</p>

            <p
              className={`mt-1 text-sm font-semibold ${
                isVerified ? "text-emerald-600" : "text-slate-700"
              }`}
            >
              {verification}
            </p>
          </div>

          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              isVerified ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
            }`}
          >
            {isVerified ? "Verified" : "Pending"}
          </span>
        </div>

        {/* Activity summary */}
        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-4">
          <ActivityStat
            icon={<Building2 className="h-3.5 w-3.5" />}
            value={propertyCount}
            label="Properties"
          />

          <ActivityStat
            icon={<Star className="h-3.5 w-3.5" />}
            value={reviewCount}
            label="Reviews"
          />

          <ActivityStat
            icon={<FileText className="h-3.5 w-3.5" />}
            value={leaseRequestCount}
            label="Requests"
          />
        </div>

        <button
          type="button"
          onClick={onView}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Review Profile
        </button>
      </div>
    </article>
  );
}

function ActivityStat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-1 text-slate-500">
        {icon}
        <span className="text-sm font-bold text-slate-800">{value}</span>
      </div>

      <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
    </div>
  );
}

function RoleBadge({ role }: { role: Role | null }) {
  const label = role ? role.charAt(0).toUpperCase() + role.slice(1) : "Unassigned";

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
        role === "admin"
          ? "bg-purple-50 text-purple-700"
          : role === "landlord"
            ? "bg-blue-50 text-blue-700"
            : role === "tenant"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-slate-100 text-slate-500"
      }`}
    >
      {label}
    </span>
  );
}

function ProfileDetailDrawer({
  profile,
  role,
  properties,
  reviews,
  leaseRequests,
  onClose,
  onUpdated,
}: {
  profile: Profile;
  role: Role | null;
  properties: Property[];
  reviews: Review[];
  leaseRequests: LeaseRequest[];
  onClose: () => void;
  onUpdated: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [verification, setVerification] = useState(profile.verification);
  const [trustScore, setTrustScore] = useState(String(profile.trust_score));

  const submittedReviews = reviews.filter((review) => review.author_id === profile.id);

  const receivedReviews = reviews.filter((review) => review.subject_id === profile.id);

  const saveChanges = async () => {
    setSaving(true);
    setActionMessage(null);
    setActionError(null);

    const parsedTrustScore = Number(trustScore);

    if (!Number.isFinite(parsedTrustScore) || parsedTrustScore < 0 || parsedTrustScore > 100) {
      setActionError("Trust score must be a number between 0 and 100.");
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        verification,
        trust_score: Math.round(parsedTrustScore),
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id);

    setSaving(false);

    if (error) {
      setActionError(error.message);
      return;
    }

    setActionMessage("Profile trust information updated successfully.");
    await onUpdated();
  };

  const initials =
    profile.full_name
      ?.split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join("") || "U";

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close profile details"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-slate-950/40 backdrop-blur-sm"
      />

      {/* Drawer */}
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
        {/* Drawer header */}
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 font-bold text-white">
                {initials}
              </div>

              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {profile.full_name || "Unnamed User"}
                </h2>

                <div className="mt-1 flex items-center gap-2">
                  <RoleBadge role={role} />

                  <span className="text-xs text-slate-400">Profile details</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Drawer body */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="space-y-6">
            {/* Identity */}
            <section>
              <SectionTitle title="Identity Information" />

              <div className="grid gap-3 sm:grid-cols-2">
                <InfoBox label="Full Name" value={profile.full_name} />

                <InfoBox label="Phone" value={profile.phone || "Not provided"} />

                <InfoBox label="User ID" value={profile.id} fullWidth />

                <InfoBox label="Account Created" value={formatDate(profile.created_at)} />

                <InfoBox label="Last Profile Update" value={formatDate(profile.updated_at)} />

                <InfoBox
                  label="Role"
                  value={role ? role.charAt(0).toUpperCase() + role.slice(1) : "Unassigned"}
                />
              </div>

              {profile.bio && (
                <div className="mt-3 rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Bio
                  </p>

                  <p className="mt-2 text-sm leading-6 text-slate-700">{profile.bio}</p>
                </div>
              )}
            </section>

            {/* Trust management */}
            <section>
              <SectionTitle title="Trust & Verification" />

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Verification Status
                    </label>

                    <select
                      value={verification}
                      onChange={(event) => setVerification(event.target.value)}
                      className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                    >
                      <option value="Email">Email</option>
                      <option value="Verified">Verified</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Trust Score
                    </label>

                    <div className="relative mt-2">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={trustScore}
                        onChange={(event) => setTrustScore(event.target.value)}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 pr-14 text-sm font-semibold text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                      />

                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">
                        /100
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={saveChanges}
                  disabled={saving}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  {saving ? "Saving..." : "Save Trust Changes"}
                </button>

                {actionMessage && (
                  <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                    {actionMessage}
                  </p>
                )}

                {actionError && (
                  <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                    {actionError}
                  </p>
                )}
              </div>
            </section>

            {/* Activity */}
            <section>
              <SectionTitle title="TNP Activity" />

              <div className="grid gap-3 sm:grid-cols-3">
                <ActivityPanel
                  icon={<Building2 className="h-5 w-5" />}
                  label="Properties"
                  value={properties.length}
                />

                <ActivityPanel
                  icon={<Star className="h-5 w-5" />}
                  label="Reviews Received"
                  value={receivedReviews.length}
                />

                <ActivityPanel
                  icon={<FileText className="h-5 w-5" />}
                  label="Lease Requests"
                  value={leaseRequests.length}
                />
              </div>
            </section>

            {/* Properties */}
            {properties.length > 0 && (
              <section>
                <SectionTitle title="Owned Properties" />

                <div className="space-y-3">
                  {properties.slice(0, 5).map((property) => (
                    <div key={property.id} className="rounded-xl border border-slate-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-slate-900">{property.title}</h3>

                          <p className="mt-1 text-xs text-slate-500">
                            {property.suburb}, {property.city} · {property.property_type}
                          </p>
                        </div>

                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            property.verified
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {property.verified ? "Verified" : "Unverified"}
                        </span>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-900">
                          ${property.rent_usd.toLocaleString()}/month
                        </span>

                        <span className="text-xs text-slate-400">
                          {property.available ? "Available" : "Unavailable"}
                        </span>
                      </div>

                      {property.fraud_flags.length > 0 && (
                        <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                          <ShieldAlert className="h-4 w-4" />
                          {property.fraud_flags.length} integrity flag
                          {property.fraud_flags.length === 1 ? "" : "s"}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Reviews */}
            {reviews.length > 0 && (
              <section>
                <SectionTitle title="Review Activity" />

                <div className="space-y-3">
                  {reviews.slice(0, 5).map((review) => {
                    const received = review.subject_id === profile.id;

                    return (
                      <div key={review.id} className="rounded-xl border border-slate-200 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                              received ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {received ? "Received" : "Submitted"}
                          </span>

                          <div className="flex items-center gap-1 text-amber-500">
                            <Star className="h-4 w-4 fill-current" />

                            <span className="text-sm font-bold">{review.rating}/5</span>
                          </div>
                        </div>

                        <p className="mt-3 text-sm leading-6 text-slate-600">{review.body}</p>

                        <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                          <span>
                            {review.lease_confirmed ? "Lease confirmed" : "Lease not confirmed"}
                          </span>

                          <span>{formatDate(review.created_at)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Lease requests */}
            {leaseRequests.length > 0 && (
              <section>
                <SectionTitle title="Lease Request Activity" />

                <div className="space-y-3">
                  {leaseRequests.slice(0, 5).map((request) => (
                    <div key={request.id} className="rounded-xl border border-slate-200 p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400">
                          {formatDate(request.created_at)}
                        </span>

                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold capitalize text-slate-600">
                          {request.status}
                        </span>
                      </div>

                      {request.message && (
                        <p className="mt-3 text-sm leading-6 text-slate-600">{request.message}</p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Investigation note */}
            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-slate-700" />

                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Admin Investigation Context
                  </h3>

                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    This profile view combines identity, role, trust, property, review and
                    lease-request information available to the current TNP database. Additional
                    investigation modules can be connected when their database tables are present.
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 bg-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Mail className="h-4 w-4" />
              Profile ID: {profile.id}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Close
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">{title}</h3>

      <div className="h-px flex-1 bg-slate-100 ml-4" />
    </div>
  );
}

function InfoBox({
  label,
  value,
  fullWidth = false,
}: {
  label: string;
  value: string;
  fullWidth?: boolean;
}) {
  return (
    <div className={`rounded-xl bg-slate-50 p-3 ${fullWidth ? "sm:col-span-2" : ""}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>

      <p className="mt-1 break-all text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}

function ActivityPanel({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="text-slate-500">{icon}</div>

        <span className="text-2xl font-bold text-slate-900">{value}</span>
      </div>

      <p className="mt-3 text-xs font-medium text-slate-500">{label}</p>
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
