import { matchesSearch as matchWorkspaceSearch } from '@/lib/workspace-search';
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Eye,
  FileText,
  Loader2,
  MapPin,
  MessageSquare,
  Search,
  Send,
  ShieldCheck,
  UserRound,
  WalletCards,
  X,
  XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app/tenant/applications")({
  component: TenantApplications,
});

type Row = Record<string, unknown>;

type ApplicationRecord = Row & {
  property?: Row | undefined;
  landlord?: Row | undefined;
};

type FormState = {
  moveIn: string;
  message: string;
};

function value<T>(...values: Array<T | null | undefined | "">) {
  return values.find((item) => item !== null && item !== undefined && item !== "") as T | undefined;
}

function text(valueToRead: unknown, fallback = "") {
  const result = String(valueToRead ?? "").trim();
  return result || fallback;
}

function number(valueToRead: unknown) {
  const result = Number(valueToRead);
  return Number.isFinite(result) ? result : null;
}

function money(valueToRead: unknown) {
  const result = number(valueToRead);

  if (result === null) {
    return "Price not specified";
  }

  return `$${result.toLocaleString()}`;
}

function dateLabel(valueToRead: unknown) {
  if (!valueToRead) {
    return "Not set";
  }

  const date = new Date(String(valueToRead));

  if (Number.isNaN(date.getTime())) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-ZW", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function dateTimeLabel(valueToRead: unknown) {
  if (!valueToRead) {
    return "Not recorded";
  }

  const date = new Date(String(valueToRead));

  if (Number.isNaN(date.getTime())) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en-ZW", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function normalize(valueToRead: unknown) {
  return text(valueToRead).toLowerCase().trim();
}

function applicationStatus(application: Row) {
  return normalize(application["status"] || "pending");
}

function statusLabel(status: string) {
  switch (status) {
    case "pending":
    case "pending review":
    case "pending_review":
    case "submitted":
      return "Pending review";

    case "under review":
    case "under_review":
      return "Under review";

    case "approved":
    case "accepted":
      return "Approved";

    case "rejected":
    case "declined":
      return "Rejected";

    case "withdrawn":
      return "Withdrawn";

    case "cancelled":
    case "canceled":
      return "Cancelled";

    default:
      return text(status, "Pending");
  }
}

function statusClass(status: string) {
  switch (status) {
    case "approved":
    case "accepted":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "rejected":
    case "declined":
      return "border-red-200 bg-red-50 text-red-700";

    case "withdrawn":
    case "cancelled":
    case "canceled":
      return "border-slate-200 bg-slate-100 text-slate-600";

    case "under review":
    case "under_review":
      return "border-amber-200 bg-amber-50 text-amber-700";

    default:
      return "border-blue-200 bg-blue-50 text-blue-700";
  }
}

function propertyTitle(property: Row | undefined) {
  return text(value(property?.["title"], property?.["name"]), "Property");
}

function propertyLocation(property: Row | undefined) {
  if (!property) {
    return "Location not provided";
  }

  const suburb = text(property["suburb"]);
  const city = text(property["city"], "Harare");

  return suburb && city ? `${suburb}, ${city}` : suburb || city;
}

function propertyType(property: Row | undefined) {
  return text(value(property?.["property_type"], property?.["type"]), "Property");
}

function propertyListingType(property: Row | undefined) {
  return text(property?.["listing_type"], "For Rent");
}

function propertyPrice(property: Row | undefined) {
  if (!property) {
    return "Price not specified";
  }

  const listingType = normalize(property["listing_type"] || "For Rent");

  const rent = number(value(property["rent_usd"], property["rent"], property["monthly_rent"]));

  const sale = number(value(property["price_usd"], property["sale_price"], property["price"]));

  if (listingType === "for sale" && sale !== null) {
    return `${money(sale)} total`;
  }

  if (listingType === "for rent or sale") {
    if (rent !== null && sale !== null) {
      return `${money(rent)}/month · ${money(sale)} sale`;
    }

    if (rent !== null) {
      return `${money(rent)}/month`;
    }

    if (sale !== null) {
      return `${money(sale)} total`;
    }
  }

  if (rent !== null) {
    return `${money(rent)}/month`;
  }

  if (sale !== null) {
    return `${money(sale)} total`;
  }

  return "Price not specified";
}

function propertyImage(property: Row | undefined) {
  const images = property?.["image_urls"];

  if (Array.isArray(images)) {
    const first = images.find((item) => typeof item === "string" && item.trim().length > 0);

    if (typeof first === "string") {
      return first;
    }
  }

  return text(value(property?.["image_url"], property?.["cover_image"]), "");
}

function landlordName(landlord: Row | undefined, property: Row | undefined) {
  return text(
    value(landlord?.["full_name"], property?.["landlord_name"], property?.["owner_name"]),
    "TNP Landlord",
  );
}

function ImageOrPlaceholder({ src, alt }: { src?: string; alt: string }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-100 text-slate-400">
        <Building2 className="h-9 w-9" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className="h-full w-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}

function Metric({
  icon,
  label,
  value: metricValue,
}: {
  icon: ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
          {icon}
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>

          <p className="mt-1 text-2xl font-bold text-slate-950">{metricValue}</p>
        </div>
      </div>
    </div>
  );
}

function TenantApplications() {
  const navigate = useNavigate();

  const [userId, setUserId] = useState<string | null>(null);

  const [applications, setApplications] = useState<ApplicationRecord[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [selectedApplication, setSelectedApplication] = useState<ApplicationRecord | null>(null);

  const [applicationProperty, setApplicationProperty] = useState<Row | null>(null);

  const [form, setForm] = useState<FormState>({
    moveIn: "",
    message: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [processingId, setProcessingId] = useState<string | null>(null);

  const [detailsOpen, setDetailsOpen] = useState(false);

  const requestedPropertyId = useMemo(() => {
    if (typeof window === "undefined") {
      return null;
    }

    return new URLSearchParams(window.location.search).get("property");
  }, []);

  async function loadApplications(targetUserId: string) {
    setLoading(true);
    setError(null);

    try {
      const { data, error: applicationsError } = await supabase
        .from("lease_requests" as never)
        .select("*")
        .eq("tenant_id", targetUserId)
        .order("created_at", { ascending: false });

      if (applicationsError) {
        throw applicationsError;
      }

      const rows = (data ?? []) as ApplicationRecord[];

      const propertyIds = Array.from(
        new Set(rows.map((row) => text(row["property_id"])).filter(Boolean)),
      );

      let propertyRows: Row[] = [];
      let profileRows: Row[] = [];

      if (propertyIds.length > 0) {
        const { data: propertiesData, error: propertiesError } = await supabase
          .from("properties" as never)
          .select("*")
          .in("id", propertyIds);

        if (propertiesError) {
          console.warn("Could not load application properties:", propertiesError);
        } else {
          propertyRows = (propertiesData ?? []) as Row[];
        }
      }

      const ownerIds = Array.from(
        new Set(propertyRows.map((row) => text(row["owner_id"])).filter(Boolean)),
      );

      if (ownerIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles" as never)
          .select("id, full_name, phone, verification, trust_score")
          .in("id", ownerIds);

        if (profilesError) {
          console.warn("Could not load application landlords:", profilesError);
        } else {
          profileRows = (profilesData ?? []) as Row[];
        }
      }

      const propertyMap = new Map(propertyRows.map((row) => [text(row["id"]), row]));

      const landlordMap = new Map(profileRows.map((row) => [text(row["id"]), row]));

      const enriched = rows.map((row) => {
        const property = propertyMap.get(text(row["property_id"]));

        const landlord = landlordMap.get(text(property?.["owner_id"]));

        return {
          ...row,
          property,
          landlord,
        };
      });

      setApplications(enriched);
    } catch (loadError) {
      console.error(loadError);

      setApplications([]);

      setError(
        loadError instanceof Error ? loadError.message : "Could not load your applications.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function start() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active) {
        return;
      }

      if (!user) {
        setUserId(null);
        setLoading(false);
        setError("Your tenant session could not be found. Please sign in again.");
        return;
      }

      setUserId(user.id);

      await loadApplications(user.id);
    }

    void start();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!userId) return;
    const refresh = () => { if (document.visibilityState === "visible" && !applicationProperty) void loadApplications(userId); };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [userId, applicationProperty]);

  useEffect(() => {
    if (!requestedPropertyId) {
      return;
    }

    const propertyId = requestedPropertyId;

    let active = true;

    async function loadRequestedProperty() {
      setSubmitError(null);

      const alreadyPending = applications.some(
        (application) =>
          text(application["property_id"]) === propertyId &&
          ["pending", "pending review", "pending_review", "submitted", "under review", "under_review", "approved", "accepted"].includes(
            applicationStatus(application),
          ),
      );

      if (alreadyPending) {
        setSubmitError("You already have an active application for this property.");

        return;
      }

      const { data, error: propertyError } = await supabase
        .from("properties" as never)
        .select("*")
        .eq("id", propertyId)
        .maybeSingle();

      if (!active) {
        return;
      }

      if (propertyError) {
        setSubmitError(propertyError.message);
        return;
      }

      if (!data) {
        setSubmitError("The property connected to this application could not be found.");
        return;
      }

      setApplicationProperty(data as Row);

      setForm({
        moveIn: "",
        message: "",
      });
    }

    void loadRequestedProperty();

    return () => {
      active = false;
    };
  }, [requestedPropertyId, applications]);

  const filteredApplications = useMemo(() => {
    const query = normalize(search);

    return applications.filter((application) => {
      const property = application.property;
      const landlord = application.landlord;

      const status = applicationStatus(application);

      const matchesSearch = matchWorkspaceSearch(query, propertyTitle(property), propertyLocation(property), propertyType(property), propertyListingType(property), landlordName(landlord, property), application["message"], application["id"]);

      if (!matchesSearch) {
        return false;
      }

      if (statusFilter !== "all" && status !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [applications, search, statusFilter]);

  const metrics = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;

    for (const application of applications) {
      const status = applicationStatus(application);

      if (["pending", "pending review", "pending_review", "submitted", "under review", "under_review"].includes(status)) {
        pending++;
      }

      if (["approved", "accepted"].includes(status)) {
        approved++;
      }

      if (["rejected", "declined"].includes(status)) {
        rejected++;
      }
    }

    return {
      total: applications.length,
      pending,
      approved,
      rejected,
    };
  }, [applications]);

  const closeApplicationForm = () => {
    setApplicationProperty(null);

    setForm({
      moveIn: "",
      message: "",
    });

    setSubmitError(null);

    if (typeof window !== "undefined" && window.history.replaceState) {
      const url = new URL(window.location.href);

      url.searchParams.delete("property");

      window.history.replaceState({}, "", url.toString());
    }
  };

  const openDetails = (application: ApplicationRecord) => {
    setSelectedApplication(application);
    setDetailsOpen(true);
  };

  const closeDetails = () => {
    setSelectedApplication(null);
    setDetailsOpen(false);
  };

  const submitApplication = async () => {
    if (submitting) return;
    if (!userId || !applicationProperty) {
      setSubmitError("Your tenant session or selected property is missing.");

      return;
    }

    if (!applicationProperty["available"] || !["for rent", "for lease", "for rent or sale", "rent", "rental"].includes(text(applicationProperty["listing_type"] || "For Rent").trim().toLowerCase())) {
      setSubmitError("Please choose an available rental listing."); return;
    }
    if (!form.moveIn) {
      setSubmitError("Please select your intended move-in date.");

      return;
    }

    const today = new Date(new Date().toISOString().slice(0, 10));

    if (new Date(form.moveIn) < today) {
      setSubmitError("Move-in date cannot be in the past.");

      return;
    }

    if (form.message.trim().length > 2000) { setSubmitError("Please keep your message within 2,000 characters."); return; }
    const selectedPropertyId = text(applicationProperty["id"]);

    const existingPending = applications.find(
      (application) =>
        text(application["property_id"]) === selectedPropertyId &&
        ["pending", "pending review", "pending_review", "submitted", "under review", "under_review"].includes(
          applicationStatus(application),
        ),
    );

    if (existingPending) {
      setSubmitError("You already have an active application for this property.");

      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const payload = {
        property_id: selectedPropertyId,
        tenant_id: userId,
        move_in: form.moveIn,
        message: form.message.trim() || null,
        status: "pending",
      };

      const { error: insertError } = await supabase
        .from("lease_requests" as never)
        .insert(payload as never);

      if (insertError) {
        throw insertError;
      }

      closeApplicationForm();

      await loadApplications(userId);

      window.alert("Application submitted successfully. The landlord can now review your request.");
    } catch (submitErrorValue) {
      console.error(submitErrorValue);

      setSubmitError(
        submitErrorValue instanceof Error
          ? submitErrorValue.message
          : "Your application could not be submitted.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const withdrawApplication = async (application: ApplicationRecord) => {
    const id = text(application["id"]);
    const tenantId = userId;

    const status = applicationStatus(application);

    if (!id || !tenantId) {
      return;
    }

    if (!["pending", "pending review", "pending_review", "submitted", "under review", "under_review"].includes(status)) {
      window.alert("This application can no longer be withdrawn.");

      return;
    }

    const confirmed = window.confirm(
      "Withdraw this application? The landlord will no longer be able to approve this request as an active application.",
    );

    if (!confirmed) {
      return;
    }

    setProcessingId(id);

    try {
      const { error: updateError } = await supabase
        .from("lease_requests" as never)
        .update({
          status: "withdrawn",
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id", id)
        .eq("tenant_id", tenantId).select("id").single();

      if (updateError) {
        throw updateError;
      }

      await loadApplications(tenantId);

      if (selectedApplication && text(selectedApplication["id"]) === id) {
        closeDetails();
      }
    } catch (withdrawError) {
      console.error(withdrawError);

      window.alert(
        withdrawError instanceof Error
          ? withdrawError.message
          : "The application could not be withdrawn.",
      );
    } finally {
      setProcessingId(null);
    }
  };

  const goToProperty = (application: ApplicationRecord) => {
    const id=text(application['property_id']);
    if(id)void navigate({to:'/app/property/$id',params:{id}});
    else void navigate({to:'/app/tenant/properties'});
  };

  const goToLease = (_application: ApplicationRecord) => {
    navigate({
      to: "/app/tenant/leases" as never,
    });
  };

  return (
    <div className="tnp-module tnp-module-light min-h-full bg-slate-50">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-9 lg:px-8">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
              <FileText className="h-3.5 w-3.5" />
              Tenant Applications
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
              My applications
            </h1>

            <p className="mt-3 text-sm leading-6 text-slate-500 sm:text-base">
              Track every property application you have submitted, review landlord decisions, and
              move approved applications into the lease process.
            </p>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric
            icon={<FileText className="h-5 w-5" />}
            label="Total applications"
            value={metrics.total}
          />

          <Metric
            icon={<Clock3 className="h-5 w-5" />}
            label="Pending / review"
            value={metrics.pending}
          />

          <Metric
            icon={<CheckCircle2 className="h-5 w-5" />}
            label="Approved"
            value={metrics.approved}
          />

          <Metric
            icon={<XCircle className="h-5 w-5" />}
            label="Rejected"
            value={metrics.rejected}
          />
        </div>

        {applicationProperty && (
          <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  New application
                </p>

                <h2 className="mt-1 text-lg font-bold text-slate-950">
                  Apply for {propertyTitle(applicationProperty)}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeApplicationForm}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid lg:grid-cols-[300px,1fr]">
              <div className="h-56 lg:h-full">
                <ImageOrPlaceholder
                  src={propertyImage(applicationProperty)}
                  alt={propertyTitle(applicationProperty)}
                />
              </div>

              <div className="p-6 lg:p-8">
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {propertyType(applicationProperty)}
                  </span>

                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {propertyListingType(applicationProperty)}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" />
                    {propertyLocation(applicationProperty)}
                  </span>

                  <span className="inline-flex items-center gap-1.5">
                    <WalletCards className="h-4 w-4" />
                    {propertyPrice(applicationProperty)}
                  </span>
                </div>

                {submitError && (
                  <div className="mt-5 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />

                    <p className="text-sm leading-5 text-red-700">{submitError}</p>
                  </div>
                )}

                <div className="mt-6 grid gap-5 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-800">
                      Intended move-in date <span className="text-red-500">*</span>
                    </span>

                    <input
                      type="date"
                      value={form.moveIn}
                      min={new Date().toISOString().slice(0, 10)}
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          moveIn: event.target.value,
                        }))
                      }
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                    />
                  </label>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Property owner
                    </p>

                    <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <UserRound className="h-4 w-4 text-slate-500" />
                      {text(applicationProperty["landlord_name"], "TNP Landlord")}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      Your request will be connected to the property owner for review.
                    </p>
                  </div>
                </div>

                <label className="mt-5 block">
                  <span className="mb-2 block text-sm font-semibold text-slate-800">
                    Message to landlord
                  </span>

                  <textarea
                    rows={5}
                    value={form.message}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        message: event.target.value,
                      }))
                    }
                    placeholder="Introduce yourself, explain your intended use of the property, or add information the landlord should know."
                    className="w-full resize-y rounded-xl border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-800 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  />
                </label>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={closeApplicationForm}
                    className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={() => void submitApplication()}
                    disabled={submitting || !userId}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}

                    {submitting ? "Submitting..." : "Submit application"}
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-semibold text-slate-950">Application history</h2>

              <p className="mt-1 text-sm text-slate-500">
                See exactly where each application stands.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search applications..."
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none focus:border-slate-400 sm:w-64"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400"
              >
                <option value="all">All statuses</option>

                <option value="pending">Pending</option>

                <option value="under review">Under review</option>

                <option value="approved">Approved</option>

                <option value="rejected">Rejected</option>

                <option value="withdrawn">Withdrawn</option>
              </select>
            </div>
          </div>
        </section>

        {loading && (
          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="h-40 animate-pulse bg-slate-100" />

                <div className="space-y-3 p-5">
                  <div className="h-5 w-3/4 animate-pulse rounded bg-slate-100" />

                  <div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" />

                  <div className="h-10 w-full animate-pulse rounded bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6">
            <div className="flex gap-4">
              <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />

              <div>
                <h3 className="font-semibold text-red-900">Applications could not be loaded</h3>

                <p className="mt-1 text-sm leading-6 text-red-700">{error}</p>

                {userId && (
                  <button
                    type="button"
                    onClick={() => void loadApplications(userId)}
                    className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                  >
                    Try again
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {!loading && !error && applications.length === 0 && (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <FileText className="h-7 w-7" />
            </div>

            <h3 className="mt-4 text-lg font-semibold text-slate-900">No applications yet</h3>

            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
              Your application history will appear here after you apply for a property. Start from
              Find Properties to choose a listing.
            </p>

            <button
              type="button"
              onClick={() =>
                navigate({
                  to: "/app/tenant/properties" as never,
                })
              }
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Find properties
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {!loading && !error && applications.length > 0 && filteredApplications.length === 0 && (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center shadow-sm">
            <Search className="mx-auto h-7 w-7 text-slate-400" />

            <h3 className="mt-4 text-lg font-semibold text-slate-900">No matching applications</h3>

            <p className="mt-2 text-sm text-slate-500">
              Change the search or status filter to see more of your applications.
            </p>
          </div>
        )}

        {!loading && !error && filteredApplications.length > 0 && (
          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            {filteredApplications.map((application) => {
              const property = application.property;

              const landlord = application.landlord;

              const status = applicationStatus(application);

              const id = text(application["id"]);
              const rejectionReason = text(application["rejection_reason"]);
              const landlordMessage = text(application["landlord_message"]);

              const canWithdraw = ["pending", "pending review", "pending_review", "submitted", "under review", "under_review"].includes(
                status,
              );

              const approved = ["approved", "accepted"].includes(status);

              return (
                <article
                  key={id}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                >
                  <div className="flex h-44">
                    <div className="w-44 shrink-0 sm:w-52">
                      <ImageOrPlaceholder
                        src={propertyImage(property)}
                        alt={propertyTitle(property)}
                      />
                    </div>

                    <div className="min-w-0 flex-1 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-lg font-bold text-slate-950">
                            {propertyTitle(property)}
                          </h3>

                          <p className="mt-1 flex items-center gap-1.5 truncate text-sm text-slate-500">
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                            {propertyLocation(property)}
                          </p>
                        </div>

                        <span
                          className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(
                            status,
                          )}`}
                        >
                          {statusLabel(status)}
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                        <div className="rounded-lg bg-slate-50 p-2.5">
                          <p className="text-slate-400">Submitted</p>

                          <p className="mt-1 font-semibold text-slate-700">
                            {dateLabel(application["created_at"])}
                          </p>
                        </div>

                        <div className="rounded-lg bg-slate-50 p-2.5">
                          <p className="text-slate-400">Move-in</p>

                          <p className="mt-1 font-semibold text-slate-700">
                            {dateLabel(application["move_in"])}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 px-5 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <UserRound className="h-4 w-4" />

                        <span>
                          Landlord:{" "}
                          <strong className="font-semibold text-slate-700">
                            {landlordName(landlord, property)}
                          </strong>
                        </span>
                      </div>

                      <span className="text-sm font-semibold text-slate-800">
                        {propertyPrice(property)}
                      </span>
                    </div>

                    {Boolean(application["rejection_reason"]) && (
                      <div className="mt-3 rounded-xl border border-red-100 bg-red-50 p-3 text-xs leading-5 text-red-700">
                        <strong>Reason:</strong> {text(application["rejection_reason"])}
                      </div>
                    )}

                    {Boolean(application["landlord_message"]) && (
                      <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-blue-700">
                        <strong>Landlord message:</strong> {text(application["landlord_message"])}
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openDetails(application)}
                        className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                      >
                        <Eye className="h-4 w-4" />
                        View application
                      </button>

                      <button
                        type="button"
                        onClick={() => goToProperty(application)}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        View properties
                      </button>

                      {approved && <button type="button" onClick={() => navigate({to:"/app/tenant/payments"})} className="tnp-payment-action rounded-xl px-4 py-3 text-sm font-bold">Pay rent / deposit →</button>}
                      {approved && Boolean(application["lease_id"]) && (
                        <button
                          type="button"
                          onClick={() => goToLease(application)}
                          className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
                        >
                          Continue to lease
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      )}

                      {canWithdraw && (
                        <button
                          type="button"
                          disabled={processingId === id}
                          onClick={() => void withdrawApplication(application)}
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                        >
                          {processingId === id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <XCircle className="h-4 w-4" />
                          )}
                          Withdraw
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {detailsOpen && selectedApplication && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Application record
                </p>

                <h2 className="mt-1 text-xl font-bold text-slate-950">
                  {propertyTitle(selectedApplication.property)}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeDetails}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-6">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${statusClass(
                    applicationStatus(selectedApplication),
                  )}`}
                >
                  {statusLabel(applicationStatus(selectedApplication))}
                </span>

                <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
                  {propertyListingType(selectedApplication.property)}
                </span>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    <Building2 className="h-4 w-4" />
                    Property
                  </div>

                  <p className="mt-2 font-semibold text-slate-900">
                    {propertyTitle(selectedApplication.property)}
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    {propertyType(selectedApplication.property)} ·{" "}
                    {propertyLocation(selectedApplication.property)}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    <UserRound className="h-4 w-4" />
                    Landlord
                  </div>

                  <p className="mt-2 font-semibold text-slate-900">
                    {landlordName(selectedApplication.landlord, selectedApplication.property)}
                  </p>

                  {Boolean(selectedApplication.landlord?.["verification"]) && (
                    <p className="mt-1 inline-flex items-center gap-1 text-sm text-slate-500">
                      <ShieldCheck className="h-4 w-4" />
                      {text(selectedApplication.landlord?.["verification"])}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-4">
                  <CalendarDays className="h-4 w-4 text-slate-500" />

                  <p className="mt-2 text-xs text-slate-400">Submitted</p>

                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {dateTimeLabel(selectedApplication["created_at"])}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <CalendarDays className="h-4 w-4 text-slate-500" />

                  <p className="mt-2 text-xs text-slate-400">Requested move-in</p>

                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {dateLabel(selectedApplication["move_in"])}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <WalletCards className="h-4 w-4 text-slate-500" />

                  <p className="mt-2 text-xs text-slate-400">Property price</p>

                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {propertyPrice(selectedApplication.property)}
                  </p>
                </div>
              </div>

              <section className="mt-6">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-slate-600" />

                  <h3 className="font-semibold text-slate-950">Your message</h3>
                </div>

                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                  {text(
                    selectedApplication["message"],
                    "No message was included with this application.",
                  )}
                </div>
              </section>

              <section className="mt-6">
                <h3 className="font-semibold text-slate-950">Application timeline</h3>

                <div className="mt-4 space-y-4">
                  <TimelineItem
                    done
                    title="Application submitted"
                    description={`Your application was recorded on ${dateTimeLabel(
                      selectedApplication["created_at"],
                    )}.`}
                  />

                  <TimelineItem
                    done={
                      Boolean(selectedApplication["reviewed_at"]) ||
                      ["approved", "accepted", "rejected", "declined"].includes(
                        applicationStatus(selectedApplication),
                      )
                    }
                    title="Landlord review"
                    description={
                      selectedApplication["reviewed_at"]
                        ? `Reviewed on ${dateTimeLabel(selectedApplication["reviewed_at"])}.`
                        : "Waiting for the landlord to review your application."
                    }
                  />

                  <TimelineItem
                    done={[
                      "approved",
                      "accepted",
                      "rejected",
                      "declined",
                      "withdrawn",
                      "cancelled",
                      "canceled",
                    ].includes(applicationStatus(selectedApplication))}
                    title="Decision"
                    description={
                      selectedApplication["decision_at"]
                        ? `${statusLabel(
                            applicationStatus(selectedApplication),
                          )} on ${dateTimeLabel(selectedApplication["decision_at"])}.`
                        : "A final decision has not been recorded yet."
                    }
                  />

                  <TimelineItem
                    done={Boolean(selectedApplication["lease_id"])}
                    title="Lease hand-off"
                    description={
                      selectedApplication["lease_id"]
                        ? "An associated lease record exists. Continue to My Leases to review the lease process."
                        : "A lease will appear here once the approved application is converted into a lease."
                    }
                  />
                </div>
              </section>

              {(() => {
                const landlordMessage = text(selectedApplication["landlord_message"]);
                const rejectionReason = text(selectedApplication["rejection_reason"]);

                return (
                  <>
                    {landlordMessage && (
                      <section className="mt-6">
                        <h3 className="font-semibold text-slate-950">Landlord response</h3>

                        <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-800">
                          {landlordMessage}
                        </div>
                      </section>
                    )}

                    {rejectionReason && (
                      <section className="mt-6">
                        <h3 className="font-semibold text-slate-950">Decision reason</h3>

                        <div className="mt-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm leading-6 text-red-700">
                          {rejectionReason}
                        </div>
                      </section>
                    )}
                  </>
                );
              })()}

              <div className="mt-7 flex flex-wrap gap-3">
                {["approved", "accepted"].includes(applicationStatus(selectedApplication)) && <button type="button" onClick={() => navigate({to:"/app/tenant/payments"})} className="tnp-payment-action rounded-xl px-4 py-3 text-sm font-bold">Pay rent / deposit →</button>}
                {["approved", "accepted"].includes(applicationStatus(selectedApplication)) && Boolean(selectedApplication["lease_id"]) && (
                  <button
                    type="button"
                    onClick={() => goToLease(selectedApplication)}
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    Continue to My Leases
                    <ArrowRight className="h-4 w-4" />
                  </button>
                )}

                {["pending", "pending review", "pending_review", "submitted", "under review", "under_review"].includes(
                  applicationStatus(selectedApplication),
                ) && (
                  <button
                    type="button"
                    disabled={processingId === text(selectedApplication["id"])}
                    onClick={() => void withdrawApplication(selectedApplication)}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {processingId === text(selectedApplication["id"]) ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                    Withdraw application
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TimelineItem({
  done,
  title,
  description,
}: {
  done: boolean;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-3">
      <div
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          done ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"
        }`}
      >
        {done ? <CheckCircle2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
      </div>

      <div>
        <p className="text-sm font-semibold text-slate-900">{title}</p>

        <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
      </div>
    </div>
  );
}
