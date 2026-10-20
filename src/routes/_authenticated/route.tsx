import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { WorkspaceFrame } from '@/components/tnp/WorkspaceFrame';
import { supabase } from '@/integrations/supabase/client';
import { requiredRole, resolveRole, roleHome } from '@/lib/roles';
export const Route = createFileRoute('/_authenticated')({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: requiredRole(location.pathname) === 'admin' ? '/admin-signin' : '/auth' });
    const roles = await supabase.from('user_roles').select('role').eq('user_id', data.user.id);
    if (roles.error) throw new Error('Unable to verify your account permissions. Please retry.');
    const role = resolveRole(roles.data ?? []);
    if (!role) throw new Error('Your account has no assigned role. Contact TNP support.');
    const required = requiredRole(location.pathname);
    if (required && required !== role) throw redirect({ to: roleHome(role) });
    return { user: data.user, role };
  },
  component: AuthenticatedWorkspace,
});

function AuthenticatedWorkspace() {
  const { role } = Route.useRouteContext();
  return <WorkspaceFrame role={role}><Outlet /></WorkspaceFrame>;
}
