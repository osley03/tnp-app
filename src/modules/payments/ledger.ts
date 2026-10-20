export type RentalPayment = {id:string;lease_id:string;payer_id:string;payee_id:string|null;payment_type:string;amount_usd:string|number;status:string;reference:string|null;paid_at:string|null;released_at:string|null;created_at:string;due_date?:string|null;period_start?:string|null;period_end?:string|null};
export type RentalLease = {id:string;property_id:string;tenant_id:string;landlord_id:string;status:string;rent_usd:string|number;deposit_usd:string|number;start_date:string|null;end_date:string|null};
export type RentalProperty = {id:string;title:string|null;city:string|null;suburb:string|null};
export type RentalPerson = {id:string;full_name:string|null};
export function paymentMoney(value:unknown){return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(value)||0);}
export function paymentDate(value:string|null|undefined){if(!value)return 'Not recorded';const date=new Date(value.length===10?value+'T12:00:00':value);return Number.isNaN(date.getTime())?'Not recorded':date.toLocaleDateString('en-ZW',{day:'numeric',month:'short',year:'numeric'});}
export function paymentPeriod(payment:RentalPayment){if(payment.payment_type==='deposit')return 'One-off deposit';if(!payment.period_start)return 'Period not recorded';const date=new Date(payment.period_start.length===10?payment.period_start+'T12:00:00':payment.period_start);return Number.isNaN(date.getTime())?'Period not recorded':date.toLocaleDateString('en-ZW',{month:'long',year:'numeric'});}
export function paymentReceivedAt(payment:RentalPayment){return payment.paid_at || (payment.status==='released'?payment.released_at:null);}
export function isSettledPayment(status:string){return ['paid','released'].includes(status);}
