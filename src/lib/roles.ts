export type AppRole = 'tenant' | 'landlord' | 'admin';
export function resolveRole(rows: {role: string}[]): AppRole | null {
  return (['admin', 'landlord', 'tenant'] as const).find(role => rows.some(row => row.role === role)) ?? null;
}
export function roleHome(role: AppRole | null): '/app/tenant' | '/app/landlord' | '/app/admin' {
  return role === 'admin' ? '/app/admin' : role === 'landlord' ? '/app/landlord' : '/app/tenant';
}
export function requiredRole(pathname: string): AppRole | null {
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] !== 'app') return null;
  if (parts[1] === 'admin') return 'admin';
  if (parts[1] === 'landlord' || parts[1] === 'applicant') return 'landlord';
  if (parts[1] === 'tenant') return 'tenant';
  return null;
}
