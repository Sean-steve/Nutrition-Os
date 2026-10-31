import {useCallback,useEffect,useMemo,useRef,useState,type FormEvent} from 'react';
import {
  Activity,AlertTriangle,Apple,ArrowRight,BarChart3,BookOpen,CalendarDays,CheckCircle2,
  ChevronLeft,ChevronRight,Heart,Home,Leaf,LockKeyhole,Menu,Package,
  Search,Settings,ShieldCheck,ShoppingBasket,Signpost, Sparkles,Target,TrendingUp,
  Users,Utensils,Wallet,X
} from 'lucide-react';
import {NutritionClient,LiveApiError,apiOrigin,type LiveSnapshot} from './client';
import {Head,Empty,Loading,shiftDay,todayIso} from './components';
import {isLiveRoute,type LiveRoute,type LiveProps} from './types';
import {DashboardScreen,ProfileScreen,FoodScreen,RecipeScreen,MealsScreen,ProgressScreen} from './screens/Personal';
import {PlanScreen,GroceriesScreen,InventoryScreen,BudgetScreen,WasteScreen} from './screens/Resources';
import {InsightsScreen,GuideScreen,FamilyScreen} from './screens/FamilyInsights';
import KernelScreen from './KernelScreen';
import './live.css';

const mainNav=[
 ['dashboard','Dashboard',Home],['today','Today',CalendarDays],['meals','Meals',Utensils],
 ['planner','Meal Planner',CalendarDays],['foods','Food Library',Apple],['recipes','Recipes',BookOpen],
 ['groceries','Groceries',ShoppingBasket],['inventory','Inventory',Package],
 ['budget','Food Budget',Wallet],['waste','Waste & Expiry',AlertTriangle],
 ['goals','Nutrition Goals',Target],['insights','Insights',BarChart3],
 ['progress','Progress',TrendingUp],['family','Family Kitchen',Users]
] as const;
const secondNav=[['assistant','Nutrition Guide',Sparkles],['profile','My Profile',Settings],['privacy','Privacy',ShieldCheck],['integrations','Integrations',Signpost]] as const;
type ModeProps={onPreview:()=>void};
const devLocal=(import.meta.env.DEV as boolean) && typeof window!=='undefined' && (['localhost','127.0.0.1'].includes(window.location.hostname));
function errorText(error:unknown):string{
 if(error instanceof LiveApiError)return error.message+(error.correlationId?' · Reference '+error.correlationId.slice(0,8):'');
 if(error instanceof Error){
  if(error.name==='AbortError')return 'Request cancelled.';
  if(error instanceof TypeError)return 'Cannot reach the Nutrition OS API. Confirm the backend is running, the URL/CORS settings are correct and TLS is enabled.';
  return error.message;
 }
 return 'The request could not be completed.';
}
function SignIn({onSignIn,onPreview}:{onSignIn:(token:string)=>void;onPreview:()=>void}){
 const [value,setValue]=useState('');
 let origin='';
 try{origin=apiOrigin();}catch{origin='INVALID_URL';}
 const allowed=devLocal && origin!=='INVALID_URL';
 function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();if(allowed&&value.trim())onSignIn(value.trim());setValue('');}
 return <div className="lv-login-outer"><section className="lv-login-card">
   <div className="lv-login-logo"><Leaf size={29}/><div><strong>Nutrition OS</strong><small>Eat · Plan · Live Better.</small></div></div>
   <span className="eyebrow"><LockKeyhole size={15}/> AUTHENTICATED WORKSPACE</span>
   <h1>Your nutrition. Your records.</h1>
   <p>Nutrition OS now connects to a PostgreSQL-backed API. Empty accounts begin empty. No example meals or fabricated nutrient history are loaded into the authenticated experience.</p>
   {allowed?<form onSubmit={submit} className="lv-form">
     <label className="lv-field"><span>Signed local development token</span><textarea value={value} rows={3} onChange={e=>setValue(e.target.value)} placeholder="Paste the token from npm --prefix server run dev:token" required autoComplete="off" spellCheck={false}/></label>
     <button type="submit" className="primary-button" disabled={!value.trim()}><LockKeyhole size={16}/> Open development workspace</button>
     <div className="lv-note"><ShieldCheck size={17}/><div><strong>Local development only</strong><p>JWT stays in React memory and expires. It is never persisted, placed in a URL, or sent to GitHub Pages. Generate tokens with the local backend command.</p></div></div>
   </form>:<div className="lv-note warn"><AlertTriangle size={18}/><div><strong>Verified identity provider not connected</strong><p>Production access requires Personal Kernel sign-in and a configured HTTPS API. Pasting credentials into an untrusted static site is disabled. The live workspace cannot be unlocked until HumanKernelOS provisions its identity issuer and an authorized token exchange.</p></div></div>}
   <div className="lv-login-actions"><button className="outlined-button" type="button" onClick={onPreview}>Open sample UI preview <ArrowRight size={15}/></button><span>API: {origin||'same-origin /api proxy'}</span></div>
 </section></div>;
}
function OtherPage({p}:{p:LiveProps}){
 if(p.route==='privacy')return <div className="lv-page"><Head icon={ShieldCheck} title="Privacy and Data Authority" tag="GOVERNANCE" description="Authenticated records are scoped to your verified token and database identity."/>
  <section className="panel lv-panel"><h2>Your signed workspace</h2><p>Subject: {p.data.session.userId}</p><p>Tenant: {p.data.session.tenantId}</p><p>Verification: {p.data.session.identitySource}</p>
   <p>Personal meals, goals and nutrition details are separate from shared family kitchen logistics. Only accepted household members can view sanitized shared boards. No data is automatically published.</p>
   <div className="lv-note"><LockKeyhole size={18}/><div><strong>Account deletion and consent export are not certified yet.</strong><p>Kernel-signed consent assertions are supported but require actual deployment. Full data export/erasure and production security certification remain outstanding.</p></div></div></section></div>;
 return <div className="lv-page"><Head icon={Signpost} title="Integrations" tag="EXTERNAL AUTHORITY" description="Nutrition OS does not impersonate other engines."/>
  <section className="panel lv-panel"><Empty title="No external engines connected" description="Personal Kernel identity, Family OS membership, Finance OS transactions, Health OS records and Fitness/Calendar projections require explicit contracts, consent and production identity. No demo integration is presented as real."/></section></div>;
}
function CurrentScreen(p:LiveProps){
 switch(p.route){
 case 'dashboard':return <DashboardScreen p={p}/>;
 case 'onboarding':case 'profile':case 'goals':return <ProfileScreen p={p}/>;
 case 'today':case 'meals':return <MealsScreen p={p}/>;
 case 'foods':return <FoodScreen p={p}/>;
 case 'recipes':return <RecipeScreen p={p}/>;
 case 'progress':return <ProgressScreen p={p}/>;
 case 'planner':return <PlanScreen p={p}/>;
 case 'groceries':return <GroceriesScreen p={p}/>;
 case 'inventory':return <InventoryScreen p={p}/>;
 case 'budget':return <BudgetScreen p={p}/>;
 case 'waste':return <WasteScreen p={p}/>;
 case 'insights':return <InsightsScreen p={p}/>;
 case 'assistant':return <GuideScreen p={p}/>;
 case 'family':return <FamilyScreen p={p}/>;
 case 'integrations':return <KernelScreen p={p}/>;
 default:return <OtherPage p={p}/>;
 }
}
function fromHash():LiveRoute{
 const next=window.location.hash.replace(/^#\/?/,'').split('/')[0]||'dashboard';
 return isLiveRoute(next)?next:'dashboard';
}
export default function LiveApp({onPreview}:ModeProps){
 const [token,setToken]=useState<string|null>(null);
 const [route,setRoute]=useState<LiveRoute>(fromHash);
 const [date,setDate]=useState(todayIso);
 const [data,setData]=useState<LiveSnapshot|null>(null);
 const [busy,setBusy]=useState(false),[refresh,setRefresh]=useState(0);
 const [error,setError]=useState(''),[success,setSuccess]=useState('');
 const [menuOpen,setMenuOpen]=useState(false);
 const sequence=useRef(0);
 const [query,setQuery]=useState('');
 const endSession=useCallback(()=>{sequence.current++;setToken(null);setData(null);setError('Session expired. Sign in again with a fresh verified token.');},[]);
 const client=useMemo(()=>token?new NutritionClient(token,endSession):null,[token,endSession]);
 const navigate=(next:LiveRoute)=>{setRoute(next);window.location.hash=next==='dashboard'?'#/':'#/'+next;setMenuOpen(false);setSuccess('');setError('');};
 useEffect(()=>{
   const change=()=>setRoute(fromHash());
   window.addEventListener('hashchange',change);
   return()=>window.removeEventListener('hashchange',change);
 },[]);
 useEffect(()=>{
  if(!client)return;
  const ctrl=new AbortController(),id=++sequence.current;
  setBusy(true);setError('');
  client.load(date,ctrl.signal).then(v=>{if(id===sequence.current)setData(v);})
   .catch(e=>{if(id===sequence.current&&!(e instanceof Error&&e.name==='AbortError')){setData(null);setError(errorText(e));}})
   .finally(()=>{if(id===sequence.current)setBusy(false);});
  return()=>{ctrl.abort();sequence.current++;};
 },[client,date,refresh]);
 const perform=useCallback(async(action:()=>Promise<unknown>,message:string)=>{
  if(!client||busy)return false;
  setBusy(true);setError('');setSuccess('');
  try{
   await action();
   const updated=await client.load(date);
   // A completed mutation reads actual persisted state; never optimistic fake success.
   if(token){setData(updated);setSuccess(message);}
   return true;
  }catch(e){setError(errorText(e));return false;}
  finally{setBusy(false);}
 },[client,date,busy,token]);
 function signOut(){sequence.current++;client?.clear();setToken(null);setData(null);setSuccess('');setError('');}
 const offline=token&&!data&&!busy;
 if(!token)return <SignIn onSignIn={setToken} onPreview={onPreview}/>;
 const props=data&&client?{client,data,date,route,busy,perform,navigate,setDate}:null;
 const search=mainNav.concat(secondNav as unknown as typeof mainNav).filter(x=>x[1].toLowerCase().includes(query.trim().toLowerCase()));
 return <div className="app-shell lv-shell">
    <div className={'sidebar-overlay '+(menuOpen?'show':'')} aria-hidden="true" onClick={()=>setMenuOpen(false)}/>
    <aside className={'sidebar '+(menuOpen?'open':'')} aria-label="Authenticated navigation">
      <div className="brand"><div className="brand-mark"><Leaf size={29}/></div><div><strong>Nutrition OS</strong><small>LIVE WORKSPACE</small></div><button type="button" className="mobile-close" aria-label="Close menu" onClick={()=>setMenuOpen(false)}><X size={21}/></button></div>
      <nav className="sidebar-links" aria-label="Nutrition modules">{mainNav.map(([id,label,Icon])=><button className={'side-link '+(route===id?'active':'')} type="button" key={id} onClick={()=>navigate(id)}><Icon size={18}/><span>{label}</span></button>)}</nav>
      <div className="sidebar-separator"/>
      <nav className="sidebar-links secondary">{secondNav.map(([id,label,Icon])=><button className={'side-link '+(route===id?'active':'')} type="button" key={id} onClick={()=>navigate(id)}><Icon size={18}/><span>{label}</span></button>)}</nav>
      <div className="sidebar-bottom"><div className="lv-live-sidebar"><ShieldCheck size={22}/><div><strong>Verified session</strong><small>{data?.session.identitySource??'Connecting to API'}</small></div><button type="button" onClick={signOut}>Sign out</button></div><div className="sidebar-caption"><Heart size={14}/> Every record stays yours.</div></div>
    </aside>
    <div className="app-column">
      <header className="topbar">
        <div className="topbar-left"><button type="button" className="icon-button hamburger" onClick={()=>setMenuOpen(true)} aria-label="Open navigation"><Menu size={23}/></button>
          <div className="global-search"><Search size={18}/><label className="sr-only" htmlFor="lv-nav-search">Find modules</label>
            <input id="lv-nav-search" value={query} placeholder="Find a nutrition workspace…" onChange={e=>setQuery(e.target.value)}/>
            {query&&<div className="search-results">{search.map(([id,label,Icon])=><button key={id} type="button" onClick={()=>{navigate(id);setQuery('');}}><Icon size={17}/>{label}</button>)}{!search.length&&<p>No matching section</p>}</div>}
          </div>
        </div>
        <div className="topbar-right">
          <div className="date-picker"><button className="icon-button" type="button" aria-label="Previous day" onClick={()=>setDate(d=>shiftDay(d,-1))}><ChevronLeft size={16}/></button><span><CalendarDays size={16}/>{date}</span><button className="icon-button" type="button" aria-label="Next day" onClick={()=>setDate(d=>shiftDay(d,1))}><ChevronRight size={16}/></button></div>
          <button type="button" className="profile-button" onClick={()=>navigate('profile')}><span className="avatar">{data?.profile?.display_name?.slice(0,1).toUpperCase()||'N'}</span><span className="profile-copy"><b>{data?.profile?.display_name||'Your nutrition'}</b><small>Authenticated</small></span></button>
        </div>
      </header>
      <main className="workspace lv-workspace">
        <div className="workspace-toolbar"><span className="preview-badge lv-live-tag"><span className="preview-dot"/> SIGNED SESSION · POSTGRESQL DATA</span>
          <div className="toolbar-actions"><button type="button" className="outlined-button" onClick={()=>setRefresh(n=>n+1)} disabled={busy}><Activity size={15}/> Refresh</button><button type="button" className="outlined-button" onClick={signOut}><LockKeyhole size={15}/> Sign out</button></div>
        </div>
        {error&&<div className="lv-error" role="alert"><AlertTriangle size={18}/><span>{error}</span><button type="button" onClick={()=>setError('')} aria-label="Dismiss error"><X size={16}/></button></div>}
        {success&&<div className="lv-success" role="status"><CheckCircle2 size={18}/>{success}<button type="button" onClick={()=>setSuccess('')} aria-label="Dismiss message"><X size={16}/></button></div>}
        {busy&&!data?<Loading/>:offline?<section className="panel lv-panel"><Empty title="Nutrition API unavailable" description="No private data was loaded. Verify the server, token, network, PostgreSQL migrations and allowed origin before retrying." action={<button type="button" className="outlined-button" disabled={busy} onClick={()=>setRefresh(n=>n+1)}>Retry connection <ArrowRight size={15}/></button>}/></section>:data&&props?<CurrentScreen {...props}/>:<Loading/>}
        <footer className="page-footer">Nutrition OS · Phase 7 governed engine integration boundary <span>Logged facts only · Incomplete observations are unknown · Not medical advice</span></footer>
      </main>
    </div>
  </div>;
}
