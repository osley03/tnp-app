import { Home, Building2, Trees, LandPlot, Factory, type LucideIcon } from "lucide-react";

export type Category = "Residential" | "Commercial" | "Agricultural" | "Land" | "Industrial";

export type ListingType = "For Rent" | "For Sale" | "For Lease" | "For Rent or Sale";

export type Purpose =
  | "Personal Home"
  | "Family Home"
  | "Staff Accommodation"
  | "Office"
  | "Retail / Shop"
  | "Restaurant / Hospitality"
  | "Warehouse / Storage"
  | "Industrial Operations"
  | "Agriculture"
  | "Development"
  | "Investment"
  | "General Business";

export type BudgetFrequency = "Monthly" | "Annual" | "Once-off";

export type PropertyRecord = Record<string, unknown>;

export interface CategoryDefinition {
  id: Category;
  description: string;
  icon: LucideIcon;
  types: string[];
}

export interface MatchPreferences {
  purpose: Purpose | "";
  category: Category | "";
  propertyType: string;
  listingType: ListingType | "";

  location: string;

  budget: number;
  budgetFrequency: BudgetFrequency;

  minimumSize: number;
  bedrooms: number;
  bathrooms: number;
  occupants: number;

  moveInDate: string;
  leaseTerm: number;

  furnished: "Any" | "Furnished" | "Unfurnished";
  parking: "Any" | "Required";
  security: "Any" | "Required";
  electricity: "Any" | "Required";
  water: "Any" | "Required";
  internet: "Any" | "Required";
  accessibility: "Any" | "Required";

  landUse: string;
  preferredFeatures: string[];

  strictBudget: boolean;
  strictLocation: boolean;
  strictPropertyType: boolean;
  strictSize: boolean;
}

export interface MatchResult {
  property: PropertyRecord;
  score: number;
  level: "Excellent" | "Strong" | "Good" | "Partial";
  reasons: string[];
  warnings: string[];
  breakdown: {
    budget: number;
    location: number;
    category: number;
    type: number;
    size: number;
    features: number;
    availability: number;
    terms: number;
  };
}

/* =========================================================
   TAXONOMY
========================================================= */

export const CATEGORIES: CategoryDefinition[] = [
  {
    id: "Residential",
    description: "Homes and living spaces",
    icon: Home,
    types: ["House", "Apartment", "Flat", "Townhouse", "Duplex", "Cottage", "Cluster"],
  },
  {
    id: "Commercial",
    description: "Business and retail premises",
    icon: Building2,
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
    icon: Trees,
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
    icon: LandPlot,
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
    icon: Factory,
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

export const ALL_TYPES = Array.from(new Set(CATEGORIES.flatMap((category) => category.types)));

export const LISTING_TYPES: ListingType[] = ["For Rent", "For Sale", "For Lease", "For Rent or Sale"];

export const LAND_USES = [
  "Residential",
  "Commercial",
  "Agriculture",
  "Industrial",
  "Mixed Use",
  "Development",
];

export const PURPOSES: {
  id: Purpose;
  label: string;
  description: string;
  categories: Category[];
}[] = [
  {
    id: "Personal Home",
    label: "Personal Home",
    description: "Find a home for yourself",
    categories: ["Residential"],
  },
  {
    id: "Family Home",
    label: "Family Home",
    description: "Find suitable family accommodation",
    categories: ["Residential"],
  },
  {
    id: "Staff Accommodation",
    label: "Staff Accommodation",
    description: "Accommodation for employees or staff",
    categories: ["Residential"],
  },
  {
    id: "Office",
    label: "Office",
    description: "Office or professional workspace",
    categories: ["Commercial"],
  },
  {
    id: "Retail / Shop",
    label: "Retail / Shop",
    description: "Shop, retail or customer-facing premises",
    categories: ["Commercial"],
  },
  {
    id: "Restaurant / Hospitality",
    label: "Restaurant / Hospitality",
    description: "Restaurant or hospitality operation",
    categories: ["Commercial"],
  },
  {
    id: "Warehouse / Storage",
    label: "Warehouse / Storage",
    description: "Storage, distribution or logistics",
    categories: ["Industrial", "Commercial"],
  },
  {
    id: "Industrial Operations",
    label: "Industrial Operations",
    description: "Factory, workshop or industrial operation",
    categories: ["Industrial"],
  },
  {
    id: "Agriculture",
    label: "Agriculture",
    description: "Farming, horticulture or agricultural use",
    categories: ["Agricultural", "Land"],
  },
  {
    id: "Development",
    label: "Development",
    description: "Land for construction or development",
    categories: ["Land"],
  },
  {
    id: "Investment",
    label: "Investment",
    description: "Property investment opportunity",
    categories: ["Residential", "Commercial", "Agricultural", "Land", "Industrial"],
  },
  {
    id: "General Business",
    label: "General Business",
    description: "Business premises for another purpose",
    categories: ["Commercial", "Industrial"],
  },
];

export const FEATURE_OPTIONS = [
  "Parking",
  "Secure Parking",
  "24/7 Security",
  "Security Gate",
  "CCTV",
  "Electric Fence",
  "Borehole",
  "Municipal Water",
  "Reliable Electricity",
  "Solar Backup",
  "Generator",
  "Internet",
  "Fibre",
  "Air Conditioning",
  "Furnished",
  "Garden",
  "Pool",
  "Staff Quarters",
  "Loading Bay",
  "Large Access",
  "Reception",
  "Kitchen",
  "Warehouse Space",
  "Workshop Space",
  "Boundary Wall",
];

/* =========================================================
   DEFAULTS
========================================================= */

export const DEFAULT_PREFERENCES: MatchPreferences = {
  purpose: "",
  category: "",
  propertyType: "",
  listingType: "For Rent",

  location: "",

  budget: 0,
  budgetFrequency: "Monthly",

  minimumSize: 0,
  bedrooms: 0,
  bathrooms: 0,
  occupants: 0,

  moveInDate: "",
  leaseTerm: 12,

  furnished: "Any",
  parking: "Any",
  security: "Any",
  electricity: "Any",
  water: "Any",
  internet: "Any",
  accessibility: "Any",

  landUse: "",
  preferredFeatures: [],

  strictBudget: false,
  strictLocation: false,
  strictPropertyType: false,
  strictSize: false,
};

/* =========================================================
   UTILITY FUNCTIONS
========================================================= */

export function normalize(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export function firstValue(property: PropertyRecord, keys: string[]): unknown {
  for (const key of keys) {
    if (property[key] !== undefined && property[key] !== null && property[key] !== "") {
      return property[key];
    }
  }

  return undefined;
}

export function numberValue(property: PropertyRecord, keys: string[]): number {
  const value = firstValue(property, keys);

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const parsed = Number(
    String(value ?? "")
      .replace(/,/g, "")
      .replace(/[^\d.-]/g, ""),
  );

  return Number.isFinite(parsed) ? parsed : 0;
}

export function stringValue(property: PropertyRecord, keys: string[]): string {
  return String(firstValue(property, keys) ?? "");
}

export function booleanValue(property: PropertyRecord, keys: string[]): boolean {
  const value = firstValue(property, keys);

  if (typeof value === "boolean") return value;

  const normalized = normalize(value);

  return ["true", "yes", "1", "required", "available", "included"].includes(normalized);
}

export function propertyCategory(property: PropertyRecord): string {
  return stringValue(property, [
    "category",
    "property_category",
    "propertyCategory",
    "type_category",
  ]);
}

export function propertyType(property: PropertyRecord): string {
  return stringValue(property, ["property_type", "propertyType", "type", "property_type_name"]);
}

export function propertyTitle(property: PropertyRecord): string {
  return (
    stringValue(property, ["title", "name", "property_name", "propertyName"]) || "Untitled Property"
  );
}

export function propertyDescription(property: PropertyRecord): string {
  return stringValue(property, ["description", "details", "property_description"]);
}

export function propertyLocation(property: PropertyRecord): string {
  const address = [property["suburb"], property["city"]].filter(Boolean).join(", ");
  if (address) return address;
  return stringValue(property, [
    "location",
    "city",
    "suburb",
    "area",
    "address",
    "location_name",
    "property_location",
  ]);
}

export function propertyPrice(property: PropertyRecord): number {
  return numberValue(property, [
    "rent_usd",
    "price",
    "rent",
    "monthly_rent",
    "monthlyRent",
    "asking_price",
    "amount",
    "rental_price",
    "lease_price",
  ]);
}

export function propertyCurrency(property: PropertyRecord): string {
  return stringValue(property, ["currency", "price_currency", "currency_code"]) || "USD";
}

export function propertySize(property: PropertyRecord): number {
  return numberValue(property, [
    "size_sqm",
    "size",
    "area_size",
    "area",
    "square_meters",
    "sqm",
    "land_size",
    "property_size",
  ]);
}

export function propertyBedrooms(property: PropertyRecord): number {
  return numberValue(property, ["beds", "bedrooms", "bedroom_count", "num_bedrooms"]);
}

export function propertyBathrooms(property: PropertyRecord): number {
  return numberValue(property, ["baths", "bathrooms", "bathroom_count", "num_bathrooms"]);
}

export function propertyListingType(property: PropertyRecord): string {
  return stringValue(property, [
    "listing_type",
    "listingType",
    "transaction_type",
    "listing_status",
  ]);
}

export function propertyLandUse(property: PropertyRecord): string {
  return stringValue(property, ["land_use", "landUse", "permitted_use", "zoning", "zoning_type"]);
}

export function propertyFeatures(property: PropertyRecord): string[] {
  const raw = firstValue(property, ["features", "amenities", "facilities", "property_features"]);

  if (Array.isArray(raw)) {
    return raw.map(String);
  }

  if (typeof raw === "string") {
    return raw
      .split(/[,;|]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

export function propertyImage(property: PropertyRecord): string {
  const direct = stringValue(property, [
    "image_url",
    "imageUrl",
    "cover_image",
    "coverImage",
    "thumbnail",
  ]);

  if (direct) return direct;

  const images = firstValue(property, ["images", "photos", "image_urls"]);

  if (Array.isArray(images) && images.length > 0) {
    return String(images[0]);
  }

  return "";
}

export function formatMoney(value: number, currency = "USD"): string {
  if (!value) return "Price on request";

  return `${currency} ${value.toLocaleString(undefined, {
    maximumFractionDigits: 0,
  })}`;
}

export function containsText(source: string, search: string): boolean {
  if (!search.trim()) return true;

  return normalize(source).includes(normalize(search));
}

export function categoryForType(type: string): Category | "" {
  const found = CATEGORIES.find((category) =>
    category.types.some((item) => normalize(item) === normalize(type)),
  );

  return found?.id ?? "";
}

export function getMatchLevel(score: number): MatchResult["level"] {
  if (score >= 90) return "Excellent";
  if (score >= 80) return "Strong";
  if (score >= 70) return "Good";
  return "Partial";
}

export function scoreText(score: number): string {
  if (score >= 90) return "Excellent match";
  if (score >= 80) return "Strong match";
  if (score >= 70) return "Good match";
  return "Partial match";
}

/* =========================================================
   CATEGORY FEATURE HELPERS
========================================================= */

export function getRelevantFeatures(category: Category | "", purpose: Purpose | ""): string[] {
  if (
    category === "Residential" ||
    purpose === "Personal Home" ||
    purpose === "Family Home" ||
    purpose === "Staff Accommodation"
  ) {
    return [
      "Parking",
      "Secure Parking",
      "24/7 Security",
      "Security Gate",
      "CCTV",
      "Electric Fence",
      "Borehole",
      "Municipal Water",
      "Reliable Electricity",
      "Solar Backup",
      "Internet",
      "Fibre",
      "Air Conditioning",
      "Furnished",
      "Garden",
      "Pool",
      "Staff Quarters",
      "Boundary Wall",
    ];
  }

  if (category === "Commercial") {
    return [
      "Parking",
      "Secure Parking",
      "24/7 Security",
      "CCTV",
      "Electric Fence",
      "Reliable Electricity",
      "Solar Backup",
      "Generator",
      "Internet",
      "Fibre",
      "Air Conditioning",
      "Reception",
      "Kitchen",
      "Loading Bay",
      "Large Access",
    ];
  }

  if (category === "Industrial") {
    return [
      "Secure Parking",
      "24/7 Security",
      "CCTV",
      "Electric Fence",
      "Reliable Electricity",
      "Solar Backup",
      "Generator",
      "Internet",
      "Loading Bay",
      "Large Access",
      "Warehouse Space",
      "Workshop Space",
    ];
  }

  if (category === "Agricultural" || purpose === "Agriculture") {
    return [
      "Borehole",
      "Municipal Water",
      "Reliable Electricity",
      "Solar Backup",
      "Generator",
      "Security Gate",
      "Electric Fence",
      "Boundary Wall",
      "Staff Quarters",
      "Large Access",
    ];
  }

  if (category === "Land" || purpose === "Development") {
    return [
      "Borehole",
      "Municipal Water",
      "Reliable Electricity",
      "Solar Backup",
      "Large Access",
      "Security Gate",
      "Boundary Wall",
    ];
  }

  return FEATURE_OPTIONS;
}

/* =========================================================
   MATCHING ENGINE
========================================================= */

export function buildMatch(property: PropertyRecord, preferences: MatchPreferences): MatchResult | null {
  const category = propertyCategory(property) || categoryForType(propertyType(property));

  const type = propertyType(property);
  const listingType = propertyListingType(property);
  const location = propertyLocation(property);
  const rawPrice = propertyPrice(property);
  const price = preferences.budgetFrequency === "Annual" && preferences.listingType !== "For Sale" ? rawPrice * 12 : rawPrice;
  const size = propertySize(property);
  const bedrooms = propertyBedrooms(property);
  const bathrooms = propertyBathrooms(property);
  const landUse = propertyLandUse(property);
  const features = propertyFeatures(property);

  const reasons: string[] = [];
  const warnings: string[] = [];

  if (property["available"] !== true || property["verified"] !== true) return null;
  const purpose = PURPOSES.find(item => item.id === preferences.purpose);
  if (purpose && !purpose.categories.some(item => normalize(item) === normalize(category))) return null;
  const featureText = features.map(normalize).join(" ");
  const requiredFeatures: [string, string[]][] = [
    [preferences.parking, ["parking"]], [preferences.security, ["security", "cctv", "electric fence"]],
    [preferences.water, ["water", "borehole"]], [preferences.electricity, ["electric", "solar", "generator"]],
    [preferences.internet, ["internet", "fibre", "fiber", "wifi"]], [preferences.accessibility, ["accessible", "wheelchair", "step-free"]],
  ];
  if (requiredFeatures.some(([requirement, terms]) => requirement === "Required" && !terms.some(term => featureText.includes(term)))) return null;
  const furnished = typeof property["furnished"] === "boolean" ? property["furnished"] : /(?:^|[ ,])furnished(?:$|[ ,])/.test(featureText.replace(/unfurnished/g, ""));
  const unfurnished = typeof property["furnished"] === "boolean" ? !property["furnished"] : featureText.includes("unfurnished");
  if (preferences.furnished === "Furnished" && !furnished) return null;
  if (preferences.furnished === "Unfurnished" && !unfurnished) return null;
  const capacity = numberValue(property, ["max_occupants", "capacity", "occupancy"]);
  if (preferences.occupants > 0 && capacity > 0 && capacity < preferences.occupants) return null;
  const minTerm = numberValue(property, ["minimum_lease_months", "min_lease_months"]);
  const maxTerm = numberValue(property, ["maximum_lease_months", "max_lease_months"]);
  if (preferences.leaseTerm > 0 && ((minTerm > 0 && preferences.leaseTerm < minTerm) || (maxTerm > 0 && preferences.leaseTerm > maxTerm))) return null;
  if (preferences.leaseTerm > 0 && !minTerm && !maxTerm) warnings.push("Confirm the requested lease duration with the landlord");


  /* -----------------------------------------------
     HARD CONSTRAINTS
  ------------------------------------------------ */

  if (preferences.category && normalize(category) !== normalize(preferences.category)) {
    return null;
  }

  if (preferences.propertyType && normalize(type) !== normalize(preferences.propertyType)) {
    if (preferences.strictPropertyType) {
      return null;
    }
  }

  if (
    preferences.listingType &&
    listingType &&
    normalize(listingType) !== normalize(preferences.listingType)
  ) {
    const rentCompatible =
      preferences.listingType === "For Rent" &&
      ["for lease", "for rent or sale"].includes(normalize(listingType));

    const leaseCompatible =
      preferences.listingType === "For Lease" &&
      ["for rent", "for rent or sale"].includes(normalize(listingType));

    if (!rentCompatible && !leaseCompatible) {
      return null;
    }
  }

  if (
    preferences.strictLocation &&
    preferences.location &&
    !containsText(location, preferences.location)
  ) {
    return null;
  }

  if (preferences.strictBudget && preferences.budget > 0 && (price <= 0 || price > preferences.budget)) {
    return null;
  }

  if (
    preferences.strictSize &&
    preferences.minimumSize > 0 &&
    size < preferences.minimumSize
  ) {
    return null;
  }

  /* -----------------------------------------------
     WEIGHTED SCORE
  ------------------------------------------------ */

  let budgetScore = 0;
  let locationScore = 0;
  let categoryScore = 0;
  let typeScore = 0;
  let sizeScore = 0;
  let featureScore = 0;
  let availabilityScore = 0;
  let termsScore = 0;

  /* CATEGORY — 15 */

  if (preferences.category) {
    if (normalize(category) === normalize(preferences.category)) {
      categoryScore = 15;
      reasons.push(`Matches your ${preferences.category.toLowerCase()} requirement`);
    } else if (!category) {
      categoryScore = 7;
      warnings.push("Property category is not clearly specified");
    }
  } else {
    categoryScore = 15;
  }

  /* PROPERTY TYPE — 12 */

  if (preferences.propertyType) {
    if (normalize(type) === normalize(preferences.propertyType)) {
      typeScore = 12;
      reasons.push(`Matches your ${type.toLowerCase()} preference`);
    } else if (type) {
      typeScore = 5;
      warnings.push(`Property type is ${type}, not ${preferences.propertyType}`);
    } else {
      typeScore = 6;
    }
  } else {
    typeScore = 12;
  }

  /* BUDGET — 20 */

  if (preferences.budget > 0 && price > 0) {
    if (price <= preferences.budget) {
      budgetScore = 20;
      reasons.push("Within your stated budget");
    } else {
      const difference = ((price - preferences.budget) / preferences.budget) * 100;

      if (difference <= 10) {
        budgetScore = 15;
        warnings.push("Slightly above your budget");
      } else if (difference <= 20) {
        budgetScore = 8;
        warnings.push("Above your stated budget");
      } else {
        budgetScore = 2;
        warnings.push("Significantly above your stated budget");
      }
    }
  } else {
    budgetScore = preferences.budget > 0 ? 0 : 20;
    if (preferences.budget > 0) warnings.push("Listing price is not confirmed");
  }

  /* LOCATION — 15 */

  if (preferences.location) {
    if (containsText(location, preferences.location)) {
      locationScore = 15;
      reasons.push("Located in your preferred area");
    } else {
      locationScore = 5;
      warnings.push("Location does not exactly match your preferred area");
    }
  } else {
    locationScore = 15;
  }

  /* SIZE — 10 */

  if (preferences.minimumSize > 0 && size > 0) {
    if (size >= preferences.minimumSize) {
      sizeScore = 10;
      reasons.push(`Meets your minimum size of ${preferences.minimumSize} m²`);
    } else {
      const ratio = size / preferences.minimumSize;

      if (ratio >= 0.8) {
        sizeScore = 6;
        warnings.push("Slightly below your preferred size");
      } else {
        sizeScore = 2;
        warnings.push("Below your preferred size");
      }
    }
  } else {
    sizeScore = preferences.minimumSize > 0 ? 0 : 10;
    if (preferences.minimumSize > 0) warnings.push("Property size is not confirmed");
  }

  /* BEDROOMS */

  if (preferences.bedrooms > 0 && category === "Residential") {
    if (bedrooms >= preferences.bedrooms) {
      reasons.push(
        `Has at least ${preferences.bedrooms} bedroom${preferences.bedrooms > 1 ? "s" : ""}`,
      );
    } else {
      warnings.push("Fewer bedrooms than requested");
      sizeScore = Math.max(0, sizeScore - 2);
    }
  }

  /* BATHROOMS */

  if (preferences.bathrooms > 0 && category === "Residential") {
    if (bathrooms >= preferences.bathrooms) {
      reasons.push(`Meets your ${preferences.bathrooms}-bathroom requirement`);
    } else {
      warnings.push("Fewer bathrooms than requested");
      sizeScore = Math.max(0, sizeScore - 2);
    }
  }

  /* FEATURES — 13 */

  const normalizedPropertyFeatures = features.map(normalize);

  if (preferences.preferredFeatures.length > 0) {
    const matchedFeatures = preferences.preferredFeatures.filter((feature) =>
      normalizedPropertyFeatures.some(
        (propertyFeature) =>
          propertyFeature.includes(normalize(feature)) ||
          normalize(feature).includes(propertyFeature),
      ),
    );

    featureScore = Math.round((matchedFeatures.length / preferences.preferredFeatures.length) * 13);

    if (matchedFeatures.length > 0) {
      reasons.push(
        `${matchedFeatures.length} of ${preferences.preferredFeatures.length} preferred features matched`,
      );
    }

    if (matchedFeatures.length < preferences.preferredFeatures.length) {
      warnings.push(
        `${preferences.preferredFeatures.length - matchedFeatures.length} preferred feature${
          preferences.preferredFeatures.length - matchedFeatures.length > 1 ? "s" : ""
        } not confirmed`,
      );
    }
  } else {
    featureScore = 13;
  }

  /* REQUIRED FEATURES */

  if (
    preferences.parking === "Required" &&
    !normalizedPropertyFeatures.some((item) => item.includes("parking"))
  ) {
    warnings.push("Parking is not confirmed");
    featureScore = Math.max(0, featureScore - 2);
  }

  if (
    preferences.security === "Required" &&
    !normalizedPropertyFeatures.some((item) => item.includes("security"))
  ) {
    warnings.push("Security is not confirmed");
    featureScore = Math.max(0, featureScore - 2);
  }

  if (
    preferences.electricity === "Required" &&
    !normalizedPropertyFeatures.some(
      (item) => item.includes("electric") || item.includes("generator") || item.includes("solar"),
    )
  ) {
    warnings.push("Reliable electricity is not confirmed");
  }

  if (
    preferences.water === "Required" &&
    !normalizedPropertyFeatures.some((item) => item.includes("water") || item.includes("borehole"))
  ) {
    warnings.push("Water supply is not confirmed");
  }

  if (
    preferences.internet === "Required" &&
    !normalizedPropertyFeatures.some((item) => item.includes("internet") || item.includes("fibre"))
  ) {
    warnings.push("Internet connectivity is not confirmed");
  }

  /* LAND USE — 5 */

  if (preferences.landUse) {
    if (normalize(landUse).includes(normalize(preferences.landUse))) {
      termsScore += 2;
      reasons.push(`Land use aligns with ${preferences.landUse.toLowerCase()} use`);
    } else if (category === "Land" || category === "Agricultural") {
      warnings.push("Permitted land use should be verified");
    }
  } else {
    termsScore += 2;
  }

  /* LISTING / TERMS — 5 */

  if (listingType) {
    if (preferences.listingType && normalize(listingType) === normalize(preferences.listingType)) {
      termsScore += 3;
      reasons.push(
        `Available under your preferred ${preferences.listingType.toLowerCase()} arrangement`,
      );
    } else {
      termsScore += 3;
    }
  } else {
    termsScore += 3;
  }

  /* AVAILABILITY — 5 */

  const availability = stringValue(property, [
    "availability",
    "availability_status",
    "status",
    "property_status",
  ]);

  if (property["available"] === true || ["available", "active"].includes(normalize(availability))) {
    availabilityScore = 5;
    reasons.push("Property appears to be currently available");
  } else if (availability) {
    availabilityScore = 2;
  } else {
    availabilityScore = 3;
  }

  /* MOVE-IN DATE */

  if (preferences.moveInDate) {
    const propertyAvailableDate = stringValue(property, [
      "available_from",
      "availableFrom",
      "move_in_date",
      "availability_date",
    ]);

    if (propertyAvailableDate) {
      const requested = new Date(preferences.moveInDate).getTime();

      const available = new Date(propertyAvailableDate).getTime();

      if (Number.isFinite(requested) && Number.isFinite(available)) {
        if (available <= requested) {
          reasons.push("Availability aligns with your requested move-in date");
        } else {
          return null;
        }
      }
    } else {
      warnings.push("Confirm availability for your requested move-in date");
    }
  }

  /* OCCUPANCY */

  if (preferences.occupants > 0 && category === "Residential") {
    const capacity = numberValue(property, [
      "occupancy",
      "capacity",
      "max_occupants",
      "maximum_occupants",
    ]);

    if (capacity > 0 && capacity >= preferences.occupants) {
      reasons.push(`Suitable for approximately ${preferences.occupants} occupants`);
    }
  }

  const total =
    budgetScore +
    locationScore +
    categoryScore +
    typeScore +
    sizeScore +
    featureScore +
    availabilityScore +
    termsScore;

  const score = Math.max(0, Math.min(100, Math.round(total / 95 * 100)));

  return {
    property,
    score,
    level: getMatchLevel(score),
    reasons,
    warnings,
    breakdown: {
      budget: budgetScore,
      location: locationScore,
      category: categoryScore,
      type: typeScore,
      size: sizeScore,
      features: featureScore,
      availability: availabilityScore,
      terms: termsScore,
    },
  };
}

