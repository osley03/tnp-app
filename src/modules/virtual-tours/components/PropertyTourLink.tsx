import {useState} from 'react';
import {externalTour} from '@/lib/external-tours';
import {tourIdFromUrl,tourLink} from '@/lib/tour-links';
export function PropertyTourLink({value}:{value:string}){
 const [loaded,setLoaded]=useState('');const id=tourIdFromUrl(value,window.location.origin);const external=externalTour(value);
 if(id)return <a href={tourLink(id,window.location.origin)} target="_blank" rel="noopener noreferrer" className="block rounded-xl bg-amber-200 p-3 text-center font-semibold text-slate-950">View 360° property tour</a>;
 if(!external)return null;
 return <section id="property-virtual-tour" className="tnp-payment-paper rounded-xl border bg-white p-4 text-slate-950"><h2 className="font-bold">360° property tour · {external.provider}</h2><p className="my-3 text-sm">This tour is hosted by {external.provider}. Loading it connects your browser to that provider. Its availability and access settings are managed by the tour owner.</p>{loaded===external.url?<iframe title={external.provider+' property tour'} src={external.url} className="h-[420px] w-full rounded-lg border sm:h-[560px]" loading="lazy" allowFullScreen allow="fullscreen; xr-spatial-tracking; gyroscope; accelerometer" sandbox="allow-scripts allow-same-origin allow-popups" referrerPolicy="strict-origin-when-cross-origin"/>:<button type="button" className="rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white" onClick={()=>setLoaded(external.url)}>Load external 360° tour</button>}<a href={external.url} target="_blank" rel="noopener noreferrer" className="mt-3 block text-sm underline">Open on {external.provider} if the embedded tour is unavailable</a></section>;
}
