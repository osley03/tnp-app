export function applicationStatus(value: unknown): string {
 const status = String(value ?? '').trim().toLowerCase().replaceAll('_',' ');
 if (['pending','pending review','submitted','under review'].includes(status)) return 'Pending review';
 if (['approved','accepted'].includes(status)) return 'Approved';
 if (['rejected','declined'].includes(status)) return 'Rejected';
 if (['withdrawn','cancelled','canceled'].includes(status)) return 'Withdrawn';
 return String(value ?? 'Pending review');
}
