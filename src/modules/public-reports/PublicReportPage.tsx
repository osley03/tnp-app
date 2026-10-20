import { Link } from "@tanstack/react-router";
import { useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, CheckCircle2, FileSearch, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import authBg from "@/assets/auth-bg.jpg";

type Receipt = {reference: string; tracking_code: string; status: string};
type CaseStatus = {reference: string; status: string; resolution: string | null; updated_at: string};
const categories = [["property_scam","Property scam"],["land_scam","Land scam"],["payment_scam","Payment scam"],["identity_fraud","Identity fraud"],["fake_listing","Fake listing"],["impersonation","Impersonation"],["other","Other concern"]];
const initial = {name:"",email:"",phone:"",case_type:"fake_listing",title:"",description:"",location:"",scammer_name:"",amount:"0",payment_reference:"",evidence:"",website:""};
export function PublicReportPage() {
  const [tab,setTab] = useState<"report"|"track">("report");
  const [form,setForm] = useState(initial);
  const [receipt,setReceipt] = useState<Receipt|null>(null);
  const [reference,setReference] = useState("");
  const [code,setCode] = useState("");
  const [status,setStatus] = useState<CaseStatus|null>(null);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  function update(key: keyof typeof initial,value: string) {setForm(current=>({...current,[key]:value}));}
  async function submit(event: FormEvent) {
    event.preventDefault(); if(busy)return; setBusy(true);setError("");
    try {
      const evidence = form.evidence.split("\n").map(value=>value.trim()).filter(Boolean);
      if(evidence.length>10 || evidence.some(value=>{try{const url=new URL(value);return url.protocol!=="https:"||!!url.username||!!url.password;}catch{return true;}}))throw Error("Use up to ten secure HTTPS evidence links, one per line.");
      const {data,error:failure}=await supabase.rpc("tnp_submit_public_report" as never,{p_report:{...form,evidence}} as never);
      if(failure)throw Error(failure.message);
      const saved=data as unknown as Receipt;
      if(!saved?.reference||!saved.tracking_code)throw Error("The case receipt was not returned. Contact TNP support before resubmitting.");
      setReceipt(saved);setReference(saved.reference);setCode(saved.tracking_code);setForm(initial);
    }catch(cause){setError(cause instanceof Error?cause.message:"The report could not be submitted. Please try again.");}
    finally{setBusy(false);}
  }
  async function track(event: FormEvent) {
    event.preventDefault();if(busy)return;setBusy(true);setError("");setStatus(null);
    try{
      const {data,error:failure}=await supabase.rpc("tnp_track_public_report" as never,{p_reference:reference.trim(),p_tracking_code:code.trim()} as never);
      if(failure)throw Error(failure.message);setStatus(data as unknown as CaseStatus);
    }catch(cause){setError(cause instanceof Error?cause.message:"Case status could not be loaded.");}finally{setBusy(false);}
  }
  function downloadReceipt() {
    if(!receipt)return;
    const text=["TNP CASE RECEIPT","Reference: "+receipt.reference,"Private tracking code: "+receipt.tracking_code,"Status: Submitted", "Track your case at: "+window.location.origin+"/report", "Keep this code private. It gives access to your case status and resolution."].join("\n");
    const url=URL.createObjectURL(new Blob([text],{type:"text/plain;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="TNP-case-receipt.txt";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  return <main className="tnp-public-report" style={{backgroundImage:"linear-gradient(115deg,rgba(7,19,35,.92),rgba(7,19,35,.68)),url("+authBg+")"}}>
    <div className="tnp-report-shell"><header className="tnp-report-header"><Link to="/auth"><ArrowLeft size={16}/>Account access</Link><Link to="/">TNP · Tenant Network Profile</Link></header>
      <div className="tnp-report-layout"><aside className="tnp-report-intro"><ShieldAlert size={35}/><p className="tnp-report-eyebrow">A SAFER RENTAL COMMUNITY</p><h1>Speak up.<br/>We’ll take it seriously.</h1><p>Report a suspicious listing, payment request, impersonation or rental concern. Everyone can submit a report, even without a TNP account.</p><ol><li><strong>Tell us what happened.</strong> Include dates, locations and relevant references.</li><li><strong>Save your private case receipt.</strong> Use it to check progress without signing in.</li><li><strong>Our administrators review the case.</strong> The outcome appears in your case tracker.</li></ol><p className="tnp-report-privacy">Your contact details and evidence are shared with TNP administrators, never displayed in the public directory. This form does not contact emergency services.</p></aside>
      <section className="tnp-report-card" aria-label="Public reporting"><div className="tnp-report-tabs"><button type="button" aria-pressed={tab==="report"} onClick={()=>{setTab("report");setError("");}}>Submit a report</button><button type="button" aria-pressed={tab==="track"} onClick={()=>{setTab("track");setError("");}}>Track a case</button></div>
      {error&&<p role="alert" className="tnp-report-error">{error}</p>}
      {tab==="report" ? receipt ? <div className="tnp-report-success" role="status"><CheckCircle2 size={36}/><h2>Your report has reached TNP.</h2><p>The case is saved in the administrator’s case queue for review.</p><Field label="Case reference"><input readOnly value={receipt.reference}/></Field><Field label="Private tracking code"><input readOnly value={receipt.tracking_code}/></Field><p>Download this receipt before leaving. Your tracking code is private and cannot be recovered on this page.</p><button type="button" className="tnp-report-primary" onClick={downloadReceipt}>Download case receipt</button><button type="button" className="tnp-report-secondary" onClick={()=>setTab("track")}>Check case status</button><button type="button" className="tnp-report-secondary" onClick={()=>setReceipt(null)}>Submit another report</button></div> : <form onSubmit={submit} className="tnp-report-form"><h2>Report suspicious activity</h2><p>Fields marked * are required. Share facts and avoid including passwords or payment PINs.</p>
        <div className="tnp-report-grid"><Field label="Your name *"><input required maxLength={150} minLength={2} autoComplete="name" value={form.name} onChange={e=>update("name",e.target.value)}/></Field><Field label="Email address *"><input required type="email" maxLength={254} autoComplete="email" value={form.email} onChange={e=>update("email",e.target.value)}/></Field></div>
        <div className="tnp-report-grid"><Field label="Phone number"><input type="tel" maxLength={50} autoComplete="tel" value={form.phone} onChange={e=>update("phone",e.target.value)}/></Field><Field label="Report category *"><select value={form.case_type} onChange={e=>update("case_type",e.target.value)}>{categories.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></Field></div>
        <Field label="Report title *"><input required minLength={5} maxLength={300} placeholder="A short summary of the concern" value={form.title} onChange={e=>update("title",e.target.value)}/></Field>
        <Field label="What happened? *"><textarea required minLength={30} maxLength={20000} rows={5} placeholder="Explain what happened, when, and who was involved (at least 30 characters)." value={form.description} onChange={e=>update("description",e.target.value)}/></Field>
        <div className="tnp-report-grid"><Field label="Property or incident location"><input maxLength={300} value={form.location} onChange={e=>update("location",e.target.value)}/></Field><Field label="Person or business involved"><input maxLength={200} value={form.scammer_name} onChange={e=>update("scammer_name",e.target.value)}/></Field></div>
        <div className="tnp-report-grid"><Field label="Amount lost (USD)"><input type="number" min="0" max="9999999" step="0.01" required value={form.amount} onChange={e=>update("amount",e.target.value)}/></Field><Field label="Payment reference"><input maxLength={300} value={form.payment_reference} onChange={e=>update("payment_reference",e.target.value)}/></Field></div>
        <Field label="Evidence links (optional)"><textarea rows={3} maxLength={20000} placeholder="Paste secure links to screenshots, documents or the listing, one per line (up to 10)." value={form.evidence} onChange={e=>update("evidence",e.target.value)}/></Field><p className="tnp-report-hint">Make evidence links accessible to the administrator. Direct file attachments are not supported on this public form.</p>
        <label className="tnp-report-honeypot" aria-hidden="true">Leave this empty<input tabIndex={-1} autoComplete="off" value={form.website} onChange={e=>update("website",e.target.value)}/></label>
        <button type="submit" disabled={busy} className="tnp-report-primary">{busy?"Submitting…":"Submit report to TNP"}</button>
      </form> : <form onSubmit={track} className="tnp-report-form"><FileSearch size={30}/><h2>Check your case</h2><p>Enter the reference and private code from your downloaded receipt.</p><Field label="Case reference"><input required maxLength={100} value={reference} onChange={e=>setReference(e.target.value)}/></Field><Field label="Private tracking code"><input required minLength={64} maxLength={64} autoComplete="off" value={code} onChange={e=>setCode(e.target.value)}/></Field><button type="submit" disabled={busy} className="tnp-report-primary">{busy?"Checking…":"Check case status"}</button>{status&&<div role="status" className="tnp-report-status"><h3>{status.status.replaceAll("_"," ")}</h3><p>Updated {new Date(status.updated_at).toLocaleString()}</p><p className="whitespace-pre-wrap">{status.resolution||"Your report is awaiting an outcome. Check this page again for updates."}</p></div>}</form>}
      </section></div>
    </div>
  </main>;
}
function Field({label,children}:{label:string;children:ReactNode}) {return <label className="tnp-report-field"><span>{label}</span>{children}</label>;}
