import { useState, type ReactNode } from 'react';
import { Link, useLocation } from '@tanstack/react-router';
import { ArrowLeft, RotateCw, Search, Settings, X } from 'lucide-react';
import { roleNavigation } from '@/components/dashboard/RoleSidebar';
import { roleHome, type AppRole } from '@/lib/roles';
import { matchesSearch } from '@/lib/workspace-search';

export function WorkspaceFrame({ role, children }: { role: AppRole; children: ReactNode }) {
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const pathname = useLocation({ select: location => location.pathname });
  const home = roleHome(role);
  const items = [...roleNavigation[role], { title: 'Settings', href: '/app/settings', icon: Settings }];
  const current = items.find(item => item.href === pathname)?.title ?? (pathname.startsWith('/app/property/') ? 'Property details' : pathname.startsWith('/app/applicant/') ? 'Applicant profile' : 'Tour editor');
  const results = items.filter(item => matchesSearch(query, item.title));
  return <div className="tnp-workspace">
    <nav className="tnp-workspace-tools" aria-label="Workspace controls">
      <div className="tnp-workspace-context">
        <Link to={home} activeOptions={{ exact: true }} className="tnp-tool-button" aria-label="Back to dashboard"><ArrowLeft size={16} /><span>Back to dashboard</span></Link>
        <span className="tnp-workspace-current">{current}</span>
      </div>
      <div className="tnp-workspace-search">
        <Search size={17} aria-hidden="true" />
        <input type="search" aria-label="Find a module" placeholder="Find a module…" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') setQuery(''); }} aria-controls={query.trim() ? 'tnp-module-results' : undefined} />
        {query && <button type="button" aria-label="Clear module search" onClick={() => setQuery('')}><X size={16} /></button>}
        {query.trim() && <div id="tnp-module-results" className="tnp-module-results">
          <p role="status">{results.length ? results.length + ' modules found' : 'No matching modules. Try properties, payments or reviews.'}</p>
          {results.map(item => <Link key={item.href} to={item.href as never} onClick={() => setQuery('')}><item.icon size={17} /><span>{item.title}</span></Link>)}
        </div>}
      </div>
      <button type="button" className="tnp-tool-button tnp-refresh-button" disabled={refreshing} onClick={() => { setRefreshing(true); window.location.reload(); }} aria-label="Refresh this page">
        <RotateCw size={16} className={refreshing ? 'animate-spin' : ''} /><span>{refreshing ? 'Refreshing…' : 'Refresh'}</span>
      </button>
    </nav>
    {children}
  </div>;
}
