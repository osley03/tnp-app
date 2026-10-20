import { applicationStatus } from '@/lib/application-status';
import { validateProperty } from '@/lib/property-validation';
import {
  PropertyFormModal,
  EMPTY_FORM,
  PROPERTY_CATEGORIES,
  LISTING_TYPES,
  type PropertyForm,
} from "@/components/properties/PropertyFormModal";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Bath,
  BedDouble,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Edit3,
  Eye,
  FileText,
  Flag,
  Home,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Star,
  ToggleLeft,
  ToggleRight,
  Trash2,
  UserRound,
  Users,
  Wallet,
  X,
  Ruler,
  Droplets,
  Zap,
  Route as RoadIcon,
  Trees,
  Tag,
  Landmark,
} from "lucide-react";

import { tourIdFromUrl } from "@/lib/tour-links";
import { supabase } from "@/integrations/supabase/client";

const db: typeof supabase = supabase;

export const Route = createFileRoute("/_authenticated/app/landlord/properties")({
  component: LandlordProperties,
});

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type Property = {
  id: string;
  owner_id: string;
  title: string;
  suburb: string;
  city: string;

  rent_usd: number | null;
  deposit_usd: number | null;
  price_usd: number | null;
  price_unit: string | null;

  beds: number | null;
  baths: number | null;
  rooms: number | null;

  property_type: string | null;
  property_category: string | null;
  listing_type: string | null;

  size: number | null;
  size_unit: string | null;

  land_use: string | null;
  water_available: boolean | null;
  electricity_available: boolean | null;
  road_access: boolean | null;
  zoning: string | null;
  title_status: string | null;

  description: string | null;
  amenities: string[];

  image_url: string | null;
  image_urls?: string[] | null;

  verified: boolean | null;
  available: boolean | null;
  fraud_flags: string[] | null;

  trust_score?: number | null;
  landlord_name?: string | null;
  landlord_verified?: boolean | null;
  landlord_rating?: number | null;
  has_360_tour?: boolean | null;
  tour_url?: string | null;

  created_at: string;
};

type PropertyWrite = Omit<
  Property,
  | "id"
  | "created_at"
  | "water_available"
  | "electricity_available"
  | "road_access"
  | "verified"
  | "available"
> & {
  water_available: boolean;
  electricity_available: boolean;
  road_access: boolean;
  verified: boolean;
  available: boolean;
};

type Profile = {
  id: string;
  full_name: string | null;
  phone?: string | null;
  trust_score?: number | null;
  verification?: string | null;
};

type LeaseRequest = {
  id: string;
  property_id: string;
  tenant_id: string;
  move_in: string | null;
  message: string | null;
  status: string | null;
  created_at: string;
  tenant?: Profile | null;
};

type Lease = {
  id: string;
  lease_request_id: string | null;
  property_id: string;
  tenant_id: string;
  landlord_id: string;
  status: string | null;
  rent_usd: number | null;
  deposit_usd: number | null;
  start_date: string | null;
  end_date: string | null;
  signed_at: string | null;
  terms: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  tenant?: Profile | null;
};

type Payment = {
  id: string;
  lease_id: string;
  payer_id: string;
  payee_id: string | null;
  payment_type: string | null;
  amount_usd: number | null;
  status: string | null;
  reference: string | null;
  paid_at: string | null;
  released_at: string | null;
  created_at: string;
};

type Review = {
  id: string;
  author_id: string;
  subject_id: string;
  property_id: string;
  rating: number | null;
  body: string | null;
  lease_confirmed: boolean | null;
  created_at: string;
  moderation_status: string | null;
  admin_note: string | null;
  reviewed_at: string | null;
  author?: Profile | null;
};

type PropertyBundle = {
  requests: LeaseRequest[];
  leases: Lease[];
  payments: Payment[];
  reviews: Review[];
};

function money(value: number | null | undefined) {
  return `$${Number(value ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function date(value: string | null | undefined) {
  if (!value) return "—";

  return new Date(value).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function titleCase(value: string | null | undefined) {
  if (!value) return "Unknown";

  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusClasses(status: string | null | undefined) {
  const value = String(status ?? "").toLowerCase();

  if (["active", "approved", "verified", "released", "completed"].includes(value)) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (["pending", "requested", "under_review", "held", "awaiting_response"].includes(value)) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (["disputed", "failed", "critical", "flagged", "rejected"].includes(value)) {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

function isRentListing(listingType: string | null | undefined) {
  return ["For Rent", "For Lease", "For Rent or Sale"].includes(String(listingType ?? ""));
}

function isSaleListing(listingType: string | null | undefined) {
  return ["For Sale", "For Rent or Sale"].includes(String(listingType ?? ""));
}

function displayPrice(property: Property) {
  const listing = String(property.listing_type ?? "For Rent");

  if (listing === "For Sale") {
    return money(property.price_usd);
  }

  if (listing === "For Rent") {
    return money(property.rent_usd);
  }

  if (listing === "For Lease") {
    return money(property.rent_usd);
  }

  return property.price_usd ? money(property.price_usd) : money(property.rent_usd);
}

function priceLabel(property: Property) {
  const listing = String(property.listing_type ?? "For Rent");

  if (listing === "For Sale") {
    return property.price_unit && property.price_unit !== "total"
      ? titleCase(property.price_unit)
      : "asking price";
  }

  if (listing === "For Rent or Sale") {
    return "rent / sale";
  }

  return "per month";
}

function categoryIcon(category: string | null | undefined) {
  const value = String(category ?? "").toLowerCase();

  if (value === "land" || value === "agricultural") {
    return Trees;
  }

  if (value === "commercial" || value === "industrial") {
    return Building2;
  }

  return Home;
}

/* -------------------------------------------------------------------------- */
/* Main Page                                                                  */
/* -------------------------------------------------------------------------- */

function LandlordProperties() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState("all");
  const [verificationFilter, setVerificationFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [listingFilter, setListingFilter] = useState("all");

  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);

  const [form, setForm] = useState<PropertyForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const currentUserQuery = useQuery({
    queryKey: ["landlord-properties-current-user"],

    queryFn: async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) throw error;
      if (!user) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      return user;
    },
  });

  const user = currentUserQuery.data;

  const propertiesQuery = useQuery({
    queryKey: ["landlord-properties", user?.id],
    enabled: Boolean(user?.id),

    queryFn: async () => {
      const { data, error } = await db
        .from("properties")
        .select("*")
        .eq("owner_id", user!.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data ?? []) as Property[];
    },
  });

  const properties = propertiesQuery.data ?? [];

  /* ---------------------------------------------------------------------- */
  /* Selected property related data                                         */
  /* ---------------------------------------------------------------------- */

  const selectedBundleQuery = useQuery({
    queryKey: ["landlord-property-bundle", selectedProperty?.id],
    enabled: Boolean(selectedProperty?.id),

    queryFn: async (): Promise<PropertyBundle> => {
      const propertyId = selectedProperty!.id;

      const [requestsResult, leasesResult, reviewsResult] = await Promise.all([
        db
          .from("lease_requests")
          .select("*")
          .eq("property_id", propertyId)
          .order("created_at", { ascending: false }),

        db
          .from("leases" as never)
          .select("*")
          .eq("property_id", propertyId)
          .order("created_at", { ascending: false }),

        db
          .from("reviews")
          .select("*")
          .eq("property_id", propertyId)
          .order("created_at", { ascending: false }),
      ]);

      if (requestsResult.error) throw requestsResult.error;
      if (leasesResult.error) throw leasesResult.error;
      if (reviewsResult.error) throw reviewsResult.error;

      const requests = (requestsResult.data ?? []) as LeaseRequest[];

      const leases = (leasesResult.data ?? []) as Lease[];

      const reviews = (reviewsResult.data ?? []) as Review[];

      const tenantIds = Array.from(
        new Set([
          ...requests.map((item) => item.tenant_id),
          ...leases.map((item) => item.tenant_id),
          ...reviews.map((item) => item.author_id),
        ]),
      ).filter(Boolean);

      let profiles: Profile[] = [];

      if (tenantIds.length) {
        const { data, error } = await db
          .from("profiles")
          .select("id, full_name, phone, trust_score, verification")
          .in("id", tenantIds);

        if (error) throw error;

        profiles = (data ?? []) as Profile[];
      }

      const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));

      requests.forEach((request) => {
        request.tenant = profileMap.get(request.tenant_id) ?? null;
      });

      leases.forEach((lease) => {
        lease.tenant = profileMap.get(lease.tenant_id) ?? null;
      });

      reviews.forEach((review) => {
        review.author = profileMap.get(review.author_id) ?? null;
      });

      const leaseIds = leases.map((lease) => lease.id);

      let payments: Payment[] = [];

      if (leaseIds.length) {
        const { data, error } = await db
          .from("lease_payments" as never)
          .select("*")
          .in("lease_id", leaseIds)
          .order("created_at", { ascending: false });

        if (error) throw error;

        payments = (data ?? []) as Payment[];
      }

      return {
        requests,
        leases,
        payments,
        reviews,
      };
    },
  });

  const selectedBundle = selectedBundleQuery.data;

  /* ---------------------------------------------------------------------- */
  /* Filters                                                                 */
  /* ---------------------------------------------------------------------- */

  const filteredProperties = useMemo(() => {
    const query = search.trim().toLowerCase();

    return properties.filter((property) => {
      const searchable = [
        property.title,
        property.suburb,
        property.city,
        property.property_type,
        property.property_category,
        property.listing_type,
        property.description,
        property.land_use,
        property.zoning,
        property.title_status,
        ...(property.amenities ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !query || searchable.includes(query);

      const matchesAvailability =
        availabilityFilter === "all" ||
        (availabilityFilter === "available" && property.available) ||
        (availabilityFilter === "occupied" && !property.available);

      const matchesVerification =
        verificationFilter === "all" ||
        (verificationFilter === "verified" && property.verified) ||
        (verificationFilter === "unverified" && !property.verified);

      const matchesCategory =
        categoryFilter === "all" ||
        String(property.property_category ?? "").toLowerCase() === categoryFilter.toLowerCase();

      const matchesListing =
        listingFilter === "all" ||
        String(property.listing_type ?? "").toLowerCase() === listingFilter.toLowerCase();

      return (
        matchesSearch &&
        matchesAvailability &&
        matchesVerification &&
        matchesCategory &&
        matchesListing
      );
    });
  }, [properties, search, availabilityFilter, verificationFilter, categoryFilter, listingFilter]);

  /* ---------------------------------------------------------------------- */
  /* Statistics                                                              */
  /* ---------------------------------------------------------------------- */

  const stats = useMemo(() => {
    const total = properties.length;

    const available = properties.filter((property) => property.available).length;

    const occupied = properties.filter((property) => !property.available).length;

    const verified = properties.filter((property) => property.verified).length;

    const flagged = properties.filter(
      (property) => Array.isArray(property.fraud_flags) && property.fraud_flags.length > 0,
    ).length;

    const incomplete = properties.filter((property) => {
      const missingImage = !property.image_url;

      const missingDescription = !property.description || property.description.trim().length < 20;

      const missingAmenities = !property.amenities || property.amenities.length === 0;

      const missingLocation = !property.city || !property.suburb;

      return missingImage || missingDescription || missingAmenities || missingLocation;
    }).length;

    const rentalProperties = properties.filter((property) => isRentListing(property.listing_type));

    const monthlyPotential = rentalProperties.reduce(
      (sum, property) => sum + Number(property.rent_usd ?? 0),
      0,
    );

    const averageRent =
      rentalProperties.length > 0 ? monthlyPotential / rentalProperties.length : 0;

    const saleListings = properties.filter((property) => isSaleListing(property.listing_type));

    const saleValue = saleListings.reduce(
      (sum, property) => sum + Number(property.price_usd ?? 0),
      0,
    );

    const residential = properties.filter(
      (property) => property.property_category === "Residential",
    ).length;

    const commercial = properties.filter(
      (property) => property.property_category === "Commercial",
    ).length;

    const agricultural = properties.filter(
      (property) => property.property_category === "Agricultural",
    ).length;

    const land = properties.filter((property) => property.property_category === "Land").length;

    return {
      total,
      available,
      occupied,
      verified,
      flagged,
      incomplete,
      averageRent,
      monthlyPotential,
      annualPotential: monthlyPotential * 12,
      saleValue,
      residential,
      commercial,
      agricultural,
      land,
    };
  }, [properties]);

  const selectedActiveLease = selectedBundle?.leases.find((lease) =>
    ["active", "approved"].includes(String(lease.status).toLowerCase()),
  );

  const pendingRequests =
    selectedBundle?.requests.filter((request) =>
      applicationStatus(request.status) === "Pending review",
    ) ?? [];

  const heldPayments =
    selectedBundle?.payments.filter((payment) =>
      String(payment.status).toLowerCase() === "held",
    ) ?? [];

  const reviewAverage = selectedBundle?.reviews.length
    ? selectedBundle.reviews.reduce((sum, review) => sum + Number(review.rating ?? 0), 0) /
      selectedBundle.reviews.length
    : 0;

  /* ---------------------------------------------------------------------- */
  /* Form helpers                                                            */
  /* ---------------------------------------------------------------------- */

  function openCreate() {
    setEditingProperty(null);
    setForm(EMPTY_FORM);
    setErrorMessage("");
    setShowForm(true);
  }

  function openEdit(property: Property) {
    setEditingProperty(property);

    setForm({
      title: property.title ?? "",
      suburb: property.suburb ?? "",
      city: property.city ?? "",

      property_category: property.property_category ?? "Residential",

      property_type: property.property_type ?? "Apartment",

      listing_type: property.listing_type ?? "For Rent",

      rent_usd: property.rent_usd?.toString() ?? "",

      deposit_usd: property.deposit_usd?.toString() ?? "",

      price_usd: property.price_usd?.toString() ?? "",

      price_unit: property.price_unit ?? "total",

      beds: property.beds?.toString() ?? "",

      baths: property.baths?.toString() ?? "",

      rooms: property.rooms?.toString() ?? "",

      size: property.size?.toString() ?? "",

      size_unit: property.size_unit ?? "m²",

      land_use: property.land_use ?? "",

      water_available: Boolean(property.water_available),

      electricity_available: Boolean(property.electricity_available),

      road_access: Boolean(property.road_access),

      zoning: property.zoning ?? "",

      title_status: property.title_status ?? "",

      description: property.description ?? "",

      amenities: property.amenities?.join(", ") ?? "",

      image_url: property.image_url ?? "",
      tour_url: property.tour_url ?? "",

      verified: Boolean(property.verified),

      available: property.available !== false,
    });

    setErrorMessage("");
    setShowForm(true);
  }

  async function saveProperty(event: React.FormEvent) {
    event.preventDefault();

    if (!user?.id) return;
    const validation=validateProperty(form);
    if(validation){setErrorMessage(validation);return;}

    if (!form.title.trim()) {
      setErrorMessage("Property title is required.");
      return;
    }

    if (!form.city.trim()) {
      setErrorMessage("City is required.");
      return;
    }

    if (!form.property_category.trim()) {
      setErrorMessage("Property category is required.");
      return;
    }

    if (!form.property_type.trim()) {
      setErrorMessage("Property type is required.");
      return;
    }

    if (!form.listing_type.trim()) {
      setErrorMessage("Listing purpose is required.");
      return;
    }

    const needsRent =
      form.listing_type === "For Rent" ||
      form.listing_type === "For Lease" ||
      form.listing_type === "For Rent or Sale";

    const needsSale = form.listing_type === "For Sale" || form.listing_type === "For Rent or Sale";

    if (needsRent && (!form.rent_usd || Number(form.rent_usd) < 0)) {
      setErrorMessage("Enter a valid monthly rent for this listing.");
      return;
    }

    if (needsSale && (!form.price_usd || Number(form.price_usd) < 0)) {
      setErrorMessage("Enter a valid sale price for this listing.");
      return;
    }

    if (form.tour_url.trim()) {
      const tourId = tourIdFromUrl(form.tour_url.trim(), window.location.origin);
      if (!tourId) {
        setErrorMessage("Paste a TNP tour URL created in the 360° Tour Manager.");
        return;
      }
      const result = await supabase
        .from("tnp_tours")
        .select("id")
        .eq("id", tourId)
        .eq("owner_id", user.id)
        .eq("is_published", true)
        .maybeSingle();
      if (result.error || !result.data) {
        setErrorMessage("Choose one of your published tours. The tour could not be verified.");
        return;
      }
    }
    setSaving(true);
    setErrorMessage("");

    try {
      const payload = {
        title: form.title.trim(),
        suburb: form.suburb.trim(),
        city: form.city.trim(),

        property_category: form.property_category.trim(),

        property_type: form.property_type.trim(),

        listing_type: form.listing_type.trim(),

        rent_usd: needsRent && form.rent_usd ? Number(form.rent_usd) : 0,

        deposit_usd: form.deposit_usd ? Number(form.deposit_usd) : 0,

        price_usd: needsSale && form.price_usd ? Number(form.price_usd) : null,

        price_unit: form.price_unit || "total",

        beds: form.beds ? Number(form.beds) : 0,

        baths: form.baths ? Number(form.baths) : 0,

        rooms: form.rooms ? Number(form.rooms) : null,

        size: form.size ? Number(form.size) : null,

        size_unit: form.size_unit || "m²",

        land_use: form.land_use.trim() || null,

        water_available: Boolean(form.water_available),

        electricity_available: Boolean(form.electricity_available),

        road_access: Boolean(form.road_access),

        zoning: form.zoning.trim() || null,

        title_status: form.title_status.trim() || null,

        description: form.description.trim(),

        amenities: form.amenities
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),

        image_url: form.image_url.trim() || null,
        tour_url: form.tour_url.trim() || null,

        verified: editingProperty?.verified ?? false,

        available: Boolean(form.available),
      };

      if (editingProperty) {
        const { error } = await db
          .from("properties")
          .update(payload as never)
          .eq("id", editingProperty.id)
          .eq("owner_id", user.id).select("id").single();

        if (error) throw error;
      } else {
        const { error } = await db.from("properties").insert({
          ...payload,
          owner_id: user.id,
          fraud_flags: [],
        } as never);

        if (error) throw error;
      }

      await queryClient.invalidateQueries({
        queryKey: ["landlord-properties", user.id],
      });

      setShowForm(false);
      setEditingProperty(null);
      setForm(EMPTY_FORM);
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to save the property. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleAvailability(property: Property) {
    if (!user?.id) return;

    setActionId(property.id);
    setErrorMessage("");

    try {
      const { error } = await db
        .from("properties")
        .update({
          available: !property.available,
        })
        .eq("id", property.id)
        .eq("owner_id", user.id).select("id").single();

      if (error) throw error;

      await queryClient.invalidateQueries({
        queryKey: ["landlord-properties", user.id],
      });

      if (selectedProperty?.id === property.id) {
        setSelectedProperty({
          ...property,
          available: !property.available,
        });
      }
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to update property availability.",
      );
    } finally {
      setActionId(null);
    }
  }

  async function removeProperty(property: Property) {
    if (!user?.id) return;

    const confirmed = window.confirm(`Delete "${property.title}"? This action cannot be undone.`);

    if (!confirmed) return;

    setActionId(property.id);
    setErrorMessage("");

    try {
      const { error } = await db
        .from("properties")
        .delete()
        .eq("id", property.id)
        .eq("owner_id", user.id).select("id").single();

      if (error) throw error;

      if (selectedProperty?.id === property.id) {
        setSelectedProperty(null);
      }

      await queryClient.invalidateQueries({
        queryKey: ["landlord-properties", user.id],
      });
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to delete this property. It may have related records.",
      );
    } finally {
      setActionId(null);
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Loading/Error                                                            */
  /* ---------------------------------------------------------------------- */

  if (currentUserQuery.isLoading || propertiesQuery.isLoading) {
    return (
      <div className="tnp-module tnp-module-light min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading your property portfolio...
        </div>
      </div>
    );
  }

  if (currentUserQuery.error || propertiesQuery.error) {
    return (
      <div className="tnp-module tnp-module-light min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
          <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-red-500" />

          <h2 className="text-lg font-bold text-slate-900">Unable to load properties</h2>

          <p className="mt-2 text-sm text-slate-500">
            {currentUserQuery.error?.message ||
              propertiesQuery.error?.message ||
              "Something went wrong while loading your portfolio."}
          </p>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------------- */
  /* UI                                                                       */
  /* ---------------------------------------------------------------------- */

  return (
    <div className="tnp-module tnp-module-light min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <Link
          to="/app/landlord"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
        <div className="flex h-16 items-center justify-between px-5 lg:px-8">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
              Landlord Portal
            </p>

            <h1 className="text-lg font-bold text-slate-900">My Properties</h1>
          </div>

          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            Add Property
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] space-y-7 p-5 lg:p-8">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-3xl bg-slate-900 p-7 text-white shadow-xl lg:p-9">
          <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />

          <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200">
                <Building2 className="h-3.5 w-3.5" />
                Property Management Center
              </div>

              <h2 className="max-w-2xl text-2xl font-bold tracking-tight lg:text-3xl">
                Manage your property portfolio with confidence.
              </h2>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                Manage residential, commercial, agricultural and land listings while monitoring
                occupancy, verification, tenant activity and listing integrity.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <p className="text-xs font-medium text-slate-300">Monthly rental potential</p>

                <p className="mt-1 text-2xl font-bold">{money(stats.monthlyPotential)}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <p className="text-xs font-medium text-slate-300">Sale portfolio</p>

                <p className="mt-1 text-2xl font-bold">{money(stats.saleValue)}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <StatCard label="Total" value={stats.total} icon={Building2} detail="Portfolio size" />

          <StatCard
            label="Available"
            value={stats.available}
            icon={Home}
            detail="Currently listed"
          />

          <StatCard label="Occupied" value={stats.occupied} icon={Users} detail="Not available" />

          <StatCard
            label="Verified"
            value={`${stats.verified}/${stats.total}`}
            icon={ShieldCheck}
            detail="Verified listings"
          />

          <StatCard
            label="Residential"
            value={stats.residential}
            icon={Home}
            detail="Homes & apartments"
          />

          <StatCard
            label="Commercial"
            value={stats.commercial}
            icon={Building2}
            detail="Business property"
          />

          <StatCard
            label="Agricultural"
            value={stats.agricultural}
            icon={Trees}
            detail="Farms & agriculture"
          />

          <StatCard
            label="Integrity"
            value={stats.flagged + stats.incomplete}
            icon={ShieldAlert}
            detail={`${stats.flagged} flagged`}
            danger={stats.flagged + stats.incomplete > 0}
          />
        </section>

        {errorMessage && (
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />

            <div className="flex-1">{errorMessage}</div>

            <button
              type="button"
              onClick={() => setErrorMessage("")}
              className="rounded-lg p-1 hover:bg-red-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Filters */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search property, location, type, category, land use..."
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
            >
              <option value="all">All categories</option>

              {PROPERTY_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>

            <select
              value={listingFilter}
              onChange={(event) => setListingFilter(event.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
            >
              <option value="all">All purposes</option>

              {LISTING_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>

            <select
              value={availabilityFilter}
              onChange={(event) => setAvailabilityFilter(event.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
            >
              <option value="all">All availability</option>
              <option value="available">Available</option>
              <option value="occupied">Occupied</option>
            </select>

            <select
              value={verificationFilter}
              onChange={(event) => setVerificationFilter(event.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
            >
              <option value="all">All verification</option>
              <option value="verified">Verified</option>
              <option value="unverified">Unverified</option>
            </select>
          </div>
        </section>

        {/* Portfolio */}
        <section>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Your Portfolio</h2>

              <p className="mt-1 text-sm text-slate-500">
                {filteredProperties.length} of {properties.length} properties displayed
              </p>
            </div>

            {search ||
            availabilityFilter !== "all" ||
            verificationFilter !== "all" ||
            categoryFilter !== "all" ||
            listingFilter !== "all" ? (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setAvailabilityFilter("all");
                  setVerificationFilter("all");
                  setCategoryFilter("all");
                  setListingFilter("all");
                }}
                className="text-sm font-semibold text-slate-600 hover:text-slate-900"
              >
                Clear filters
              </button>
            ) : null}
          </div>

          {filteredProperties.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <Building2 className="mx-auto h-10 w-10 text-slate-300" />

              <h3 className="mt-4 font-bold text-slate-900">
                {properties.length === 0 ? "No properties yet" : "No properties match your filters"}
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                {properties.length === 0
                  ? "Add your first property to start building your TNP landlord portfolio."
                  : "Try changing your search or filters."}
              </p>

              {properties.length === 0 && (
                <button
                  type="button"
                  onClick={openCreate}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"
                >
                  <Plus className="h-4 w-4" />
                  Add Your First Property
                </button>
              )}
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {filteredProperties.map((property) => {
                const flagged =
                  Array.isArray(property.fraud_flags) && property.fraud_flags.length > 0;

                const incomplete =
                  !property.image_url ||
                  !property.description ||
                  property.description.trim().length < 20 ||
                  !property.amenities?.length;

                return (
                  <PropertyCard
                    key={property.id}
                    property={property}
                    flagged={flagged}
                    incomplete={incomplete}
                    actionId={actionId}
                    onView={() => setSelectedProperty(property)}
                    onEdit={() => openEdit(property)}
                    onToggle={() => toggleAvailability(property)}
                    onDelete={() => removeProperty(property)}
                  />
                );
              })}
            </div>
          )}
        </section>

        {/* Portfolio health */}
        <section className="grid gap-5 lg:grid-cols-3">
          <HealthCard
            icon={ShieldCheck}
            title="Listing Verification"
            value={`${stats.verified}/${stats.total}`}
            description={
              stats.total
                ? `${Math.round(
                    (stats.verified / stats.total) * 100,
                  )}% of your listings are marked verified.`
                : "No listings available yet."
            }
          />

          <HealthCard
            icon={ShieldAlert}
            title="Integrity Monitoring"
            value={String(stats.flagged)}
            description={
              stats.flagged
                ? `${stats.flagged} listing${
                    stats.flagged === 1 ? "" : "s"
                  } currently have fraud or integrity flags.`
                : "No fraud flags detected on your current listings."
            }
            danger={stats.flagged > 0}
          />

          <HealthCard
            icon={FileText}
            title="Listing Completeness"
            value={String(stats.incomplete)}
            description={
              stats.incomplete
                ? `${stats.incomplete} listing${
                    stats.incomplete === 1 ? "" : "s"
                  } need additional listing information.`
                : "Your portfolio listings contain the key presentation information."
            }
            danger={stats.incomplete > 0}
          />
        </section>
      </main>

      {/* Detail drawer */}
      {selectedProperty && (
        <PropertyDetailDrawer
          property={selectedProperty}
          bundle={selectedBundle}
          loading={selectedBundleQuery.isLoading}
          reviewAverage={reviewAverage}
          pendingRequests={pendingRequests}
          heldPayments={heldPayments}
          activeLease={selectedActiveLease}
          onClose={() => setSelectedProperty(null)}
          onEdit={() => {
            openEdit(selectedProperty);
            setSelectedProperty(null);
          }}
          onToggle={() => toggleAvailability(selectedProperty)}
          onRequests={() =>
            navigate({
              to: "/app/landlord/requests" as never,
            })
          }
          onApplicants={() =>
            navigate({
              to: "/app/landlord/applicants" as never,
            })
          }
          actionId={actionId}
        />
      )}

      {/* Form */}
      {showForm && (
        <PropertyFormModal
          form={form}
          setForm={setForm}
          editing={Boolean(editingProperty)}
          saving={saving}
          errorMessage={errorMessage}
          onClose={() => {
            if (!saving) {
              setShowForm(false);
              setErrorMessage("");
            }
          }}
          onSubmit={saveProperty}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Stat Card                                                                  */
/* -------------------------------------------------------------------------- */

function StatCard({
  label,
  value,
  icon: Icon,
  detail,
  danger = false,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  detail: string;
  danger?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div
        className={`inline-flex rounded-xl p-2.5 ${
          danger ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-700"
        }`}
      >
        <Icon className="h-5 w-5" />
      </div>

      <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>

      <p className="mt-1 text-[11px] text-slate-500">{detail}</p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Health Card                                                                */
/* -------------------------------------------------------------------------- */

function HealthCard({
  icon: Icon,
  title,
  value,
  description,
  danger = false,
}: {
  icon: React.ElementType;
  title: string;
  value: string;
  description: string;
  danger?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        danger ? "border-red-200 bg-red-50/60" : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-center justify-between">
        <div
          className={`rounded-xl p-2.5 ${
            danger ? "bg-red-100 text-red-600" : "bg-emerald-50 text-emerald-600"
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>

        <span className="text-2xl font-bold text-slate-900">{value}</span>
      </div>

      <h3 className="mt-4 font-bold text-slate-900">{title}</h3>

      <p className="mt-1 text-sm leading-5 text-slate-500">{description}</p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Property Card                                                              */
/* -------------------------------------------------------------------------- */

function PropertyCard({
  property,
  flagged,
  incomplete,
  actionId,
  onView,
  onEdit,
  onToggle,
  onDelete,
}: {
  property: Property;
  flagged: boolean;
  incomplete: boolean;
  actionId: string | null;
  onView: () => void;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const CategoryIcon = categoryIcon(property.property_category);

  const landOrCommercial =
    property.property_category === "Land" || property.property_category === "Agricultural";

  return (
    <article className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative h-52 overflow-hidden bg-slate-100">
        {property.image_url ? (
          <img
            src={property.image_url}
            alt={property.title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-slate-400">
            <ImageIcon className="h-10 w-10" />
            <span className="mt-2 text-xs font-medium">No property image</span>
          </div>
        )}

        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
          <span
            className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${
              property.available
                ? "border-emerald-200 bg-white/95 text-emerald-700"
                : "border-slate-200 bg-white/95 text-slate-600"
            }`}
          >
            {property.available ? "Available" : "Occupied"}
          </span>

          <span className="inline-flex items-center gap-1 rounded-full border border-white/60 bg-white/95 px-2.5 py-1 text-[11px] font-bold text-slate-700">
            <CategoryIcon className="h-3 w-3" />
            {property.property_category || "Property"}
          </span>

          {property.verified ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-white/95 px-2.5 py-1 text-[11px] font-bold text-blue-700">
              <ShieldCheck className="h-3 w-3" />
              Verified
            </span>
          ) : (
            <span className="rounded-full border border-amber-200 bg-white/95 px-2.5 py-1 text-[11px] font-bold text-amber-700">
              Unverified
            </span>
          )}
        </div>

        <div className="absolute bottom-4 right-4 rounded-full bg-slate-900/90 px-3 py-1.5 text-[11px] font-bold text-white">
          {property.listing_type || "For Rent"}
        </div>

        {flagged && (
          <div className="absolute bottom-4 left-4 inline-flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-lg">
            <ShieldAlert className="h-3.5 w-3.5" />
            Integrity flag
          </div>
        )}

        {incomplete && !flagged && (
          <div className="absolute bottom-4 left-4 inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-3 py-1.5 text-[11px] font-bold text-white shadow-lg">
            <AlertTriangle className="h-3.5 w-3.5" />
            Listing needs attention
          </div>
        )}
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-bold text-slate-900">{property.title}</h3>

            <div className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
              <MapPin className="h-3.5 w-3.5 shrink-0" />

              <span className="truncate">
                {[property.suburb, property.city].filter(Boolean).join(", ") ||
                  "Location not provided"}
              </span>
            </div>
          </div>

          <div className="text-right">
            <p className="text-lg font-bold text-slate-900">{displayPrice(property)}</p>

            <p className="text-[11px] text-slate-400">{priceLabel(property)}</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 divide-x divide-slate-100 rounded-xl border border-slate-100 bg-slate-50 py-3">
          {landOrCommercial ? (
            <>
              <InfoMini
                icon={Ruler}
                value={property.size ? `${property.size} ${property.size_unit ?? ""}` : "—"}
                label="Size"
              />

              <InfoMini icon={Building2} value={String(property.rooms ?? "—")} label="Rooms" />

              <InfoMini icon={Tag} value={titleCase(property.property_type)} label="Type" />
            </>
          ) : (
            <>
              <InfoMini icon={BedDouble} value={String(property.beds ?? 0)} label="Beds" />

              <InfoMini icon={Bath} value={String(property.baths ?? 0)} label="Baths" />

              <InfoMini icon={Building2} value={titleCase(property.property_type)} label="Type" />
            </>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {property.size && (
            <SmallTag icon={Ruler} text={`${property.size} ${property.size_unit ?? "m²"}`} />
          )}

          {property.water_available && <SmallTag icon={Droplets} text="Water" />}

          {property.electricity_available && <SmallTag icon={Zap} text="Electricity" />}

          {property.road_access && <SmallTag icon={RoadIcon} text="Road access" />}
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onView}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800"
          >
            <Eye className="h-4 w-4" />
            View
          </button>

          <button
            type="button"
            onClick={onEdit}
            className="rounded-xl border border-slate-200 p-2.5 text-slate-600 transition hover:bg-slate-50"
            title="Edit property"
          >
            <Edit3 className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={onToggle}
            disabled={actionId === property.id}
            className="rounded-xl border border-slate-200 p-2.5 text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            title={property.available ? "Mark occupied" : "Mark available"}
          >
            {actionId === property.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : property.available ? (
              <ToggleRight className="h-4 w-4" />
            ) : (
              <ToggleLeft className="h-4 w-4" />
            )}
          </button>

          <button
            type="button"
            onClick={onDelete}
            disabled={actionId === property.id}
            className="rounded-xl border border-red-100 p-2.5 text-red-500 transition hover:bg-red-50 disabled:opacity-50"
            title="Delete property"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/* Small UI Components                                                        */
/* -------------------------------------------------------------------------- */

function SmallTag({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
      <Icon className="h-3 w-3" />
      {text}
    </span>
  );
}

function InfoMini({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ElementType;
  value: string;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 px-2">
      <div className="flex items-center gap-1.5 text-slate-700">
        <Icon className="h-3.5 w-3.5" />

        <span className="max-w-[90px] truncate text-xs font-bold">{value}</span>
      </div>

      <span className="text-[10px] text-slate-400">{label}</span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Detail Drawer                                                              */
/* -------------------------------------------------------------------------- */

function PropertyDetailDrawer({
  property,
  bundle,
  loading,
  reviewAverage,
  pendingRequests,
  heldPayments,
  activeLease,
  onClose,
  onEdit,
  onToggle,
  onRequests,
  onApplicants,
  actionId,
}: {
  property: Property;
  bundle: PropertyBundle | undefined;
  loading: boolean;
  reviewAverage: number;
  pendingRequests: LeaseRequest[];
  heldPayments: Payment[];
  activeLease: Lease | undefined;
  onClose: () => void;
  onEdit: () => void;
  onToggle: () => void;
  onRequests: () => void;
  onApplicants: () => void;
  actionId: string | null;
}) {
  const flags = property.fraud_flags ?? [];

  const landRelated =
    property.property_category === "Land" || property.property_category === "Agricultural";

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Close property details"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />

      <aside className="relative z-10 flex h-full w-full max-w-2xl flex-col overflow-hidden bg-white shadow-2xl">
        <div className="border-b border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  Property Inspection
                </p>

                <h2 className="text-lg font-bold text-slate-900">{property.title}</h2>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Hero */}
          <div className="relative h-60 bg-slate-100">
            {property.image_url ? (
              <img
                src={property.image_url}
                alt={property.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-slate-400">
                <ImageIcon className="h-12 w-12" />
              </div>
            )}

            <div className="absolute bottom-4 left-4 flex flex-wrap gap-2">
              <span
                className={`rounded-full px-3 py-1.5 text-xs font-bold shadow ${
                  property.available ? "bg-emerald-500 text-white" : "bg-slate-800 text-white"
                }`}
              >
                {property.available ? "Available" : "Occupied"}
              </span>

              <span className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-bold text-white shadow">
                {property.listing_type || "For Rent"}
              </span>

              <span
                className={`rounded-full px-3 py-1.5 text-xs font-bold shadow ${
                  property.verified ? "bg-blue-600 text-white" : "bg-amber-500 text-white"
                }`}
              >
                {property.verified ? "Verified Listing" : "Unverified Listing"}
              </span>
            </div>
          </div>

          <div className="space-y-6 p-6">
            {/* Overview */}
            <section>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">
                      {property.property_category || "Property"}
                    </span>

                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">
                      {property.property_type || "Type not specified"}
                    </span>
                  </div>

                  <h3 className="mt-3 text-xl font-bold text-slate-900">{property.title}</h3>

                  <div className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                    <MapPin className="h-4 w-4" />

                    {[property.suburb, property.city].filter(Boolean).join(", ") ||
                      "Location not provided"}
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-2xl font-bold text-slate-900">{displayPrice(property)}</p>

                  <p className="text-xs text-slate-400">{priceLabel(property)}</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {landRelated ? (
                  <>
                    <DetailMetric
                      icon={Ruler}
                      label="Size"
                      value={property.size ? `${property.size} ${property.size_unit ?? "m²"}` : "—"}
                    />

                    <DetailMetric
                      icon={Tag}
                      label="Land use"
                      value={property.land_use || "Not specified"}
                    />

                    <DetailMetric
                      icon={Landmark}
                      label="Title status"
                      value={property.title_status || "Not provided"}
                    />

                    <DetailMetric icon={Wallet} label="Price" value={displayPrice(property)} />
                  </>
                ) : (
                  <>
                    <DetailMetric
                      icon={BedDouble}
                      label="Bedrooms"
                      value={String(property.beds ?? 0)}
                    />

                    <DetailMetric
                      icon={Bath}
                      label="Bathrooms"
                      value={String(property.baths ?? 0)}
                    />

                    <DetailMetric
                      icon={Building2}
                      label="Type"
                      value={titleCase(property.property_type)}
                    />

                    <DetailMetric
                      icon={Wallet}
                      label="Deposit"
                      value={money(property.deposit_usd)}
                    />
                  </>
                )}
              </div>
            </section>

            {/* Property specifications */}
            <section className="rounded-2xl border border-slate-200 p-5">
              <SectionHeading icon={Building2} title="Property Specifications" />

              <div className="mt-4 grid grid-cols-2 gap-3">
                <InfoBox label="Category" value={property.property_category || "—"} />

                <InfoBox label="Property type" value={property.property_type || "—"} />

                <InfoBox label="Listing purpose" value={property.listing_type || "—"} />

                <InfoBox
                  label="Size"
                  value={
                    property.size
                      ? `${property.size} ${property.size_unit ?? "m²"}`
                      : "Not provided"
                  }
                />

                <InfoBox label="Rooms" value={String(property.rooms ?? "—")} />

                <InfoBox label="Bedrooms" value={String(property.beds ?? "—")} />

                <InfoBox label="Bathrooms" value={String(property.baths ?? "—")} />

                <InfoBox label="Zoning" value={property.zoning || "Not provided"} />
              </div>
            </section>

            {/* Land / utilities */}
            {(landRelated ||
              property.water_available ||
              property.electricity_available ||
              property.road_access) && (
              <section className="rounded-2xl border border-slate-200 p-5">
                <SectionHeading icon={Trees} title="Land & Utilities" />

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <UtilityBox
                    icon={Droplets}
                    label="Water"
                    enabled={Boolean(property.water_available)}
                  />

                  <UtilityBox
                    icon={Zap}
                    label="Electricity"
                    enabled={Boolean(property.electricity_available)}
                  />

                  <UtilityBox
                    icon={RoadIcon}
                    label="Road access"
                    enabled={Boolean(property.road_access)}
                  />
                </div>

                {property.land_use && (
                  <div className="mt-4">
                    <InfoBox label="Land use" value={property.land_use} />
                  </div>
                )}

                {property.title_status && (
                  <div className="mt-3">
                    <InfoBox label="Title status" value={property.title_status} />
                  </div>
                )}
              </section>
            )}

            {/* Actions */}
            <section className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white"
              >
                <Edit3 className="h-4 w-4" />
                Edit Listing
              </button>

              <button
                type="button"
                onClick={onToggle}
                disabled={actionId === property.id}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {actionId === property.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : property.available ? (
                  <ToggleLeft className="h-4 w-4" />
                ) : (
                  <ToggleRight className="h-4 w-4" />
                )}

                {property.available ? "Mark Occupied" : "Mark Available"}
              </button>

              <button
                type="button"
                onClick={onApplicants}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                <Users className="h-4 w-4" />
                Applicants
              </button>
            </section>

            {/* Description */}
            <section className="rounded-2xl border border-slate-200 p-5">
              <SectionHeading icon={FileText} title="Property Information" />

              <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                {property.description || "No property description has been added."}
              </p>

              <div className="mt-5">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Amenities
                </p>

                {property.amenities?.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {property.amenities.map((amenity) => (
                      <span
                        key={amenity}
                        className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600"
                      >
                        {amenity}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-amber-600">No amenities have been provided.</p>
                )}
              </div>
            </section>

            {/* Active lease */}
            <section className="rounded-2xl border border-slate-200 p-5">
              <SectionHeading
                icon={FileText}
                title="Active Lease"
                badge={
                  activeLease ? (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                      Active
                    </span>
                  ) : (
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-500">
                      No active lease
                    </span>
                  )
                }
              />

              {activeLease ? (
                <div className="mt-4 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-slate-100 p-3">
                      <UserRound className="h-5 w-5 text-slate-600" />
                    </div>

                    <div>
                      <p className="font-bold text-slate-900">
                        {activeLease.tenant?.full_name || "Tenant"}
                      </p>

                      <p className="text-xs text-slate-500">
                        Trust score: {activeLease.tenant?.trust_score ?? "Not available"}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <InfoBox label="Rent" value={money(activeLease.rent_usd)} />

                    <InfoBox label="Deposit" value={money(activeLease.deposit_usd)} />

                    <InfoBox label="Start" value={date(activeLease.start_date)} />

                    <InfoBox label="End" value={date(activeLease.end_date)} />
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                  This property currently has no active lease.
                </div>
              )}
            </section>

            {/* Requests */}
            <section className="rounded-2xl border border-slate-200 p-5">
              <SectionHeading
                icon={Clock3}
                title="Lease Requests"
                badge={
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                    {pendingRequests.length} pending
                  </span>
                }
              />

              {loading ? (
                <LoadingRow />
              ) : bundle?.requests.length ? (
                <div className="mt-4 space-y-3">
                  {bundle.requests.slice(0, 5).map((request) => (
                    <div
                      key={request.id}
                      className="rounded-xl border border-slate-100 bg-slate-50 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {request.tenant?.full_name || "Tenant applicant"}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            Move-in: {date(request.move_in)}
                          </p>
                        </div>

                        <span
                          className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${statusClasses(
                            request.status,
                          )}`}
                        >
                          {titleCase(request.status)}
                        </span>
                      </div>

                      {request.message && (
                        <p className="mt-3 text-xs leading-5 text-slate-500">{request.message}</p>
                      )}
                    </div>
                  ))}

                  {bundle.requests.length > 5 && (
                    <button
                      type="button"
                      onClick={onRequests}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                    >
                      View all requests
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ) : (
                <EmptySection text="No lease requests for this property." />
              )}
            </section>

            {/* Payments */}
            <section className="rounded-2xl border border-slate-200 p-5">
              <SectionHeading
                icon={Wallet}
                title="Protected Payments"
                badge={
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                    {heldPayments.length} active
                  </span>
                }
              />

              {loading ? (
                <LoadingRow />
              ) : bundle?.payments.length ? (
                <div className="mt-4 space-y-3">
                  {bundle.payments.slice(0, 5).map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4"
                    >
                      <div>
                        <p className="font-semibold text-slate-900">
                          {titleCase(payment.payment_type)}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {payment.reference || "No reference"}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="font-bold text-slate-900">{money(payment.amount_usd)}</p>

                        <span
                          className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusClasses(
                            payment.status,
                          )}`}
                        >
                          {titleCase(payment.status)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptySection text="No payment records are associated with this property's leases." />
              )}
            </section>

            {/* Reviews */}
            <section className="rounded-2xl border border-slate-200 p-5">
              <SectionHeading
                icon={Star}
                title="Property Reviews"
                badge={
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                    <Star className="h-3 w-3 fill-current" />
                    {reviewAverage ? reviewAverage.toFixed(1) : "—"}
                  </span>
                }
              />

              {loading ? (
                <LoadingRow />
              ) : bundle?.reviews.length ? (
                <div className="mt-4 space-y-4">
                  {bundle.reviews.slice(0, 5).map((review) => (
                    <div
                      key={review.id}
                      className="rounded-xl border border-slate-100 bg-slate-50 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <div className="rounded-full bg-white p-2">
                            <UserRound className="h-4 w-4 text-slate-500" />
                          </div>

                          <span className="text-sm font-semibold text-slate-900">
                            {review.author?.full_name || "Tenant"}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 text-amber-500">
                          <Star className="h-3.5 w-3.5 fill-current" />

                          <span className="text-xs font-bold">{review.rating ?? "—"}</span>
                        </div>
                      </div>

                      <p className="mt-3 text-sm leading-5 text-slate-600">
                        {review.body || "No written review."}
                      </p>

                      <div className="mt-3 flex items-center justify-between text-[10px] text-slate-400">
                        <span>{date(review.created_at)}</span>

                        <span>
                          {review.lease_confirmed ? "Lease confirmed" : "Lease not confirmed"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptySection text="No reviews have been submitted for this property." />
              )}
            </section>

            {/* Integrity */}
            <section
              className={`rounded-2xl border p-5 ${
                flags.length ? "border-red-200 bg-red-50/50" : "border-emerald-200 bg-emerald-50/50"
              }`}
            >
              <SectionHeading
                icon={flags.length ? ShieldAlert : ShieldCheck}
                title="Listing Integrity"
                badge={
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                      flags.length ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {flags.length
                      ? `${flags.length} flag${flags.length === 1 ? "" : "s"}`
                      : "Clear"}
                  </span>
                }
              />

              <div className="mt-4 space-y-3">
                {flags.length ? (
                  flags.map((flag, index) => (
                    <div
                      key={`${flag}-${index}`}
                      className="flex items-start gap-3 rounded-xl border border-red-200 bg-white p-4"
                    >
                      <Flag className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />

                      <div>
                        <p className="text-sm font-semibold text-red-800">Integrity flag</p>

                        <p className="mt-1 text-xs text-red-700">{flag}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-white p-4">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />

                    <div>
                      <p className="text-sm font-bold text-emerald-800">No active fraud flags</p>

                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        No fraud flags are currently stored against this listing.
                      </p>
                    </div>
                  </div>
                )}

                {!property.image_url && <WarningRow text="Property image is missing." />}

                {!property.description || property.description.trim().length < 20 ? (
                  <WarningRow text="Property description is missing or too short." />
                ) : null}

                {!property.amenities?.length && (
                  <WarningRow text="No amenities have been provided." />
                )}

                {!property.verified && (
                  <WarningRow text="This listing has not been marked as verified." />
                )}

                {!property.size && <WarningRow text="Property size has not been provided." />}

                {landRelated && !property.title_status && (
                  <WarningRow text="Land/title status has not been provided." />
                )}
              </div>
            </section>

            {/* Metadata */}
            <section className="rounded-2xl bg-slate-50 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <InfoBox label="Listing created" value={date(property.created_at)} />

                <InfoBox label="Property ID" value={property.id} />
              </div>
            </section>
          </div>
        </div>
      </aside>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Form Modal                                                                 */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/* Drawer Components                                                          */
/* -------------------------------------------------------------------------- */

function DetailMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
      <Icon className="h-4 w-4 text-slate-500" />

      <p className="mt-2 text-xs text-slate-400">{label}</p>

      <p className="mt-0.5 truncate text-sm font-bold text-slate-800">{value}</p>
    </div>
  );
}

function UtilityBox({
  icon: Icon,
  label,
  enabled,
}: {
  icon: React.ElementType;
  label: string;
  enabled: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        enabled ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"
      }`}
    >
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${enabled ? "text-emerald-600" : "text-slate-400"}`} />

        <span className="text-sm font-bold text-slate-800">{label}</span>
      </div>

      <p className={`mt-1 text-xs ${enabled ? "text-emerald-700" : "text-slate-500"}`}>
        {enabled ? "Available" : "Not confirmed"}
      </p>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>

      <p className="mt-1 truncate text-sm font-bold text-slate-800">{value}</p>
    </div>
  );
}

function SectionHeading({
  icon: Icon,
  title,
  badge,
}: {
  icon: React.ElementType;
  title: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <div className="rounded-lg bg-slate-100 p-2 text-slate-600">
          <Icon className="h-4 w-4" />
        </div>

        <h3 className="font-bold text-slate-900">{title}</h3>
      </div>

      {badge}
    </div>
  );
}

function EmptySection({ text }: { text: string }) {
  return (
    <div className="mt-4 rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500">{text}</div>
  );
}

function LoadingRow() {
  return (
    <div className="mt-4 flex items-center justify-center rounded-xl bg-slate-50 p-6 text-sm text-slate-500">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Loading...
    </div>
  );
}

function WarningRow({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-white p-3">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />

      <p className="text-xs font-medium text-amber-800">{text}</p>
    </div>
  );
}
