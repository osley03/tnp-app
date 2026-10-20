import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Eye,
  FileText,
  Flag,
  MessageSquare,
  RefreshCw,
  Search,
  ShieldCheck,
  Star,
  Trash2,
  User,
  X,
  XCircle,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

type ModerationStatus = "pending" | "approved" | "flagged" | "removed";

type ReviewRow = {
  id: string;
  author_id: string;
  subject_id: string;
  property_id: string;
  rating: number;
  body: string;
  lease_confirmed: boolean;
  created_at: string;
  moderation_status: ModerationStatus;
  admin_note: string | null;
  reviewed_at: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string;
  phone: string | null;
  verification: string;
  trust_score: number;
};

type PropertyRow = {
  id: string;
  title: string;
  city: string;
  suburb: string;
  property_type: string;
  owner_id: string;
};

type ReviewAction = {
  id: string;
  review_id: string;
  admin_id: string;
  action: "approved" | "flagged" | "removed" | "restored" | "note_added";
  reason: string | null;
  created_at: string;
};

type EnrichedReview = ReviewRow & {
  author?: ProfileRow;
  subject?: ProfileRow;
  property?: PropertyRow;
};

const db = supabase;

const STATUS_LABELS: Record<ModerationStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  flagged: "Flagged",
  removed: "Removed",
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-ZW", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatShortDate(value: string | null | undefined) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-ZW", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function statusClasses(status: ModerationStatus) {
  switch (status) {
    case "approved":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
    case "flagged":
      return "border-amber-500/20 bg-amber-500/10 text-amber-300";
    case "removed":
      return "border-red-500/20 bg-red-500/10 text-red-300";
    default:
      return "border-sky-500/20 bg-sky-500/10 text-sky-300";
  }
}

function StatusBadge({ status }: { status: ModerationStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${statusClasses(
        status,
      )}`}
    >
      {status === "approved" && <CheckCircle2 size={13} />}
      {status === "pending" && <Clock3 size={13} />}
      {status === "flagged" && <Flag size={13} />}
      {status === "removed" && <XCircle size={13} />}
      {STATUS_LABELS[status]}
    </span>
  );
}

function StatCard({
  label,
  value,
  icon,
  description,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#111318] p-5 shadow-xl shadow-black/10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-white/50">{label}</p>
          <p className="mt-2 text-3xl font-bold text-white">{value}</p>
          <p className="mt-1 text-xs text-white/35">{description}</p>
        </div>

        <div className="rounded-xl border border-[#d4af37]/20 bg-[#d4af37]/10 p-3 text-[#d4af37]">
          {icon}
        </div>
      </div>
    </div>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={14}
          className={star <= rating ? "fill-[#d4af37] text-[#d4af37]" : "text-white/15"}
        />
      ))}
    </div>
  );
}

function initials(name?: string | null) {
  if (!name) return "U";

  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-[#111318] px-6 text-center">
      <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-white/40">
        <MessageSquare size={28} />
      </div>

      <h3 className="text-lg font-semibold text-white">{title}</h3>

      <p className="mt-2 max-w-md text-sm leading-6 text-white/45">{description}</p>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-6">
      <div className="flex items-start gap-4">
        <div className="rounded-xl bg-red-500/10 p-3 text-red-300">
          <AlertTriangle size={22} />
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-red-200">Unable to load reviews</h3>

          <p className="mt-1 break-words text-sm text-red-200/60">{message}</p>

          <button
            type="button"
            onClick={onRetry}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-200 transition hover:bg-red-500/20"
          >
            <RefreshCw size={15} />
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map((item) => (
        <div
          key={item}
          className="h-28 animate-pulse rounded-2xl border border-white/5 bg-white/[0.03]"
        />
      ))}
    </div>
  );
}

function AuditTimeline({
  actions,
  profiles,
}: {
  actions: ReviewAction[];
  profiles: Record<string, ProfileRow>;
}) {
  if (actions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 p-5 text-center">
        <p className="text-sm text-white/35">
          No administrative actions have been recorded for this review.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {actions.map((action) => {
        const admin = profiles[action.admin_id];

        return (
          <div key={action.id} className="relative border-l border-white/10 pl-5">
            <div className="absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full bg-[#d4af37]" />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium capitalize text-white">
                {action.action.replace("_", " ")}
              </p>

              <span className="text-xs text-white/35">{formatDate(action.created_at)}</span>
            </div>

            <p className="mt-1 text-xs text-white/40">By {admin?.full_name || "Administrator"}</p>

            {action.reason && (
              <p className="mt-2 rounded-lg border border-white/5 bg-white/[0.025] p-3 text-sm leading-6 text-white/55">
                {action.reason}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ReviewInspection({
  review,
  actions,
  profiles,
  onClose,
  onAction,
  actionLoading,
}: {
  review: EnrichedReview;
  actions: ReviewAction[];
  profiles: Record<string, ProfileRow>;
  onClose: () => void;
  onAction: (action: "approved" | "flagged" | "removed" | "restored") => Promise<void>;
  actionLoading: boolean;
}) {
  const [note, setNote] = useState(review.admin_note ?? "");
  const [savingNote, setSavingNote] = useState(false);
  const [noteMessage, setNoteMessage] = useState("");

  const saveNote = async () => {
    setSavingNote(true);
    setNoteMessage("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Your admin session has expired.");
      }

      const { error } = await db
        .from("reviews")
        .update({
          admin_note: note.trim() || null,
          reviewed_at: new Date().toISOString(),
        } as never)
        .eq("id", review.id);

      if (error) throw error;

      const { error: actionError } = await db.from("review_admin_actions" as never).insert({
        review_id: review.id,
        admin_id: user.id,
        action: "note_added",
        reason: note.trim() || "Admin note cleared.",
      } as never);

      if (actionError) throw actionError;

      setNoteMessage("Admin note saved.");
    } catch (error: unknown) {
      setNoteMessage(error instanceof Error ? error.message : "Unable to save the admin note.");
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm">
      <div className="flex h-full w-full max-w-2xl flex-col border-l border-white/10 bg-[#0c0d10] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#d4af37]">
              Review Inspection
            </p>

            <h2 className="mt-1 text-xl font-bold text-white">Review #{review.id.slice(0, 8)}</h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 p-2 text-white/50 transition hover:bg-white/5 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            <section className="rounded-2xl border border-white/10 bg-[#111318] p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#d4af37]/10 font-semibold text-[#d4af37]">
                  {initials(review.author?.full_name)}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-white">
                      {review.author?.full_name || "Unknown reviewer"}
                    </h3>

                    {review.author?.verification && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300">
                        <ShieldCheck size={11} />
                        {review.author.verification}
                      </span>
                    )}
                  </div>

                  <p className="mt-1 text-xs text-white/35">
                    Review submitted {formatDate(review.created_at)}
                  </p>

                  <div className="mt-3">
                    <Stars rating={review.rating} />
                  </div>
                </div>

                <StatusBadge status={review.moderation_status} />
              </div>

              <div className="mt-5 rounded-xl border border-white/5 bg-white/[0.025] p-4">
                <p className="whitespace-pre-wrap text-sm leading-7 text-white/70">
                  {review.body || "No review text provided."}
                </p>
              </div>
            </section>

            <section className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-[#111318] p-5">
                <p className="text-xs uppercase tracking-wider text-white/35">Property</p>

                <p className="mt-2 font-semibold text-white">
                  {review.property?.title || "Unknown property"}
                </p>

                <p className="mt-1 text-sm text-white/45">
                  {review.property
                    ? `${review.property.suburb}, ${review.property.city}`
                    : "Property details unavailable"}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#111318] p-5">
                <p className="text-xs uppercase tracking-wider text-white/35">Lease Verification</p>

                <div className="mt-3 flex items-center gap-2">
                  {review.lease_confirmed ? (
                    <>
                      <CheckCircle2 size={18} className="text-emerald-400" />
                      <span className="text-sm font-medium text-emerald-300">Lease confirmed</span>
                    </>
                  ) : (
                    <>
                      <XCircle size={18} className="text-white/30" />
                      <span className="text-sm text-white/50">Not lease confirmed</span>
                    </>
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-[#111318] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-white">Administrative Actions</h3>
                  <p className="mt-1 text-xs text-white/35">
                    Apply moderation decisions to this review.
                  </p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {review.moderation_status !== "approved" && (
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => onAction("approved")}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <CheckCircle2 size={15} />
                    Approve
                  </button>
                )}

                {review.moderation_status !== "flagged" && (
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => onAction("flagged")}
                    className="inline-flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-300 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Flag size={15} />
                    Flag
                  </button>
                )}

                {review.moderation_status !== "removed" && (
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => onAction("removed")}
                    className="inline-flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm font-medium text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 size={15} />
                    Remove
                  </button>
                )}

                {review.moderation_status === "removed" && (
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => onAction("restored")}
                    className="inline-flex items-center gap-2 rounded-lg bg-sky-500/10 px-3 py-2 text-sm font-medium text-sky-300 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <RefreshCw size={15} />
                    Restore
                  </button>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-[#111318] p-5">
              <div>
                <h3 className="font-semibold text-white">Admin Note</h3>

                <p className="mt-1 text-xs text-white/35">
                  Internal moderation notes are visible to administrators.
                </p>
              </div>

              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={5}
                placeholder="Add an internal note about this review..."
                className="mt-4 w-full resize-none rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#d4af37]/40"
              />

              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-xs text-white/40">{noteMessage}</p>

                <button
                  type="button"
                  onClick={saveNote}
                  disabled={savingNote}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#d4af37] px-4 py-2 text-sm font-semibold text-black transition hover:bg-[#e1c65a] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingNote && <RefreshCw size={14} className="animate-spin" />}
                  Save Note
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-[#111318] p-5">
              <div className="mb-5 flex items-center gap-2">
                <FileText size={17} className="text-[#d4af37]" />

                <div>
                  <h3 className="font-semibold text-white">Audit Trail</h3>

                  <p className="text-xs text-white/35">Administrative history for this review.</p>
                </div>
              </div>

              <AuditTimeline actions={actions} profiles={profiles} />
            </section>

            <section className="rounded-2xl border border-white/10 bg-[#111318] p-5">
              <h3 className="font-semibold text-white">Review Metadata</h3>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-white/35">Review ID</p>
                  <p className="mt-1 break-all text-sm text-white/65">{review.id}</p>
                </div>

                <div>
                  <p className="text-xs text-white/35">Author ID</p>
                  <p className="mt-1 break-all text-sm text-white/65">{review.author_id}</p>
                </div>

                <div>
                  <p className="text-xs text-white/35">Subject ID</p>
                  <p className="mt-1 break-all text-sm text-white/65">{review.subject_id}</p>
                </div>

                <div>
                  <p className="text-xs text-white/35">Property ID</p>
                  <p className="mt-1 break-all text-sm text-white/65">{review.property_id}</p>
                </div>

                <div>
                  <p className="text-xs text-white/35">Submitted</p>
                  <p className="mt-1 text-sm text-white/65">{formatDate(review.created_at)}</p>
                </div>

                <div>
                  <p className="text-xs text-white/35">Last Reviewed</p>
                  <p className="mt-1 text-sm text-white/65">{formatDate(review.reviewed_at)}</p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminReviewsPage() {
  const [reviews, setReviews] = useState<EnrichedReview[]>([]);
  const [actions, setActions] = useState<ReviewAction[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({});

  const [selectedReview, setSelectedReview] = useState<EnrichedReview | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ModerationStatus>("all");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [actionLoading, setActionLoading] = useState(false);

  const loadReviews = useCallback(async (showRefresh = false) => {
    if (showRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const { data: reviewData, error: reviewError } = await db
        .from("reviews")
        .select(
          `
            id,
            author_id,
            subject_id,
            property_id,
            rating,
            body,
            lease_confirmed,
            created_at,
            moderation_status,
            admin_note,
            reviewed_at
          `,
        )
        .order("created_at", { ascending: false });

      if (reviewError) throw reviewError;

      const rawReviews = (reviewData || []) as unknown as ReviewRow[];

      const profileIds = Array.from(
        new Set(rawReviews.flatMap((review) => [review.author_id, review.subject_id])),
      );

      const propertyIds = Array.from(new Set(rawReviews.map((review) => review.property_id)));

      let profileRows: ProfileRow[] = [];
      let propertyRows: PropertyRow[] = [];

      if (profileIds.length > 0) {
        const { data, error: profileError } = await db
          .from("profiles")
          .select("id, full_name, phone, verification, trust_score")
          .in("id", profileIds);

        if (profileError) throw profileError;

        profileRows = (data || []) as ProfileRow[];
      }

      if (propertyIds.length > 0) {
        const { data, error: propertyError } = await db
          .from("properties")
          .select("id, title, city, suburb, property_type, owner_id")
          .in("id", propertyIds);

        if (propertyError) throw propertyError;

        propertyRows = (data || []) as PropertyRow[];
      }

      const profileMap: Record<string, ProfileRow> = {};
      profileRows.forEach((profile) => {
        profileMap[profile.id] = profile;
      });

      const propertyMap: Record<string, PropertyRow> = {};
      propertyRows.forEach((property) => {
        propertyMap[property.id] = property;
      });

      setProfiles(profileMap);

      const enriched: EnrichedReview[] = rawReviews.map((review) => ({
        ...review,
        ...(profileMap[review.author_id] ? { author: profileMap[review.author_id] } : {}),
        ...(profileMap[review.subject_id] ? { subject: profileMap[review.subject_id] } : {}),
        ...(propertyMap[review.property_id] ? { property: propertyMap[review.property_id] } : {}),
      }));

      setReviews(enriched);

      const { data: actionData, error: actionError } = await db
        .from("review_admin_actions" as never)
        .select("id, review_id, admin_id, action, reason, created_at")
        .order("created_at", { ascending: false });

      if (actionError) throw actionError;

      setActions((actionData || []) as ReviewAction[]);
    } catch (err: unknown) {
      console.error("Admin reviews load error:", err);

      setError(
        err instanceof Error ? err.message : "An unexpected error occurred while loading reviews.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadReviews();
  }, [loadReviews]);

  const filteredReviews = useMemo(() => {
    const term = search.trim().toLowerCase();

    return reviews.filter((review) => {
      const matchesStatus = statusFilter === "all" || review.moderation_status === statusFilter;

      if (!matchesStatus) return false;

      if (!term) return true;

      const searchable = [
        review.body,
        review.author?.full_name,
        review.subject?.full_name,
        review.property?.title,
        review.property?.city,
        review.property?.suburb,
        review.property?.property_type,
        review.id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(term);
    });
  }, [reviews, search, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: reviews.length,
      pending: reviews.filter((review) => review.moderation_status === "pending").length,
      approved: reviews.filter((review) => review.moderation_status === "approved").length,
      flagged: reviews.filter((review) => review.moderation_status === "flagged").length,
      removed: reviews.filter((review) => review.moderation_status === "removed").length,
      leaseConfirmed: reviews.filter((review) => review.lease_confirmed).length,
    };
  }, [reviews]);

  const selectedActions = useMemo(() => {
    if (!selectedReview) return [];

    return actions.filter((action) => action.review_id === selectedReview.id);
  }, [actions, selectedReview]);

  const performModerationAction = async (
    review: EnrichedReview,
    action: "approved" | "flagged" | "removed" | "restored",
  ) => {
    const actionLabels = {
      approved: "approve",
      flagged: "flag",
      removed: "remove",
      restored: "restore",
    };

    const confirmed = window.confirm(
      `Are you sure you want to ${actionLabels[action]} this review?`,
    );

    if (!confirmed) return;

    setActionLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Your admin session has expired.");
      }

      const nextStatus: ModerationStatus = action === "restored" ? "pending" : action;

      const reason = window.prompt(
        `Optional reason for ${actionLabels[action]}ing this review:`,
        "",
      );

      const { error: updateError } = await db
        .from("reviews" as never)
        .update({
          moderation_status: nextStatus,
          reviewed_at: new Date().toISOString(),
        } as never)
        .eq("id", review.id);

      if (updateError) throw updateError;

      const { error: auditError } = await db.from("review_admin_actions" as never).insert({
        review_id: review.id,
        admin_id: user.id,
        action,
        reason: reason?.trim() || null,
      } as never);

      if (auditError) throw auditError;

      await loadReviews(true);

      setSelectedReview((current) => {
        if (!current || current.id !== review.id) return current;

        return {
          ...current,
          moderation_status: nextStatus,
          reviewed_at: new Date().toISOString(),
        };
      });
    } catch (err: unknown) {
      console.error("Review moderation error:", err);

      window.alert(
        err instanceof Error ? err.message : "The review moderation action could not be completed.",
      );
    } finally {
      setActionLoading(false);
    }
  };

  const goBackToDashboard = () => {
    window.location.href = "/app/admin";
  };

  return (
    <div className="tnp-module tnp-module-dark min-h-screen bg-[#0a0b0d] text-white">
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-[#d4af37]">
              <ShieldCheck size={15} />
              TNP Administration
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-white">Review Management</h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">
              Monitor tenant and landlord reviews, verify review integrity, moderate content, and
              maintain a complete administrative audit trail.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={goBackToDashboard}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/[0.06] hover:text-white"
            >
              <ArrowLeft size={16} />
              Back to Admin Dashboard
            </button>

            <button
              type="button"
              onClick={() => void loadReviews(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-xl border border-[#d4af37]/20 bg-[#d4af37]/10 px-4 py-2.5 text-sm font-medium text-[#d4af37] transition hover:bg-[#d4af37]/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <StatCard
            label="Total Reviews"
            value={stats.total}
            icon={<MessageSquare size={20} />}
            description="All submitted reviews"
          />

          <StatCard
            label="Pending"
            value={stats.pending}
            icon={<Clock3 size={20} />}
            description="Awaiting moderation"
          />

          <StatCard
            label="Approved"
            value={stats.approved}
            icon={<CheckCircle2 size={20} />}
            description="Approved content"
          />

          <StatCard
            label="Flagged"
            value={stats.flagged}
            icon={<Flag size={20} />}
            description="Requires attention"
          />

          <StatCard
            label="Removed"
            value={stats.removed}
            icon={<Trash2 size={20} />}
            description="Removed from service"
          />

          <StatCard
            label="Lease Confirmed"
            value={stats.leaseConfirmed}
            icon={<ShieldCheck size={20} />}
            description="Verified tenancy reviews"
          />
        </div>

        {/* Toolbar */}
        <div className="mt-7 rounded-2xl border border-white/10 bg-[#111318] p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-xl">
              <Search
                size={18}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
              />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search reviewer, property, location, review text..."
                className="w-full rounded-xl border border-white/10 bg-black/20 py-3 pl-10 pr-4 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#d4af37]/40"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["all", "All"],
                  ["pending", "Pending"],
                  ["approved", "Approved"],
                  ["flagged", "Flagged"],
                  ["removed", "Removed"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStatusFilter(value)}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                    statusFilter === value
                      ? "bg-[#d4af37] text-black"
                      : "border border-white/10 bg-white/[0.03] text-white/55 hover:bg-white/[0.06] hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="mt-5">
          {loading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState message={error} onRetry={() => void loadReviews()} />
          ) : filteredReviews.length === 0 ? (
            <EmptyState
              title={search || statusFilter !== "all" ? "No matching reviews" : "No reviews found"}
              description={
                search || statusFilter !== "all"
                  ? "Try changing your search term or moderation filter."
                  : "Reviews submitted through TNP will appear here for administrative moderation."
              }
            />
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <p className="text-sm text-white/40">
                  Showing{" "}
                  <span className="font-medium text-white/70">{filteredReviews.length}</span> of{" "}
                  <span className="font-medium text-white/70">{reviews.length}</span> reviews
                </p>
              </div>

              {filteredReviews.map((review) => (
                <div
                  key={review.id}
                  className="group rounded-2xl border border-white/10 bg-[#111318] p-5 transition hover:border-[#d4af37]/20 hover:bg-[#131519]"
                >
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-center">
                    <div className="flex min-w-0 flex-1 items-start gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#d4af37]/20 bg-[#d4af37]/10 text-sm font-semibold text-[#d4af37]">
                        {initials(review.author?.full_name)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-white">
                            {review.author?.full_name || "Unknown reviewer"}
                          </h3>

                          <StatusBadge status={review.moderation_status} />

                          {review.lease_confirmed && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-300">
                              <ShieldCheck size={11} />
                              Lease confirmed
                            </span>
                          )}
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/35">
                          <span>{review.property?.title || "Unknown property"}</span>

                          <span>
                            {review.property
                              ? `${review.property.suburb}, ${review.property.city}`
                              : "Location unavailable"}
                          </span>

                          <span>{formatShortDate(review.created_at)}</span>
                        </div>

                        <div className="mt-3">
                          <Stars rating={review.rating} />
                        </div>

                        <p className="mt-3 line-clamp-2 max-w-4xl text-sm leading-6 text-white/55">
                          {review.body || "No review text provided."}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedReview(review)}
                        className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-white/65 transition hover:bg-white/[0.07] hover:text-white"
                      >
                        <Eye size={16} />
                        Inspect
                        <ChevronRight size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedReview && (
        <ReviewInspection
          review={selectedReview}
          actions={selectedActions}
          profiles={profiles}
          onClose={() => setSelectedReview(null)}
          onAction={(action) => performModerationAction(selectedReview, action)}
          actionLoading={actionLoading}
        />
      )}
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/app/admin/reviews")({
  component: AdminReviewsPage,
});
