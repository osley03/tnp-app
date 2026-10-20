import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Filter,
  Loader2,
  MessageSquare,
  Search,
  ShieldCheck,
  Star,
  User,
  X,
} from "lucide-react";

import { RoleSidebar } from "@/components/dashboard/RoleSidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app/landlord/reviews")({
  component: LandlordReviews,
});

type Review = {
  id: string;
  author_id: string;
  subject_id: string;
  property_id: string | null;
  rating: number;
  body: string;
  lease_confirmed: boolean;
  created_at: string;
  moderation_status: string;
  admin_note: string | null;
  reviewed_at: string | null;
  landlord_response: string | null;
  landlord_responded_at: string | null;
  landlord_response_by: string | null;
};

type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  bio: string | null;
  verification: string | null;
  trust_score: number | null;
};

type Property = {
  id: string;
  owner_id: string;
  title: string | null;
  suburb: string | null;
  city: string | null;
  rent_usd: number | null;
  deposit_usd: number | null;
  beds: number | null;
  baths: number | null;
  property_type: string | null;
  description: string | null;
  image_url: string | null;
};

type ReviewBundle = {
  review: Review;
  author: Profile | null;
  property: Property | null;
};

const RATING_FILTERS = ["All", "5 Stars", "4 Stars", "3 Stars", "2 Stars", "1 Star"] as const;

const RESPONSE_FILTERS = ["All", "Responded", "Awaiting response"] as const;

const MODERATION_FILTERS = ["All", "Pending", "Approved", "Rejected"] as const;

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-ZW", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-ZW", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getInitials(name: string | null | undefined) {
  if (!name?.trim()) return "TN";

  const parts = name.trim().split(/\s+/);

  if (parts.length === 1) {
    return parts[0]?.slice(0, 2).toUpperCase() ?? "TN";
  }

  return `${parts[0]?.[0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`.toUpperCase();
}

function getRatingText(rating: number) {
  return `${rating} ${rating === 1 ? "Star" : "Stars"}`;
}

function getModerationClass(status: string) {
  switch (status.toLowerCase()) {
    case "approved":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "rejected":
      return "border-red-200 bg-red-50 text-red-700";

    case "pending":
    default:
      return "border-amber-200 bg-amber-50 text-amber-700";
  }
}

function getPropertyName(property: Property | null) {
  if (!property) return "Property unavailable";

  return property.title || "Untitled property";
}

function getPropertyLocation(property: Property | null) {
  if (!property) return "Location unavailable";

  return [property.suburb, property.city].filter(Boolean).join(", ") || "Location not provided";
}

function StarRating({ rating, size = "h-4 w-4" }: { rating: number; size?: string }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${size} ${
            star <= rating ? "fill-amber-400 text-amber-400" : "text-slate-200"
          }`}
        />
      ))}
    </div>
  );
}

function StatCard({
  label,
  value,
  description,
  icon,
}: {
  label: string;
  value: number | string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">
            {label}
          </p>

          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>

          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>

        <div className="rounded-xl border border-amber-100 bg-amber-50 p-2.5 text-amber-600">
          {icon}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-[340px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 text-center">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-400">
        <MessageSquare className="h-7 w-7" />
      </div>

      <h3 className="mt-5 text-base font-semibold text-slate-900">{title}</h3>

      <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );
}

function DetailItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-2 text-slate-400">
        {icon}

        <span className="text-[11px] font-semibold uppercase tracking-[0.12em]">{label}</span>
      </div>

      <p className="mt-2 truncate text-sm font-semibold text-slate-800">{value}</p>
    </div>
  );
}

function ModerationBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${getModerationClass(
        status,
      )}`}
    >
      {status.toLowerCase() === "approved" ? (
        <CheckCircle2 className="h-3.5 w-3.5" />
      ) : status.toLowerCase() === "rejected" ? (
        <X className="h-3.5 w-3.5" />
      ) : (
        <Clock3 className="h-3.5 w-3.5" />
      )}

      {status}
    </span>
  );
}

function LandlordReviews() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");

  const [ratingFilter, setRatingFilter] = useState<(typeof RATING_FILTERS)[number]>("All");

  const [responseFilter, setResponseFilter] = useState<(typeof RESPONSE_FILTERS)[number]>("All");

  const [moderationFilter, setModerationFilter] =
    useState<(typeof MODERATION_FILTERS)[number]>("All");

  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);

  const [responseText, setResponseText] = useState("");

  const [responseMode, setResponseMode] = useState(false);

  const [responseLoading, setResponseLoading] = useState(false);

  const [responseError, setResponseError] = useState<string | null>(null);

  const userQuery = useQuery({
    queryKey: ["landlord-reviews-user"],

    queryFn: async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) throw error;

      return user;
    },
  });

  const landlordId = userQuery.data?.id ?? null;

  /*
   * ----------------------------------------------------------
   * LANDLORD PROPERTIES
   * ----------------------------------------------------------
   */

  const propertiesQuery = useQuery({
    queryKey: ["landlord-review-properties", landlordId],

    enabled: Boolean(landlordId),

    queryFn: async () => {
      if (!landlordId) return [];

      const { data, error } = await supabase
        .from("properties")
        .select(
          "id, owner_id, title, suburb, city, rent_usd, deposit_usd, beds, baths, property_type, description, image_url",
        )
        .eq("owner_id", landlordId);

      if (error) throw error;

      return (data ?? []) as Property[];
    },
  });

  const properties = propertiesQuery.data ?? [];

  const propertyIds = useMemo(() => properties.map((property) => property.id), [properties]);

  /*
   * ----------------------------------------------------------
   * REVIEWS
   * ----------------------------------------------------------
   *
   * We retrieve:
   *
   * 1. Reviews where subject_id = landlord
   * 2. Reviews attached to landlord-owned properties
   *
   * The results are merged and deduplicated.
   */

  const reviewsQuery = useQuery({
    queryKey: ["landlord-reviews", landlordId, propertyIds],

    enabled: Boolean(landlordId),

    queryFn: async () => {
      if (!landlordId) return [];

      const directResult = await supabase
        .from("reviews")
        .select("*")
        .eq("subject_id", landlordId)
        .order("created_at", {
          ascending: false,
        });

      if (directResult.error) {
        throw directResult.error;
      }

      let propertyReviews: Review[] = [];

      if (propertyIds.length > 0) {
        const propertyResult = await supabase
          .from("reviews")
          .select("*")
          .in("property_id", propertyIds)
          .order("created_at", {
            ascending: false,
          });

        if (propertyResult.error) {
          throw propertyResult.error;
        }

        propertyReviews = (propertyResult.data ?? []) as Review[];
      }

      const combined = [...((directResult.data ?? []) as Review[]), ...propertyReviews];

      const unique = new Map<string, Review>();

      combined.forEach((review) => {
        unique.set(review.id, review);
      });

      return Array.from(unique.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    },
  });

  const reviews = reviewsQuery.data ?? [];

  /*
   * ----------------------------------------------------------
   * AUTHOR IDS
   * ----------------------------------------------------------
   */

  const authorIds = useMemo(
    () => [...new Set(reviews.map((review) => review.author_id).filter(Boolean))],
    [reviews],
  );

  /*
   * ----------------------------------------------------------
   * AUTHOR PROFILES
   * ----------------------------------------------------------
   */

  const authorsQuery = useQuery({
    queryKey: ["landlord-review-authors", authorIds],

    enabled: authorIds.length > 0,

    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, phone, bio, verification, trust_score")
        .in("id", authorIds);

      if (error) throw error;

      return (data ?? []) as Profile[];
    },
  });

  const authors = authorsQuery.data ?? [];

  const propertyMap = useMemo(
    () => new Map(properties.map((property) => [property.id, property])),
    [properties],
  );

  const authorMap = useMemo(() => new Map(authors.map((author) => [author.id, author])), [authors]);

  /*
   * ----------------------------------------------------------
   * REVIEW BUNDLES
   * ----------------------------------------------------------
   */

  const bundles = useMemo<ReviewBundle[]>(
    () =>
      reviews.map((review) => ({
        review,
        author: authorMap.get(review.author_id) ?? null,
        property: review.property_id ? (propertyMap.get(review.property_id) ?? null) : null,
      })),
    [reviews, authorMap, propertyMap],
  );

  /*
   * ----------------------------------------------------------
   * FILTERING
   * ----------------------------------------------------------
   */

  const filteredReviews = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return bundles.filter(({ review, author, property }) => {
      if (ratingFilter !== "All" && review.rating !== Number(ratingFilter.charAt(0))) {
        return false;
      }

      if (responseFilter === "Responded" && !review.landlord_response) {
        return false;
      }

      if (responseFilter === "Awaiting response" && review.landlord_response) {
        return false;
      }

      if (
        moderationFilter !== "All" &&
        review.moderation_status.toLowerCase() !== moderationFilter.toLowerCase()
      ) {
        return false;
      }

      if (!normalizedSearch) return true;

      const haystack = [
        author?.full_name,
        author?.phone,
        property?.title,
        property?.suburb,
        property?.city,
        review.body,
        review.moderation_status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [bundles, search, ratingFilter, responseFilter, moderationFilter]);

  /*
   * ----------------------------------------------------------
   * SELECTED REVIEW
   * ----------------------------------------------------------
   */

  const selectedBundle = useMemo(
    () => bundles.find(({ review }) => review.id === selectedReviewId) ?? null,
    [bundles, selectedReviewId],
  );

  /*
   * ----------------------------------------------------------
   * METRICS
   * ----------------------------------------------------------
   */

  const metrics = useMemo(() => {
    const total = reviews.length;

    const average =
      total === 0
        ? 0
        : reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / total;

    return {
      total,

      fiveStars: reviews.filter((review) => review.rating === 5).length,

      responded: reviews.filter((review) => Boolean(review.landlord_response)).length,

      awaiting: reviews.filter((review) => !review.landlord_response).length,

      average: average.toFixed(1),
    };
  }, [reviews]);

  /*
   * ----------------------------------------------------------
   * OPEN REVIEW
   * ----------------------------------------------------------
   */

  function openReview(review: Review) {
    setSelectedReviewId(review.id);

    setResponseText(review.landlord_response ?? "");

    setResponseMode(false);

    setResponseError(null);
  }

  /*
   * ----------------------------------------------------------
   * SAVE LANDLORD RESPONSE
   * ----------------------------------------------------------
   */

  async function saveResponse() {
    if (!selectedBundle || !landlordId) return;

    const trimmedResponse = responseText.trim();

    if (!trimmedResponse) {
      setResponseError("Please enter a response before saving.");

      return;
    }

    setResponseLoading(true);

    setResponseError(null);

    try {
      const now = new Date().toISOString();

      const { error } = await supabase
        .from("reviews")
        .update({
          landlord_response: trimmedResponse,
          landlord_responded_at: now,
          landlord_response_by: landlordId,
        } as never)
        .eq("id", selectedBundle.review.id);

      if (error) throw error;

      await queryClient.invalidateQueries({
        queryKey: ["landlord-reviews"],
      });

      setResponseMode(false);

      setResponseText(trimmedResponse);
    } catch (error) {
      setResponseError(
        error instanceof Error ? error.message : "Unable to save landlord response.",
      );
    } finally {
      setResponseLoading(false);
    }
  }

  /*
   * ----------------------------------------------------------
   * CLOSE DRAWER
   * ----------------------------------------------------------
   */

  function closeDetails() {
    setSelectedReviewId(null);

    setResponseText("");

    setResponseMode(false);

    setResponseError(null);
  }

  const isLoading =
    userQuery.isLoading ||
    propertiesQuery.isLoading ||
    reviewsQuery.isLoading ||
    authorsQuery.isLoading;

  /*
   * ----------------------------------------------------------
   * LOADING
   * ----------------------------------------------------------
   */

  if (isLoading) {
    return (
      <SidebarProvider>
        <RoleSidebar role="landlord" />

        <SidebarInset className="min-w-0 bg-slate-50 text-slate-900">
          <div className="flex min-h-screen items-center justify-center">
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin text-amber-600" />
              Loading reviews...
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  /*
   * ----------------------------------------------------------
   * MAIN PAGE
   * ----------------------------------------------------------
   */

  return (
    <SidebarProvider>
      <RoleSidebar role="landlord" />

      <SidebarInset className="min-w-0 bg-slate-50 text-slate-900">
        <div className="tnp-module tnp-module-light min-h-screen w-full bg-slate-50">
          {/* HEADER */}

          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur-xl">
            <div className="flex h-16 items-center justify-between px-5 lg:px-8">
              <div className="flex min-w-0 items-center gap-3">
                <SidebarTrigger className="text-slate-500 hover:bg-slate-100 hover:text-slate-900" />

                <div className="hidden h-5 w-px bg-slate-200 sm:block" />

                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-600">
                    Landlord Portal
                  </p>

                  <h1 className="truncate text-sm font-semibold text-slate-900">Reviews</h1>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  navigate({
                    to: "/app/landlord",
                  })
                }
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
              >
                <ArrowLeft className="h-4 w-4" />

                <span className="hidden sm:inline">Dashboard</span>
              </button>
            </div>
          </header>

          <main className="mx-auto w-full max-w-[1600px] px-5 py-8 lg:px-8">
            {/* INTRO */}

            <section className="mb-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                Tenant Feedback
              </p>

              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 lg:text-4xl">
                Reviews
              </h2>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                Review tenant feedback, verify lease-backed reviews, monitor moderation status, and
                respond directly to reviews associated with your properties.
              </p>
            </section>

            {/* METRICS */}

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <StatCard
                label="Total Reviews"
                value={metrics.total}
                description="Reviews received"
                icon={<MessageSquare className="h-5 w-5" />}
              />

              <StatCard
                label="Average Rating"
                value={`${metrics.average}/5`}
                description="Overall rating"
                icon={<Star className="h-5 w-5" />}
              />

              <StatCard
                label="5 Stars"
                value={metrics.fiveStars}
                description="Highest-rated reviews"
                icon={<Star className="h-5 w-5" />}
              />

              <StatCard
                label="Responded"
                value={metrics.responded}
                description="Landlord responses"
                icon={<CheckCircle2 className="h-5 w-5" />}
              />

              <StatCard
                label="Awaiting"
                value={metrics.awaiting}
                description="Need response"
                icon={<Clock3 className="h-5 w-5" />}
              />
            </section>

            {/* FILTERS */}

            <section className="mt-8">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-4">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search tenant, property, review..."
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="mr-1 flex items-center gap-2 text-xs font-medium text-slate-400">
                      <Filter className="h-4 w-4" />
                      Rating
                    </div>

                    {RATING_FILTERS.map((filter) => (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => setRatingFilter(filter)}
                        className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                          ratingFilter === filter
                            ? "border-amber-200 bg-amber-50 text-amber-700"
                            : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                        }`}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="mr-1 text-xs font-medium text-slate-400">Response</span>

                    {RESPONSE_FILTERS.map((filter) => (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => setResponseFilter(filter)}
                        className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                          responseFilter === filter
                            ? "border-amber-200 bg-amber-50 text-amber-700"
                            : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                        }`}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="mr-1 text-xs font-medium text-slate-400">Moderation</span>

                    {MODERATION_FILTERS.map((filter) => (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => setModerationFilter(filter)}
                        className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                          moderationFilter === filter
                            ? "border-amber-200 bg-amber-50 text-amber-700"
                            : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                        }`}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* ERROR */}

            {reviewsQuery.error && (
              <div className="mt-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />

                <span>
                  {reviewsQuery.error instanceof Error
                    ? reviewsQuery.error.message
                    : "Unable to load reviews."}
                </span>
              </div>
            )}

            {/* REVIEW LIST */}

            <section className="mt-6">
              {filteredReviews.length === 0 ? (
                <EmptyState
                  title={reviews.length === 0 ? "No reviews yet" : "No matching reviews"}
                  description={
                    reviews.length === 0
                      ? "Tenant reviews associated with your properties will appear here once they are submitted."
                      : "Try changing your search or filters to find the review you are looking for."
                  }
                />
              ) : (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  {/* TABLE HEADER */}

                  <div className="hidden border-b border-slate-200 bg-slate-50 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400 lg:grid lg:grid-cols-[1.5fr_1.5fr_1fr_1fr_40px] lg:gap-4">
                    <span>Tenant</span>
                    <span>Property</span>
                    <span>Rating</span>
                    <span>Status</span>
                    <span />
                  </div>

                  <div className="divide-y divide-slate-200">
                    {filteredReviews.map(({ review, author, property }) => (
                      <button
                        key={review.id}
                        type="button"
                        onClick={() => openReview(review)}
                        className="group grid w-full gap-4 px-5 py-5 text-left transition hover:bg-slate-50 lg:grid-cols-[1.5fr_1.5fr_1fr_1fr_40px] lg:items-center"
                      >
                        {/* TENANT */}

                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-xs font-semibold text-slate-600">
                            {getInitials(author?.full_name)}
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {author?.full_name || "Unknown tenant"}
                            </p>

                            <div className="mt-1 flex items-center gap-2">
                              {review.lease_confirmed && (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                                  <ShieldCheck className="h-3.5 w-3.5" />
                                  Lease confirmed
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* PROPERTY */}

                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-800">
                            {getPropertyName(property)}
                          </p>

                          <p className="mt-1 truncate text-xs text-slate-400">
                            {getPropertyLocation(property)}
                          </p>
                        </div>

                        {/* RATING */}

                        <div>
                          <StarRating rating={review.rating} size="h-3.5 w-3.5" />

                          <p className="mt-1 text-xs text-slate-400">
                            {getRatingText(review.rating)}
                          </p>
                        </div>

                        {/* STATUS */}

                        <div className="flex flex-wrap gap-2">
                          <ModerationBadge status={review.moderation_status} />

                          {review.landlord_response ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                              <Check className="h-3.5 w-3.5" />
                              Responded
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500">
                              Awaiting
                            </span>
                          )}
                        </div>

                        <ChevronRight className="hidden h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500 lg:block" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </main>
        </div>

        {/* ==================================================
            REVIEW DETAIL DRAWER
        ================================================== */}

        {selectedBundle && (
          <div className="fixed inset-0 z-50">
            <button
              type="button"
              aria-label="Close review details"
              onClick={closeDetails}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />

            <aside className="absolute right-0 top-0 flex h-full w-full max-w-2xl flex-col border-l border-slate-200 bg-white shadow-2xl">
              {/* DRAWER HEADER */}

              <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-5">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-600">
                    Tenant Review
                  </p>

                  <h2 className="mt-1 text-lg font-semibold text-slate-900">Review details</h2>
                </div>

                <button
                  type="button"
                  onClick={closeDetails}
                  className="rounded-lg border border-slate-200 p-2 text-slate-400 transition hover:bg-slate-50 hover:text-slate-900"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* DRAWER CONTENT */}

              <div className="flex-1 overflow-y-auto px-6 py-6">
                {/* TOP STATUS */}

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <ModerationBadge status={selectedBundle.review.moderation_status} />

                    {selectedBundle.review.lease_confirmed && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Lease confirmed
                      </span>
                    )}
                  </div>

                  <span className="text-xs text-slate-400">
                    {formatDateTime(selectedBundle.review.created_at)}
                  </span>
                </div>

                {/* TENANT */}

                <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 text-sm font-semibold text-slate-600">
                      {getInitials(selectedBundle.author?.full_name)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                        Reviewer
                      </p>

                      <h3 className="mt-1 text-lg font-semibold text-slate-900">
                        {selectedBundle.author?.full_name || "Unknown tenant"}
                      </h3>

                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        {selectedBundle.author?.trust_score !== null &&
                          selectedBundle.author?.trust_score !== undefined && (
                            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600">
                              <ShieldCheck className="h-4 w-4 text-amber-600" />
                              Trust score {selectedBundle.author.trust_score}
                            </span>
                          )}

                        {selectedBundle.author?.verification && (
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-500">
                            {selectedBundle.author.verification}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <DetailItem
                      icon={<User className="h-4 w-4" />}
                      label="Tenant"
                      value={selectedBundle.author?.full_name || "Not available"}
                    />

                    <DetailItem
                      icon={<MessageSquare className="h-4 w-4" />}
                      label="Phone"
                      value={selectedBundle.author?.phone || "Not provided"}
                    />
                  </div>
                </section>

                {/* PROPERTY */}

                <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-100 bg-amber-50">
                      <Building2 className="h-5 w-5 text-amber-600" />
                    </div>

                    <div className="min-w-0">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                        Property
                      </p>

                      <h3 className="mt-1 truncate text-base font-semibold text-slate-900">
                        {getPropertyName(selectedBundle.property)}
                      </h3>

                      <p className="mt-1 text-sm text-slate-500">
                        {getPropertyLocation(selectedBundle.property)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <DetailItem
                      icon={<Building2 className="h-4 w-4" />}
                      label="Property type"
                      value={selectedBundle.property?.property_type || "Not specified"}
                    />

                    <DetailItem
                      icon={<Star className="h-4 w-4" />}
                      label="Rating"
                      value={getRatingText(selectedBundle.review.rating)}
                    />
                  </div>
                </section>

                {/* REVIEW */}

                <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                        Tenant feedback
                      </p>

                      <div className="mt-2">
                        <StarRating rating={selectedBundle.review.rating} />
                      </div>
                    </div>

                    <span className="text-sm font-semibold text-slate-700">
                      {selectedBundle.review.rating}
                      /5
                    </span>
                  </div>

                  <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="whitespace-pre-wrap text-sm leading-7 text-slate-600">
                      {selectedBundle.review.body || "No review text was provided."}
                    </p>
                  </div>
                </section>

                {/* MODERATION */}

                <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Moderation
                  </p>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <DetailItem
                      icon={<Clock3 className="h-4 w-4" />}
                      label="Status"
                      value={selectedBundle.review.moderation_status}
                    />

                    <DetailItem
                      icon={<CheckCircle2 className="h-4 w-4" />}
                      label="Reviewed"
                      value={formatDateTime(selectedBundle.review.reviewed_at)}
                    />
                  </div>

                  {selectedBundle.review.admin_note && (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Admin note
                      </p>

                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                        {selectedBundle.review.admin_note}
                      </p>
                    </div>
                  )}
                </section>

                {/* LANDLORD RESPONSE */}

                <section className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/50 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-amber-600" />

                        <h3 className="text-sm font-semibold text-slate-900">Landlord Response</h3>
                      </div>

                      <p className="mt-1 text-xs text-slate-500">
                        Respond publicly to the tenant's review.
                      </p>
                    </div>

                    {!responseMode && (
                      <button
                        type="button"
                        onClick={() => {
                          setResponseMode(true);
                          setResponseError(null);
                        }}
                        className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-50"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />

                        {selectedBundle.review.landlord_response
                          ? "Edit Response"
                          : "Reply to Review"}
                      </button>
                    )}
                  </div>

                  {responseMode ? (
                    <div className="mt-4">
                      <textarea
                        autoFocus
                        value={responseText}
                        onChange={(event) => setResponseText(event.target.value)}
                        rows={6}
                        placeholder="Write your response to the tenant..."
                        className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-400 focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
                      />

                      {responseError && (
                        <div className="mt-2 flex items-center gap-2 text-xs text-red-600">
                          <AlertCircle className="h-3.5 w-3.5" />
                          {responseError}
                        </div>
                      )}

                      <div className="mt-3 flex justify-end gap-2">
                        <button
                          type="button"
                          disabled={responseLoading}
                          onClick={() => {
                            setResponseMode(false);
                            setResponseText(selectedBundle.review.landlord_response ?? "");
                            setResponseError(null);
                          }}
                          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50"
                        >
                          Cancel
                        </button>

                        <button
                          type="button"
                          disabled={responseLoading}
                          onClick={saveResponse}
                          className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {responseLoading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )}

                          {responseLoading ? "Saving..." : "Save Response"}
                        </button>
                      </div>
                    </div>
                  ) : selectedBundle.review.landlord_response ? (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                      <p className="whitespace-pre-wrap text-sm leading-6 text-slate-600">
                        {selectedBundle.review.landlord_response}
                      </p>

                      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                        <span className="inline-flex items-center gap-1.5 text-emerald-600">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Response published
                        </span>

                        <span>{formatDateTime(selectedBundle.review.landlord_responded_at)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-white p-4">
                      <p className="text-sm text-slate-400">
                        You have not responded to this review yet.
                      </p>
                    </div>
                  )}
                </section>
              </div>
            </aside>
          </div>
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}
