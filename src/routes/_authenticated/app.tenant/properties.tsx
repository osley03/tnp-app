import {externalTour} from '@/lib/external-tours';
import {PropertyTourLink} from '@/modules/virtual-tours/components/PropertyTourLink';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import { matchesSearch as matchWorkspaceSearch } from '@/lib/workspace-search';
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Bath,
  BedDouble,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Droplets,
  Eye,
  FileCheck2,
  Heart,
  Home,
  ImageOff,
  LandPlot,
  Loader2,
  MapPin,
  Maximize2,
  Ruler,
  Route as RouteIcon,
  Search,
  ShieldCheck,
  Star,
  Tag,
  Trees,
  UserRound,
  X,
  Zap,
} from "lucide-react";
import { Viewer } from "@photo-sphere-viewer/core";
import "@photo-sphere-viewer/core/index.css";
import { tourIdFromUrl, tourLink } from "@/lib/tour-links";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app/tenant/properties")({
  component: TenantProperties,
});

type PropertyRecord = Record<string, unknown>;

type PropertyTour = {
  id: string;
  property_id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  is_published: boolean;
};

type TourScene = {
  id: string;
  tour_id?: string;
  name: string;
  description: string | null;
  panorama_url: string;
  scene_order: number;
};

type FilterState = {
  location: string;
  propertyCategory: string;
  propertyType: string;
  listingType: string;
  maxPrice: string;
  bedrooms: string;
  minSize: string;
  landUse: string;
  verifiedOnly: boolean;
  toursOnly: boolean;
};

type Category = {
  id: string;
  description: string;
  icon: ReactNode;
  types: string[];
};

/* -------------------------------------------------------------------------- */
/* TNP PROPERTY TAXONOMY                                                     */
/* -------------------------------------------------------------------------- */

const CATEGORIES: Category[] = [
  {
    id: "Residential",
    description: "Homes and living spaces",
    icon: <Home className="h-6 w-6" />,
    types: ["House", "Apartment", "Flat", "Townhouse", "Duplex", "Cottage", "Cluster"],
  },
  {
    id: "Commercial",
    description: "Business and retail premises",
    icon: <Building2 className="h-6 w-6" />,
    types: [
      "Office",
      "Shop",
      "Retail Space",
      "Restaurant",
      "Commercial Property",
      "Commercial Stand",
      "Commercial Building",
    ],
  },
  {
    id: "Agricultural",
    description: "Farms and agricultural land",
    icon: <Trees className="h-6 w-6" />,
    types: [
      "Farm",
      "Agricultural Land",
      "Ranch",
      "Smallholding",
      "Horticultural Land",
      "Agricultural Property",
    ],
  },
  {
    id: "Land",
    description: "Stands and development land",
    icon: <LandPlot className="h-6 w-6" />,
    types: [
      "Residential Stand",
      "Commercial Stand",
      "Industrial Stand",
      "Vacant Land",
      "Development Land",
      "Agricultural Land",
    ],
  },
  {
    id: "Industrial",
    description: "Factories and industrial sites",
    icon: <Building2 className="h-6 w-6" />,
    types: [
      "Warehouse",
      "Factory",
      "Workshop",
      "Industrial Building",
      "Industrial Property",
      "Industrial Stand",
    ],
  },
];

const ALL_TYPES = Array.from(new Set(CATEGORIES.flatMap((category) => category.types)));

const LISTING_TYPES = ["For Rent", "For Sale", "For Lease", "For Rent or Sale"];

const LAND_USES = [
  "Residential",
  "Commercial",
  "Agriculture",
  "Industrial",
  "Mixed Use",
  "Development",
];

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function first<T>(...values: Array<T | null | undefined | "">) {
  return values.find((value) => value !== null && value !== undefined && value !== "") as
    T | undefined;
}

function text(value: unknown, fallback = "") {
  const result = String(value ?? "").trim();

  return result || fallback;
}

function normalize(value: unknown) {
  return text(value).toLowerCase().trim();
}

function numeric(value: unknown) {
  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function formatNumber(value: unknown) {
  const number = numeric(value);

  if (number === null) {
    return "—";
  }

  return number.toLocaleString();
}

function formatDate(value: unknown) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-ZW", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function propertyId(property: PropertyRecord) {
  return text(first(property["id"], property["property_id"]));
}

function propertyTitle(property: PropertyRecord) {
  return text(
    first(property["title"], property["property_name"], property["name"]),
    "Untitled Property",
  );
}

function propertySuburb(property: PropertyRecord) {
  return text(first(property["suburb"], property["area"], property["location_name"]));
}

function propertyCity(property: PropertyRecord) {
  return text(first(property["city"]), "Harare");
}

function propertyLocation(property: PropertyRecord) {
  const suburb = propertySuburb(property);

  const city = propertyCity(property);

  return suburb ? `${suburb}, ${city}` : city;
}

function propertyCategory(property: PropertyRecord) {
  const explicit = first(property["property_category"], property["category"]);

  if (explicit) {
    return text(explicit);
  }

  const type = normalize(first(property["property_type"], property["type"]));

  if (type.includes("farm") || type.includes("agric")) {
    return "Agricultural";
  }

  if (type.includes("land") || type.includes("stand")) {
    return "Land";
  }

  if (type.includes("industrial") || type.includes("warehouse")) {
    return "Industrial";
  }

  if (
    type.includes("office") ||
    type.includes("shop") ||
    type.includes("retail") ||
    type.includes("commercial")
  ) {
    return "Commercial";
  }

  return "Residential";
}

function propertyType(property: PropertyRecord) {
  return text(first(property["property_type"], property["type"]), "Property");
}

function propertyListingType(property: PropertyRecord) {
  return text(first(property["listing_type"]), "For Rent");
}

function propertyRent(property: PropertyRecord) {
  return first(
    property["rent_usd"],
    property["rent"],
    property["monthly_rent"],
    property["monthly_price"],
    property["rent_amount"],
  );
}

function propertySalePrice(property: PropertyRecord) {
  return first(
    property["price_usd"],
    property["sale_price"],
    property["asking_price"],
    property["sale_amount"],
    property["price"],
  );
}

function propertyPrice(property: PropertyRecord) {
  const listingType = normalize(propertyListingType(property));

  if (listingType === "for sale") {
    return propertySalePrice(property);
  }

  return first(propertyRent(property), propertySalePrice(property));
}

function propertyPriceUnit(property: PropertyRecord) {
  const stored = text(property["price_unit"]);

  if (stored) {
    return stored;
  }

  if (normalize(propertyListingType(property)) === "for sale") {
    return "total";
  }

  return "month";
}

function propertyPriceLabel(property: PropertyRecord) {
  const listingType = normalize(propertyListingType(property));

  const rent = numeric(propertyRent(property));

  const sale = numeric(propertySalePrice(property));

  if (listingType === "for rent or sale" && rent !== null && sale !== null) {
    return `$${rent.toLocaleString()}/month · $${sale.toLocaleString()} sale`;
  }

  if (listingType === "for sale" && sale !== null) {
    return `$${sale.toLocaleString()} total`;
  }

  if (rent !== null) {
    return `$${rent.toLocaleString()}/month`;
  }

  if (sale !== null) {
    return `$${sale.toLocaleString()} total`;
  }

  return "Price not specified";
}

function propertyBedrooms(property: PropertyRecord) {
  return first(property["beds"], property["bedrooms"], property["bedroom_count"]);
}

function propertyBathrooms(property: PropertyRecord) {
  return first(property["baths"], property["bathrooms"], property["bathroom_count"]);
}

function propertyRooms(property: PropertyRecord) {
  return first(property["rooms"], property["room_count"]);
}

function propertySize(property: PropertyRecord) {
  return first(
    property["size"],
    property["area_size"],
    property["land_size"],
    property["square_meters"],
    property["sqm"],
    property["floor_area"],
  );
}

function propertySizeUnit(property: PropertyRecord) {
  return text(property["size_unit"], "m²");
}

function propertyLandUse(property: PropertyRecord) {
  return text(property["land_use"]);
}

function propertyZoning(property: PropertyRecord) {
  return text(property["zoning"]);
}

function propertyTitleStatus(property: PropertyRecord) {
  return text(first(property["title_status"], property["deed_status"]));
}

function boolValue(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value.toLowerCase() === "true";
  }

  return Boolean(value);
}

function propertyWaterAvailable(property: PropertyRecord) {
  return boolValue(
    first(property["water_available"], property["water"], property["borehole"], false),
  );
}

function propertyElectricityAvailable(property: PropertyRecord) {
  return boolValue(
    first(
      property["electricity_available"],
      property["electricity"],
      property["power_available"],
      false,
    ),
  );
}

function propertyRoadAccess(property: PropertyRecord) {
  return boolValue(first(property["road_access"], property["road_access_available"], false));
}

function propertyAmenities(property: PropertyRecord) {
  const value = property["amenities"];

  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .map((item) => item.trim());
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function propertyDescription(property: PropertyRecord) {
  return text(
    first(property["description"], property["property_description"]),
    "No description has been provided for this property.",
  );
}

function propertyImages(property: PropertyRecord) {
  const images: string[] = [];

  const imageUrls = property["image_urls"];

  if (Array.isArray(imageUrls)) {
    for (const image of imageUrls) {
      if (typeof image === "string" && image.trim()) {
        images.push(image.trim());
      }
    }
  }

  const imageArray = property["images"];

  if (Array.isArray(imageArray)) {
    for (const image of imageArray) {
      if (typeof image === "string" && image.trim()) {
        images.push(image.trim());
      }
    }
  }

  const single = first(
    property["image_url"],
    property["cover_image_url"],
    property["cover_image"],
    property["photo_url"],
  );

  if (typeof single === "string" && single.trim()) {
    images.unshift(single.trim());
  }

  return Array.from(new Set(images));
}

function propertyVerified(property: PropertyRecord) {
  return boolValue(
    first(property["verified"], property["is_verified"], property["listing_verified"], false),
  );
}

function landlordName(property: PropertyRecord) {
  return text(
    first(property["landlord_name"], property["owner_name"], property["landlord_full_name"]),
    "TNP Landlord",
  );
}

function landlordVerified(property: PropertyRecord) {
  const verification = normalize(
    first(
      property["landlord_verified"],
      property["landlord_verification"],
      property["landlord_verification_status"],
      "",
    ),
  );

  return verification === "true" || verification === "verified";
}

function landlordTrustScore(property: PropertyRecord) {
  return first(
    property["trust_score"],
    property["landlord_trust_score"],
    property["tnp_trust_score"],
  );
}

function landlordRating(property: PropertyRecord) {
  return first(property["landlord_rating"], property["owner_rating"]);
}

function has360Tour(property: PropertyRecord) {
  return boolValue(
    first(property["has_360_tour"], property["tour_available"], property["is_360"], false),
  );
}

function summaryItems(property: PropertyRecord) {
  const category = normalize(propertyCategory(property));

  const items: string[] = [];

  const size = propertySize(property);

  if (category === "land" || category === "agricultural") {
    if (size !== undefined) {
      items.push(`${formatNumber(size)} ${propertySizeUnit(property)}`);
    }

    if (propertyLandUse(property)) {
      items.push(propertyLandUse(property));
    }

    if (propertyWaterAvailable(property)) {
      items.push("Water");
    }

    if (propertyElectricityAvailable(property)) {
      items.push("Electricity");
    }

    if (propertyRoadAccess(property)) {
      items.push("Road access");
    }
  } else if (category === "commercial" || category === "industrial") {
    if (size !== undefined) {
      items.push(`${formatNumber(size)} ${propertySizeUnit(property)}`);
    }

    if (propertyRooms(property) !== undefined) {
      items.push(`${formatNumber(propertyRooms(property))} rooms`);
    }

    if (propertyBathrooms(property) !== undefined) {
      items.push(`${formatNumber(propertyBathrooms(property))} baths`);
    }
  } else {
    if (propertyBedrooms(property) !== undefined) {
      items.push(`${formatNumber(propertyBedrooms(property))} beds`);
    }

    if (propertyBathrooms(property) !== undefined) {
      items.push(`${formatNumber(propertyBathrooms(property))} baths`);
    }

    if (size !== undefined) {
      items.push(`${formatNumber(size)} ${propertySizeUnit(property)}`);
    }
  }

  return items.length ? items : [propertyType(property)];
}

function searchBlob(property: PropertyRecord) {
  return [
    propertyTitle(property),
    propertySuburb(property),
    propertyCity(property),
    propertyCategory(property),
    propertyType(property),
    propertyListingType(property),
    propertyDescription(property),
    propertyLandUse(property),
    propertyZoning(property),
    propertyTitleStatus(property),
    propertyAmenities(property).join(" "),
  ]
    .join(" ")
    .toLowerCase();
}

/* -------------------------------------------------------------------------- */
/* Small UI components                                                        */
/* -------------------------------------------------------------------------- */

function PropertyImage({ src, alt }: { src?: string | undefined; alt: string }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-100 text-slate-400">
        <div className="text-center">
          <ImageOff className="mx-auto h-8 w-8" />

          <p className="mt-2 text-xs">No image available</p>
        </div>
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

function LoadingCard() {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="h-56 animate-pulse bg-slate-100" />

      <div className="space-y-3 p-5">
        <div className="h-5 w-3/4 animate-pulse rounded bg-slate-100" />

        <div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" />

        <div className="h-10 animate-pulse rounded bg-slate-100" />

        <div className="h-10 animate-pulse rounded bg-slate-100" />
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
          {icon}
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>

          <p className="mt-1 text-2xl font-bold text-slate-950">{value}</p>
        </div>
      </div>
    </div>
  );
}

function SpecBox({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-slate-600 shadow-sm">
        {icon}
      </div>

      <p className="mt-3 text-sm font-semibold text-slate-900">{value}</p>

      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </div>
  );
}

function TenantProperties() {
  const navigate = useNavigate();

  const [properties, setProperties] = useState<PropertyRecord[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [search, setSearch] = useState("");

  const [filters, setFilters] = useState<FilterState>({
    location: "all",
    propertyCategory: "all",
    propertyType: "all",
    listingType: "all",
    maxPrice: "all",
    bedrooms: "all",
    minSize: "all",
    landUse: "all",
    verifiedOnly: false,
    toursOnly: false,
  });

  const [favourites, setFavourites] = useState<Set<string>>(() => new Set());

  const [favouriteLoading, setFavouriteLoading] = useState<Set<string>>(() => new Set());

  const [selectedProperty, setSelectedProperty] = useState<PropertyRecord | null>(null);

  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  const [externalValue,setExternalValue]=useState('');
  const [tourOpen, setTourOpen] = useState(false);

  const [tourLoading, setTourLoading] = useState(false);

  const [tourError, setTourError] = useState<string | null>(null);

  const [tour, setTour] = useState<PropertyTour | null>(null);

  const [scenes, setScenes] = useState<TourScene[]>([]);

  const [activeSceneIndex, setActiveSceneIndex] = useState(0);

  const viewerContainer = useRef<HTMLDivElement | null>(null);

  const viewerInstance = useRef<{
    destroy: () => void;
  } | null>(null);

  /* ---------------------------------------------------------------------- */
  /* Authentication                                                          */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted) {
        return;
      }

      setCurrentUserId(user?.id ?? null);
    }

    void loadUser();

    return () => {
      mounted = false;
    };
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Properties                                                              */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    let mounted = true;

    async function loadProperties() {
      setLoading(true);
      setError(null);

      try {
        const { data, error: propertiesError } = await supabase
          .from("properties" as never)
          .select("*")
          .eq("available", true)
          .order("created_at", {
            ascending: false,
          });

        if (propertiesError) {
          throw propertiesError;
        }

        const rows = (data ?? []) as PropertyRecord[];

        const ownerIds = Array.from(
          new Set(rows.map((row) => text(row["owner_id"])).filter(Boolean)),
        );

        const profileMap = new Map<string, PropertyRecord>();

        if (ownerIds.length) {
          const { data: profiles } = await supabase
            .from("profiles" as never)
            .select("id, full_name, verification, trust_score")
            .in("id", ownerIds);

          for (const profile of (profiles ?? []) as PropertyRecord[]) {
            profileMap.set(text(profile["id"]), profile);
          }
        }

        const ids = rows.map(propertyId).filter(Boolean);

        const tourPropertyIds = new Set<string>();

        if (ids.length) {
          const { data: tours } = await supabase
            .from("property_tours" as never)
            .select("property_id")
            .in("property_id", ids)
            .eq("is_published", true);

          for (const row of (tours ?? []) as PropertyRecord[]) {
            const id = text(row["property_id"]);

            if (id) {
              tourPropertyIds.add(id);
            }
          }
        }

        const enriched = rows.map((property) => {
          const profile = profileMap.get(text(property["owner_id"]));

          return {
            ...property,

            landlord_name: profile?.["full_name"] ?? property["landlord_name"] ?? "TNP Landlord",

            landlord_verified:
              normalize(profile?.["verification"]) === "verified" ||
              property["landlord_verified"] === true,

            trust_score: profile?.["trust_score"] ?? property["trust_score"] ?? null,

            has_360_tour:
              tourPropertyIds.has(propertyId(property)) || Boolean(text(property["tour_url"])),
          };
        });

        if (currentUserId) {
          const { data: saved } = await supabase
            .from("property_favorites" as never)
            .select("property_id")
            .eq("tenant_id", currentUserId);

          setFavourites(
            new Set(
              ((saved ?? []) as PropertyRecord[])
                .map((row) => text(row["property_id"]))
                .filter(Boolean),
            ),
          );
        }

        if (mounted) {
          setProperties(enriched);
        }
      } catch (loadError) {
        if (!mounted) {
          return;
        }

        console.error("Could not load properties:", loadError);

        setProperties([]);

        setError(loadError instanceof Error ? loadError.message : "Unable to load properties.");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadProperties();

    return () => {
      mounted = false;
    };
  }, [currentUserId]);

  /* ---------------------------------------------------------------------- */
  /* Static taxonomy + live counts                                           */
  /* ---------------------------------------------------------------------- */

  const categories = useMemo(
    () =>
      CATEGORIES.map((category) => ({
        ...category,
        count: properties.filter(
          (property) => normalize(propertyCategory(property)) === normalize(category.id),
        ).length,
      })),
    [properties],
  );

  const locations = useMemo(
    () =>
      Array.from(new Set(properties.map(propertySuburb).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [properties],
  );

  const propertyTypes = useMemo(() => {
    if (filters.propertyCategory === "all") {
      return ALL_TYPES;
    }

    const category = CATEGORIES.find(
      (item) => normalize(item.id) === normalize(filters.propertyCategory),
    );

    return category?.types ?? ALL_TYPES;
  }, [filters.propertyCategory]);

  const filteredProperties = useMemo(() => {
    const query = normalize(search);

    return properties.filter((property) => {
      if (query && !matchWorkspaceSearch(query, searchBlob(property))) {
        return false;
      }

      if (
        filters.location !== "all" &&
        normalize(propertySuburb(property)) !== normalize(filters.location)
      ) {
        return false;
      }

      if (
        filters.propertyCategory !== "all" &&
        normalize(propertyCategory(property)) !== normalize(filters.propertyCategory)
      ) {
        return false;
      }

      if (
        filters.propertyType !== "all" &&
        normalize(propertyType(property)) !== normalize(filters.propertyType)
      ) {
        return false;
      }

      if (
        filters.listingType !== "all" &&
        normalize(propertyListingType(property)) !== normalize(filters.listingType)
      ) {
        return false;
      }

      if (filters.maxPrice !== "all") {
        const price = numeric(propertyPrice(property));

        const maximum = Number(filters.maxPrice);

        if (price === null || price > maximum) {
          return false;
        }
      }

      if (filters.bedrooms !== "all") {
        const beds = numeric(propertyBedrooms(property));

        const wanted = Number(filters.bedrooms);

        if (beds === null || (wanted === 4 ? beds < 4 : beds !== wanted)) {
          return false;
        }
      }

      if (filters.minSize !== "all") {
        const [requestedUnit, rawMinimum] = filters.minSize.split(":");

        const size = numeric(propertySize(property));

        const minimum = Number(rawMinimum);

        if (size === null || !Number.isFinite(minimum)) {
          return false;
        }

        const actualUnit = normalize(propertySizeUnit(property));

        if (requestedUnit === "ha") {
          const hectares = actualUnit === "ha" ? size : size / 10000;

          if (hectares < minimum) {
            return false;
          }
        } else {
          const squareMeters = actualUnit === "ha" ? size * 10000 : size;

          if (squareMeters < minimum) {
            return false;
          }
        }
      }

      if (
        filters.landUse !== "all" &&
        normalize(propertyLandUse(property)) !== normalize(filters.landUse)
      ) {
        return false;
      }

      if (filters.verifiedOnly && !propertyVerified(property)) {
        return false;
      }

      if (filters.toursOnly && !has360Tour(property)) {
        return false;
      }

      return true;
    });
  }, [properties, search, filters]);

  const verifiedCount = properties.filter(propertyVerified).length;

  const tourCount = properties.filter(has360Tour).length;

  const activeFilterCount =
    Number(filters.location !== "all") +
    Number(filters.propertyCategory !== "all") +
    Number(filters.propertyType !== "all") +
    Number(filters.listingType !== "all") +
    Number(filters.maxPrice !== "all") +
    Number(filters.bedrooms !== "all") +
    Number(filters.minSize !== "all") +
    Number(filters.landUse !== "all") +
    Number(filters.verifiedOnly) +
    Number(filters.toursOnly);

  function selectCategory(category: string) {
    setFilters((previous) => ({
      ...previous,
      propertyCategory: category,
      propertyType: "all",
      landUse: "all",
    }));
  }

  function resetFilters() {
    setSearch("");

    setFilters({
      location: "all",
      propertyCategory: "all",
      propertyType: "all",
      listingType: "all",
      maxPrice: "all",
      bedrooms: "all",
      minSize: "all",
      landUse: "all",
      verifiedOnly: false,
      toursOnly: false,
    });
  }

  function openProperty(property: PropertyRecord) {
    setSelectedProperty(property);
    setSelectedImageIndex(0);
  }

  function closeProperty() {
    setSelectedProperty(null);
    setSelectedImageIndex(0);
  }

  /* ---------------------------------------------------------------------- */
  /* Favourites                                                              */
  /* ---------------------------------------------------------------------- */

  async function toggleFavourite(property: PropertyRecord) {
    const id = propertyId(property);

    if (!currentUserId) {
      window.alert("Please sign in as a tenant to save properties.");

      return;
    }

    if (!id) {
      return;
    }

    if (favouriteLoading.has(id)) {
      return;
    }

    const currentlySaved = favourites.has(id);

    setFavouriteLoading((previous) => {
      const next = new Set(previous);

      next.add(id);

      return next;
    });

    setFavourites((previous) => {
      const next = new Set(previous);

      if (currentlySaved) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });

    try {
      if (currentlySaved) {
        const { error } = await supabase
          .from("property_favorites" as never)
          .delete()
          .eq("property_id", id)
          .eq("tenant_id", currentUserId);

        if (error) {
          throw error;
        }
      } else {
        const { error } = await supabase.from("property_favorites" as never).insert({
          property_id: id,
          tenant_id: currentUserId,
        } as never);

        if (error) {
          throw error;
        }
      }
    } catch (favouriteError) {
      console.error(favouriteError);

      setFavourites((previous) => {
        const next = new Set(previous);

        if (currentlySaved) {
          next.add(id);
        } else {
          next.delete(id);
        }

        return next;
      });

      window.alert("Unable to update your saved property.");
    } finally {
      setFavouriteLoading((previous) => {
        const next = new Set(previous);

        next.delete(id);

        return next;
      });
    }
  }

  /* ---------------------------------------------------------------------- */
  /* 360° tours                                                              */
  /* ---------------------------------------------------------------------- */

  async function openTour(property: PropertyRecord) {
    const external=externalTour(text(property["tour_url"]));if(external){setExternalValue(external.url);return;}
    const linkedTour = tourIdFromUrl(text(property["tour_url"]), window.location.origin);
    if (linkedTour) {
      window.open(tourLink(linkedTour, window.location.origin), "_blank", "noopener,noreferrer");
      return;
    }
    const id = propertyId(property);

    if (!id) {
      return;
    }

    setTourOpen(true);
    setTourLoading(true);
    setTourError(null);
    setTour(null);
    setScenes([]);
    setActiveSceneIndex(0);

    try {
      const { data: tourData, error: tourQueryError } = await supabase
        .from("property_tours" as never)
        .select("id, property_id, title, description, cover_image_url, is_published")
        .eq("property_id", id)
        .eq("is_published", true)
        .maybeSingle();

      if (tourQueryError) {
        throw tourQueryError;
      }

      if (!tourData) {
        throw new Error("This property does not have a published 360° tour.");
      }

      const currentTour = tourData as PropertyTour;

      const { data: scenesData, error: scenesError } = await supabase
        .from("property_tour_scenes" as never)
        .select("id, tour_id, name, description, panorama_url, scene_order")
        .eq("tour_id", currentTour.id)
        .eq("is_published", true)
        .order("scene_order", {
          ascending: true,
        });

      if (scenesError) {
        throw scenesError;
      }

      const currentScenes = (scenesData ?? []) as TourScene[];

      if (!currentScenes.length) {
        throw new Error("This 360° tour has no published scenes yet.");
      }

      setTour(currentTour);

      setScenes(currentScenes);

      setActiveSceneIndex(0);
    } catch (error) {
      console.error("Could not load 360° tour:", error);

      setTourError(error instanceof Error ? error.message : "Unable to load the 360° tour.");
    } finally {
      setTourLoading(false);
    }
  }

  function closeTour() {
    viewerInstance.current?.destroy();

    viewerInstance.current = null;

    setTourOpen(false);

    setTour(null);

    setScenes([]);

    setActiveSceneIndex(0);

    setTourError(null);
  }

  useEffect(() => {
    if (!tourOpen || !viewerContainer.current || !scenes.length) {
      return;
    }

    const scene = scenes[activeSceneIndex];

    if (!scene?.panorama_url) {
      return;
    }

    const viewer = new Viewer({
      container: viewerContainer.current,
      panorama: scene.panorama_url,
      navbar: ["zoom", "move", "fullscreen"],
      defaultZoomLvl: 0,
      touchmoveTwoFingers: false,
      mousemove: true,
    });

    viewerInstance.current = viewer;

    return () => {
      viewer.destroy();

      if (viewerInstance.current === viewer) {
        viewerInstance.current = null;
      }
    };
  }, [tourOpen, scenes, activeSceneIndex]);

  /* ---------------------------------------------------------------------- */
  /* Application hand-off                                                   */
  /* ---------------------------------------------------------------------- */

  function applyToProperty(property: PropertyRecord) {
    const id = propertyId(property);

    if (!id) {
      return;
    }

    closeProperty();

    navigate({
      to: "/app/tenant/applications" as never,
      search: {
        property: id,
      } as never,
    });
  }

  const selectedImages = selectedProperty ? propertyImages(selectedProperty) : [];

  return (
    <div className="tnp-module tnp-module-light min-h-full bg-slate-50">
      {/* ---------------------------------------------------------------- */}
      {/* Header                                                            */}
      {/* ---------------------------------------------------------------- */}

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-10 lg:px-8">
          <div className="max-w-4xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-slate-600">
              <ShieldCheck className="h-3.5 w-3.5" />
              TNP Property Marketplace
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
              Find your next property
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500 sm:text-base">
              Discover TNP-listed Residential, Commercial, Agricultural, Land and Industrial
              properties while checking listing verification, landlord trust and available 360°
              inspections.
            </p>
          </div>

          {/* Search is deliberately before taxonomy */}
          <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex gap-3">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by property name, suburb, city, category, type, amenities, land use or zoning..."
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-4 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                />
              </div>

              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="hidden h-12 rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:block"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
        {/* ---------------------------------------------------------------- */}
        {/* PROPERTY TAXONOMY                                                */}
        {/* ---------------------------------------------------------------- */}

        <section className="mb-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                TNP Property Taxonomy
              </p>

              <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
                Browse by category
              </h2>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Start with the type of property you need, then use the filters below to narrow the
                marketplace.
              </p>
            </div>

            {filters.propertyCategory !== "all" && (
              <button
                type="button"
                onClick={() => selectCategory("all")}
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                View all categories
              </button>
            )}
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {categories.map((category) => {
              const active = normalize(filters.propertyCategory) === normalize(category.id);

              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => selectCategory(category.id)}
                  aria-pressed={active}
                  className={`group min-h-[255px] rounded-2xl border p-5 text-left transition ${
                    active
                      ? "border-slate-950 bg-slate-50 shadow-md ring-1 ring-slate-950/10"
                      : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-md"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                        active ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {category.icon}
                    </div>

                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                      {category.count}
                    </span>
                  </div>

                  {/* CATEGORY NAME IS ALWAYS BLACK */}
                  <h3 className="mt-5 text-lg font-bold text-slate-950">{category.id}</h3>

                  <p className="mt-1 text-sm leading-5 text-slate-600">{category.description}</p>

                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {category.types.map((type) => (
                      <span
                        key={type}
                        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-700"
                      >
                        {type}
                      </span>
                    ))}
                  </div>

                  <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-slate-600">
                    Browse {category.id}
                    <ChevronRight className="h-3.5 w-3.5" />
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* MARKETPLACE OVERVIEW                                              */}
        {/* ---------------------------------------------------------------- */}

        <section className="mb-8">
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
              Marketplace overview
            </p>

            <h2 className="mt-1 text-lg font-bold text-slate-950">Current TNP availability</h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <MetricCard
              icon={<Building2 className="h-5 w-5" />}
              label="Available listings"
              value={properties.length}
            />

            <MetricCard
              icon={<ShieldCheck className="h-5 w-5" />}
              label="Verified listings"
              value={verifiedCount}
            />

            <MetricCard icon={<Eye className="h-5 w-5" />} label="360° tours" value={tourCount} />
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* FILTERS                                                           */}
        {/* ---------------------------------------------------------------- */}

        <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                Search controls
              </p>

              <h2 className="mt-1 text-lg font-bold text-slate-950">Refine your search</h2>

              <p className="mt-1 text-sm text-slate-500">
                {filteredProperties.length}{" "}
                {filteredProperties.length === 1 ? "property" : "properties"} found
                {filters.propertyCategory !== "all" && ` · ${filters.propertyCategory}`}
                {activeFilterCount > 0 &&
                  ` · ${activeFilterCount} active ${
                    activeFilterCount === 1 ? "filter" : "filters"
                  }`}
              </p>
            </div>

            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={resetFilters}
                className="text-sm font-semibold text-slate-700 hover:text-slate-950"
              >
                Reset all filters
              </button>
            )}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <select
              value={filters.location}
              onChange={(event) =>
                setFilters((previous) => ({
                  ...previous,
                  location: event.target.value,
                }))
              }
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            >
              <option value="all">All locations</option>

              {locations.map((location) => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
            </select>

            <select
              value={filters.propertyCategory}
              onChange={(event) => selectCategory(event.target.value)}
              className={`h-11 rounded-xl border px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-slate-100 ${
                filters.propertyCategory !== "all"
                  ? "border-slate-950 bg-slate-50 text-slate-950"
                  : "border-slate-200 bg-white text-slate-700"
              }`}
            >
              <option value="all" className="text-slate-950">
                All categories
              </option>

              {CATEGORIES.map((category) => (
                <option key={category.id} value={category.id} className="text-slate-950">
                  {category.id}
                </option>
              ))}
            </select>

            <select
              value={filters.propertyType}
              onChange={(event) =>
                setFilters((previous) => ({
                  ...previous,
                  propertyType: event.target.value,
                }))
              }
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-slate-400"
            >
              <option value="all">All property types</option>

              {propertyTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>

            <select
              value={filters.listingType}
              onChange={(event) =>
                setFilters((previous) => ({
                  ...previous,
                  listingType: event.target.value,
                }))
              }
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-slate-400"
            >
              <option value="all">All listing purposes</option>

              {LISTING_TYPES.map((listing) => (
                <option key={listing} value={listing}>
                  {listing}
                </option>
              ))}
            </select>

            <select
              value={filters.maxPrice}
              onChange={(event) =>
                setFilters((previous) => ({
                  ...previous,
                  maxPrice: event.target.value,
                }))
              }
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-slate-400"
            >
              <option value="all">Any maximum price</option>

              <option value="300">Up to $300</option>

              <option value="500">Up to $500</option>

              <option value="750">Up to $750</option>

              <option value="1000">Up to $1,000</option>

              <option value="1500">Up to $1,500</option>

              <option value="2000">Up to $2,000</option>

              <option value="5000">Up to $5,000</option>

              <option value="25000">Up to $25,000</option>

              <option value="50000">Up to $50,000</option>

              <option value="100000">Up to $100,000</option>

              <option value="250000">Up to $250,000</option>
            </select>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <select
              value={filters.bedrooms}
              onChange={(event) =>
                setFilters((previous) => ({
                  ...previous,
                  bedrooms: event.target.value,
                }))
              }
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-slate-400"
            >
              <option value="all">Any bedrooms</option>

              <option value="1">1 bedroom</option>

              <option value="2">2 bedrooms</option>

              <option value="3">3 bedrooms</option>

              <option value="4">4+ bedrooms</option>
            </select>

            <select
              value={filters.minSize}
              onChange={(event) =>
                setFilters((previous) => ({
                  ...previous,
                  minSize: event.target.value,
                }))
              }
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-slate-400"
            >
              <option value="all">Any minimum size</option>

              <option value="m2:100">100+ m²</option>

              <option value="m2:250">250+ m²</option>

              <option value="m2:500">500+ m²</option>

              <option value="m2:1000">1,000+ m²</option>

              <option value="ha:5">5+ ha</option>

              <option value="ha:10">10+ ha</option>

              <option value="ha:25">25+ ha</option>

              <option value="ha:50">50+ ha</option>
            </select>

            <select
              value={filters.landUse}
              onChange={(event) =>
                setFilters((previous) => ({
                  ...previous,
                  landUse: event.target.value,
                }))
              }
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-slate-400"
            >
              <option value="all">All land uses</option>

              {LAND_USES.map((landUse) => (
                <option key={landUse} value={landUse}>
                  {landUse}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() =>
                setFilters((previous) => ({
                  ...previous,
                  verifiedOnly: !previous.verifiedOnly,
                }))
              }
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                filters.verifiedOnly
                  ? "border-slate-950 bg-slate-950 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                TNP verified only
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                setFilters((previous) => ({
                  ...previous,
                  toursOnly: !previous.toursOnly,
                }))
              }
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                filters.toursOnly
                  ? "border-slate-950 bg-slate-950 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <Eye className="h-4 w-4" />
                360° tours only
              </span>
            </button>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* STATES                                                            */}
        {/* ---------------------------------------------------------------- */}

        {loading && (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({
              length: 6,
            }).map((_, index) => (
              <LoadingCard key={index} />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <div className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                <AlertTriangle className="h-5 w-5" />
              </div>

              <div>
                <h3 className="font-semibold text-red-900">Properties could not be loaded</h3>

                <p className="mt-2 text-sm leading-6 text-red-700">{error}</p>

                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="mt-4 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && properties.length === 0 && (
          <div className="rounded-3xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <Building2 className="h-7 w-7" />
            </div>

            <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
              Marketplace status
            </p>

            <h3 className="mt-2 text-xl font-bold text-slate-950">No available properties yet</h3>

            <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              TNP has no landlord listings currently marked as available. Your property categories
              and search tools are ready, and new listings will appear here when landlords publish
              them.
            </p>
          </div>
        )}

        {!loading && !error && properties.length > 0 && filteredProperties.length === 0 && (
          <div className="rounded-3xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
            <Search className="mx-auto h-9 w-9 text-slate-400" />

            <h3 className="mt-4 text-xl font-bold text-slate-950">No matching properties</h3>

            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
              Your current search and filters do not match any available TNP listings.
            </p>

            <button
              type="button"
              onClick={resetFilters}
              className="mt-5 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Reset search
            </button>
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* PROPERTY LISTINGS                                                 */}
        {/* ---------------------------------------------------------------- */}

        {!loading && !error && filteredProperties.length > 0 && (
          <section>
            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                  Available listings
                </p>

                <h2 className="mt-1 text-xl font-bold text-slate-950">
                  Properties matching your search
                </h2>
              </div>

              <p className="text-sm text-slate-500">
                Showing {filteredProperties.length} available{" "}
                {filteredProperties.length === 1 ? "listing" : "listings"}
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {filteredProperties.map((property) => {
                const id = propertyId(property);

                const images = propertyImages(property);

                const saved = favourites.has(id);

                const busy = favouriteLoading.has(id);

                return (
                  <article
                    key={id}
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="relative h-56 overflow-hidden bg-slate-100">
                      <PropertyImage src={images[0]} alt={propertyTitle(property)} />

                      <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                        {propertyVerified(property) && (
                          <span className="rounded-full bg-white/95 px-3 py-1.5 text-xs font-bold text-slate-800 shadow">
                            <span className="inline-flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              TNP Verified
                            </span>
                          </span>
                        )}

                        {has360Tour(property) && (
                          <span className="rounded-full bg-slate-950/90 px-3 py-1.5 text-xs font-bold text-white shadow">
                            <span className="inline-flex items-center gap-1">
                              <Eye className="h-3.5 w-3.5" />
                              360°
                            </span>
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void toggleFavourite(property)}
                        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow transition hover:bg-white disabled:opacity-50"
                        aria-label={saved ? "Remove saved property" : "Save property"}
                      >
                        {busy ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Heart
                            className={saved ? "h-5 w-5 fill-current text-red-500" : "h-5 w-5"}
                          />
                        )}
                      </button>

                      <div className="absolute bottom-4 left-4">
                        <span className="rounded-xl bg-slate-950/90 px-3 py-2 text-sm font-bold text-white">
                          {propertyPriceLabel(property)}
                        </span>
                      </div>
                    </div>

                    <div className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-lg font-bold text-slate-950">
                            {propertyTitle(property)}
                          </h3>

                          <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                            <MapPin className="h-4 w-4 shrink-0" />
                            {propertyLocation(property)}
                          </p>
                        </div>

                        <span className="shrink-0 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                          {propertyType(property)}
                        </span>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2 border-y border-slate-100 py-4">
                        {summaryItems(property)
                          .slice(0, 5)
                          .map((item) => (
                            <span
                              key={item}
                              className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-600"
                            >
                              {item}
                            </span>
                          ))}
                      </div>

                      <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                        <Tag className="h-3.5 w-3.5" />

                        {propertyListingType(property)}

                        <span>•</span>

                        {propertyCategory(property)}
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100">
                            <UserRound className="h-4 w-4 text-slate-600" />
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-slate-800">
                              {landlordName(property)}
                            </p>

                            <p className="flex items-center gap-1 text-[11px] text-slate-500">
                              {landlordVerified(property) ? (
                                <>
                                  <ShieldCheck className="h-3 w-3" />
                                  Verified landlord
                                </>
                              ) : (
                                "Landlord profile"
                              )}
                            </p>
                          </div>
                        </div>

                        {landlordTrustScore(property) !== undefined && (
                          <span className="shrink-0 rounded-lg bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700">
                            Trust {formatNumber(landlordTrustScore(property))}
                          </span>
                        )}
                      </div>

                      <div className="mt-5 flex gap-2">
                        <button
                          type="button"
                          onClick={() => openProperty(property)}
                          className="flex-1 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                        >
                          View details
                        </button>

                        {has360Tour(property) && (
                          <button
                            type="button"
                            onClick={() => void openTour(property)}
                            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <span className="inline-flex items-center gap-2">
                              <Eye className="h-4 w-4" />
                              360°
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </main>

      {/* ------------------------------------------------------------------ */}
      {/* PROPERTY DETAILS                                                   */}
      {/* ------------------------------------------------------------------ */}

      {selectedProperty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  TNP Property Details
                </p>

                <h2 className="mt-1 truncate text-xl font-bold text-slate-950">
                  {propertyTitle(selectedProperty)}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeProperty}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto">
              <div className="grid lg:grid-cols-2">
                <div>
                  <div className="relative aspect-[4/3] bg-slate-100">
                    <PropertyImage
                      src={selectedImages[selectedImageIndex] ?? selectedImages[0]}
                      alt={propertyTitle(selectedProperty)}
                    />

                    {selectedImages.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedImageIndex((index) =>
                              index === 0 ? selectedImages.length - 1 : index - 1,
                            )
                          }
                          className="absolute left-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 shadow"
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setSelectedImageIndex((index) =>
                              index === selectedImages.length - 1 ? 0 : index + 1,
                            )
                          }
                          className="absolute right-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 shadow"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </button>
                      </>
                    )}

                    <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                      {propertyVerified(selectedProperty) && (
                        <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-800 shadow">
                          <span className="inline-flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            TNP Verified
                          </span>
                        </span>
                      )}

                      {has360Tour(selectedProperty) && (
                        <span className="rounded-full bg-slate-950/90 px-3 py-1.5 text-xs font-bold text-white shadow">
                          360° Available
                        </span>
                      )}
                    </div>
                  </div>

                  {selectedImages.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto border-b border-slate-200 p-4 lg:border-b-0">
                      {selectedImages.map((image, index) => (
                        <button
                          key={`${image}-${index}`}
                          type="button"
                          onClick={() => setSelectedImageIndex(index)}
                          className={`h-16 w-20 shrink-0 overflow-hidden rounded-lg border-2 ${
                            selectedImageIndex === index ? "border-slate-950" : "border-transparent"
                          }`}
                        >
                          <img
                            src={image}
                            alt={`${propertyTitle(selectedProperty)} ${index + 1}`}
                            className="h-full w-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-6 lg:p-8">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-2xl font-bold text-slate-950">
                        {propertyPriceLabel(selectedProperty)}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        {propertyListingType(selectedProperty)} ·{" "}
                        {propertyCategory(selectedProperty)}
                      </p>

                      <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-500">
                        <MapPin className="h-4 w-4" />
                        {propertyLocation(selectedProperty)}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => void toggleFavourite(selectedProperty)}
                      className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200"
                    >
                      <Heart
                        className={
                          favourites.has(propertyId(selectedProperty))
                            ? "h-5 w-5 fill-current text-red-500"
                            : "h-5 w-5 text-slate-600"
                        }
                      />
                    </button>
                  </div>

                  <section className="mt-7">
                    <h3 className="font-semibold text-slate-950">Property Overview</h3>

                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <SpecBox
                        icon={<Building2 className="h-4 w-4" />}
                        label="Property type"
                        value={propertyType(selectedProperty)}
                      />

                      <SpecBox
                        icon={<Tag className="h-4 w-4" />}
                        label="Listing purpose"
                        value={propertyListingType(selectedProperty)}
                      />

                      <SpecBox
                        icon={<LandPlot className="h-4 w-4" />}
                        label="Category"
                        value={propertyCategory(selectedProperty)}
                      />

                      <SpecBox
                        icon={<MapPin className="h-4 w-4" />}
                        label="Location"
                        value={propertyLocation(selectedProperty)}
                      />
                    </div>
                  </section>

                  <section className="mt-7">
                    <h3 className="font-semibold text-slate-950">Property Specifications</h3>

                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {propertyBedrooms(selectedProperty) !== undefined && (
                        <SpecBox
                          icon={<BedDouble className="h-4 w-4" />}
                          label="Bedrooms"
                          value={formatNumber(propertyBedrooms(selectedProperty))}
                        />
                      )}

                      {propertyBathrooms(selectedProperty) !== undefined && (
                        <SpecBox
                          icon={<Bath className="h-4 w-4" />}
                          label="Bathrooms"
                          value={formatNumber(propertyBathrooms(selectedProperty))}
                        />
                      )}

                      {propertyRooms(selectedProperty) !== undefined && (
                        <SpecBox
                          icon={<Building2 className="h-4 w-4" />}
                          label="Rooms"
                          value={formatNumber(propertyRooms(selectedProperty))}
                        />
                      )}

                      {propertySize(selectedProperty) !== undefined && (
                        <SpecBox
                          icon={<Ruler className="h-4 w-4" />}
                          label="Size"
                          value={`${formatNumber(
                            propertySize(selectedProperty),
                          )} ${propertySizeUnit(selectedProperty)}`}
                        />
                      )}
                    </div>
                  </section>

                  {(normalize(propertyCategory(selectedProperty)) === "land" ||
                    normalize(propertyCategory(selectedProperty)) === "agricultural" ||
                    propertyLandUse(selectedProperty) ||
                    propertyZoning(selectedProperty) ||
                    propertyTitleStatus(selectedProperty)) && (
                    <section className="mt-7 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                      <div className="flex gap-3">
                        <Trees className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />

                        <div className="flex-1">
                          <h3 className="font-semibold text-slate-950">Land Information</h3>

                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            {propertyLandUse(selectedProperty) && (
                              <SpecBox
                                icon={<Trees className="h-4 w-4" />}
                                label="Land use"
                                value={propertyLandUse(selectedProperty)}
                              />
                            )}

                            {propertyZoning(selectedProperty) && (
                              <SpecBox
                                icon={<LandPlot className="h-4 w-4" />}
                                label="Zoning"
                                value={propertyZoning(selectedProperty)}
                              />
                            )}

                            {propertyTitleStatus(selectedProperty) && (
                              <SpecBox
                                icon={<FileCheck2 className="h-4 w-4" />}
                                label="Title status"
                                value={propertyTitleStatus(selectedProperty)}
                              />
                            )}

                            {propertyWaterAvailable(selectedProperty) && (
                              <SpecBox
                                icon={<Droplets className="h-4 w-4" />}
                                label="Infrastructure"
                                value="Water available"
                              />
                            )}

                            {propertyElectricityAvailable(selectedProperty) && (
                              <SpecBox
                                icon={<Zap className="h-4 w-4" />}
                                label="Infrastructure"
                                value="Electricity available"
                              />
                            )}

                            {propertyRoadAccess(selectedProperty) && (
                              <SpecBox
                                icon={<RouteIcon className="h-4 w-4" />}
                                label="Access"
                                value="Road access"
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    </section>
                  )}

                  <section className="mt-7">
                    <h3 className="font-semibold text-slate-950">About this property</h3>

                    <p className="mt-2 text-sm leading-7 text-slate-600">
                      {propertyDescription(selectedProperty)}
                    </p>

                    {propertyAmenities(selectedProperty).length > 0 && (
                      <div className="mt-5">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Amenities & features
                        </p>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {propertyAmenities(selectedProperty).map((amenity) => (
                            <span
                              key={amenity}
                              className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600"
                            >
                              {amenity}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </section>

                  <section className="mt-7 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                    <div className="flex gap-3">
                      <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-slate-700" />

                      <div className="flex-1">
                        <h3 className="font-semibold text-slate-950">TNP Trust Information</h3>

                        <div className="mt-4 space-y-3 text-sm">
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-slate-500">Listing verification</span>

                            <span className="font-semibold text-slate-800">
                              {propertyVerified(selectedProperty) ? "Verified" : "Not verified"}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-4">
                            <span className="text-slate-500">Landlord</span>

                            <span className="text-right font-semibold text-slate-800">
                              {landlordName(selectedProperty)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-4">
                            <span className="text-slate-500">Landlord verification</span>

                            <span className="font-semibold text-slate-800">
                              {landlordVerified(selectedProperty) ? "Verified" : "Not verified"}
                            </span>
                          </div>

                          {landlordTrustScore(selectedProperty) !== undefined && (
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-slate-500">Trust score</span>

                              <span className="font-semibold text-slate-800">
                                {formatNumber(landlordTrustScore(selectedProperty))}
                                /100
                              </span>
                            </div>
                          )}

                          {landlordRating(selectedProperty) !== undefined && (
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-slate-500">Landlord rating</span>

                              <span className="flex items-center gap-1 font-semibold text-slate-800">
                                <Star className="h-4 w-4 fill-current" />
                                {formatNumber(landlordRating(selectedProperty))}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </section>

                  <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <div className="flex gap-3">
                      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />

                      <div>
                        <p className="text-sm font-semibold text-amber-900">Payment safety</p>

                        <p className="mt-1 text-xs leading-5 text-amber-800">
                          Do not send money outside the TNP process. Verify the property and
                          landlord before making payments.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    {has360Tour(selectedProperty) && (
                      <button
                        type="button"
                        onClick={() => void openTour(selectedProperty)}
                        className="flex-1 rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <span className="inline-flex items-center justify-center gap-2">
                          <Eye className="h-4 w-4" />
                          View 360° Tour
                        </span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => applyToProperty(selectedProperty)}
                      className="flex-1 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                    >
                      Apply for this property
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 360° TOUR                                                          */}
      {/* ------------------------------------------------------------------ */}

      <Dialog open={Boolean(externalValue)} onOpenChange={open=>{if(!open)setExternalValue('');}}><DialogContent className="max-h-[90svh] max-w-5xl overflow-y-auto bg-white text-slate-950"><DialogTitle>360° property tour</DialogTitle><DialogDescription>View the property through its external tour provider.</DialogDescription><PropertyTourLink value={externalValue}/></DialogContent></Dialog>
      {tourOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/90 p-3 sm:p-5">
          <div className="flex h-full max-h-[95vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl bg-slate-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-white">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {tour?.title || "360° Property Tour"}
                </p>

                {tour?.description && (
                  <p className="truncate text-xs text-white/50">{tour.description}</p>
                )}
              </div>

              <button
                type="button"
                onClick={closeTour}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="relative flex min-h-0 flex-1">
              {tourLoading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950 text-white">
                  <div className="text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin" />

                    <p className="mt-3 text-sm">Loading 360° tour...</p>
                  </div>
                </div>
              )}

              {tourError && !tourLoading && (
                <div className="flex flex-1 items-center justify-center px-6 text-white">
                  <div className="max-w-md text-center">
                    <AlertTriangle className="mx-auto h-8 w-8 text-red-400" />

                    <h3 className="mt-4 text-lg font-semibold">360° tour unavailable</h3>

                    <p className="mt-2 text-sm leading-6 text-white/60">{tourError}</p>
                  </div>
                </div>
              )}

              {!tourLoading && !tourError && scenes.length > 0 && (
                <div className="relative flex min-h-0 flex-1 flex-col">
                  <div ref={viewerContainer} className="min-h-0 flex-1 bg-black" />

                  <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-2xl bg-slate-950/90 p-2 shadow-xl">
                    <button
                      type="button"
                      disabled={activeSceneIndex === 0}
                      onClick={() => setActiveSceneIndex((index) => Math.max(0, index - 1))}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-white disabled:opacity-30"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>

                    <div className="min-w-[150px] px-3 text-center">
                      <p className="truncate text-xs font-semibold text-white">
                        {scenes[activeSceneIndex]?.name}
                      </p>

                      <p className="mt-0.5 text-[10px] text-white/50">
                        {activeSceneIndex + 1} / {scenes.length}
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={activeSceneIndex === scenes.length - 1}
                      onClick={() =>
                        setActiveSceneIndex((index) => Math.min(scenes.length - 1, index + 1))
                      }
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-white disabled:opacity-30"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="absolute right-4 top-4 rounded-lg bg-slate-950/80 px-3 py-2 text-[11px] text-white/70">
                    <span className="inline-flex items-center gap-1.5">
                      <Maximize2 className="h-3.5 w-3.5" />
                      Drag to look · scroll to zoom
                    </span>
                  </div>

                  {scenes[activeSceneIndex]?.description && (
                    <div className="absolute left-4 top-4 max-w-sm rounded-xl bg-slate-950/80 px-4 py-3 text-xs leading-5 text-white/70">
                      {scenes[activeSceneIndex].description}
                    </div>
                  )}
                </div>
              )}
            </div>

            {!tourLoading && !tourError && scenes.length > 1 && (
              <div className="flex gap-2 overflow-x-auto border-t border-white/10 p-3">
                {scenes.map((scene, index) => (
                  <button
                    key={scene.id}
                    type="button"
                    onClick={() => setActiveSceneIndex(index)}
                    className={`shrink-0 rounded-lg border px-4 py-2 text-xs font-semibold ${
                      activeSceneIndex === index
                        ? "border-white bg-white text-slate-950"
                        : "border-white/10 text-white/60 hover:bg-white/5"
                    }`}
                  >
                    {scene.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
