import {useQuery} from "@tanstack/react-query";
import {supabase} from "@/integrations/supabase/client";
import {useSession} from "@/lib/session";
import type {RentalPayment,RentalLease,RentalProperty,RentalPerson} from "./ledger";
export function useRentalPayments(role:"tenant"|"landlord",page:number,leaseFilter:string,statusFilter:string,from:string,to:string){
 const {user}=useSession();const identity=role==='tenant'?'payer_id':'payee_id';
 const related=useQuery({queryKey:['rental-payment-parties',role,user?.id],enabled:!!user?.id,queryFn:async()=>{
  const result=await supabase.from('leases' as never).select('id,property_id,tenant_id,landlord_id,status,rent_usd,deposit_usd,start_date,end_date').eq(role==='tenant'?'tenant_id':'landlord_id',user!.id).order('created_at',{ascending:false});if(result.error)throw Error(result.error.message);const leases=result.data as unknown as RentalLease[];
  const propertyIds=[...new Set(leases.map(item=>item.property_id))];const partyIds=[...new Set(leases.map(item=>role==='tenant'?item.landlord_id:item.tenant_id))];
  const [properties,people]=await Promise.all([propertyIds.length?supabase.from('properties').select('id,title,city,suburb').in('id',propertyIds):Promise.resolve({data:[],error:null}),partyIds.length?supabase.from('profiles').select('id,full_name').in('id',partyIds):Promise.resolve({data:[],error:null})]);if(properties.error)throw Error(properties.error.message);if(people.error)throw Error(people.error.message);
  return {leases,properties:properties.data as RentalProperty[],people:people.data as RentalPerson[]};
 }});
 const history=useQuery({queryKey:['rental-payment-ledger',role,user?.id,page,leaseFilter,statusFilter,from,to],enabled:!!user?.id,queryFn:async()=>{
  if(from&&to&&from>to)throw Error('Paid through must be on or after Paid from.');
  let query=supabase.from('lease_payments' as never).select('*',{count:'exact'}).eq(identity,user!.id).order('created_at',{ascending:false}).order('id',{ascending:false});
  if(leaseFilter)query=query.eq('lease_id',leaseFilter);if(statusFilter)query=query.eq('status',statusFilter);if(from)query=query.gte('paid_at',new Date(from+'T00:00:00').toISOString());if(to)query=query.lte('paid_at',new Date(to+'T23:59:59.999').toISOString());
  const result=await query.range(page*25,page*25+24);if(result.error)throw Error(result.error.message);return {rows:result.data as unknown as RentalPayment[],count:result.count||0};
 }});
 const pending=useQuery({queryKey:['rental-payment-due',role,user?.id],enabled:!!user?.id,queryFn:async()=>{const result=await supabase.from('lease_payments' as never).select('*').eq(identity,user!.id).in('status',['pending','processing']).order('due_date',{ascending:true,nullsFirst:false}).limit(100);if(result.error)throw Error(result.error.message);return result.data as unknown as RentalPayment[];}});
 const summary=useQuery({queryKey:['rental-payment-summary',role,user?.id],enabled:!!user?.id,queryFn:async()=>{const result=await supabase.rpc('tnp_payment_summary' as never,{p_role:role} as never);if(result.error)throw Error(result.error.message);return result.data as unknown as {paid:number;this_month:number;pending:number;overdue:number;paid_count:number;pending_count:number};}});
 async function refresh(){await Promise.all([related.refetch(),history.refetch(),pending.refetch(),summary.refetch()]);}
 return {user,related,history,pending,summary,refresh};
}
