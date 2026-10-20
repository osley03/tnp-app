export type LeaseGroup = 'active' | 'upcoming' | 'past';
export function leaseGroup(lease: {status?: string | null; start_date?: string | null; end_date?: string | null}, now = new Date()): LeaseGroup {
 const status = (lease.status ?? '').trim().toLowerCase().replace(/\s+/g, '_');
 if (['active', 'signed', 'running', 'disputed'].includes(status)) return 'active';
 if (['draft', 'requested', 'pending', 'pending_approval', 'upcoming', 'approved', 'pending_start'].includes(status)) return 'upcoming';
 if (['completed', 'expired', 'terminated', 'cancelled', 'closed'].includes(status)) return 'past';
 const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
 if (lease.end_date && new Date(lease.end_date.slice(0, 10) + 'T00:00:00') < today) return 'past';
 if (lease.start_date && new Date(lease.start_date.slice(0, 10) + 'T00:00:00') > today) return 'upcoming';
 return 'active';
}
