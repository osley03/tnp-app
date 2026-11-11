export type RegistrationData = {
  session?: unknown;
  user?: { identities?: readonly unknown[] | undefined } | null | undefined;
};
export function registrationNotice(data: RegistrationData): string {
  if (data.session) return "";
  if (Array.isArray(data.user?.identities) && data.user.identities.length === 0)
    return "This email is already registered. Sign in to your existing account, or use Resend verification if you have not confirmed your email.";
  return "Verification requested if this email is eligible. Check your inbox and spam folder. If you already have an account, sign in instead.";
}
export const TNP_EMAIL_REDIRECT =
  "https://tnp-app-alpha.vercel.app/auth?mode=signin&confirmation=1";
