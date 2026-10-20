export type ExternalTour={provider:'Kuula'|'Matterport';url:string};
export function externalTour(value:string):ExternalTour|null {
 try{const url=new URL(value.trim());if(url.protocol!=='https:'||url.username||url.password||url.port||url.hash)return null;
  if(['kuula.co','www.kuula.co'].includes(url.hostname)&&/^\/share\/(?:[A-Za-z0-9]+\/)?(?:collection\/)?[A-Za-z0-9]+\/?$/.test(url.pathname)){
   const clean=new URL('https://kuula.co'+url.pathname.replace(/\/$/,''));for(const key of ['fs','vr','sd','thumbs','info','logo','autorotate','keys','zoom']){const value=url.searchParams.get(key);if(value&&/^[A-Za-z0-9.,-]{1,40}$/.test(value))clean.searchParams.set(key,value);}return{provider:'Kuula',url:clean.href};
  }
  if(url.hostname==='my.matterport.com'&&/^\/show\/?$/.test(url.pathname)&&url.searchParams.getAll('m').length===1&&/^[A-Za-z0-9]+$/.test(url.searchParams.get('m')||'')){
   const clean=new URL('https://my.matterport.com/show/');clean.searchParams.set('m',url.searchParams.get('m')!);for(const key of ['play','qs','vr','lang','hl']){const value=url.searchParams.get(key);if(value&&/^[A-Za-z0-9_-]{1,20}$/.test(value))clean.searchParams.set(key,value);}return{provider:'Matterport',url:clean.href};
  }return null;
 }catch{return null;}
}
