import {DeletedAccounts} from '@/modules/accounts/DeletedAccounts';
import {DeleteAccount} from '@/modules/accounts/DeleteAccount';
import { resolveRole } from '@/lib/roles';
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  BadgeCheck,
  Bell,
  Building2,
  Check,
  CheckCircle2,
  Eye,
  FileText,
  KeyRound,
  LockKeyhole,
  LogOut,
  Mail,
  Phone,
  Save,
  Settings2,
  Shield,
  ShieldCheck,
  User,
  Users,
  WalletCards,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { RoleSidebar } from "@/components/dashboard/RoleSidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app/settings")({
  component: SettingsPage,
});

type AppRole = "tenant" | "landlord" | "admin";

type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  bio: string | null;
  verification: string | null;
  trust_score: number | null;
};

type NotificationSettings = {
  email: boolean;
  activity: boolean;
  platform: boolean;
  security: boolean;
};

type PrivacySettings = {
  profileVisible: boolean;
  trustVisible: boolean;
  contactVisible: boolean;
};

type RolePreferences = {
  propertyAlerts: boolean;
  applicationAlerts: boolean;
  paymentAlerts: boolean;
  messageAlerts: boolean;
  reviewAlerts: boolean;
};

const defaultNotifications: NotificationSettings = {
  email: true,
  activity: true,
  platform: true,
  security: true,
};

const defaultPrivacy: PrivacySettings = {
  profileVisible: true,
  trustVisible: true,
  contactVisible: false,
};

const defaultRolePreferences: RolePreferences = {
  propertyAlerts: true,
  applicationAlerts: true,
  paymentAlerts: true,
  messageAlerts: true,
  reviewAlerts: true,
};

const roleLabels: Record<AppRole, string> = {
  tenant: "Tenant",
  landlord: "Landlord",
  admin: "Administrator",
};

const roleDescriptions: Record<AppRole, string> = {
  tenant:
    "Manage your tenant profile, trust information, property preferences and account security.",
  landlord:
    "Manage your landlord profile, listing preferences, trust information and account security.",
  admin: "Manage your administrator profile, platform preferences, security and privacy controls.",
};

const roleIcons: Record<AppRole, typeof User> = {
  tenant: User,
  landlord: Building2,
  admin: ShieldCheck,
};

function SettingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [profileForm, setProfileForm] = useState({
    full_name: "",
    phone: "",
    bio: "",
  });

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [notifications, setNotifications] = useState<NotificationSettings>(defaultNotifications);

  const [privacy, setPrivacy] = useState<PrivacySettings>(defaultPrivacy);

  const [rolePreferences, setRolePreferences] = useState<RolePreferences>(defaultRolePreferences);

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const [profileMessage, setProfileMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [settingsMessage, setSettingsMessage] = useState("");

  /*
   * ------------------------------------------------------------
   * AUTHENTICATED USER + ROLE
   * ------------------------------------------------------------
   */

  const sessionQuery = useQuery({
    queryKey: ["settings-session"],
    queryFn: async () => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        throw new Error("No authenticated user found.");
      }

      const { data: roleRows, error: roleError } = await supabase
        .from("user_roles" as never)
        .select("role")
        .eq("user_id", user.id);

      if (roleError) throw roleError;

      const resolvedRole = resolveRole((roleRows ?? []) as {role: string}[]);

      if (resolvedRole !== "tenant" && resolvedRole !== "landlord" && resolvedRole !== "admin") {
        throw new Error("Your account does not have a valid TNP role.");
      }

      return {
        user,
        role: resolvedRole as AppRole,
      };
    },
  });

  const user = sessionQuery.data?.user;
  const role = sessionQuery.data?.role;

  /*
   * ------------------------------------------------------------
   * PROFILE
   * ------------------------------------------------------------
   */

  const profileQuery = useQuery({
    queryKey: ["settings-profile", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, phone, bio, verification, trust_score")
        .eq("id", user!.id)
        .maybeSingle();

      if (error) throw error;

      return data as Profile | null;
    },
  });

  const profile = profileQuery.data;

  useEffect(() => {
    if (!profile) return;

    setProfileForm({
      full_name: profile.full_name ?? "",
      phone: profile.phone ?? "",
      bio: profile.bio ?? "",
    });
  }, [profile]);

  /*
   * ------------------------------------------------------------
   * LOAD LOCAL SETTINGS
   *
   * These preferences are kept locally for now because the
   * confirmed profiles table does not contain notification,
   * privacy or preference columns.
   * ------------------------------------------------------------
   */

  useEffect(() => {
    if (!user || !role) return;

    try {
      const notificationKey = `tnp-notifications:${user.id}:${role}`;

      const privacyKey = `tnp-privacy:${user.id}:${role}`;

      const preferenceKey = `tnp-role-preferences:${user.id}:${role}`;

      const storedNotifications = window.localStorage.getItem(notificationKey);

      const storedPrivacy = window.localStorage.getItem(privacyKey);

      const storedPreferences = window.localStorage.getItem(preferenceKey);

      if (storedNotifications) {
        setNotifications({
          ...defaultNotifications,
          ...JSON.parse(storedNotifications),
        });
      }

      if (storedPrivacy) {
        setPrivacy({
          ...defaultPrivacy,
          ...JSON.parse(storedPrivacy),
        });
      }

      if (storedPreferences) {
        setRolePreferences({
          ...defaultRolePreferences,
          ...JSON.parse(storedPreferences),
        });
      }
    } catch {
      setNotifications(defaultNotifications);
      setPrivacy(defaultPrivacy);
      setRolePreferences(defaultRolePreferences);
    }
  }, [user, role]);

  const RoleIcon = role ? roleIcons[role] : Settings2;

  /*
   * ------------------------------------------------------------
   * ROLE-SPECIFIC COPY
   * ------------------------------------------------------------
   */

  const roleContent = useMemo(() => {
    if (role === "tenant") {
      return {
        propertyTitle: "Property match alerts",
        propertyDescription: "Receive alerts when properties match your search and preferences.",

        applicationTitle: "Application updates",
        applicationDescription: "Receive updates about applications, lease requests and approvals.",

        paymentTitle: "Payment & escrow alerts",
        paymentDescription: "Receive important payment and escrow activity notifications.",

        messageTitle: "Landlord messages",
        messageDescription: "Receive notifications when landlords contact you.",

        reviewTitle: "Review activity",
        reviewDescription: "Receive notifications about reviews and review responses.",
      };
    }

    if (role === "landlord") {
      return {
        propertyTitle: "Listing activity",
        propertyDescription: "Receive alerts about listing activity and property-related events.",

        applicationTitle: "Lease request alerts",
        applicationDescription:
          "Receive notifications when tenants submit or update lease requests.",

        paymentTitle: "Payment & escrow alerts",
        paymentDescription: "Receive important escrow and lease payment activity notifications.",

        messageTitle: "Tenant messages",
        messageDescription: "Receive notifications when tenants contact you.",

        reviewTitle: "Reviews & disputes",
        reviewDescription: "Receive important review and dispute activity notifications.",
      };
    }

    return {
      propertyTitle: "Platform activity",
      propertyDescription: "Receive important activity alerts across the TNP platform.",

      applicationTitle: "Case & report alerts",
      applicationDescription: "Receive notifications about cases, reports and investigations.",

      paymentTitle: "Platform financial alerts",
      paymentDescription: "Receive important platform payment and escrow alerts.",

      messageTitle: "Administrative messages",
      messageDescription: "Receive important administrative communications.",

      reviewTitle: "Moderation activity",
      reviewDescription: "Receive notifications about reviews, disputes and moderation.",
    };
  }, [role]);

  /*
   * ------------------------------------------------------------
   * SAVE PROFILE
   * ------------------------------------------------------------
   */

  async function handleSaveProfile() {
    if (!user) return;

    setSavingProfile(true);
    setProfileMessage("");

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: profileForm.full_name.trim() || "",
          phone: profileForm.phone.trim() || null,
          bio: profileForm.bio.trim() || null,
        })
        .eq("id", user.id);

      if (error) throw error;

      await queryClient.invalidateQueries({
        queryKey: ["settings-profile", user.id],
      });

      setProfileMessage("Profile updated successfully.");
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : "Unable to update your profile.");
    } finally {
      setSavingProfile(false);
    }
  }

  /*
   * ------------------------------------------------------------
   * PASSWORD
   * ------------------------------------------------------------
   */

  async function handleChangePassword() {
    setPasswordMessage("");

    if (!newPassword || !confirmPassword) {
      setPasswordMessage("Enter and confirm your new password.");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordMessage("Your password must contain at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage("The passwords do not match.");
      return;
    }

    setSavingPassword(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setNewPassword("");
      setConfirmPassword("");

      setPasswordMessage("Password updated successfully.");
    } catch (error) {
      setPasswordMessage(
        error instanceof Error ? error.message : "Unable to update your password.",
      );
    } finally {
      setSavingPassword(false);
    }
  }

  /*
   * ------------------------------------------------------------
   * LOCAL SETTINGS HELPERS
   * ------------------------------------------------------------
   */

  function saveLocalSetting(type: "notifications" | "privacy" | "preferences", value: unknown) {
    if (!user || !role) return;

    try {
      const prefix =
        type === "notifications"
          ? "tnp-notifications"
          : type === "privacy"
            ? "tnp-privacy"
            : "tnp-role-preferences";

      const key = `${prefix}:${user.id}:${role}`;

      window.localStorage.setItem(key, JSON.stringify(value));

      setSettingsMessage("Settings saved successfully.");

      window.setTimeout(() => {
        setSettingsMessage("");
      }, 2500);
    } catch {
      setSettingsMessage("Unable to save this preference.");
    }
  }

  function updateNotification(key: keyof NotificationSettings, value: boolean) {
    const updated = {
      ...notifications,
      [key]: value,
    };

    setNotifications(updated);

    saveLocalSetting("notifications", updated);
  }

  function updatePrivacy(key: keyof PrivacySettings, value: boolean) {
    const updated = {
      ...privacy,
      [key]: value,
    };

    setPrivacy(updated);

    saveLocalSetting("privacy", updated);
  }

  function updateRolePreference(key: keyof RolePreferences, value: boolean) {
    const updated = {
      ...rolePreferences,
      [key]: value,
    };

    setRolePreferences(updated);

    saveLocalSetting("preferences", updated);
  }

  /*
   * ------------------------------------------------------------
   * SIGN OUT
   * ------------------------------------------------------------
   */

  async function handleSignOut() {
    setSigningOut(true);

    try {
      await supabase.auth.signOut();

      queryClient.clear();

      navigate({
        to: "/auth",
      });
    } catch {
      setSigningOut(false);
    }
  }

  /*
   * ------------------------------------------------------------
   * LOADING
   * ------------------------------------------------------------
   */

  if (sessionQuery.isLoading) {
    return (
      <SidebarProvider>
        <main className="tnp-module tnp-module-light min-h-screen flex-1 bg-slate-50">
          <div className="flex min-h-screen items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />

              <p className="text-sm font-medium text-slate-500">Loading your settings...</p>
            </div>
          </div>
        </main>
      </SidebarProvider>
    );
  }

  /*
   * ------------------------------------------------------------
   * ERROR
   * ------------------------------------------------------------
   */

  if (sessionQuery.isError || !role || !user) {
    return (
      <SidebarProvider>
        <main className="tnp-module tnp-module-light min-h-screen flex-1 bg-slate-50">
          <div className="flex min-h-screen items-center justify-center p-6">
            <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-red-50">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>

              <h1 className="text-lg font-bold text-slate-900">Settings could not be loaded</h1>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                {sessionQuery.error instanceof Error
                  ? sessionQuery.error.message
                  : "Your TNP account role could not be determined."}
              </p>

              <button
                type="button"
                onClick={() => sessionQuery.refetch()}
                className="mt-5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Try again
              </button>
            </div>
          </div>
        </main>
      </SidebarProvider>
    );
  }

  /*
   * ============================================================
   * MAIN SETTINGS LAYOUT
   *
   * THIS IS THE IMPORTANT SIDEBAR STRUCTURE:
   *
   * SidebarProvider
   *    ├── RoleSidebar
   *    └── SidebarInset
   *
   * Exactly like the corrected Integrity / Disputes architecture.
   * ============================================================
   */

  return (
    <SidebarProvider>
      <RoleSidebar role={role} />

      <SidebarInset>
        <main className="min-w-0 flex-1 bg-slate-50 text-slate-900">
          <div className="relative min-h-screen">
            {/* ==================================================
                HEADER
            ================================================== */}

            <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
              <div className="flex h-16 items-center justify-between px-4 sm:px-6">
                <div className="flex items-center gap-3">
                  <SidebarTrigger />

                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      TNP · Mutual Trust Ledger
                    </div>

                    <h1 className="text-lg font-bold text-slate-900">Settings</h1>
                  </div>
                </div>

                <div className="hidden items-center gap-2 sm:flex">
                  <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5">
                    <RoleIcon className="h-4 w-4 text-slate-500" />

                    <span className="text-sm font-semibold text-slate-700">{roleLabels[role]}</span>
                  </div>
                </div>
              </div>
            </header>

            {/* ==================================================
                CONTENT
            ================================================== */}

            <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
              {/* ==================================================
                  INTRO
              ================================================== */}

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
                      <Settings2 className="h-5 w-5" />
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-bold text-slate-900">Account Settings</h2>

                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-600">
                          {roleLabels[role]}
                        </span>
                      </div>

                      <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                        {roleDescriptions[role]}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                    <ShieldCheck className="h-5 w-5 text-emerald-600" />

                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">
                        Account status
                      </p>

                      <p className="text-sm font-semibold text-emerald-800">Active</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* ==================================================
                  1. PROFILE
              ================================================== */}

              <SettingsSection
                icon={User}
                title="Profile"
                description="Manage the information associated with your TNP account."
              >
                <div className="grid gap-5 md:grid-cols-2">
                  <Field label="Full name">
                    <input
                      type="text"
                      value={profileForm.full_name}
                      onChange={(event) =>
                        setProfileForm((current) => ({
                          ...current,
                          full_name: event.target.value,
                        }))
                      }
                      placeholder="Enter your full name"
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Email address">
                    <div className="relative">
                      <Mail className={iconInputClass} />

                      <input
                        type="email"
                        value={user.email ?? ""}
                        disabled
                        className={`${inputClass} pl-10 bg-slate-50 text-slate-500`}
                      />
                    </div>

                    <p className="mt-1.5 text-xs text-slate-400">Managed by TNP authentication.</p>
                  </Field>

                  <Field label="Phone number">
                    <div className="relative">
                      <Phone className={iconInputClass} />

                      <input
                        type="tel"
                        value={profileForm.phone}
                        onChange={(event) =>
                          setProfileForm((current) => ({
                            ...current,
                            phone: event.target.value,
                          }))
                        }
                        placeholder="+263..."
                        className={`${inputClass} pl-10`}
                      />
                    </div>
                  </Field>

                  <Field label="Account role">
                    <div className="flex h-11 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5">
                      <RoleIcon className="h-4 w-4 text-slate-500" />

                      <span className="text-sm font-semibold text-slate-700">
                        {roleLabels[role]}
                      </span>

                      <span className="ml-auto text-xs text-slate-400">System managed</span>
                    </div>
                  </Field>

                  <div className="md:col-span-2">
                    <Field label="Bio">
                      <textarea
                        rows={4}
                        value={profileForm.bio}
                        onChange={(event) =>
                          setProfileForm((current) => ({
                            ...current,
                            bio: event.target.value,
                          }))
                        }
                        placeholder={
                          role === "tenant"
                            ? "Tell landlords a little about yourself..."
                            : role === "landlord"
                              ? "Tell tenants about yourself or your property management experience..."
                              : "Add a short professional administrator profile..."
                        }
                        className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                      />
                    </Field>
                  </div>
                </div>

                <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    {profileMessage && (
                      <Message
                        success={profileMessage.includes("successfully")}
                        text={profileMessage}
                      />
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveProfile}
                    disabled={savingProfile}
                    className={primaryButton}
                  >
                    <Save className="h-4 w-4" />

                    {savingProfile ? "Saving..." : "Save profile"}
                  </button>
                </div>
              </SettingsSection>

              {/* ==================================================
                  2. VERIFICATION & TRUST
              ================================================== */}

              <SettingsSection
                icon={BadgeCheck}
                title="Verification & Trust"
                description="Your TNP identity and trust information."
              >
                <div className="grid gap-4 md:grid-cols-3">
                  <TrustCard
                    label="Verification"
                    value={profile?.verification || "Email only"}
                    icon={BadgeCheck}
                  />

                  <TrustCard
                    label="Trust score"
                    value={`${profile?.trust_score ?? 50}/100`}
                    icon={ShieldCheck}
                  />

                  <TrustCard label="Account standing" value="Good standing" icon={Shield} />
                </div>

                <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-slate-600" />

                    <div>
                      <p className="text-sm font-bold text-slate-900">Why trust matters</p>

                      <p className="mt-1 text-sm leading-6 text-slate-500">
                        TNP uses verification and trust information to promote safer interactions
                        between tenants, landlords and administrators.
                      </p>
                    </div>
                  </div>
                </div>
              </SettingsSection>

              {/* ==================================================
                  3. SECURITY
              ================================================== */}

              <SettingsSection
                icon={LockKeyhole}
                title="Security"
                description="Protect your TNP account and authentication credentials."
              >
                <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50 p-4">
                  <div className="flex items-start gap-3">
                    <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />

                    <div>
                      <p className="text-sm font-bold text-blue-900">Keep your account secure</p>

                      <p className="mt-1 text-sm leading-6 text-blue-700">
                        Use a strong password and never share your TNP login credentials with
                        another person.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <Field label="New password">
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      placeholder="Enter new password"
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Confirm new password">
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder="Confirm new password"
                      className={inputClass}
                    />
                  </Field>
                </div>

                <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                  {passwordMessage ? (
                    <Message
                      success={passwordMessage.includes("successfully")}
                      text={passwordMessage}
                    />
                  ) : (
                    <p className="text-xs text-slate-400">Minimum password length: 6 characters.</p>
                  )}

                  <button
                    type="button"
                    onClick={handleChangePassword}
                    disabled={savingPassword}
                    className={secondaryButton}
                  >
                    <KeyRound className="h-4 w-4" />

                    {savingPassword ? "Updating..." : "Update password"}
                  </button>
                </div>

                {/* Future security controls */}
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <FutureFeature
                    icon={Shield}
                    title="Two-factor authentication"
                    description="Additional login protection will be available in a future security release."
                  />

                  <FutureFeature
                    icon={FileText}
                    title="Login history"
                    description="Detailed authentication history will be available once session auditing is implemented."
                  />
                </div>
              </SettingsSection>

              {/* ==================================================
                  4. NOTIFICATIONS
              ================================================== */}

              <SettingsSection
                icon={Bell}
                title="Notifications"
                description="Choose which notifications you want to receive."
              >
                <div className="divide-y divide-slate-100">
                  <ToggleRow
                    title="Email notifications"
                    description="Receive important TNP notifications through your account email."
                    enabled={notifications.email}
                    onChange={(value) => updateNotification("email", value)}
                  />

                  <ToggleRow
                    title={roleContent.propertyTitle}
                    description={roleContent.propertyDescription}
                    enabled={notifications.activity}
                    onChange={(value) => updateNotification("activity", value)}
                  />

                  <ToggleRow
                    title={roleContent.applicationTitle}
                    description={roleContent.applicationDescription}
                    enabled={notifications.platform}
                    onChange={(value) => updateNotification("platform", value)}
                  />

                  <ToggleRow
                    title={roleContent.paymentTitle}
                    description={roleContent.paymentDescription}
                    enabled={notifications.activity}
                    onChange={(value) => updateNotification("activity", value)}
                  />

                  <ToggleRow
                    title={roleContent.messageTitle}
                    description={roleContent.messageDescription}
                    enabled={notifications.email}
                    onChange={(value) => updateNotification("email", value)}
                  />

                  <ToggleRow
                    title={roleContent.reviewTitle}
                    description={roleContent.reviewDescription}
                    enabled={notifications.platform}
                    onChange={(value) => updateNotification("platform", value)}
                  />

                  <ToggleRow
                    title="Security alerts"
                    description="Important authentication and account-security alerts."
                    enabled={notifications.security}
                    onChange={(value) => updateNotification("security", value)}
                    locked
                  />
                </div>
              </SettingsSection>

              {/* ==================================================
                  5. ROLE PREFERENCES
              ================================================== */}

              <SettingsSection
                icon={Settings2}
                title={`${roleLabels[role]} Preferences`}
                description="Preferences specific to your current TNP role."
              >
                {role === "tenant" && (
                  <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-bold text-slate-900">Tenant preferences</p>

                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      Control the types of property and account activity you want TNP to notify you
                      about.
                    </p>
                  </div>
                )}

                {role === "landlord" && (
                  <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-bold text-slate-900">Landlord preferences</p>

                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      Control listing, applicant, lease and property management alerts.
                    </p>
                  </div>
                )}

                {role === "admin" && (
                  <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-bold text-slate-900">Administrator preferences</p>

                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      Control important administrative and platform activity alerts.
                    </p>
                  </div>
                )}

                <div className="divide-y divide-slate-100">
                  <ToggleRow
                    title={
                      role === "tenant"
                        ? "Property recommendations"
                        : role === "landlord"
                          ? "Listing activity"
                          : "Platform activity"
                    }
                    description={
                      role === "tenant"
                        ? "Receive relevant property matching notifications."
                        : role === "landlord"
                          ? "Receive alerts about your property listings."
                          : "Receive important platform activity alerts."
                    }
                    enabled={rolePreferences.propertyAlerts}
                    onChange={(value) => updateRolePreference("propertyAlerts", value)}
                  />

                  <ToggleRow
                    title={
                      role === "tenant"
                        ? "Applications & leases"
                        : role === "landlord"
                          ? "Lease requests & applicants"
                          : "Cases & reports"
                    }
                    description={
                      role === "tenant"
                        ? "Receive application and lease status changes."
                        : role === "landlord"
                          ? "Receive applicant and lease request alerts."
                          : "Receive case, report and investigation alerts."
                    }
                    enabled={rolePreferences.applicationAlerts}
                    onChange={(value) => updateRolePreference("applicationAlerts", value)}
                  />

                  <ToggleRow
                    title="Payments & escrow"
                    description="Receive important payment and escrow activity."
                    enabled={rolePreferences.paymentAlerts}
                    onChange={(value) => updateRolePreference("paymentAlerts", value)}
                  />

                  <ToggleRow
                    title={
                      role === "tenant"
                        ? "Landlord messages"
                        : role === "landlord"
                          ? "Tenant messages"
                          : "Administrative messages"
                    }
                    description="Receive notifications when another TNP user contacts you."
                    enabled={rolePreferences.messageAlerts}
                    onChange={(value) => updateRolePreference("messageAlerts", value)}
                  />

                  <ToggleRow
                    title={role === "admin" ? "Moderation activity" : "Reviews"}
                    description={
                      role === "admin"
                        ? "Receive review, dispute and moderation alerts."
                        : "Receive important review and response activity."
                    }
                    enabled={rolePreferences.reviewAlerts}
                    onChange={(value) => updateRolePreference("reviewAlerts", value)}
                  />
                </div>
              </SettingsSection>

              {/* ==================================================
                  6. PRIVACY
              ================================================== */}

              <SettingsSection
                icon={Eye}
                title="Privacy"
                description="Control what other TNP users can see about your account."
              >
                <div className="mb-5 rounded-xl border border-amber-100 bg-amber-50 p-4">
                  <div className="flex items-start gap-3">
                    <Eye className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />

                    <div>
                      <p className="text-sm font-bold text-amber-900">Account data access</p>

                      <p className="mt-1 text-sm leading-6 text-amber-800">
                        Access follows your role and rental relationships. The database access rules must be installed in your Supabase project to enforce these boundaries.
                      </p>
                    </div>
                  </div>
                </div>

                <ul className="space-y-3 text-sm leading-6 text-slate-700">
                  <li>Tenant profiles are available to their account holder, TNP administrators, and landlords with a related application or lease.</li>
                  <li>Landlord profiles are visible alongside their listings.</li>
                  <li>Lease and payment records are restricted to the parties involved and administrators.</li>
                  <li>Private and password-protected tour access is checked by the sharing service.</li>
                </ul>
              </SettingsSection>

              {/* ==================================================
                  7. ACCOUNT
              ================================================== */}

              <SettingsSection
                icon={LogOut}
                title="Account"
                description="Manage your current TNP account session."
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                      Account email
                    </p>

                    <p className="mt-2 break-all text-sm font-semibold text-slate-900">
                      {user.email || "No email available"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                      Current role
                    </p>

                    <div className="mt-2 flex items-center gap-2">
                      <RoleIcon className="h-4 w-4 text-slate-600" />

                      <p className="text-sm font-semibold text-slate-900">{roleLabels[role]}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex flex-col gap-4 rounded-xl border border-red-100 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-bold text-red-900">Sign out</p>

                    <p className="mt-1 text-sm leading-5 text-red-700">
                      End your current TNP session on this device.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleSignOut}
                    disabled={signingOut}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-5 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <LogOut className="h-4 w-4" />

                    {signingOut ? "Signing out..." : "Sign out"}
                  </button>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <FutureFeature
                    icon={FileText}
                    title="Download account data"
                    description="Account data export will be connected after the platform data-export service is implemented."
                  />

                  {role === "admin" ? <DeletedAccounts/> : role && <DeleteAccount role={role}/>}
                </div>
              </SettingsSection>

              {/* ==================================================
                  SAVED MESSAGE
              ================================================== */}

              {settingsMessage && (
                <div className="sticky bottom-4 z-20 flex justify-center">
                  <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-700 shadow-lg">
                    <CheckCircle2 className="h-4 w-4" />

                    {settingsMessage}
                  </div>
                </div>
              )}

              <div className="pb-8 text-center text-xs text-slate-400">
                TNP · Mutual Trust Ledger · Harare
              </div>
            </div>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

/*
 * ==============================================================
 * REUSABLE UI COMPONENTS
 * ==============================================================
 */

function SettingsSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof User;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
            <Icon className="h-5 w-5 text-slate-700" />
          </div>

          <div>
            <h2 className="font-bold text-slate-900">{title}</h2>

            <p className="text-sm text-slate-500">{description}</p>
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-700">{label}</label>

      {children}
    </div>
  );
}

function TrustCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof ShieldCheck;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</span>

        <Icon className="h-5 w-5 text-slate-600" />
      </div>

      <p className="text-lg font-bold text-slate-900">{value}</p>
    </div>
  );
}

function ToggleRow({
  title,
  description,
  enabled,
  onChange,
  locked = false,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onChange: (value: boolean) => void;
  locked?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-5 py-5 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-slate-900">{title}</p>

          {locked && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Required
            </span>
          )}
        </div>

        <p className="mt-1 max-w-2xl text-sm leading-5 text-slate-500">{description}</p>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => {
          if (!locked) {
            onChange(!enabled);
          }
        }}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
          enabled ? "bg-slate-900" : "bg-slate-200"
        } ${locked ? "cursor-not-allowed opacity-80" : "cursor-pointer"}`}
      >
        <span
          className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition ${
            enabled ? "left-6" : "left-1"
          }`}
        />
      </button>
    </div>
  );
}

function Message({ success, text }: { success: boolean; text: string }) {
  return (
    <div
      className={`flex items-center gap-2 text-sm font-medium ${
        success ? "text-emerald-700" : "text-red-600"
      }`}
    >
      {success ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}

      {text}
    </div>
  );
}

function FutureFeature({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Shield;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />

        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-slate-700">{title}</p>

            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Later
            </span>
          </div>

          <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
        </div>
      </div>
    </div>
  );
}

const inputClass =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100";

const iconInputClass =
  "pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400";

const primaryButton =
  "inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60";

const secondaryButton =
  "inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60";
