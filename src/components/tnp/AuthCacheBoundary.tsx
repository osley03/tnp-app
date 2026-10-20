import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase, supabaseConfigured } from '@/integrations/supabase/client';
export function AuthCacheBoundary() {
 const client=useQueryClient();
 useEffect(()=>{
  if(!supabaseConfigured)return;
  let previous:string|null|undefined;
  const {data}=supabase.auth.onAuthStateChange((event,session)=>{
   const next=session?.user.id??null;
   if(event==='SIGNED_OUT'||(previous!==undefined&&next!==previous)){
    void client.cancelQueries();client.clear();
   }
   previous=next;
  });
  return ()=>data.subscription.unsubscribe();
 },[client]);
 return null;
}
