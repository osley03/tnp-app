import { PropertyPhotoUpload } from "./PropertyPhotoUpload";
import { verifyPropertyImage } from "@/lib/property-image-url";
import { PropertyPhoto } from "@/modules/virtual-tours/components/PropertyPhoto";
import { externalTour } from "@/lib/external-tours";
import { tourIdFromUrl } from "@/lib/tour-links";
import { useEffect, useId, useRef, useState } from "react";
import { PropertyTourBuilder } from "@/modules/virtual-tours/components/PropertyTourBuilder";
import { createPortal } from "react-dom";
import type * as React from "react";
import {
  Eye,
  AlertTriangle,
  X,
  Loader2,
  Check,
  CheckCircle2,
  ShieldCheck,
  Droplets,
  Zap,
  Route as RoadIcon,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
export type PropertyForm = {
  title: string;
  suburb: string;
  city: string;

  property_category: string;
  property_type: string;
  listing_type: string;

  rent_usd: string;
  deposit_usd: string;
  price_usd: string;
  price_unit: string;

  beds: string;
  baths: string;
  rooms: string;

  size: string;
  size_unit: string;

  land_use: string;
  water_available: boolean;
  electricity_available: boolean;
  road_access: boolean;

  zoning: string;
  title_status: string;

  description: string;
  amenities: string;
  image_url: string;
  tour_url: string;

  verified: boolean;
  available: boolean;
};

export const EMPTY_FORM: PropertyForm = {
  title: "",
  suburb: "",
  city: "",

  property_category: "Residential",
  property_type: "Apartment",
  listing_type: "For Rent",

  rent_usd: "",
  deposit_usd: "",
  price_usd: "",
  price_unit: "total",

  beds: "",
  baths: "",
  rooms: "",

  size: "",
  size_unit: "m²",

  land_use: "",
  water_available: false,
  electricity_available: false,
  road_access: false,

  zoning: "",
  title_status: "",

  description: "",
  amenities: "",
  image_url: "",
  tour_url: "",

  verified: false,
  available: true,
};

export const PROPERTY_CATEGORIES = [
  "Residential",
  "Commercial",
  "Agricultural",
  "Land",
  "Industrial",
  "Other",
];

const PROPERTY_TYPES: Record<string, string[]> = {
  Residential: [
    "House",
    "Apartment",
    "Flat",
    "Townhouse",
    "Cottage",
    "Cluster",
    "Residential Stand",
  ],
  Commercial: [
    "Office",
    "Shop",
    "Retail Space",
    "Restaurant",
    "Commercial Stand",
    "Commercial Building",
  ],
  Agricultural: [
    "Farm",
    "Agricultural Land",
    "Ranch",
    "Smallholding",
    "Horticultural Land",
  ],
  Land: [
    "Residential Stand",
    "Commercial Stand",
    "Industrial Stand",
    "Vacant Land",
    "Agricultural Land",
  ],
  Industrial: [
    "Warehouse",
    "Factory",
    "Workshop",
    "Industrial Building",
    "Industrial Stand",
  ],
  Other: [
    "Mixed Use",
    "Guest House",
    "Lodge",
    "Institutional Property",
    "Other",
  ],
};

export const LISTING_TYPES = [
  "For Rent",
  "For Sale",
  "For Lease",
  "For Rent or Sale",
];

const SIZE_UNITS = ["m²", "ha", "acres", "km²"];

const PRICE_UNITS = [
  { value: "total", label: "Total price" },
  { value: "per_month", label: "Per month" },
  { value: "per_year", label: "Per year" },
  { value: "per_m2", label: "Per m²" },
  { value: "per_ha", label: "Per hectare" },
];

const TITLE_STATUSES = [
  "Verified",
  "Pending Verification",
  "Title Deed",
  "Agreement of Sale",
  "Certificate of Compliance",
  "Not Provided",
];

export function PropertyFormModal({
  form,
  setForm,
  editing,
  saving,
  errorMessage,
  onClose,
  onSubmit,
  ownerControl,
}: {
  form: PropertyForm;
  setForm: React.Dispatch<React.SetStateAction<PropertyForm>>;
  editing: boolean;
  saving: boolean;
  errorMessage: string;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
  ownerControl?: React.ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState("");
  const [tourState, setTourState] = useState({ busy: false, dirty: false });
  const [tourInputError, setTourInputError] = useState("");
  function closeForm() {
    if (saving || imageBusy || tourState.busy) return;
    if (
      tourState.dirty &&
      !window.confirm(
        "Close without saving your latest tour edits? Previously saved rooms remain in My tours.",
      )
    )
      return;
    onClose();
  }
  const closeRef = useRef({ saving, onClose: closeForm });
  closeRef.current = {
    saving: saving || imageBusy || tourState.busy,
    onClose: closeForm,
  };
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'button,input,select,textarea,a[href],[tabindex="0"]',
        ) ?? [],
      ).filter(
        (el) => !el.hasAttribute("disabled") && el.getClientRects().length > 0,
      );
    focusable()[0]?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !closeRef.current.saving) {
        event.preventDefault();
        closeRef.current.onClose();
      }
      if (event.key === "Tab") {
        const items = focusable(),
          first = items[0],
          last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    dialog?.addEventListener("keydown", keydown);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.removeEventListener("keydown", keydown);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  function update<K extends keyof PropertyForm>(
    key: K,
    value: PropertyForm[K],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  const defaultTypes = PROPERTY_TYPES["Other"] ?? ["Other"];
  const availableTypes = PROPERTY_TYPES[form.property_category] ?? defaultTypes;

  const needsRent =
    form.listing_type === "For Rent" ||
    form.listing_type === "For Lease" ||
    form.listing_type === "For Rent or Sale";

  const needsSale =
    form.listing_type === "For Sale" ||
    form.listing_type === "For Rent or Sale";

  const landRelated =
    form.property_category === "Land" ||
    form.property_category === "Agricultural";

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="tnp-property-overlay fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={editing ? "Edit property" : "Add property"}
        className="tnp-property-dialog tnp-property-form flex max-h-[calc(100dvh-1.5rem)] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white text-slate-950 shadow-2xl sm:max-h-[calc(100dvh-3rem)]"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
              Property Management
            </p>

            <h2 className="mt-1 text-xl font-bold text-slate-900">
              {editing ? "Edit Property" : "Add Property"}
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Add accurate listing information so TNP can present the property
              correctly.
            </p>
          </div>

          <button
            type="button"
            onClick={closeForm}
            aria-label="Close property form"
            disabled={saving || imageBusy || tourState.busy}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (imageBusy || tourState.busy || tourState.dirty) {
              event.preventDefault();
              return;
            }
            if (
              form.tour_url.trim() &&
              !tourIdFromUrl(form.tour_url.trim(), window.location.origin) &&
              !externalTour(form.tour_url)
            ) {
              event.preventDefault();
              setTourInputError(
                "Use a TNP tour URL, public Kuula share link or Matterport show link.",
              );
              return;
            }
            setTourInputError("");
            setImageError("");
            setImageBusy(true);
            try {
              await verifyPropertyImage(form.image_url);
              onSubmit(event);
            } catch (error) {
              setImageError(
                error instanceof Error
                  ? error.message
                  : "Choose a working exterior photo.",
              );
            } finally {
              setImageBusy(false);
            }
          }}
          className="tnp-property-form min-h-0 overflow-y-auto text-slate-950"
        >
          {tourInputError && (
            <p
              role="alert"
              className="m-4 rounded-lg bg-red-50 p-3 text-red-800"
            >
              {tourInputError}
            </p>
          )}
          <div className="space-y-7 p-6">
            {ownerControl}
            {errorMessage && (
              <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <AlertTriangle className="h-5 w-5 shrink-0" />

                <span>{errorMessage}</span>
              </div>
            )}

            {/* Basic information */}
            <section>
              <FormSectionTitle
                title="Basic Information"
                description="Tell tenants or buyers what this property is."
              />

              <div className="mt-4 grid gap-5 md:grid-cols-2">
                <Field
                  label="Property title"
                  required
                  value={form.title}
                  onChange={(value) => update("title", value)}
                  placeholder="e.g. Modern 3 Bedroom House"
                />

                <SelectField
                  label="Property category"
                  required
                  value={form.property_category}
                  onChange={(value) => {
                    const types =
                      PROPERTY_TYPES[value] ?? PROPERTY_TYPES["Other"] ?? [];

                    update("property_category", value);

                    setForm((current) => ({
                      ...current,
                      property_category: value,
                      property_type: types[0] ?? "Other",
                    }));
                  }}
                  options={PROPERTY_CATEGORIES}
                />

                <SelectField
                  label="Property type"
                  required
                  value={form.property_type}
                  onChange={(value) => update("property_type", value)}
                  options={availableTypes}
                />

                <SelectField
                  label="Listing purpose"
                  required
                  value={form.listing_type}
                  onChange={(value) => update("listing_type", value)}
                  options={LISTING_TYPES}
                />

                <Field
                  label="Suburb / Area"
                  required
                  value={form.suburb}
                  onChange={(value) => update("suburb", value)}
                  placeholder="Avondale"
                />

                <Field
                  label="City"
                  required
                  value={form.city}
                  onChange={(value) => update("city", value)}
                  placeholder="Harare"
                />
              </div>
            </section>

            {/* Pricing */}
            <section>
              <FormSectionTitle
                title="Pricing"
                description="Pricing fields adapt to the selected listing purpose."
              />

              <div className="mt-4 grid gap-5 md:grid-cols-2">
                {needsRent && (
                  <Field
                    label="Monthly rent (USD)"
                    required
                    type="number"
                    value={form.rent_usd}
                    onChange={(value) => update("rent_usd", value)}
                    placeholder="650"
                  />
                )}

                {needsRent && (
                  <Field
                    label="Deposit (USD)"
                    type="number"
                    value={form.deposit_usd}
                    onChange={(value) => update("deposit_usd", value)}
                    placeholder="1300"
                  />
                )}

                {needsSale && (
                  <Field
                    label="Sale price (USD)"
                    required
                    type="number"
                    value={form.price_usd}
                    onChange={(value) => update("price_usd", value)}
                    placeholder="120000"
                  />
                )}

                {needsSale && (
                  <SelectField
                    label="Sale price unit"
                    value={form.price_unit}
                    onChange={(value) => update("price_unit", value)}
                    options={PRICE_UNITS.map((item) => item.value)}
                    optionLabels={Object.fromEntries(
                      PRICE_UNITS.map((item) => [item.value, item.label]),
                    )}
                  />
                )}
              </div>
            </section>

            {/* Keep optional specifications out of the essential listing flow. */}
            <details
              className="rounded-2xl border border-slate-200 p-4"
              open={editing || landRelated}
            >
              <summary className="cursor-pointer font-semibold text-slate-900">
                Optional details: size, rooms and zoning
              </summary>
              <section className="mt-4">
                <FormSectionTitle
                  title="Property Specifications"
                  description="Only provide the specifications that make sense for this property."
                />

                <div className="mt-4 grid gap-5 md:grid-cols-3">
                  <Field
                    label="Property size"
                    type="number"
                    value={form.size}
                    onChange={(value) => update("size", value)}
                    placeholder="600"
                  />

                  <SelectField
                    label="Size unit"
                    value={form.size_unit}
                    onChange={(value) => update("size_unit", value)}
                    options={SIZE_UNITS}
                  />

                  <Field
                    label="Rooms"
                    type="number"
                    value={form.rooms}
                    onChange={(value) => update("rooms", value)}
                    placeholder="6"
                  />

                  <Field
                    label="Bedrooms"
                    type="number"
                    value={form.beds}
                    onChange={(value) => update("beds", value)}
                    placeholder="3"
                  />

                  <Field
                    label="Bathrooms"
                    type="number"
                    value={form.baths}
                    onChange={(value) => update("baths", value)}
                    placeholder="2"
                  />

                  <Field
                    label="Zoning"
                    value={form.zoning}
                    onChange={(value) => update("zoning", value)}
                    placeholder="Residential"
                  />
                </div>
              </section>
            </details>
            {/* Land information */}
            {landRelated && (
              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <FormSectionTitle
                  title="Land & Agricultural Information"
                  description="Important information for farms, agricultural land and other land-based listings."
                />

                <div className="mt-4 grid gap-5 md:grid-cols-2">
                  <Field
                    label="Land use"
                    value={form.land_use}
                    onChange={(value) => update("land_use", value)}
                    placeholder="Agriculture, Residential, Commercial..."
                  />

                  <SelectField
                    label="Title / ownership status"
                    value={form.title_status}
                    onChange={(value) => update("title_status", value)}
                    options={["", ...TITLE_STATUSES]}
                    optionLabels={{
                      "": "Select status",
                      ...Object.fromEntries(
                        TITLE_STATUSES.map((item) => [item, item]),
                      ),
                    }}
                  />
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <ToggleField
                    icon={Droplets}
                    title="Water available"
                    description="Borehole, municipal or other reliable water source."
                    enabled={form.water_available}
                    onToggle={() =>
                      update("water_available", !form.water_available)
                    }
                  />

                  <ToggleField
                    icon={Zap}
                    title="Electricity available"
                    description="Electricity connection or reliable supply."
                    enabled={form.electricity_available}
                    onToggle={() =>
                      update(
                        "electricity_available",
                        !form.electricity_available,
                      )
                    }
                  />

                  <ToggleField
                    icon={RoadIcon}
                    title="Road access"
                    description="Accessible road connection to the property."
                    enabled={form.road_access}
                    onToggle={() => update("road_access", !form.road_access)}
                  />
                </div>
              </section>
            )}

            {/* Image */}
            <section>
              <FormSectionTitle
                title="Property Media"
                description="Upload the outside view of your property or paste a direct image URL. The same photo appears on the listing and beside its tour."
              />

              <div className="mt-4">
                <PropertyPhotoUpload
                  onUploaded={(url) => {
                    update("image_url", url);
                    setImageError("");
                  }}
                  onBusyChange={setImageBusy}
                />
                <Field
                  label="Primary property image URL"
                  value={form.image_url}
                  onChange={(value) => update("image_url", value)}
                  placeholder="https://..."
                />

                {imageError && (
                  <p role="alert" className="mt-2 text-sm text-red-700">
                    {imageError}
                  </p>
                )}
                <div className="mt-4 max-w-md">
                  <PropertyPhoto
                    imageUrl={form.image_url}
                    title={form.title || "Property photo"}
                  />
                </div>
                {!ownerControl ? (
                  <PropertyTourBuilder
                    value={form.tour_url}
                    title={form.title}
                    onChange={(value) => update("tour_url", value)}
                    onState={setTourState}
                  />
                ) : (
                  <div className="mt-5">
                    <Field
                      label="360° tour URL (optional)"
                      value={form.tour_url}
                      onChange={(value) => update("tour_url", value)}
                      placeholder="TNP, Kuula share or Matterport show URL"
                    />
                    <p className="mt-2 text-xs text-slate-600">
                      Create a TNP room tour or paste a public Kuula /
                      Matterport share link. Do not paste iframe code.
                    </p>
                    <a
                      href="/app/landlord/tours"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex rounded-lg bg-slate-900 px-4 py-3 text-xs font-semibold text-white"
                    >
                      Create a 360° tour ↗
                    </a>
                  </div>
                )}
              </div>
            </section>

            {/* Description */}
            <section>
              <FormSectionTitle
                title="Description & Amenities"
                description="Give tenants or buyers enough information to make an informed decision."
              />

              <div className="mt-4 space-y-5">
                <div>
                  <label className="text-xs font-bold text-slate-700">
                    Description
                  </label>

                  <textarea
                    value={form.description}
                    onChange={(event) =>
                      update("description", event.target.value)
                    }
                    rows={5}
                    placeholder="Describe the property, location, security, utilities, access and important features..."
                    className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none focus:border-slate-400"
                  />

                  <p className="mt-1.5 text-[11px] text-slate-400">
                    Aim for at least 20 characters so the listing has enough
                    useful information.
                  </p>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700">
                    Amenities
                  </label>

                  <input
                    value={form.amenities}
                    onChange={(event) =>
                      update("amenities", event.target.value)
                    }
                    placeholder="WiFi, Parking, Borehole, Security, Garden"
                    className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm outline-none focus:border-slate-400"
                  />

                  <p className="mt-1.5 text-[11px] text-slate-400">
                    Separate amenities with commas.
                  </p>
                </div>
              </div>
            </section>

            {/* Listing status */}
            <section>
              <FormSectionTitle
                title="Listing Status"
                description="Control how the listing is presented in TNP."
              />

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <ToggleField
                  icon={Eye}
                  title="Listing available"
                  description="Allow tenants or buyers to see this property as available."
                  enabled={form.available}
                  onToggle={() => update("available", !form.available)}
                />

                {ownerControl ? (
                  <ToggleField
                    icon={ShieldCheck}
                    title="Verified listing"
                    description="Verification state for the property listing."
                    enabled={form.verified}
                    onToggle={() => update("verified", !form.verified)}
                  />
                ) : (
                  <p className="rounded-xl border border-slate-200 p-4 text-sm text-slate-600">
                    Listing verification is managed by TNP administrators.
                  </p>
                )}
              </div>
            </section>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
            <button
              type="button"
              onClick={closeForm}
              disabled={saving || imageBusy || tourState.busy}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={
                saving || imageBusy || tourState.busy || tourState.dirty
              }
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}

              {imageBusy
                ? "Checking photo..."
                : saving
                  ? "Saving..."
                  : editing
                    ? "Save Changes"
                    : "Create Property"}
            </button>
          </div>
          {(tourState.busy || tourState.dirty) && (
            <p
              role="status"
              className="bg-blue-50 px-6 pb-4 text-sm text-blue-900"
            >
              {tourState.busy
                ? "Wait for the room upload or tour save to finish."
                : "Save your tour progress or publish it before saving the property."}
            </p>
          )}
        </form>
      </div>
    </div>,
    document.body,
  );
}

/* -------------------------------------------------------------------------- */
/* Form Components                                                            */
/* -------------------------------------------------------------------------- */

function FormSectionTitle({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h3 className="font-bold text-slate-900">{title}</h3>

      <p className="mt-1 text-xs text-slate-500">{description}</p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  const fieldId = useId();
  return (
    <div>
      <label htmlFor={fieldId} className="text-xs font-bold text-slate-700">
        {label}

        {required && <span className="ml-1 text-red-500">*</span>}
      </label>

      <input
        id={fieldId}
        step={type === "number" ? "any" : undefined}
        type={type}
        required={required}
        min={type === "number" ? "0" : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  required = false,
  optionLabels,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  required?: boolean;
  optionLabels?: Record<string, string>;
}) {
  const fieldId = useId();
  return (
    <div>
      <label htmlFor={fieldId} className="text-xs font-bold text-slate-700">
        {label}

        {required && <span className="ml-1 text-red-500">*</span>}
      </label>

      <select
        id={fieldId}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {optionLabels?.[option] ?? option}
          </option>
        ))}
      </select>
    </div>
  );
}

function ToggleField({
  icon: Icon,
  title,
  description,
  enabled,
  onToggle,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <div
          className={`rounded-xl p-2 ${
            enabled
              ? "bg-emerald-50 text-emerald-600"
              : "bg-slate-100 text-slate-400"
          }`}
        >
          <Icon className="h-4 w-4" />
        </div>

        <div>
          <p className="text-sm font-bold text-slate-800">{title}</p>

          <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">
            {description}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onToggle}
        className={`shrink-0 rounded-full p-1 transition ${
          enabled
            ? "bg-emerald-100 text-emerald-600"
            : "bg-slate-100 text-slate-400"
        }`}
      >
        {enabled ? (
          <ToggleRight className="h-7 w-7" />
        ) : (
          <ToggleLeft className="h-7 w-7" />
        )}
      </button>
    </div>
  );
}
