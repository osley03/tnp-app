import { resolveRole } from '@/lib/roles';
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { roleHome, type AppRole } from "@/lib/session";
import authBg from "@/assets/auth-bg.jpg";

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { mode?: "signup" | "signin" | undefined } => ({
    mode: search["mode"] === "signup" || search["mode"] === "signin" ? search["mode"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign up or sign in — TNP Tenant Network Profile" },
      {
        name: "description",
        content:
          "Create your TNP account as a tenant or landlord. Role-based access to verified property listings, landlord and tenant trust profiles, and lease requests.",
      },
      { property: "og:title", content: "Sign up or sign in — TNP" },
      {
        property: "og:description",
        content: "Role-based access for tenants, landlords and administrators on TNP.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PublicAuthPage,
});

const roles: { key: AppRole; label: string }[] = [
  { key: "tenant", label: "Tenant" },
  { key: "landlord", label: "Landlord" },
];

function PublicAuthPage() {
  const { mode } = Route.useSearch();
  return <AuthPage initialMode={mode ?? "signup"} />;
}

export function AuthPage({ adminOnly = false, initialMode = "signup" }: { adminOnly?: boolean; initialMode?: "signup" | "signin" }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signup" | "signin">(adminOnly ? "signin" : initialMode);
  const [role, setRole] = useState<AppRole>("tenant");
  const [fullName, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setMode(adminOnly ? "signin" : initialMode);
    setMsg(null);
  }, [adminOnly, initialMode]);

  async function go() {
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      setMsg("Unable to get the logged-in user.");
      return;
    }

    const uid = data.user.id;

    const { data: roleRows, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", uid);

    if (roleError) {
      setMsg("Unable to determine your account role.");
      return;
    }

    const role = resolveRole(roleRows ?? []);
    if (adminOnly && role !== "admin") {
      const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
      setMsg(signOutError ? "Administrator access required. Please sign out before continuing." : "This account does not have administrator access. Use the tenant or landlord sign-in page.");
      return;
    }
    if (!role) { setMsg('Your account has no assigned role. Contact TNP support.'); return; }

    navigate({ to: roleHome(role) });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);

    try {
      if (!adminOnly && mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth`,
            data: {
              full_name: fullName.trim(),
              phone: phone.trim(),
              role: role === "landlord" ? "landlord" : "tenant",
            },
          },
        });

        if (error) throw error;

        setPassword("");
        setEmail("");

        if (!data.session) {
          setMsg("Account created. Check your email to confirm, then sign in.");
          setMode("signin");
          return;
        }

        await go();

        setName("");
        setPhone("");
        setEmail("");
        setPassword("");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          setPassword("");
          throw error;
        }

        await go();

        setEmail("");
        setPassword("");
      }
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="relative min-h-screen overflow-hidden bg-ink text-[13px] text-fg">
      {/* Full-screen cinematic 3D housing background */}
      <img
        src={authBg}
        alt=""
        width={1536}
        height={1024}
        className="pointer-events-none absolute inset-0 size-full object-cover"
      />
      <div className="pointer-events-none absolute inset-0 bg-ink/45" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ink/60 via-transparent to-ink/70" />

      <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-10">
        {/* Brand */}
        <Link to="/" className="mb-6 flex items-center gap-2">
          <div className="grid size-8 place-items-center rounded-lg bg-terra/20 ring-1 ring-terra/40 backdrop-blur">
            <span className="font-display text-sm font-bold text-terra">T</span>
          </div>
          <div>
            <h1 className="font-display text-[13px] leading-none font-semibold tracking-tight">
              TNP · Tenant Network Profile
            </h1>
            <p className="mt-1 font-mono text-[9px] tracking-wider text-fg/60">
              MUTUAL TRUST LEDGER · HARARE
            </p>
          </div>
        </Link>

        {/* Centered glass card */}
        <div className="w-full max-w-[380px] rounded-3xl bg-ink/55 p-6 shadow-2xl ring-1 ring-fg/10 backdrop-blur-xl">
          <p className="text-center font-display text-xl font-bold tracking-tight">
            {adminOnly ? "Administrator sign in" : mode === "signup" ? "Create your account" : "Welcome back"}
          </p>
          <p className="mt-1 text-center text-[11px] text-fg/60">
            {adminOnly ? "Sign in with your assigned TNP administrator account." : mode === "signup"
              ? "Pick your role — your dashboard is built for it."
              : "Sign in to your TNP dashboard."}
          </p>

          {/* Mode toggle */}
          {!adminOnly && (mode === "signup" ? (
            <button
              type="button"
              onClick={() => {
                setMode("signin");
                setMsg(null);
                setEmail("");
                setPassword("");
                setName("");
                setPhone("");
              }}
              className="mt-5 w-full rounded-xl bg-fg/5 px-3 py-2 font-mono text-[10px] text-fg/70 ring-1 ring-fg/10 hover:text-fg"
            >
              Already have an account? <span className="text-terra">SIGN IN</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setMsg(null);
                setEmail("");
                setPassword("");
              }}
              className="mt-5 w-full rounded-xl bg-fg/5 px-3 py-2 font-mono text-[10px] text-fg/70 ring-1 ring-fg/10 hover:text-fg"
            >
              Don't have an account? <span className="text-terra">SIGN UP</span>
            </button>
          ))}

          <form onSubmit={submit} className="mt-4 space-y-3">
            {mode === "signup" && (
              <div className="flex gap-1.5">
                {roles.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => setRole(r.key)}
                    className={`flex-1 rounded-xl px-2 py-2 font-display text-[11px] font-semibold ring-1 transition-colors ${
                      role === r.key
                        ? "bg-terra/20 text-terra ring-terra/50"
                        : "bg-fg/5 text-fg/60 ring-fg/10 hover:ring-terra/30"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            )}

            {mode === "signup" && (
              <>
                <Input value={fullName} onChange={setName} placeholder="Full name" required />
                <Input value={phone} onChange={setPhone} placeholder="Phone (+263 …)" />
              </>
            )}
            <Input
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="Email"
              autocomplete="email"
              required
            />
            <Input
              type="password"
              value={password}
              onChange={setPassword}
              placeholder="Password"
              autocomplete={mode === "signup" ? "new-password" : "current-password"}
              required
            />

            {msg && <p role="status" aria-live="polite" className="text-[11px] text-clay">{msg}</p>}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-terra px-3 py-2.5 font-display text-[12px] font-semibold text-ink transition-opacity disabled:opacity-50"
            >
              {busy ? "Working…" : adminOnly ? "Sign in as administrator" : mode === "signup" ? `Create ${role} account` : "Sign in"}
            </button>
          </form>
        </div>

        <Link to="/report" className="mt-5 text-center text-xs font-semibold text-terra underline underline-offset-4">Report suspicious activity · no account needed</Link>

        <p className="mt-5 max-w-[340px] text-center font-mono text-[9px] leading-relaxed text-fg/50">
          {adminOnly ? (
            <Link to="/auth" className="underline underline-offset-4 hover:text-fg">Tenant or landlord? Return to account access</Link>
          ) : (
            <Link to="/admin-signin" className="underline underline-offset-4 hover:text-fg">Admin sign in</Link>
          )}
        </p>
      </div>
    </main>
  );
}

function Input({
  value,
  onChange,
  type = "text",
  required,
  placeholder,
  autocomplete,
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  autocomplete?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      required={required}
      placeholder={placeholder}
      autoComplete={autocomplete}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl bg-fg/5 px-3.5 py-2.5 text-[12px] text-fg ring-1 ring-fg/10 outline-none transition-shadow placeholder:text-fg/40 focus:ring-terra/50"
    />
  );
}
