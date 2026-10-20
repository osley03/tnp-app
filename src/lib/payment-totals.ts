type PaymentAmount={status?:string|null;amount_usd?:number|string|null};
export function paymentTotals(payments:PaymentAmount[]){
 const totals={paid:0,held:0,released:0,refunded:0,pending:0,disputed:0};
 for(const payment of payments){const amount=Number(payment.amount_usd??0);if(!Number.isFinite(amount)||amount<0)continue;const status=String(payment.status??'').toLowerCase();
  if(status==='held')totals.held+=amount;
  if(status==='released')totals.released+=amount;
  if(status==='refunded')totals.refunded+=amount;
  if(status==='pending'||status==='processing')totals.pending+=amount;
  if(status==='disputed')totals.disputed+=amount;
  if(['paid','held','released'].includes(status))totals.paid+=amount;
 }return totals;
}
