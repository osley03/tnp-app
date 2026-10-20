import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Accessibility,
  Check,
  CheckCircle2,
  Eye,
  Focus,
  Keyboard,
  Monitor,
  MousePointer2,
  RotateCcw,
  Save,
  ShieldCheck,
  Smartphone,
  Sun,
  Type,
  Volume2,
  Zap,
} from "lucide-react";

type AccessibilitySettings = {
  enhancedContrast: boolean;
  reducedMotion: boolean;
  largerText: boolean;
  keyboardFocus: boolean;
  readableContent: boolean;
};

const DEFAULT_SETTINGS: AccessibilitySettings = {
  enhancedContrast: false,
  reducedMotion: false,
  largerText: false,
  keyboardFocus: true,
  readableContent: false,
};

const STORAGE_KEY = "tnp-admin-accessibility-settings";

export const Route = createFileRoute("/_authenticated/app/admin/accessibility")({
  component: RouteComponent,
});

function RouteComponent() {
  const [settings, setSettings] = useState<AccessibilitySettings>(DEFAULT_SETTINGS);

  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);

      if (stored) {
        setSettings({
          ...DEFAULT_SETTINGS,
          ...JSON.parse(stored),
        });
      }
    } catch {
      // Keep default settings if stored preferences are invalid.
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("tnp-reduced-motion", settings.reducedMotion);

    document.documentElement.classList.toggle("tnp-large-text", settings.largerText);

    document.documentElement.classList.toggle("tnp-enhanced-contrast", settings.enhancedContrast);

    document.documentElement.classList.toggle("tnp-readable-content", settings.readableContent);

    document.documentElement.classList.toggle("tnp-keyboard-focus", settings.keyboardFocus);
  }, [settings]);

  const enabledCount = useMemo(() => Object.values(settings).filter(Boolean).length, [settings]);

  const readinessScore = Math.round((enabledCount / Object.keys(settings).length) * 100);

  const updateSetting = (key: keyof AccessibilitySettings, value: boolean) => {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));

    setSaved(false);
  };

  const saveSettings = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      setSaved(true);

      window.setTimeout(() => {
        setSaved(false);
      }, 2500);
    } catch {
      setSaved(false);
    }
  };

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS));
    } catch {
      // Ignore storage errors.
    }

    setSaved(false);
  };

  return (
    <div className="tnp-module tnp-module-dark min-h-screen bg-[#090a0d] text-white">
      <div className="border-b border-white/10 bg-[#0d0f13]">
        <div className="mx-auto max-w-[1500px] px-6 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-400">
                <ShieldCheck className="h-4 w-4" />
                Trust & Governance
              </div>

              <h1 className="text-2xl font-bold tracking-tight">Accessibility Center</h1>

              <p className="mt-1 text-sm text-gray-400">
                Configure accessibility preferences and review TNP platform browser preferences.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
                Accessibility Active
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-[1500px] space-y-6 px-6 py-6">
        {/* Readiness */}
        <section className="grid gap-4 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
          <div className="rounded-2xl border border-white/10 bg-[#111318] p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-gray-500">
                  Personal Preferences
                </p>

                <div className="mt-3 flex items-end gap-2">
                  <span className="text-4xl font-bold">{readinessScore}</span>
                  <span className="mb-1 text-sm text-gray-500">/ 100</span>
                </div>

                <p className="mt-2 text-sm text-gray-400">
                  {enabledCount} of {Object.keys(settings).length} accessibility controls enabled.
                </p>
              </div>

              <div className="rounded-xl bg-amber-400/10 p-3 text-amber-400">
                <Accessibility className="h-6 w-6" />
              </div>
            </div>

            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-amber-400 transition-all"
                style={{ width: `${readinessScore}%` }}
              />
            </div>
          </div>

          <MetricCard
            icon={<Eye className="h-5 w-5" />}
            label="Perceivable"
            value="Available"
            description="Visual accessibility controls"
          />

          <MetricCard
            icon={<Keyboard className="h-5 w-5" />}
            label="Operable"
            value="Available"
            description="Keyboard and navigation support"
          />

          <MetricCard
            icon={<Monitor className="h-5 w-5" />}
            label="Adaptable"
            value="Available"
            description="Responsive user experience"
          />
        </section>

        {/* Controls */}
        <section className="rounded-2xl border border-white/10 bg-[#111318]">
          <div className="border-b border-white/10 px-6 py-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Accessibility Controls</h2>
                <p className="mt-1 text-sm text-gray-400">
                  Configure preferences for this browser when you need additional accessibility
                  support.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={resetSettings}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-gray-300 transition hover:bg-white/10 hover:text-white"
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset
                </button>

                <button
                  type="button"
                  onClick={saveSettings}
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-amber-300"
                >
                  {saved ? (
                    <>
                      <Check className="h-4 w-4" />
                      Saved
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save Preferences
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-6 md:grid-cols-2">
            <AccessibilityToggle
              icon={<Eye className="h-5 w-5" />}
              title="Enhanced Contrast"
              description="Increase visual separation between text, surfaces and interface controls."
              enabled={settings.enhancedContrast}
              onChange={(value) => updateSetting("enhancedContrast", value)}
            />

            <AccessibilityToggle
              icon={<Zap className="h-5 w-5" />}
              title="Reduced Motion"
              description="Reduce non-essential animations and transitions across the interface."
              enabled={settings.reducedMotion}
              onChange={(value) => updateSetting("reducedMotion", value)}
            />

            <AccessibilityToggle
              icon={<Type className="h-5 w-5" />}
              title="Larger Text"
              description="Increase interface text size for improved readability."
              enabled={settings.largerText}
              onChange={(value) => updateSetting("largerText", value)}
            />

            <AccessibilityToggle
              icon={<Focus className="h-5 w-5" />}
              title="Keyboard Focus"
              description="Keep clear keyboard focus indicators for interactive controls."
              enabled={settings.keyboardFocus}
              onChange={(value) => updateSetting("keyboardFocus", value)}
            />

            <AccessibilityToggle
              icon={<Volume2 className="h-5 w-5" />}
              title="Readable Content Mode"
              description="Prioritize readable spacing, content structure and simplified presentation."
              enabled={settings.readableContent}
              onChange={(value) => updateSetting("readableContent", value)}
            />
          </div>
        </section>

        {/* Accessibility checks */}
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-[#111318] p-6">
            <SectionHeader
              icon={<ShieldCheck className="h-5 w-5" />}
              title="Accessibility Checks"
              description="Core accessibility areas monitored by TNP."
            />

            <div className="mt-5 space-y-3">
              <CheckRow
                title="Keyboard Navigation"
                description="Interactive elements can be reached without a mouse."
              />

              <CheckRow
                title="Focus Visibility"
                description="Focused controls remain visually identifiable."
              />

              <CheckRow
                title="Responsive Layout"
                description="Interfaces adapt across desktop, tablet and mobile screens."
              />

              <CheckRow
                title="Readable Typography"
                description="Content uses clear hierarchy and adequate spacing."
              />

              <CheckRow
                title="Semantic Controls"
                description="Buttons and interactive controls communicate their purpose."
              />
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#111318] p-6">
            <SectionHeader
              icon={<Keyboard className="h-5 w-5" />}
              title="Keyboard Guide"
              description="Recommended navigation shortcuts."
            />

            <div className="mt-5 space-y-3">
              <Shortcut keys={["Tab"]} text="Move to the next interactive element" />
              <Shortcut keys={["Shift", "Tab"]} text="Move to the previous interactive element" />
              <Shortcut keys={["Enter"]} text="Activate the focused control" />
              <Shortcut keys={["Esc"]} text="Close open panels or dialogs" />
              <Shortcut keys={["Space"]} text="Toggle focused controls where supported" />
            </div>
          </div>
        </section>

        {/* Platform access */}
        <section className="grid gap-6 md:grid-cols-3">
          <AccessCard
            icon={<Smartphone className="h-5 w-5" />}
            title="Mobile Accessibility"
            description="Responsive layouts support users accessing TNP from mobile devices."
          />

          <AccessCard
            icon={<MousePointer2 className="h-5 w-5" />}
            title="Pointer Accessibility"
            description="Controls maintain clear spacing and interactive targets."
          />

          <AccessCard
            icon={<Monitor className="h-5 w-5" />}
            title="Desktop Accessibility"
            description="Dashboard interfaces are structured for keyboard and desktop navigation."
          />
        </section>

        {/* USSD fallback */}
        <section className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.04] p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-300">
                <Smartphone className="h-5 w-5" />
                USSD Accessibility Fallback
              </div>

              <h3 className="mt-2 text-lg font-semibold text-white">
                Keep essential TNP services accessible without the web.
              </h3>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">
                Users who cannot reliably access the web interface can use the TNP USSD fallback for
                essential account, property and support workflows.
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 px-5 py-4">
              <p className="text-xs uppercase tracking-wider text-gray-500">Service</p>
              <p className="mt-1 text-lg font-bold text-amber-300">TNP USSD</p>
              <p className="mt-1 text-xs text-gray-500">Fallback channel</p>
            </div>
          </div>
        </section>

        {/* Status */}
        <section className="rounded-2xl border border-white/10 bg-[#111318] p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                <h2 className="font-semibold">Accessibility Service Status</h2>
              </div>

              <p className="mt-2 text-sm text-gray-400">
                Accessibility preferences are stored locally for this browser and applied to the
                current TNP interface.
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm font-medium text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Operational
            </div>
          </div>
        </section>
      </main>

      <style>{`
        html.tnp-reduced-motion *,
        html.tnp-reduced-motion *::before,
        html.tnp-reduced-motion *::after {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
          scroll-behavior: auto !important;
        }

        html.tnp-large-text {
          font-size: 110%;
        }

        html.tnp-enhanced-contrast {
          filter: contrast(1.08);
        }

        html.tnp-readable-content body {
          letter-spacing: 0.01em;
          line-height: 1.65;
        }

        html.tnp-keyboard-focus *:focus-visible {
          outline: 2px solid rgb(251 191 36);
          outline-offset: 3px;
        }
      `}</style>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  description,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#111318] p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-gray-500">{label}</p>

          <p className="mt-3 text-xl font-bold text-white">{value}</p>

          <p className="mt-1 text-xs text-gray-500">{description}</p>
        </div>

        <div className="rounded-xl bg-amber-400/10 p-3 text-amber-400">{icon}</div>
      </div>
    </div>
  );
}

function AccessibilityToggle({
  icon,
  title,
  description,
  enabled,
  onChange,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  enabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0d0f13] p-5 transition hover:border-white/20">
      <div className="flex items-start gap-4">
        <div className="rounded-xl bg-amber-400/10 p-3 text-amber-400">{icon}</div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold text-white">{title}</h3>
              <p className="mt-1 text-sm leading-6 text-gray-400">{description}</p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              onClick={() => onChange(!enabled)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                enabled ? "bg-amber-400" : "bg-white/15"
              }`}
            >
              <span
                className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${
                  enabled ? "left-6" : "left-1"
                }`}
              />
            </button>
          </div>

          <div className="mt-4 flex items-center gap-2 text-xs font-medium">
            <span
              className={`h-2 w-2 rounded-full ${enabled ? "bg-emerald-400" : "bg-gray-600"}`}
            />

            <span className={enabled ? "text-emerald-300" : "text-gray-500"}>
              {enabled ? "Enabled" : "Disabled"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({
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
      <div className="rounded-xl bg-amber-400/10 p-2.5 text-amber-400">{icon}</div>

      <div>
        <h2 className="font-semibold text-white">{title}</h2>
        <p className="mt-1 text-sm text-gray-400">{description}</p>
      </div>
    </div>
  );
}

function CheckRow({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-4">
      <div className="mt-0.5 rounded-full bg-emerald-400/10 p-1.5 text-emerald-400">
        <Check className="h-4 w-4" />
      </div>

      <div>
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="mt-1 text-xs leading-5 text-gray-500">{description}</p>
      </div>
    </div>
  );
}

function Shortcut({ keys, text }: { keys: string[]; text: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-white/5 bg-white/[0.02] p-3">
      <div className="flex items-center gap-2">
        {keys.map((key) => (
          <kbd
            key={key}
            className="rounded-lg border border-white/10 bg-[#090a0d] px-2.5 py-1.5 text-xs font-semibold text-gray-300"
          >
            {key}
          </kbd>
        ))}
      </div>

      <span className="text-right text-xs text-gray-500">{text}</span>
    </div>
  );
}

function AccessCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#111318] p-5">
      <div className="mb-4 inline-flex rounded-xl bg-amber-400/10 p-3 text-amber-400">{icon}</div>

      <h3 className="font-semibold text-white">{title}</h3>

      <p className="mt-2 text-sm leading-6 text-gray-400">{description}</p>
    </div>
  );
}
