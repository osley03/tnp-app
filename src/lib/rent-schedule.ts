// Calendar dates are compared at midnight so today's due date remains visible all day.
export function nextRentDate(startDate: string | null | undefined, dueDay: number | null | undefined, now = new Date(), endDate?: string | null): string | null {
 if (!startDate || !Number.isFinite(now.getTime())) return null;
 const start = new Date(startDate.slice(0, 10) + 'T00:00:00');
 if (!Number.isFinite(start.getTime())) return null;
 const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
 const earliest = start > today ? start : today;
 const day = Number(dueDay ?? 1);
 if (!Number.isFinite(day)) return null;
 const scheduledDay = Math.min(Math.max(Math.trunc(day), 1), 28);
 let candidate = new Date(earliest.getFullYear(), earliest.getMonth(), scheduledDay);
 if (candidate < earliest) candidate = new Date(earliest.getFullYear(), earliest.getMonth() + 1, scheduledDay);
 if (endDate) {
  const end = new Date(endDate.slice(0, 10) + 'T00:00:00');
  if (!Number.isFinite(end.getTime()) || candidate > end) return null;
 }
 return candidate.getFullYear() + '-' + String(candidate.getMonth() + 1).padStart(2, '0') + '-' + String(candidate.getDate()).padStart(2, '0');
}
