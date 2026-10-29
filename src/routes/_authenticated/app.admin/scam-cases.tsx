import { normalizeScamCase, scamDate } from "@/lib/scam-case-data";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Clock3,
  DollarSign,
  FileSearch,
  Flag,
  Gavel,
  Loader2,
  MapPin,
  MessageSquare,
  Phone,
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

type UntypedDbResult = {
  data: unknown;
  error: Error | null;
};

type UntypedDbQuery = PromiseLike<UntypedDbResult> & {
  select: (columns?: string) => UntypedDbQuery;
  order: (column: string, options?: { ascending?: boolean }) => UntypedDbQuery;
  update: (values: Record<string, unknown>) => UntypedDbQuery;
  eq: (column: string, value: string) => UntypedDbQuery;
  insert: (values: Record<string, unknown>) => Promise<{ error: Error | null }>;
};

const untypedDb = db as unknown as {
  from: (table: string) => UntypedDbQuery;
};

type ScamStatus =
  | "submitted"
  | "open"
  | "under_review"
  | "evidence_requested"
  | "escalated"
  | "resolved"
  | "closed"
  | "dismissed";

type ScamPriority = "low" | "medium" | "high" | "critical";

type ScamType =
  | "property_scam"
  | "land_scam"
  | "payment_scam"
  | "identity_fraud"
  | "fake_listing"
  | "impersonation"
  | "other";

type ScamCase = {
  id: string;
  reference?: string;
  source?: string;
  reporter_name?: string | null;
  reporter_email?: string | null;
  reporter_phone?: string | null;
  reporter_id: string | null;
  scammer_id: string | null;
  property_id: string | null;
  case_type: ScamType;
  priority: ScamPriority;
  status: ScamStatus;
  title: string;
  description: string;
  location: string | null;
  address: string | null;
  scammer_name: string | null;
  scammer_phone: string | null;
  scammer_email: string | null;
  identification_number: string | null;
  amount_lost_usd: number;
  payment_method: string | null;
  payment_reference: string | null;
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

type CaseAction = {
  id: string;
  case_id: string;
  admin_id: string;
  action: string;
  from_status: string | null;
  to_status: string | null;
  reason: string | null;
  created_at: string;
};

type EnrichedCase = ScamCase & {
  reporter?: Profile;
  scammer?: Profile;
  property?: Property;
};

const STATUS_OPTIONS: {
  value: ScamStatus;
  label: string;
}[] = [
  { value: "submitted", label: "Submitted" },
  { value: "open", label: "Open" },
  { value: "under_review", label: "Under Review" },
  { value: "evidence_requested", label: "Evidence Requested" },
  { value: "escalated", label: "Escalated" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
  { value: "dismissed", label: "Dismissed" },
];

const PRIORITY_OPTIONS: {
  value: ScamPriority;
  label: string;
}[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const TYPE_OPTIONS: {
  value: ScamType;
  label: string;
}[] = [
  { value: "property_scam", label: "Property Scam" },
  { value: "land_scam", label: "Land Scam" },
  { value: "payment_scam", label: "Payment Scam" },
  { value: "identity_fraud", label: "Identity Fraud" },
  { value: "fake_listing", label: "Fake Listing" },
  { value: "impersonation", label: "Impersonation" },
  { value: "other", label: "Other" },
];

function formatLabel(value: string | null | undefined) {
  if (!value) return "—";

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string | null | undefined) {
  return scamDate(value);
}

function formatMoney(value: number | null | undefined) {
  return `$${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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

function statusClasses(status: ScamStatus) {
  switch (status) {
    case "open":
      return "border-blue-400/20 bg-blue-400/10 text-blue-300";
    case "under_review":
      return "border-amber-400/20 bg-amber-400/10 text-amber-300";
    case "evidence_requested":
      return "border-purple-400/20 bg-purple-400/10 text-purple-300";
    case "escalated":
      return "border-red-400/20 bg-red-400/10 text-red-300";
    case "resolved":
      return "border-emerald-400/20 bg-emerald-400/10 text-emerald-300";
    case "closed":
      return "border-zinc-400/20 bg-zinc-400/10 text-zinc-300";
    case "dismissed":
      return "border-zinc-500/20 bg-zinc-500/10 text-zinc-500";
    default:
      return "border-zinc-400/20 bg-zinc-400/10 text-zinc-300";
  }
}

function priorityClasses(priority: ScamPriority) {
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
  description,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  description: string;
  icon: typeof AlertTriangle;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 shadow-[0_15px_45px_rgba(0,0,0,0.15)]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
            {label}
          </p>

          <p className="mt-2 text-3xl font-semibold tracking-tight text-white">
            {value}
          </p>

          <p className="mt-1 text-xs text-zinc-500">{description}</p>
        </div>

        <div className="rounded-xl border border-[#d4af37]/20 bg-[#d4af37]/10 p-2.5">
          <Icon className="h-5 w-5 text-[#d4af37]" />
        </div>
      </div>
    </div>
  );
}

function AuditTimeline({
  actions,
  profiles,
}: {
  actions: CaseAction[];
  profiles: Profile[];
}) {
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
                <span className="text-sm font-medium text-white">
                  {formatLabel(action.action)}
                </span>

                {action.from_status && action.to_status && (
                  <span className="text-xs text-zinc-500">
                    {formatLabel(action.from_status)} →{" "}
                    {formatLabel(action.to_status)}
                  </span>
                )}
              </div>

              <p className="mt-1 text-xs text-zinc-500">
                {admin?.full_name || "Administrator"} ·{" "}
                {formatDate(action.created_at)}
              </p>

              {action.reason && (
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  {action.reason}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CaseInspection({
  scamCase,
  profiles,
  actions,
  auditUnavailable,
  onClose,
  onRefresh,
}: {
  scamCase: EnrichedCase;
  profiles: Profile[];
  actions: CaseAction[];
  auditUnavailable: boolean;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState(scamCase.admin_notes || "");
  const [resolution, setResolution] = useState(scamCase.resolution || "");
  const [reason, setReason] = useState("");

  const profileMap = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles],
  );

  async function performAction(
    action: string,
    value: string,
    actionReason: string | null = null,
  ) {
    if (saving) return;
    setSaving(true);
    try {
      const { error } = await supabase.rpc(
        "tnp_admin_case_action" as never,
        {
          p_case_id: scamCase.id,
          p_action: action,
          p_value: value,
          p_reason: actionReason,
        } as never,
      );
      if (error) throw new Error(error.message);
      setReason("");
      onRefresh();
    } catch (cause) {
      window.alert(
        cause instanceof Error
          ? cause.message
          : "The case could not be updated.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function changeStatus(nextStatus: ScamStatus) {
    if (nextStatus !== scamCase.status)
      await performAction("status_changed", nextStatus, reason.trim() || null);
  }
  async function changePriority(nextPriority: ScamPriority) {
    if (nextPriority !== scamCase.priority)
      await performAction(
        "priority_changed",
        nextPriority,
        reason.trim() || null,
      );
  }
  async function saveNotes() {
    await performAction("note_added", notes.trim());
  }
  async function saveResolution() {
    if (resolution.trim().length < 10) {
      window.alert("Describe the resolution in at least ten characters.");
      return;
    }
    await performAction("resolved", resolution.trim());
  }

  async function reopen() {
    await changeStatus("under_review");
  }

  async function escalate() {
    await changeStatus("escalated");
  }

  const reporter = scamCase.reporter;
  const scammer = scamCase.scammer;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
      <div className="flex h-full w-full max-w-3xl flex-col border-l border-white/10 bg-[#0b0c0f] shadow-2xl">
        <div className="flex items-start justify-between border-b border-white/10 px-6 py-5">
          <div>
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-[#d4af37]" />

              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d4af37]">
                Scam Case Investigation
              </span>
            </div>

            <h2 className="mt-2 text-xl font-semibold text-white">
              {scamCase.title}
            </h2>

            <p className="mt-1 font-mono text-xs text-zinc-600">
              {scamCase.id}
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl border border-white/10 p-2 text-zinc-400 transition hover:bg-white/5 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {scamCase.source === "public" && (
            <section className="mb-6 rounded-2xl border border-white/15 bg-white/5 p-5">
              <h3 className="font-semibold text-white">Public report</h3>
              <p className="mt-2 break-all text-sm text-zinc-300">
                Case reference: {scamCase.reference}
              </p>
              <p className="mt-2 text-sm text-zinc-300">
                Reporter: {scamCase.reporter_name || "Not provided"}
              </p>
              <p className="mt-2 break-all text-sm text-zinc-300">
                Email: {scamCase.reporter_email || "Not provided"}
              </p>
              <p className="mt-2 text-sm text-zinc-300">
                Phone: {scamCase.reporter_phone || "Not provided"}
              </p>
              <p className="mt-3 text-xs text-zinc-400">
                The reporter can check status and the final resolution using
                their private tracking receipt. Administrative notes stay
                private.
              </p>
            </section>
          )}

          <div className="space-y-6">
            <section>
              <div className="flex flex-wrap gap-2">
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${statusClasses(
                    scamCase.status,
                  )}`}
                >
                  {formatLabel(scamCase.status)}
                </span>

                <span
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${priorityClasses(
                    scamCase.priority,
                  )}`}
                >
                  {formatLabel(scamCase.priority)} Priority
                </span>

                <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-zinc-400">
                  {formatLabel(scamCase.case_type)}
                </span>
              </div>

              <p className="mt-4 text-sm leading-7 text-zinc-300">
                {scamCase.description}
              </p>
            </section>

            <section className="rounded-2xl border border-red-400/10 bg-red-400/[0.025] p-5">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-red-300" />

                <h3 className="font-medium text-white">Financial Impact</h3>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs uppercase tracking-wider text-zinc-600">
                    Amount Lost
                  </p>

                  <p className="mt-1 text-xl font-semibold text-red-300">
                    {formatMoney(scamCase.amount_lost_usd)}
                  </p>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-wider text-zinc-600">
                    Payment Method
                  </p>

                  <p className="mt-1 text-sm text-zinc-300">
                    {scamCase.payment_method || "Not provided"}
                  </p>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-wider text-zinc-600">
                    Reference
                  </p>

                  <p className="mt-1 break-all font-mono text-xs text-zinc-400">
                    {scamCase.payment_reference || "Not provided"}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[#d4af37]" />

                <h3 className="font-medium text-white">Case Parties</h3>
              </div>

              <div className="mt-4 grid gap-5 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-black/10 p-4">
                  <p className="text-xs uppercase tracking-wider text-zinc-600">
                    Reporter / Victim
                  </p>

                  <div className="mt-3 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#d4af37]/10 text-xs font-semibold text-[#d4af37]">
                      {initials(reporter?.full_name)}
                    </div>

                    <div>
                      <p className="text-sm font-medium text-white">
                        {reporter?.full_name ||
                          scamCase.reporter_name ||
                          "Anonymous reporter"}
                      </p>

                      <p className="text-xs text-zinc-500">
                        Trust Score: {reporter?.trust_score ?? "—"}
                      </p>
                    </div>
                  </div>

                  {reporter?.phone && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
                      <Phone className="h-3.5 w-3.5" />
                      {reporter.phone}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-red-400/10 bg-red-400/[0.02] p-4">
                  <p className="text-xs uppercase tracking-wider text-zinc-600">
                    Reported Scammer
                  </p>

                  <div className="mt-3 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-400/10 text-xs font-semibold text-red-300">
                      {initials(scammer?.full_name || scamCase.scammer_name)}
                    </div>

                    <div>
                      <p className="text-sm font-medium text-white">
                        {scammer?.full_name ||
                          scamCase.scammer_name ||
                          "Unknown"}
                      </p>

                      <p className="text-xs text-zinc-500">
                        Trust Score: {scammer?.trust_score ?? "—"}
                      </p>
                    </div>
                  </div>

                  {scamCase.scammer_phone && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
                      <Phone className="h-3.5 w-3.5" />
                      {scamCase.scammer_phone}
                    </div>
                  )}

                  {scamCase.scammer_email && (
                    <p className="mt-2 break-all text-xs text-zinc-500">
                      {scamCase.scammer_email}
                    </p>
                  )}

                  {scamCase.identification_number && (
                    <p className="mt-2 font-mono text-xs text-zinc-600">
                      ID: {scamCase.identification_number}
                    </p>
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[#d4af37]" />

                <h3 className="font-medium text-white">Property / Location</h3>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-wider text-zinc-600">
                    Property
                  </p>

                  <p className="mt-1 text-sm text-zinc-300">
                    {scamCase.property?.title || "No linked property"}
                  </p>

                  {scamCase.property && (
                    <p className="mt-1 text-xs text-zinc-500">
                      {scamCase.property.suburb}, {scamCase.property.city}
                    </p>
                  )}
                </div>

                <div>
                  <p className="text-xs uppercase tracking-wider text-zinc-600">
                    Location
                  </p>

                  <p className="mt-1 text-sm text-zinc-300">
                    {scamCase.location || "Not provided"}
                  </p>
                </div>

                <div className="sm:col-span-2">
                  <p className="text-xs uppercase tracking-wider text-zinc-600">
                    Address
                  </p>

                  <p className="mt-1 text-sm text-zinc-300">
                    {scamCase.address || "Not provided"}
                  </p>
                </div>
              </div>
            </section>

            <section>
              <div className="mb-3 flex items-center gap-2">
                <FileSearch className="h-4 w-4 text-[#d4af37]" />

                <h3 className="font-medium text-white">Evidence</h3>

                <span className="ml-auto text-xs text-zinc-600">
                  {scamCase.evidence?.length || 0} item(s)
                </span>
              </div>

              {scamCase.evidence?.length ? (
                <div className="space-y-2">
                  {scamCase.evidence.map((item, index) => (
                    <div
                      key={`${item}-${index}`}
                      className="rounded-xl border border-white/10 bg-white/[0.025] p-3 text-sm text-zinc-400"
                    >
                      <span className="mr-2 text-xs font-semibold text-[#d4af37]">
                        #{index + 1}
                      </span>

                      {item}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-zinc-600">
                  No evidence has been attached to this case.
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
              <div className="flex items-center gap-2">
                <Gavel className="h-4 w-4 text-[#d4af37]" />

                <h3 className="font-medium text-white">Case Controls</h3>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs uppercase tracking-wider text-zinc-600">
                    Case Status
                  </label>

                  <select
                    value={scamCase.status}
                    disabled={saving}
                    onChange={(event) =>
                      changeStatus(event.target.value as ScamStatus)
                    }
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
                  <label className="text-xs uppercase tracking-wider text-zinc-600">
                    Priority
                  </label>

                  <select
                    value={scamCase.priority}
                    disabled={saving}
                    onChange={(event) =>
                      changePriority(event.target.value as ScamPriority)
                    }
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
                  rows={3}
                  placeholder="Reason for the administrative action..."
                  className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white placeholder:text-zinc-700 outline-none focus:border-[#d4af37]/50"
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {scamCase.status !== "escalated" &&
                  scamCase.status !== "closed" &&
                  scamCase.status !== "dismissed" && (
                    <button
                      onClick={escalate}
                      disabled={saving}
                      className="inline-flex items-center gap-2 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-2.5 text-sm font-medium text-red-300 transition hover:bg-red-400/15 disabled:opacity-50"
                    >
                      <AlertTriangle className="h-4 w-4" />
                      Escalate Case
                    </button>
                  )}

                {(scamCase.status === "resolved" ||
                  scamCase.status === "closed" ||
                  scamCase.status === "dismissed") && (
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

                <h3 className="font-medium text-white">Investigation Notes</h3>
              </div>

              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={5}
                placeholder="Document investigation findings, contacts, verification steps and follow-up..."
                className="mt-4 w-full resize-none rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm leading-6 text-white placeholder:text-zinc-700 outline-none focus:border-[#d4af37]/50"
              />

              <button
                onClick={saveNotes}
                disabled={saving}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#d4af37] px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-[#e3c45c] disabled:opacity-50"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Investigation Notes
              </button>
            </section>

            <section className="rounded-2xl border border-emerald-400/10 bg-emerald-400/[0.025] p-5">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />

                <h3 className="font-medium text-white">Resolution</h3>
              </div>

              <textarea
                aria-label="Case resolution"
                value={resolution}
                onChange={(event) => setResolution(event.target.value)}
                rows={4}
                placeholder="Document the final case outcome and resolution..."
                className="mt-4 w-full resize-none rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm leading-6 text-white placeholder:text-zinc-700 outline-none focus:border-emerald-400/40"
              />

              <button
                onClick={saveResolution}
                disabled={saving}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:opacity-50"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Resolve Case
              </button>

              {scamCase.resolved_at && (
                <p className="mt-3 text-xs text-zinc-500">
                  Resolved on {formatDate(scamCase.resolved_at)}
                  {scamCase.resolved_by
                    ? ` by ${profileMap.get(scamCase.resolved_by)?.full_name || "Administrator"}`
                    : ""}
                </p>
              )}
            </section>

            <section>
              <div className="mb-4 flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-[#d4af37]" />

                <h3 className="font-medium text-white">
                  Investigation Audit Trail
                </h3>
              </div>

              {auditUnavailable ? (
                <p role="alert" className="text-sm text-amber-200">
                  The audit trail could not be loaded. Refresh to retry; this
                  does not mean the case has no activity.
                </p>
              ) : (
                <AuditTimeline actions={actions} profiles={profiles} />
              )}
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs uppercase tracking-wider text-zinc-600">
                    Case Created
                  </p>

                  <p className="mt-1 text-sm text-zinc-400">
                    {formatDate(scamCase.created_at)}
                  </p>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-wider text-zinc-600">
                    Last Updated
                  </p>

                  <p className="mt-1 text-sm text-zinc-400">
                    {formatDate(scamCase.updated_at)}
                  </p>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-wider text-zinc-600">
                    Case ID
                  </p>

                  <p className="mt-1 break-all font-mono text-xs text-zinc-500">
                    {scamCase.id}
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminScamCases() {
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const casesQuery = useQuery({
    queryKey: ["admin-scam-cases"],
    retry: 1,
    queryFn: async () => {
      const { data, error } = await untypedDb
        .from("scam_cases")
        .select("*")
        .order("created_at", {
          ascending: false,
        });

      if (error) throw error;

      return (Array.isArray(data) ? data : [])
        .map(normalizeScamCase)
        .filter(Boolean) as unknown as ScamCase[];
    },
  });

  const profilesQuery = useQuery({
    queryKey: ["admin-scam-case-profiles"],
    retry: 1,
    queryFn: async () => {
      const { data, error } = await db
        .from("profiles")
        .select("id, full_name, phone, trust_score, verification");

      if (error) throw error;

      return (data || []) as Profile[];
    },
  });

  const propertiesQuery = useQuery({
    queryKey: ["admin-scam-case-properties"],
    retry: 1,
    queryFn: async () => {
      const { data, error } = await db
        .from("properties")
        .select("id, title, city, suburb, rent_usd, verified");

      if (error) throw error;

      return (data || []) as Property[];
    },
  });

  const actionsQuery = useQuery({
    queryKey: ["admin-scam-case-actions"],
    retry: 1,
    queryFn: async () => {
      const { data, error } = await untypedDb
        .from("scam_case_admin_actions")
        .select("*")
        .order("created_at", {
          ascending: false,
        });

      if (error) throw error;

      return (data || []) as CaseAction[];
    },
  });

  const cases = casesQuery.data || [];
  const profiles = profilesQuery.data || [];
  const properties = propertiesQuery.data || [];
  const actions = actionsQuery.data || [];

  const enrichedCases = useMemo<EnrichedCase[]>(() => {
    const profileMap = new Map(
      profiles.map((profile) => [profile.id, profile]),
    );

    const propertyMap = new Map(
      properties.map((property) => [property.id, property]),
    );

    return cases.map((scamCase) => ({
      ...scamCase,

      ...(scamCase.reporter_id && profileMap.has(scamCase.reporter_id)
        ? { reporter: profileMap.get(scamCase.reporter_id)! }
        : {}),

      ...(scamCase.scammer_id && profileMap.has(scamCase.scammer_id)
        ? { scammer: profileMap.get(scamCase.scammer_id)! }
        : {}),

      ...(scamCase.property_id && propertyMap.has(scamCase.property_id)
        ? { property: propertyMap.get(scamCase.property_id)! }
        : {}),
    }));
  }, [cases, profiles, properties]);

  const filteredCases = useMemo(() => {
    const query = search.trim().toLowerCase();

    return enrichedCases.filter((scamCase) => {
      const matchesSearch =
        !query ||
        scamCase.title.toLowerCase().includes(query) ||
        scamCase.description.toLowerCase().includes(query) ||
        scamCase.id.toLowerCase().includes(query) ||
        scamCase.scammer_name?.toLowerCase().includes(query) ||
        scamCase.scammer_phone?.toLowerCase().includes(query) ||
        scamCase.reporter?.full_name?.toLowerCase().includes(query) ||
        scamCase.reporter_name?.toLowerCase().includes(query) ||
        scamCase.reference?.toLowerCase().includes(query) ||
        scamCase.scammer?.full_name?.toLowerCase().includes(query) ||
        scamCase.property?.title?.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all" || scamCase.status === statusFilter;

      const matchesPriority =
        priorityFilter === "all" || scamCase.priority === priorityFilter;

      const matchesType =
        typeFilter === "all" || scamCase.case_type === typeFilter;

      return matchesSearch && matchesStatus && matchesPriority && matchesType;
    });
  }, [enrichedCases, search, statusFilter, priorityFilter, typeFilter]);

  const selectedCase = enrichedCases.find((item) => item.id === selectedId);

  const selectedActions = selectedId
    ? actions.filter((action) => action.case_id === selectedId)
    : [];

  const stats = useMemo(() => {
    const active = cases.filter(
      (item) =>
        item.status !== "resolved" &&
        item.status !== "closed" &&
        item.status !== "dismissed",
    ).length;

    const critical = cases.filter(
      (item) => item.priority === "critical",
    ).length;

    const escalated = cases.filter(
      (item) => item.status === "escalated",
    ).length;

    const resolved = cases.filter(
      (item) => item.status === "resolved" || item.status === "closed",
    ).length;

    const totalLoss = cases.reduce(
      (sum, item) => sum + Number(item.amount_lost_usd || 0),
      0,
    );

    return {
      total: cases.length,
      active,
      critical,
      escalated,
      resolved,
      totalLoss,
    };
  }, [cases]);

  const loading = casesQuery.isLoading;

  const error = casesQuery.error;
  const relatedError =
    profilesQuery.error || propertiesQuery.error || actionsQuery.error;

  async function refreshAll() {
    await Promise.all([
      casesQuery.refetch(),
      profilesQuery.refetch(),
      propertiesQuery.refetch(),
      actionsQuery.refetch(),
    ]);
  }

  return (
    <div className="tnp-module tnp-module-dark min-h-screen bg-[#08090b] text-white">
      <div className="mx-auto max-w-[1600px] px-5 py-6 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-5 xl:flex-row xl:items-center">
          <div>
            <button
              onClick={() =>
                navigate({
                  to: "/app/admin",
                })
              }
              className="mb-4 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-zinc-500 transition hover:text-[#d4af37]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Admin Dashboard
            </button>

            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-[#d4af37]/20 bg-[#d4af37]/10 p-3">
                <ShieldAlert className="h-6 w-6 text-[#d4af37]" />
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#d4af37]">
                  Trust & Safety
                </p>

                <h1 className="mt-1 text-3xl font-semibold tracking-tight text-white">
                  Scam Cases
                </h1>

                <p className="mt-1 text-sm text-zinc-500">
                  Investigate and manage property, land and payment scam
                  reports.
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

        {relatedError && (
          <p
            role="alert"
            className="mb-5 rounded-xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-100"
          >
            Some profile, property or audit details could not load. Reports are
            still available. Use Refresh to retry those details.
          </p>
        )}
        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-400/20 bg-red-400/[0.06] p-4">
            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />

            <div>
              <p className="font-medium text-red-300">
                Unable to load scam cases
              </p>

              <p className="mt-1 text-sm text-red-300/70">
                {(error as Error)?.message ||
                  "An unexpected database error occurred."}
              </p>
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard
            label="Total Cases"
            value={stats.total}
            description="All scam reports"
            icon={ShieldAlert}
          />

          <StatCard
            label="Active"
            value={stats.active}
            description="Cases requiring action"
            icon={Clock3}
          />

          <StatCard
            label="Critical"
            value={stats.critical}
            description="Highest priority"
            icon={AlertTriangle}
          />

          <StatCard
            label="Escalated"
            value={stats.escalated}
            description="Requires escalation"
            icon={Gavel}
          />

          <StatCard
            label="Reported Loss"
            value={formatMoney(stats.totalLoss)}
            description="Total reported financial loss"
            icon={DollarSign}
          />
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
          <div className="flex flex-col gap-3 xl:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search case, victim, scammer, property or case ID..."
                className="h-11 w-full rounded-xl border border-white/10 bg-black/20 pl-10 pr-4 text-sm text-white placeholder:text-zinc-700 outline-none focus:border-[#d4af37]/40"
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="h-11 min-w-[170px] rounded-xl border border-white/15 bg-[#15171c] px-3 text-sm font-medium text-white outline-none transition focus:border-[#d4af37]/60 focus:ring-1 focus:ring-[#d4af37]/30"
              >
                <option value="all" className="bg-[#15171c] text-white">
                  All Statuses
                </option>

                {STATUS_OPTIONS.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                    className="bg-[#15171c] text-white"
                  >
                    {option.label}
                  </option>
                ))}
              </select>

              <select
                value={priorityFilter}
                onChange={(event) => setPriorityFilter(event.target.value)}
                className="h-11 min-w-[150px] rounded-xl border border-white/15 bg-[#15171c] px-3 text-sm font-medium text-white outline-none transition focus:border-[#d4af37]/60 focus:ring-1 focus:ring-[#d4af37]/30"
              >
                <option value="all" className="bg-[#15171c] text-white">
                  All Priorities
                </option>

                {PRIORITY_OPTIONS.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                    className="bg-[#15171c] text-white"
                  >
                    {option.label}
                  </option>
                ))}
              </select>

              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                className="h-11 min-w-[180px] rounded-xl border border-white/15 bg-[#15171c] px-3 text-sm font-medium text-white outline-none transition focus:border-[#d4af37]/60 focus:ring-1 focus:ring-[#d4af37]/30"
              >
                <option value="all" className="bg-[#15171c] text-white">
                  All Case Types
                </option>

                {TYPE_OPTIONS.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                    className="bg-[#15171c] text-white"
                  >
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
              <h2 className="font-semibold text-white">Investigation Queue</h2>

              <p className="mt-1 text-xs text-zinc-600">
                {filteredCases.length} case
                {filteredCases.length === 1 ? "" : "s"} matching current filters
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-[340px] items-center justify-center">
              <div className="text-center">
                <Loader2 className="mx-auto h-7 w-7 animate-spin text-[#d4af37]" />

                <p className="mt-3 text-sm text-zinc-500">
                  Loading scam cases...
                </p>
              </div>
            </div>
          ) : casesQuery.error ? (
            <div role="alert" className="p-8 text-center">
              <p className="text-white">Scam reports could not be loaded.</p>
              <button
                type="button"
                onClick={() => void casesQuery.refetch()}
                className="mt-4 rounded-lg border border-white/20 px-4 py-3 text-white"
              >
                Retry reports
              </button>
            </div>
          ) : filteredCases.length === 0 ? (
            <div className="flex min-h-[340px] items-center justify-center px-6">
              <div className="max-w-sm text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
                  <ShieldCheck className="h-6 w-6 text-zinc-600" />
                </div>

                <h3 className="mt-4 font-medium text-white">
                  No scam cases found
                </h3>

                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  No reports match your current search and filter settings.
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {filteredCases.map((scamCase) => (
                <button
                  key={scamCase.id}
                  onClick={() => setSelectedId(scamCase.id)}
                  className="group flex w-full items-center gap-4 px-5 py-5 text-left transition hover:bg-white/[0.025]"
                >
                  <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-red-400/10 bg-red-400/[0.04] sm:flex">
                    <ShieldAlert className="h-5 w-5 text-[#d4af37]" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-medium text-white">
                        {scamCase.title}
                      </h3>

                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${priorityClasses(
                          scamCase.priority,
                        )}`}
                      >
                        {formatLabel(scamCase.priority)}
                      </span>

                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusClasses(
                          scamCase.status,
                        )}`}
                      >
                        {formatLabel(scamCase.status)}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-600">
                      <span>{formatLabel(scamCase.case_type)}</span>

                      <span>
                        {scamCase.reporter?.full_name ||
                          scamCase.reporter_name ||
                          "Anonymous reporter"}
                      </span>

                      <span>Loss: {formatMoney(scamCase.amount_lost_usd)}</span>

                      <span>{formatDate(scamCase.created_at)}</span>
                    </div>
                  </div>

                  <div className="hidden items-center gap-3 md:flex">
                    <div className="text-right">
                      <p className="text-xs text-zinc-600">Case</p>

                      <p className="mt-1 font-mono text-[10px] text-zinc-500">
                        {scamCase.id.slice(0, 8)}
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
              <FileSearch className="h-5 w-5 text-[#d4af37]" />

              <div>
                <p className="text-sm font-medium text-white">
                  Evidence-led Investigation
                </p>

                <p className="mt-1 text-xs leading-5 text-zinc-600">
                  Review payment details, identity information, locations and
                  attached evidence.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-[#d4af37]" />

              <div>
                <p className="text-sm font-medium text-white">
                  Protected Audit Trail
                </p>

                <p className="mt-1 text-xs leading-5 text-zinc-600">
                  Administrative decisions and case changes are recorded for
                  accountability.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-[#d4af37]" />

              <div>
                <p className="text-sm font-medium text-white">
                  Victim Resolution
                </p>

                <p className="mt-1 text-xs leading-5 text-zinc-600">
                  Track investigation outcomes, resolutions and final case
                  status.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {selectedCase && (
        <CaseInspection
          key={selectedCase.id}
          scamCase={selectedCase}
          profiles={profiles}
          actions={selectedActions}
          auditUnavailable={Boolean(actionsQuery.error)}
          onClose={() => setSelectedId(null)}
          onRefresh={refreshAll}
        />
      )}
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/app/admin/scam-cases")({
  component: AdminScamCases,
});
