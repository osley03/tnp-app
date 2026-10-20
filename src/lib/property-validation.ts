type ListingFields = {title:string;city:string;suburb:string;rent_usd:string;deposit_usd:string;price_usd:string;beds:string;baths:string;rooms:string;size:string;listing_type:string;image_url:string};
export function validateProperty(form:ListingFields): string|null {
 if(!form.title.trim()||!form.city.trim()||!form.suburb.trim())return 'Enter the property title, city and suburb.';
 for(const key of ['rent_usd','deposit_usd','price_usd','beds','baths','rooms','size'] as const){
  const raw=form[key];if(raw&&(!Number.isFinite(Number(raw))||Number(raw)<0))return 'Prices, room counts and sizes must be valid non-negative numbers.';
 }
 for(const key of ['beds','baths','rooms'] as const)if(form[key]&&!Number.isInteger(Number(form[key])))return 'Room counts must be whole numbers.';
 if(['For Rent','For Lease','For Rent or Sale'].includes(form.listing_type)&&(!form.rent_usd||Number(form.rent_usd)<=0))return 'Enter a rent greater than zero.';
 if(['For Sale','For Rent or Sale'].includes(form.listing_type)&&(!form.price_usd||Number(form.price_usd)<=0))return 'Enter a sale price greater than zero.';
 if(form.image_url.trim())try{const url=new URL(form.image_url.trim());if(!['http:','https:'].includes(url.protocol)||url.username||url.password)return 'Use a public HTTP or HTTPS image URL.';}catch{return 'Enter a valid image URL.';}
 return null;
}
