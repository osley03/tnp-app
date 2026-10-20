import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Building2,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  FileText,
  Flag,
  Hash,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app/tenant/report-scam")({
  component: TenantReportScamPage,
});

type Property = {
  id: string;
  owner_id: string | null;
  title: string | null;
  suburb: string | null;
  city: string | null;
  address?: string | null;
  property_type: string | null;
  image_url: string | null;
  verified: boolean | null;
  available: boolean | null;
};

type FormState = {
  caseType: string;
  title: string;
  description: string;
  priority: string;
  location: string;
  address: string;
  scammerName: string;
  scammerPhone: string;
  scammerEmail: string;
  identificationNumber: string;
  amountLost: string;
  paymentMethod: string;
  paymentReference: string;
  propertyId: string;
  scammerId: string;
  evidence: string;
};

const initialForm: FormState = {
  caseType: "rental_scam",
  title: "",
  description: "",
  priority: "medium",
  location: "",
  address: "",
  scammerName: "",
  scammerPhone: "",
  scammerEmail: "",
  identificationNumber: "",
  amountLost: "0",
  paymentMethod: "",
  paymentReference: "",
  propertyId: "",
  scammerId: "",
  evidence: "",
};

const CASE_TYPES = [
  { value: "rental_scam", label: "Rental scam" },
  { value: "fake_listing", label: "Fake property listing" },
  { value: "payment_fraud", label: "Payment fraud" },
  { value: "identity_fraud", label: "Identity fraud" },
  { value: "deposit_fraud", label: "Deposit fraud" },
  { value: "impersonation", label: "Landlord impersonation" },
  { value: "property_access", label: "Property access problem" },
  { value: "other", label: "Other suspicious activity" },
];

const PAYMENT_METHODS = [
  "Bank transfer",
  "Mobile money",
  "Cash",
  "EcoCash",
  "Innbucks",
  "PayPal",
  "Card",
  "Other",
];

const PRIORITIES = [
  {
    value: "low",
    label: "Low",
    description: "Suspicious activity with limited immediate impact.",
  },
  {
    value: "medium",
    label: "Medium",
    description: "Potential fraud requiring TNP review.",
  },
  {
    value: "high",
    label: "High",
    description: "Financial loss or significant risk is involved.",
  },
  {
    value: "critical",
    label: "Critical",
    description: "Urgent financial, safety or identity concern.",
  },
];

function TenantReportScamPage() {
  const navigate = useNavigate();

  const [userId, setUserId] = useState("");
  const [properties, setProperties] = useState<Property[]>([]);
  const [form, setForm] = useState<FormState>(initialForm);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [caseReference, setCaseReference] = useState("");

  const [currentStep, setCurrentStep] = useState(1);

  const updateField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    setError("");
  };

  const loadData = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          throw userError;
        }

        if (!user) {
          await navigate({ to: "/auth" });
          return;
        }

        setUserId(user.id);

        const { data, error: propertyError } = await supabase
          .from("properties" as never)
          .select("id,owner_id,title,suburb,city,property_type,image_url,verified,available")
          .eq("available", true)
          .order("created_at", { ascending: false });

        if (propertyError) {
          throw propertyError;
        }

        setProperties((data ?? []) as Property[]);
      } catch (err) {
        console.error("Report scam loading error:", err);

        setError(
          err instanceof Error ? err.message : "Unable to load the scam reporting workspace.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [navigate],
  );

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const selectedProperty = useMemo(
    () => properties.find((property) => property.id === form.propertyId) ?? null,
    [properties, form.propertyId],
  );

  const descriptionLength = form.description.trim().length;

  const stepOneValid =
    form.caseType.trim() !== "" && form.title.trim().length >= 5 && descriptionLength >= 30;

  const stepTwoValid = form.location.trim().length >= 2 || form.address.trim().length >= 2;

  const canSubmit = userId && stepOneValid && stepTwoValid && !submitting && !success;

  const submitReport = async () => {
    setError("");

    if (!userId) {
      setError("Your session has expired. Please sign in again.");
      return;
    }

    if (!stepOneValid) {
      setCurrentStep(1);
      setError(
        "Complete the incident details. Your description must contain at least 30 characters.",
      );
      return;
    }

    if (!stepTwoValid) {
      setCurrentStep(2);
      setError("Provide the location or address associated with the incident.");
      return;
    }

    const amount = Number(form.amountLost || 0);

    if (!Number.isFinite(amount) || amount < 0) {
      setCurrentStep(3);
      setError("Enter a valid amount lost.");
      return;
    }

    setSubmitting(true);

    try {
      const evidence = form.evidence
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean);

      const { data, error: rpcError } = await supabase.rpc(
        "submit_scam_case" as never,
        {
          p_case_type: form.caseType,
          p_title: form.title.trim(),
          p_description: form.description.trim(),
          p_priority: form.priority,
          p_location: form.location.trim() || null,
          p_address: form.address.trim() || null,
          p_scammer_name: form.scammerName.trim() || null,
          p_scammer_phone: form.scammerPhone.trim() || null,
          p_scammer_email: form.scammerEmail.trim() || null,
          p_identification_number: form.identificationNumber.trim() || null,
          p_amount_lost_usd: amount,
          p_payment_method: form.paymentMethod.trim() || null,
          p_payment_reference: form.paymentReference.trim() || null,
          p_property_id: form.propertyId || null,
          p_scammer_id: form.scammerId.trim() || null,
          p_evidence: evidence,
        } as never,
      );

      if (rpcError) {
        throw rpcError;
      }

      const createdCase = (Array.isArray(data) ? data[0] : data) as {
        reference?: string;
        case_reference?: string;
        id?: string;
      } | null;

      const generatedReference =
        createdCase?.reference ||
        createdCase?.case_reference ||
        createdCase?.id ||
        null;
      if (!generatedReference) throw new Error("The server did not return a saved report reference. Please check your case records before retrying.");

      setCaseReference(String(generatedReference));
      setSuccess(true);
      setCurrentStep(1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error("Scam submission error:", err);

      setError(
        err instanceof Error ? err.message : "Unable to submit the scam report. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setForm(initialForm);
    setSuccess(false);
    setCaseReference("");
    setError("");
    setCurrentStep(1);
  };

  if (loading) {
    return (
      <div className="tnp-module tnp-module-light min-h-screen bg-slate-50">
        <div className="flex min-h-screen">
          <main className="flex-1">
            <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
              <div className="h-28 animate-pulse rounded-2xl bg-white shadow-sm" />
              <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
                <div className="h-[650px] animate-pulse rounded-2xl bg-white shadow-sm" />
                <div className="h-72 animate-pulse rounded-2xl bg-white shadow-sm" />
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="tnp-module tnp-module-light min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-400">
                <Link
                  to="/app/tenant"
                  className="inline-flex items-center gap-1.5 transition hover:text-slate-900"
                >
                  <ArrowLeft className="size-3.5" />
                  Tenant Dashboard
                </Link>

                <ChevronRight className="size-3.5" />

                <span className="text-slate-600">Safety & Reporting</span>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                  <ShieldAlert className="size-5" />
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                      Report a Scam
                    </h1>

                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                      <ShieldCheck className="size-3.5" />
                      TNP Safety Center
                    </span>
                  </div>

                  <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                    Securely report suspicious rental activity, financial fraud, impersonation or
                    other property-related scams to the TNP investigation team.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void loadData(true)}
                disabled={refreshing || submitting}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
                Refresh
              </button>

              <Link
                to="/app/tenant"
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
              >
                <ArrowLeft className="size-4" />
                <span className="hidden sm:inline">Back to Tenant</span>
                <span className="sm:hidden">Back</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        {success ? (
          <SuccessState caseReference={caseReference} onNewReport={resetForm} />
        ) : (
          <>
            {error && (
              <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <AlertTriangle className="mt-0.5 size-5 shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold">Unable to continue</p>
                  <p className="mt-1 leading-6">{error}</p>
                </div>

                <button
                  type="button"
                  onClick={() => setError("")}
                  className="rounded-lg p-1 hover:bg-red-100"
                  aria-label="Dismiss error"
                >
                  <X className="size-4" />
                </button>
              </div>
            )}

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-5 py-5 sm:px-7">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                        Secure incident submission
                      </p>
                      <h2 className="mt-1 text-xl font-bold text-slate-950">
                        Tell TNP what happened
                      </h2>
                    </div>

                    <div className="text-right">
                      <p className="text-xs font-medium text-slate-400">Step {currentStep} of 4</p>
                      <p className="mt-1 text-xs font-semibold text-slate-600">
                        {currentStep === 1
                          ? "Incident"
                          : currentStep === 2
                            ? "Location"
                            : currentStep === 3
                              ? "People & payment"
                              : "Evidence & submit"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex gap-2">
                    {[1, 2, 3, 4].map((step) => (
                      <div
                        key={step}
                        className={`h-1.5 flex-1 rounded-full ${
                          step <= currentStep ? "bg-slate-950" : "bg-slate-100"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <div className="p-5 sm:p-7">
                  {currentStep === 1 && (
                    <IncidentStep
                      form={form}
                      updateField={updateField}
                      onNext={() => setCurrentStep(2)}
                    />
                  )}

                  {currentStep === 2 && (
                    <LocationStep
                      form={form}
                      updateField={updateField}
                      properties={properties}
                      selectedProperty={selectedProperty}
                      onBack={() => setCurrentStep(1)}
                      onNext={() => setCurrentStep(3)}
                    />
                  )}

                  {currentStep === 3 && (
                    <PeoplePaymentStep
                      form={form}
                      updateField={updateField}
                      onBack={() => setCurrentStep(2)}
                      onNext={() => setCurrentStep(4)}
                    />
                  )}

                  {currentStep === 4 && (
                    <EvidenceStep
                      form={form}
                      updateField={updateField}
                      submitting={submitting}
                      canSubmit={Boolean(canSubmit)}
                      onBack={() => setCurrentStep(3)}
                      onSubmit={() => void submitReport()}
                    />
                  )}
                </div>
              </section>

              <aside className="space-y-5">
                <SafetyPanel />

                <PriorityPanel
                  priority={form.priority}
                  onChange={(value) => updateField("priority", value)}
                />

                {selectedProperty && <SelectedPropertyCard property={selectedProperty} />}
              </aside>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function IncidentStep({
  form,
  updateField,
  onNext,
}: {
  form: FormState;
  updateField: <K extends keyof FormState>(field: K, value: FormState[K]) => void;
  onNext: () => void;
}) {
  const valid =
    form.caseType && form.title.trim().length >= 5 && form.description.trim().length >= 30;

  return (
    <div className="space-y-6">
      <SectionIntro
        icon={<Flag className="size-5" />}
        title="Incident details"
        description="Start with the facts. Avoid assumptions and provide information TNP can independently investigate."
      />

      <Field label="What type of incident are you reporting?" required>
        <select
          value={form.caseType}
          onChange={(e) => updateField("caseType", e.target.value)}
          className={inputClass}
        >
          {CASE_TYPES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Report title" required>
        <input
          value={form.title}
          onChange={(e) => updateField("title", e.target.value)}
          maxLength={160}
          placeholder="Example: Paid deposit for property that does not exist"
          className={inputClass}
        />

        <CharacterCount value={form.title} max={160} />
      </Field>

      <Field
        label="What happened?"
        required
        hint="Minimum 30 characters. Include dates, promises made, what you were asked to do and what happened afterwards."
      >
        <textarea
          value={form.description}
          onChange={(e) => updateField("description", e.target.value)}
          maxLength={5000}
          rows={8}
          placeholder="Describe the incident clearly and chronologically..."
          className={textareaClass}
        />

        <CharacterCount value={form.description} max={5000} />
      </Field>

      <StepActions primaryLabel="Continue" disabled={!valid} onNext={onNext} />
    </div>
  );
}

function LocationStep({
  form,
  updateField,
  properties,
  selectedProperty,
  onBack,
  onNext,
}: {
  form: FormState;
  updateField: <K extends keyof FormState>(field: K, value: FormState[K]) => void;
  properties: Property[];
  selectedProperty: Property | null;
  onBack: () => void;
  onNext: () => void;
}) {
  const valid = form.location.trim().length >= 2 || form.address.trim().length >= 2;

  return (
    <div className="space-y-6">
      <SectionIntro
        icon={<MapPin className="size-5" />}
        title="Where did it happen?"
        description="Link the report to a TNP property when possible. This helps investigators establish the relevant property relationship."
      />

      <Field
        label="Related TNP property"
        hint="Optional. Select the property involved if it appears in TNP."
      >
        <select
          value={form.propertyId}
          onChange={(e) => updateField("propertyId", e.target.value)}
          className={inputClass}
        >
          <option value="">No TNP property selected</option>

          {properties.map((property) => (
            <option key={property.id} value={property.id}>
              {property.title || "Untitled property"} —{" "}
              {[property.suburb, property.city].filter(Boolean).join(", ")}
            </option>
          ))}
        </select>
      </Field>

      {selectedProperty && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-start gap-3">
            <BadgeCheck className="mt-0.5 size-5 text-emerald-600" />

            <div>
              <p className="text-sm font-bold text-emerald-900">Property linked</p>

              <p className="mt-1 text-xs leading-5 text-emerald-700">
                {selectedProperty.title || "Selected property"}
              </p>

              <p className="text-xs text-emerald-600">
                {[selectedProperty.suburb, selectedProperty.city].filter(Boolean).join(", ") ||
                  "Location not available"}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Location / area" required>
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-3 top-3.5 size-4 text-slate-400" />
            <input
              value={form.location}
              onChange={(e) => updateField("location", e.target.value)}
              placeholder="e.g. Avondale, Harare"
              className={`${inputClass} pl-10`}
            />
          </div>
        </Field>

        <Field label="Specific address" hint="If known.">
          <input
            value={form.address}
            onChange={(e) => updateField("address", e.target.value)}
            placeholder="Street, house number, stand number..."
            className={inputClass}
          />
        </Field>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-start gap-3">
          <Search className="mt-0.5 size-4 text-slate-500" />

          <p className="text-xs leading-5 text-slate-600">
            You do not need to know the exact address to report a scam. Provide the most accurate
            location you have and explain uncertainty in the incident description.
          </p>
        </div>
      </div>

      <StepActions primaryLabel="Continue" disabled={!valid} onBack={onBack} onNext={onNext} />
    </div>
  );
}

function PeoplePaymentStep({
  form,
  updateField,
  onBack,
  onNext,
}: {
  form: FormState;
  updateField: <K extends keyof FormState>(field: K, value: FormState[K]) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-7">
      <SectionIntro
        icon={<UserRound className="size-5" />}
        title="People and financial details"
        description="Provide whatever information you have. Unknown information can be left blank."
      />

      <div>
        <SectionHeading icon={<UserRound className="size-4" />} title="Person involved" />

        <div className="mt-4 grid gap-5 md:grid-cols-2">
          <Field label="Name">
            <input
              value={form.scammerName}
              onChange={(e) => updateField("scammerName", e.target.value)}
              placeholder="Full name or name used"
              className={inputClass}
            />
          </Field>

          <Field label="Phone number">
            <input
              value={form.scammerPhone}
              onChange={(e) => updateField("scammerPhone", e.target.value)}
              placeholder="+263..."
              className={inputClass}
            />
          </Field>

          <Field label="Email address">
            <input
              type="email"
              value={form.scammerEmail}
              onChange={(e) => updateField("scammerEmail", e.target.value)}
              placeholder="example@email.com"
              className={inputClass}
            />
          </Field>

          <Field label="Identification number">
            <input
              value={form.identificationNumber}
              onChange={(e) => updateField("identificationNumber", e.target.value)}
              placeholder="National ID or other identifier"
              className={inputClass}
            />
          </Field>
        </div>
      </div>

      <div className="border-t border-slate-100 pt-6">
        <SectionHeading icon={<CircleDollarSign className="size-4" />} title="Financial impact" />

        <div className="mt-4 grid gap-5 md:grid-cols-2">
          <Field label="Amount lost (USD)">
            <div className="relative">
              <span className="absolute left-3 top-3 text-sm font-bold text-slate-400">$</span>

              <input
                type="number"
                min="0"
                step="0.01"
                value={form.amountLost}
                onChange={(e) => updateField("amountLost", e.target.value)}
                className={`${inputClass} pl-8`}
              />
            </div>
          </Field>

          <Field label="Payment method">
            <select
              value={form.paymentMethod}
              onChange={(e) => updateField("paymentMethod", e.target.value)}
              className={inputClass}
            >
              <option value="">Select payment method</option>

              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Payment reference">
            <div className="relative">
              <Hash className="pointer-events-none absolute left-3 top-3.5 size-4 text-slate-400" />

              <input
                value={form.paymentReference}
                onChange={(e) => updateField("paymentReference", e.target.value)}
                placeholder="Transaction/reference number"
                className={`${inputClass} pl-10`}
              />
            </div>
          </Field>
        </div>
      </div>

      <StepActions primaryLabel="Continue" onBack={onBack} onNext={onNext} />
    </div>
  );
}

function EvidenceStep({
  form,
  updateField,
  submitting,
  canSubmit,
  onBack,
  onSubmit,
}: {
  form: FormState;
  updateField: <K extends keyof FormState>(field: K, value: FormState[K]) => void;
  submitting: boolean;
  canSubmit: boolean;
  onBack: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="space-y-6">
      <SectionIntro
        icon={<FileText className="size-5" />}
        title="Evidence and submission"
        description="Add references to evidence that can help TNP investigate the incident."
      />

      <Field
        label="Evidence / supporting references"
        hint="Add one item per line. Examples: transaction reference, screenshot description, listing URL, phone number, email, chat reference."
      >
        <textarea
          value={form.evidence}
          onChange={(e) => updateField("evidence", e.target.value)}
          rows={9}
          maxLength={6000}
          placeholder={`Transaction receipt #12345
Listing reference / URL
WhatsApp conversation
Screenshot showing payment request`}
          className={textareaClass}
        />

        <CharacterCount value={form.evidence} max={6000} />
      </Field>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />

          <div>
            <p className="text-sm font-bold text-amber-900">Before you submit</p>

            <ul className="mt-2 space-y-1.5 text-xs leading-5 text-amber-800">
              <li>• Make sure the information is accurate to the best of your knowledge.</li>
              <li>• Do not knowingly submit false or malicious allegations.</li>
              <li>• TNP may request additional information during investigation.</li>
              <li>• Do not include passwords, banking PINs or authentication codes.</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 size-5 text-slate-600" />

          <div>
            <p className="text-sm font-bold text-slate-800">Secure TNP submission</p>

            <p className="mt-1 text-xs leading-5 text-slate-500">
              Your account identity is attached to this report by the TNP security layer. You cannot
              submit a report on behalf of another authenticated user.
            </p>
          </div>
        </div>
      </div>

      <StepActions
        primaryLabel={submitting ? "Submitting..." : "Submit Scam Report"}
        primaryIcon={
          submitting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ShieldAlert className="size-4" />
          )
        }
        disabled={!canSubmit}
        onBack={onBack}
        onNext={onSubmit}
      />
    </div>
  );
}

function SafetyPanel() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
          <ShieldCheck className="size-5" />
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">TNP Safety</p>
          <h3 className="font-bold text-slate-950">Report securely</h3>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <SafetyItem
          icon={<BadgeCheck className="size-4" />}
          title="Identity attached"
          text="Your authenticated TNP account is recorded as the reporter."
        />

        <SafetyItem
          icon={<Search className="size-4" />}
          title="Investigation ready"
          text="Provide specific facts and references to make investigation easier."
        />

        <SafetyItem
          icon={<ShieldCheck className="size-4" />}
          title="Trust workflow"
          text="Reports enter the TNP trust and safety process for review."
        />
      </div>
    </div>
  );
}

function PriorityPanel({
  priority,
  onChange,
}: {
  priority: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
        Incident priority
      </p>

      <h3 className="mt-1 font-bold text-slate-950">How urgent is this?</h3>

      <div className="mt-4 space-y-2">
        {PRIORITIES.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            className={`w-full rounded-xl border p-3 text-left transition ${
              priority === item.value
                ? "border-slate-900 bg-slate-950 text-white"
                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            <p className="text-sm font-bold">{item.label}</p>

            <p
              className={`mt-1 text-[11px] leading-4 ${
                priority === item.value ? "text-slate-300" : "text-slate-500"
              }`}
            >
              {item.description}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

function SelectedPropertyCard({ property }: { property: Property }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {property.image_url ? (
        <img
          src={property.image_url}
          alt={property.title || "Selected property"}
          className="h-36 w-full object-cover"
        />
      ) : (
        <div className="flex h-36 items-center justify-center bg-slate-100 text-slate-400">
          <Building2 className="size-8" />
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
              Linked property
            </p>

            <h3 className="mt-1 line-clamp-2 font-bold text-slate-950">
              {property.title || "Untitled property"}
            </h3>
          </div>

          {property.verified && <BadgeCheck className="size-5 shrink-0 text-emerald-600" />}
        </div>

        <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
          <MapPin className="size-3.5" />
          {[property.suburb, property.city].filter(Boolean).join(", ") || "Location unavailable"}
        </p>
      </div>
    </div>
  );
}

function SuccessState({
  caseReference,
  onNewReport,
}: {
  caseReference: string;
  onNewReport: () => void;
}) {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="overflow-hidden rounded-3xl border border-emerald-200 bg-white shadow-sm">
        <div className="border-b border-emerald-100 bg-emerald-50 px-6 py-8 text-center sm:px-10">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle2 className="size-9" />
          </div>

          <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">
            Report received
          </p>

          <h2 className="mt-2 text-3xl font-bold tracking-tight text-emerald-950">
            Scam report submitted
          </h2>

          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-emerald-800">
            Your report has been securely received by TNP and can now enter the trust and safety
            investigation workflow.
          </p>
        </div>

        <div className="p-6 sm:p-10">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400">
              Case reference
            </p>

            <p className="mt-2 break-all font-mono text-xl font-bold text-slate-950">
              {caseReference}
            </p>

            <p className="mt-2 text-xs text-slate-500">
              Keep this reference for future communication with TNP.
            </p>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <SuccessInfo title="Received" text="Your submission is recorded." />

            <SuccessInfo title="Review" text="TNP can investigate the information." />

            <SuccessInfo title="Protected" text="Reporter identity comes from your account." />
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              to="/app/tenant"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-bold text-white hover:bg-slate-800"
            >
              <ArrowLeft className="size-4" />
              Back to Tenant Dashboard
            </Link>

            <button
              type="button"
              onClick={onNewReport}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              Submit another report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SuccessInfo({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-bold text-slate-900">{title}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{text}</p>
    </div>
  );
}

function SectionIntro({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
        {icon}
      </div>

      <div>
        <h3 className="text-lg font-bold text-slate-950">{title}</h3>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
      </div>
    </div>
  );
}

function SectionHeading({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
      <span className="text-slate-500">{icon}</span>
      {title}
    </div>
  );
}

function Field({
  label,
  required = false,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-800">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>

      {children}

      {hint && <p className="mt-1.5 text-xs leading-5 text-slate-400">{hint}</p>}
    </div>
  );
}

function CharacterCount({ value, max }: { value: string; max: number }) {
  return (
    <div className="mt-1 text-right text-[11px] text-slate-400">
      {value.length}/{max}
    </div>
  );
}

function StepActions({
  primaryLabel,
  primaryIcon,
  disabled = false,
  onBack,
  onNext,
}: {
  primaryLabel: string;
  primaryIcon?: React.ReactNode;
  disabled?: boolean;
  onBack?: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="size-4" />
          Back
        </button>
      ) : (
        <div />
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={onNext}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {primaryIcon}
        {primaryLabel}
        {!primaryIcon && <ChevronRight className="size-4" />}
      </button>
    </div>
  );
}

function SafetyItem({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 text-slate-500">{icon}</div>

      <div>
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">{text}</p>
      </div>
    </div>
  );
}

const inputClass =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100";

const textareaClass =
  "w-full resize-none rounded-xl border border-slate-200 bg-white p-3.5 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100";
