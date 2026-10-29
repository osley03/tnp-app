export type RegistrationData = {
  session?: unknown;
  user?: { identities?: readonly unknown[] | undefined } | null | undefined;
};
export function registrationNotice(data: RegistrationData): string {
  if (data.session) return "";
  if (Array.isArray(data.user?.identities) && data.user.identities.length === 0)
    return "An account may already exist for this email. Sign in to that account, or use a different email for a separate account. No new account has been confirmed.";
  return "Verification requested if this email is eligible. Check your inbox and spam folder. If you already have an account, sign in instead.";
}
export const TNP_EMAIL_REDIRECT = "https://tnp-app-alpha.vercel.app/auth";
