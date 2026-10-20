import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  Filter,
  Flag,
  Gavel,
  Loader2,
  MessageSquare,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  User,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const db = supabase;

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

type DisputeStatus =
  "open" | "under_review" | "awaiting_response" | "escalated" | "resolved" | "closed";

type DisputePriority = "low" | "medium" | "high" | "critical";

type DisputeCategory =
  | "rent"
  | "deposit"
  | "lease"
  | "property_condition"
  | "payment"
  | "landlord"
  | "tenant"
  | "fraud"
  | "harassment"
  | "access"
  | "other";

type Dispute = {
  id: string;
  lease_id: string | null;
  property_id: string | null;
  opened_by: string;
  against_user: string | null;
  category: DisputeCategory;
  priority: DisputePriority;
  status: DisputeStatus;
  title: string;
  description: string;
  evidence: string[];
  admin_notes: string | null;
  resolution: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

type Profile = {
  id: string;
  full_name: string;
  phone: string | null;
  trust_score: number;
  verification: string;
};

type Property = {
  id: string;
  title: string;
  city: string;
  suburb: string;
  rent_usd: number;
  verified: boolean;
};

type Lease = {
  id: string;
  property_id: string | null;
  tenant_id: string | null;
  landlord_id: string | null;
  status: string;
  rent_usd: number | null;
  deposit_usd: number | null;
  start_date: string | null;
  end_date: string | null;
};

type DisputeAction = {
  id: string;
  dispute_id: string;
  admin_id: string;
  action: string;
  from_status: string | null;
  to_status: string | null;
  reason: string | null;
  created_at: string;
};

type EnrichedDispute = Dispute & {
  openedBy: Profile | undefined;
  againstUser: Profile | undefined;
  property: Property | undefined;
  lease: Lease | undefined;
};

const STATUS_OPTIONS: {
  value: DisputeStatus;
  label: string;
}[] = [
  { value: "open", label: "Open" },
  { value: "under_review", label: "Under Review" },
  { value: "awaiting_response", label: "Awaiting Response" },
  { value: "escalated", label: "Escalated" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

const PRIORITY_OPTIONS: {
  value: DisputePriority;
  label: string;
}[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const CATEGORY_OPTIONS: {
  value: DisputeCategory;
  label: string;
}[] = [
  { value: "rent", label: "Rent" },
  { value: "deposit", label: "Deposit" },
  { value: "lease", label: "Lease" },
  { value: "property_condition", label: "Property Condition" },
  { value: "payment", label: "Payment" },
  { value: "landlord", label: "Landlord" },
  { value: "tenant", label: "Tenant" },
  { value: "fraud", label: "Fraud" },
  { value: "harassment", label: "Harassment" },
  { value: "access", label: "Access" },
  { value: "other", label: "Other" },
];

function formatLabel(value: string | null | undefined) {
  if (!value) return "—";

  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-ZW", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function initials(name: string | null | undefined) {
  if (!name) return "U";

  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function statusClasses(status: DisputeStatus) {
  switch (status) {
    case "open":
      return "border-blue-400/20 bg-blue-400/10 text-blue-300";
    case "under_review":
      return "border-amber-400/20 bg-amber-400/10 text-amber-300";
    case "awaiting_response":
      return "border-purple-400/20 bg-purple-400/10 text-purple-300";
    case "escalated":
      return "border-red-400/20 bg-red-400/10 text-red-300";
    case "resolved":
      return "border-emerald-400/20 bg-emerald-400/10 text-emerald-300";
    case "closed":
      return "border-zinc-400/20 bg-zinc-400/10 text-zinc-300";
    default:
      return "border-zinc-400/20 bg-zinc-400/10 text-zinc-300";
  }
}

function priorityClasses(priority: DisputePriority) {
  switch (priority) {
    case "critical":
      return "border-red-500/30 bg-red-500/10 text-red-300";
    case "high":
      return "border-orange-400/30 bg-orange-400/10 text-orange-300";
    case "medium":
      return "border-amber-400/20 bg-amber-400/10 text-amber-300";
    case "low":
      return "border-emerald-400/20 bg-emerald-400/10 text-emerald-300";
    default:
      return "border-zinc-400/20 bg-zinc-400/10 text-zinc-300";
  }
}

function StatCard({
  label,
  value,
  icon: Icon,
  description,
}: {
  label: string;
  value: number | string;
  icon: typeof Users;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 shadow-[0_15px_45px_rgba(0,0,0,0.15)]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">{label}</p>

          <p className="mt-2 text-3xl font-semibold tracking-tight text-white">{value}</p>

          <p className="mt-1 text-xs text-zinc-500">{description}</p>
        </div>

        <div className="rounded-xl border border-[#d4af37]/20 bg-[#d4af37]/10 p-2.5">
          <Icon className="h-5 w-5 text-[#d4af37]" />
        </div>
      </div>
    </div>
  );
}

function AuditTimeline({ actions, profiles }: { actions: DisputeAction[]; profiles: Profile[] }) {
  const profileMap = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles],
  );

  if (!actions.length) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-center">
        <Clock3 className="mx-auto h-6 w-6 text-zinc-600" />
        <p className="mt-2 text-sm text-zinc-500">
          No administrative activity has been recorded yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {actions.map((action) => {
        const admin = profileMap.get(action.admin_id);

        return (
          <div key={action.id} className="relative pl-8">
            <div className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-[#d4af37]" />

            <div className="absolute bottom-0 left-[4px] top-4 w-px bg-white/10" />

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-white">{formatLabel(action.action)}</span>

                {action.from_status && action.to_status && (
                  <span className="text-xs text-zinc-500">
                    {formatLabel(action.from_status)} → {formatLabel(action.to_status)}
                  </span>
                )}
              </div>

              <p className="mt-1 text-xs text-zinc-500">
                {admin?.full_name || "Administrator"} · {formatDate(action.created_at)}
              </p>

              {action.reason && (
                <p className="mt-2 text-sm leading-6 text-zinc-400">{action.reason}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DisputeInspection({
  dispute,
  profiles,
  actions,
  onClose,
  onRefresh,
}: {
  dispute: EnrichedDispute;
  profiles: Profile[];
  actions: DisputeAction[];
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState(dispute.admin_notes || "");
  const [resolution, setResolution] = useState(dispute.resolution || "");
  const [reason, setReason] = useState("");

  const profileMap = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles],
  );

  async function getCurrentAdmin() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("Your session has expired. Please sign in again.");
    }

    return user;
  }

  async function recordAction(
    adminId: string,
    action: string,
    values: {
      from_status?: string | null;
      to_status?: string | null;
      reason?: string | null;
    } = {},
  ) {
    const { error } = await db.from("dispute_admin_actions" as never).insert({
      dispute_id: dispute.id,
      admin_id: adminId,
      action,
      from_status: values.from_status ?? null,
      to_status: values.to_status ?? null,
      reason: values.reason ?? null,
    } as never);

    if (error) throw error;
  }

  async function changeStatus(nextStatus: DisputeStatus) {
    if (nextStatus === dispute.status) return;

    setSaving(true);

    try {
      const admin = await getCurrentAdmin();

      const { error } = await db
        .from("disputes" as never)
        .update({
          status: nextStatus,
          resolved_by: nextStatus === "resolved" || nextStatus === "closed" ? admin.id : null,
          resolved_at:
            nextStatus === "resolved" || nextStatus === "closed" ? new Date().toISOString() : null,
        } as never)
        .eq("id", dispute.id);

      if (error) throw error;

      await recordAction(admin.id, "status_changed", {
        from_status: dispute.status,
        to_status: nextStatus,
        reason: reason.trim() || null,
      });

      setReason("");
      onRefresh();
    } catch (error: unknown) {
      window.alert(getErrorMessage(error, "Unable to update dispute status."));
    } finally {
      setSaving(false);
    }
  }

  async function changePriority(nextPriority: DisputePriority) {
    if (nextPriority === dispute.priority) return;

    setSaving(true);

    try {
      const admin = await getCurrentAdmin();

      const { error } = await db
        .from("disputes" as never)
        .update({
          priority: nextPriority,
        } as never)
        .eq("id", dispute.id);

      if (error) throw error;

      await recordAction(admin.id, "priority_changed", {
        reason: `Priority changed from ${formatLabel(dispute.priority)} to ${formatLabel(nextPriority)}.`,
      });

      onRefresh();
    } catch (error: unknown) {
      window.alert(getErrorMessage(error, "Unable to update dispute priority."));
    } finally {
      setSaving(false);
    }
  }

  async function saveNotes() {
    setSaving(true);

    try {
      const admin = await getCurrentAdmin();

      const { error } = await db
        .from("disputes" as never)
        .update({
          admin_notes: notes.trim() || null,
        } as never)
        .eq("id", dispute.id);

      if (error) throw error;

      await recordAction(admin.id, "note_added", {
        reason: notes.trim() || "Administrative note updated.",
      });

      onRefresh();
    } catch (error: unknown) {
      window.alert(getErrorMessage(error, "Unable to save administrative notes."));
    } finally {
      setSaving(false);
    }
  }

  async function saveResolution() {
    if (!resolution.trim()) {
      window.alert("Enter a resolution before saving.");
      return;
    }

    setSaving(true);

    try {
      const admin = await getCurrentAdmin();

      const { error } = await db
        .from("disputes" as never)
        .update({
          resolution: resolution.trim(),
          status: "resolved",
          resolved_by: admin.id,
          resolved_at: new Date().toISOString(),
        } as never)
        .eq("id", dispute.id);

      if (error) throw error;

      await recordAction(admin.id, "resolved", {
        from_status: dispute.status,
        to_status: "resolved",
        reason: resolution.trim(),
      });

      onRefresh();
    } catch (error: unknown) {
      window.alert(getErrorMessage(error, "Unable to resolve dispute."));
    } finally {
      setSaving(false);
    }
  }

  async function escalate() {
    await changeStatus("escalated");
  }

  async function reopen() {
    await changeStatus("under_review");
  }

  const openedBy = dispute.openedBy;
  const againstUser = dispute.againstUser;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
      <div className="flex h-full w-full max-w-2xl flex-col border-l border-white/10 bg-[#0b0c0f] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
          <div>
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-[#d4af37]" />
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d4af37]">
                Dispute Inspection
              </span>
            </div>

            <h2 className="mt-2 text-xl font-semibold text-white">{dispute.title}</h2>

            <p className="mt-1 font-mono text-xs text-zinc-600">{dispute.id}</p>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl border border-white/10 p-2 text-zinc-400 transition hover:bg-white/5 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="space-y-6">
            <section>
              <div className="flex flex-wrap gap-2">
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${statusClasses(
                    dispute.status,
                  )}`}
                >
                  {formatLabel(dispute.status)}
                </span>

                <span
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${priorityClasses(
                    dispute.priority,
                  )}`}
                >
                  {formatLabel(dispute.priority)} Priority
                </span>

                <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-zinc-400">
                  {formatLabel(dispute.category)}
                </span>
              </div>

              <p className="mt-4 text-sm leading-7 text-zinc-300">{dispute.description}</p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
                  <p className="text-xs uppercase tracking-wider text-zinc-600">Opened</p>
                  <p className="mt-1 text-sm text-zinc-300">{formatDate(dispute.created_at)}</p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
                  <p className="text-xs uppercase tracking-wider text-zinc-600">Last Updated</p>
                  <p className="mt-1 text-sm text-zinc-300">{formatDate(dispute.updated_at)}</p>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[#d4af37]" />
                <h3 className="font-medium text-white">Parties</h3>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-wider text-zinc-600">Raised By</p>

                  <div className="mt-2 flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#d4af37]/10 text-xs font-semibold text-[#d4af37]">
                      {initials(openedBy?.full_name)}
                    </div>

                    <div>
                      <p className="text-sm font-medium text-white">
                        {openedBy?.full_name || "Unknown user"}
                      </p>

                      <p className="text-xs text-zinc-500">Trust {openedBy?.trust_score ?? "—"}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-wider text-zinc-600">Against</p>

                  <div className="mt-2 flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-xs font-semibold text-zinc-400">
                      {initials(againstUser?.full_name)}
                    </div>

                    <div>
                      <p className="text-sm font-medium text-white">
                        {againstUser?.full_name || "Not specified"}
                      </p>

                      <p className="text-xs text-zinc-500">
                        Trust {againstUser?.trust_score ?? "—"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-[#d4af37]" />
                <h3 className="font-medium text-white">Case Context</h3>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-wider text-zinc-600">Property</p>
                  <p className="mt-1 text-sm text-zinc-300">
                    {dispute.property?.title || "Not linked"}
                  </p>
                  {dispute.property && (
                    <p className="text-xs text-zinc-500">
                      {dispute.property.suburb}, {dispute.property.city}
                    </p>
                  )}
                </div>

                <div>
                  <p className="text-xs uppercase tracking-wider text-zinc-600">Lease</p>
                  <p className="mt-1 font-mono text-xs text-zinc-400">
                    {dispute.lease_id || "Not linked"}
                  </p>
                </div>

                {dispute.lease && (
                  <>
                    <div>
                      <p className="text-xs uppercase tracking-wider text-zinc-600">Lease Status</p>
                      <p className="mt-1 text-sm text-zinc-300">
                        {formatLabel(dispute.lease.status)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-wider text-zinc-600">Rent</p>
                      <p className="mt-1 text-sm text-zinc-300">
                        ${Number(dispute.lease.rent_usd || 0).toLocaleString()}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Flag className="h-4 w-4 text-[#d4af37]" />
                  <h3 className="font-medium text-white">Evidence</h3>
                </div>

                <span className="text-xs text-zinc-600">
                  {dispute.evidence?.length || 0} item(s)
                </span>
              </div>

              {dispute.evidence?.length ? (
                <div className="space-y-2">
                  {dispute.evidence.map((item, index) => (
                    <div
                      key={`${item}-${index}`}
                      className="rounded-xl border border-white/10 bg-white/[0.025] p-3 text-sm text-zinc-400"
                    >
                      <span className="mr-2 text-xs text-[#d4af37]">#{index + 1}</span>
                      {item}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-white/10 p-5 text-center text-sm text-zinc-600">
                  No evidence has been attached to this dispute.
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
              <div className="flex items-center gap-2">
                <Gavel className="h-4 w-4 text-[#d4af37]" />
                <h3 className="font-medium text-white">Administrative Action</h3>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs uppercase tracking-wider text-zinc-600">Status</label>

                  <select
                    value={dispute.status}
                    disabled={saving}
                    onChange={(event) => changeStatus(event.target.value as DisputeStatus)}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-[#d4af37]/50"
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs uppercase tracking-wider text-zinc-600">Priority</label>

                  <select
                    value={dispute.priority}
                    disabled={saving}
                    onChange={(event) => changePriority(event.target.value as DisputePriority)}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-[#d4af37]/50"
                  >
                    {PRIORITY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-4">
                <label className="text-xs uppercase tracking-wider text-zinc-600">
                  Action Reason
                </label>

                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Optional reason for the administrative action..."
                  rows={3}
                  className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white placeholder:text-zinc-700 outline-none focus:border-[#d4af37]/50"
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {dispute.status !== "escalated" && dispute.status !== "closed" && (
                  <button
                    onClick={escalate}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-2.5 text-sm font-medium text-red-300 transition hover:bg-red-400/15 disabled:opacity-50"
                  >
                    <AlertTriangle className="h-4 w-4" />
                    Escalate
                  </button>
                )}

                {(dispute.status === "resolved" || dispute.status === "closed") && (
                  <button
                    onClick={reopen}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-2.5 text-sm font-medium text-amber-300 transition hover:bg-amber-400/15 disabled:opacity-50"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Reopen Case
                  </button>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-[#d4af37]" />
                <h3 className="font-medium text-white">Internal Administrator Notes</h3>
              </div>

              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={5}
                placeholder="Record investigation notes, findings, contacts, or follow-up information..."
                className="mt-4 w-full resize-none rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm leading-6 text-white placeholder:text-zinc-700 outline-none focus:border-[#d4af37]/50"
              />

              <button
                onClick={saveNotes}
                disabled={saving}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#d4af37] px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-[#e3c45c] disabled:opacity-50"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Notes
              </button>
            </section>

            <section className="rounded-2xl border border-emerald-400/10 bg-emerald-400/[0.025] p-5">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <h3 className="font-medium text-white">Resolution</h3>
              </div>

              <textarea
                value={resolution}
                onChange={(event) => setResolution(event.target.value)}
                rows={4}
                placeholder="Document the final resolution and outcome..."
                className="mt-4 w-full resize-none rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm leading-6 text-white placeholder:text-zinc-700 outline-none focus:border-emerald-400/40"
              />

              <button
                onClick={saveResolution}
                disabled={saving}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:opacity-50"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Resolve Dispute
              </button>

              {dispute.resolved_at && (
                <p className="mt-3 text-xs text-zinc-500">
                  Resolved on {formatDate(dispute.resolved_at)}
                  {dispute.resolved_by
                    ? ` by ${profileMap.get(dispute.resolved_by)?.full_name || "Administrator"}`
                    : ""}
                </p>
              )}
            </section>

            <section>
              <div className="mb-4 flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-[#d4af37]" />
                <h3 className="font-medium text-white">Audit Trail</h3>
              </div>

              <AuditTimeline actions={actions} profiles={profiles} />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminDisputes() {
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const disputesQuery = useQuery({
    queryKey: ["admin-disputes"],
    queryFn: async () => {
      const { data, error } = await db
        .from("disputes" as never)
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []) as Dispute[];
    },
  });

  const profilesQuery = useQuery({
    queryKey: ["admin-dispute-profiles"],
    queryFn: async () => {
      const { data, error } = await db
        .from("profiles")
        .select("id, full_name, phone, trust_score, verification");

      if (error) throw error;

      return (data || []) as Profile[];
    },
  });

  const propertiesQuery = useQuery({
    queryKey: ["admin-dispute-properties"],
    queryFn: async () => {
      const { data, error } = await db
        .from("properties")
        .select("id, title, city, suburb, rent_usd, verified");

      if (error) throw error;

      return (data || []) as Property[];
    },
  });

  const leasesQuery = useQuery({
    queryKey: ["admin-dispute-leases"],
    queryFn: async () => {
      const { data, error } = await (
        db as typeof db & {
          from: (table: "leases") => ReturnType<typeof db.from>;
        }
      )
        .from("leases")
        .select(
          "id, property_id, tenant_id, landlord_id, status, rent_usd, deposit_usd, start_date, end_date",
        );

      if (error) throw error;

      return (data || []) as Lease[];
    },
  });

  const actionsQuery = useQuery({
    queryKey: ["admin-dispute-actions"],
    queryFn: async () => {
      const { data, error } = await (
        db as typeof db & {
          from: (table: "dispute_admin_actions") => ReturnType<typeof db.from>;
        }
      )
        .from("dispute_admin_actions")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []) as DisputeAction[];
    },
  });

  const profiles = profilesQuery.data || [];
  const properties = propertiesQuery.data || [];
  const leases = leasesQuery.data || [];
  const actions = actionsQuery.data || [];
  const disputes = disputesQuery.data || [];

  const enrichedDisputes = useMemo<EnrichedDispute[]>(() => {
    const profileMap = new Map(profiles.map((item) => [item.id, item]));
    const propertyMap = new Map(properties.map((item) => [item.id, item]));
    const leaseMap = new Map(leases.map((item) => [item.id, item]));

    return disputes.map((dispute) => ({
      ...dispute,
      openedBy: profileMap.get(dispute.opened_by),
      againstUser: dispute.against_user ? profileMap.get(dispute.against_user) : undefined,
      property: dispute.property_id ? propertyMap.get(dispute.property_id) : undefined,
      lease: dispute.lease_id ? leaseMap.get(dispute.lease_id) : undefined,
    }));
  }, [disputes, profiles, properties, leases]);

  const filteredDisputes = useMemo(() => {
    const query = search.trim().toLowerCase();

    return enrichedDisputes.filter((dispute) => {
      const matchesSearch =
        !query ||
        dispute.title.toLowerCase().includes(query) ||
        dispute.description.toLowerCase().includes(query) ||
        dispute.id.toLowerCase().includes(query) ||
        dispute.openedBy?.full_name?.toLowerCase().includes(query) ||
        dispute.againstUser?.full_name?.toLowerCase().includes(query) ||
        dispute.property?.title?.toLowerCase().includes(query);

      const matchesStatus = statusFilter === "all" || dispute.status === statusFilter;

      const matchesPriority = priorityFilter === "all" || dispute.priority === priorityFilter;

      const matchesCategory = categoryFilter === "all" || dispute.category === categoryFilter;

      return matchesSearch && matchesStatus && matchesPriority && matchesCategory;
    });
  }, [enrichedDisputes, search, statusFilter, priorityFilter, categoryFilter]);

  const selectedDispute = enrichedDisputes.find((dispute) => dispute.id === selectedId);

  const selectedActions = selectedId
    ? actions.filter((action) => action.dispute_id === selectedId)
    : [];

  const stats = useMemo(() => {
    const active = disputes.filter(
      (item) => item.status !== "resolved" && item.status !== "closed",
    ).length;

    const critical = disputes.filter((item) => item.priority === "critical").length;

    const escalated = disputes.filter((item) => item.status === "escalated").length;

    const resolved = disputes.filter(
      (item) => item.status === "resolved" || item.status === "closed",
    ).length;

    return {
      total: disputes.length,
      active,
      critical,
      escalated,
      resolved,
    };
  }, [disputes]);

  const refreshAll = async () => {
    await Promise.all([
      disputesQuery.refetch(),
      profilesQuery.refetch(),
      propertiesQuery.refetch(),
      leasesQuery.refetch(),
      actionsQuery.refetch(),
    ]);
  };

  const loading =
    disputesQuery.isLoading ||
    profilesQuery.isLoading ||
    propertiesQuery.isLoading ||
    leasesQuery.isLoading ||
    actionsQuery.isLoading;

  const error =
    disputesQuery.error ||
    profilesQuery.error ||
    propertiesQuery.error ||
    leasesQuery.error ||
    actionsQuery.error;

  return (
    <div className="tnp-module tnp-module-dark min-h-screen bg-[#08090b] text-white">
      <div className="mx-auto max-w-[1600px] px-5 py-6 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-5 xl:flex-row xl:items-center">
          <div>
            <button
              onClick={() => navigate({ to: "/app/admin" })}
              className="mb-4 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-zinc-500 transition hover:text-[#d4af37]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Admin Dashboard
            </button>

            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-[#d4af37]/20 bg-[#d4af37]/10 p-3">
                <Gavel className="h-6 w-6 text-[#d4af37]" />
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#d4af37]">
                  Trust & Governance
                </p>

                <h1 className="mt-1 text-3xl font-semibold tracking-tight text-white">
                  Dispute Management
                </h1>

                <p className="mt-1 text-sm text-zinc-500">
                  Investigate, manage and resolve tenant-landlord disputes.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={refreshAll}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-400/20 bg-red-400/[0.06] p-4">
            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />

            <div>
              <p className="font-medium text-red-300">Unable to load dispute data</p>

              <p className="mt-1 text-sm text-red-300/70">
                {(error as Error)?.message || "An unexpected database error occurred."}
              </p>
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard
            label="Total Cases"
            value={stats.total}
            icon={Gavel}
            description="All recorded disputes"
          />

          <StatCard
            label="Active"
            value={stats.active}
            icon={Clock3}
            description="Cases requiring attention"
          />

          <StatCard
            label="Critical"
            value={stats.critical}
            icon={ShieldAlert}
            description="Highest-priority cases"
          />

          <StatCard
            label="Escalated"
            value={stats.escalated}
            icon={AlertTriangle}
            description="Cases requiring escalation"
          />

          <StatCard
            label="Resolved"
            value={stats.resolved}
            icon={ShieldCheck}
            description="Resolved or closed cases"
          />
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
          <div className="flex flex-col gap-3 xl:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search cases, users, properties or dispute IDs..."
                className="h-11 w-full rounded-xl border border-white/10 bg-black/20 pl-10 pr-4 text-sm text-white placeholder:text-zinc-700 outline-none transition focus:border-[#d4af37]/40"
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative">
                <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />

                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="h-11 min-w-[170px] appearance-none rounded-xl border border-white/10 bg-black/20 pl-10 pr-8 text-sm text-zinc-300 outline-none focus:border-[#d4af37]/40"
                >
                  <option value="all">All Statuses</option>
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <select
                value={priorityFilter}
                onChange={(event) => setPriorityFilter(event.target.value)}
                className="h-11 min-w-[150px] rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-zinc-300 outline-none focus:border-[#d4af37]/40"
              >
                <option value="all">All Priorities</option>
                {PRIORITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className="h-11 min-w-[170px] rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-zinc-300 outline-none focus:border-[#d4af37]/40"
              >
                <option value="all">All Categories</option>
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div>
              <h2 className="font-semibold text-white">Dispute Queue</h2>
              <p className="mt-1 text-xs text-zinc-600">
                {filteredDisputes.length} case
                {filteredDisputes.length === 1 ? "" : "s"} matching current filters
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-[320px] items-center justify-center">
              <div className="text-center">
                <Loader2 className="mx-auto h-7 w-7 animate-spin text-[#d4af37]" />
                <p className="mt-3 text-sm text-zinc-500">Loading dispute cases...</p>
              </div>
            </div>
          ) : filteredDisputes.length === 0 ? (
            <div className="flex min-h-[320px] items-center justify-center px-6">
              <div className="max-w-sm text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
                  <Gavel className="h-6 w-6 text-zinc-600" />
                </div>

                <h3 className="mt-4 font-medium text-white">No disputes found</h3>

                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  No cases match your current search and filter settings.
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {filteredDisputes.map((dispute) => (
                <button
                  key={dispute.id}
                  onClick={() => setSelectedId(dispute.id)}
                  className="group flex w-full items-center gap-4 px-5 py-5 text-left transition hover:bg-white/[0.025]"
                >
                  <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.025] sm:flex">
                    <Gavel className="h-5 w-5 text-[#d4af37]" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-medium text-white">{dispute.title}</h3>

                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${priorityClasses(
                          dispute.priority,
                        )}`}
                      >
                        {formatLabel(dispute.priority)}
                      </span>

                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusClasses(
                          dispute.status,
                        )}`}
                      >
                        {formatLabel(dispute.status)}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-600">
                      <span>{formatLabel(dispute.category)}</span>

                      <span>{dispute.openedBy?.full_name || "Unknown user"}</span>

                      {dispute.property && <span>{dispute.property.title}</span>}

                      <span>{formatDate(dispute.created_at)}</span>
                    </div>
                  </div>

                  <div className="hidden items-center gap-3 md:flex">
                    <div className="text-right">
                      <p className="text-xs text-zinc-600">Case</p>
                      <p className="mt-1 font-mono text-[10px] text-zinc-500">
                        {dispute.id.slice(0, 8)}
                      </p>
                    </div>

                    <ChevronRight className="h-4 w-4 text-zinc-700 transition group-hover:translate-x-0.5 group-hover:text-[#d4af37]" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-[#d4af37]" />
              <div>
                <p className="text-sm font-medium text-white">Investigation First</p>
                <p className="mt-1 text-xs leading-5 text-zinc-600">
                  Review evidence, parties and linked lease information before making case
                  decisions.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-[#d4af37]" />
              <div>
                <p className="text-sm font-medium text-white">Audited Actions</p>
                <p className="mt-1 text-xs leading-5 text-zinc-600">
                  Administrative status and priority changes are recorded in the dispute audit
                  trail.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-[#d4af37]" />
              <div>
                <p className="text-sm font-medium text-white">Resolution Tracking</p>
                <p className="mt-1 text-xs leading-5 text-zinc-600">
                  Resolved cases retain their resolution details and administrator history.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {selectedDispute && (
        <DisputeInspection
          dispute={selectedDispute}
          profiles={profiles}
          actions={selectedActions}
          onClose={() => setSelectedId(null)}
          onRefresh={refreshAll}
        />
      )}
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/app/admin/disputes")({
  component: AdminDisputes,
});
