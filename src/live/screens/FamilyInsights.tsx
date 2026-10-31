import {useState,type FormEvent} from 'react';
import {Activity,AlertTriangle,ArrowRight,BarChart3,CalendarDays,HeartHandshake,Info,LockKeyhole,Plus,Send,ShieldCheck,ShoppingBasket,Sparkles,Target,Users} from 'lucide-react';
import type {LiveProps} from '../types';
import {asNumber,money,dateOnly} from '../client';
import {Action,Card,Empty,Field,Head,Note,Stat} from '../components';
function insightFacts(p:LiveProps):{title:string;message:string;source:string;route:LiveProps['route'];kind:'observation'|'limitation'|'resource'}[]{
 const result=[];
 const s=p.data.state;
 if(s.intake){
  result.push({title:'What your meal log contains',message:s.observedMeals+' recorded meal(s) represent '+Math.round(s.intake.energyKcal)+' kcal and '+s.intake.proteinG.toFixed(1)+'g protein. These numbers describe only logged meals, not complete actual intake.',source:'Server meal snapshot totals · unverified food composition',route:'meals' as const,kind:'observation' as const});
 }else{
  result.push({title:'Today’s intake is unknown',message:'No confirmed meals were recorded for '+p.date+'. This does not establish zero intake, a missed meal or a physiological deficiency.',source:'Server state: observationStatus = unknown',route:'today' as const,kind:'limitation' as const});
 }
 const rows=p.data.progress.observations;
 result.push({title:'Observation coverage',message:rows.length+' distinct date(s) with recorded intake in the last 90 days. '+(rows.length<3?'This is not enough to describe a pattern.':'Descriptive averages exclude all unobserved dates.'),source:'GET /progress · explicit logged days, no synthetic history',route:'progress' as const,kind:rows.length<3?'limitation' as const:'observation' as const});
 const active=p.data.groceries.find(g=>g.status==='active');
 const forecast=(active?.lines??[]).reduce((sum,l)=>sum+asNumber(l.quantity_servings)*asNumber(l.unit_price_kes),0);
 result.push({title:'Grocery forecast versus recorded spending',message:'The current basket is estimated at '+money(forecast)+'. Across all lists, '+money(p.data.budget.explicitRecordedPaidKes)+' was manually entered as paid. These are not Finance OS transaction records.',source:'Server grocery lines, unit prices and explicitly entered amounts',route:'budget' as const,kind:'resource' as const});
 const expiring=p.data.inventory.filter(l=>asNumber(l.balance)>0&&l.expires_on&&dateOnly(l.expires_on)<p.date);
 if(expiring.length)result.push({title:'Expired stock requires attention',message:expiring.length+' recorded lot(s) have positive stock balances beyond their expiry. Do not consume expired food; check inventory and record disposal explicitly.',source:'Server inventory lot dates + ledger balances',route:'waste' as const,kind:'resource' as const});
 return result;
}
export function InsightsScreen({p}:{p:LiveProps}){
 const facts=insightFacts(p),coverage=p.data.progress.observations.length;
 return <div className="lv-page"><Head icon={BarChart3} tag="EVIDENCE FIRST" title="Nutrition Intelligence" description="Explainable insights based exclusively on your signed account’s recorded data. No unverified diagnoses, forecast success rates or fabricated trend." action={<Action onClick={()=>p.navigate('assistant')}>Ask Nutrition Guide</Action>}/>
  <div className="lv-stats"><Stat icon={CalendarDays} title="Observed dates" value={String(coverage)} detail="Missing dates remain unknown"/><Stat icon={Activity} title="Logged meals today" value={String(p.data.state.observedMeals)} detail="No planned meals counted"/><Stat icon={Target} title="Descriptive trend" value={coverage>=3?'Available':'Insufficient history'} detail="At least 3 observed dates required"/><Stat icon={ShieldCheck} title="Confidence" value="Limited" detail="Unverified user food composition"/></div>
  <Note warn>Food entries and meal nutrient totals are user-entered estimates. Clinical adequacy, micronutrient deficiencies, dietary safety and medical requirements cannot be determined from this dataset.</Note>
  <div className="lv-grid-two"><Card title="Insights with traceable evidence" detail="Every statement identifies its data source and limitation.">
   <div className="lv-insight-list">{facts.map(x=><article className="lv-insight-card" key={x.title}><span className={'lv-state-chip '+x.kind}>{x.kind}</span><h3>{x.title}</h3><p>{x.message}</p><div className="lv-evidence"><ShieldCheck size={15}/><span><strong>Evidence:</strong> {x.source}</span></div><button className="outlined-button" type="button" onClick={()=>p.navigate(x.route)}>Open source workflow <ArrowRight size={14}/></button></article>)}</div>
  </Card><div className="lv-stack"><Card title="Food safety constraints" detail="Decisions stay operator-controlled.">
   <div className="lv-action-list">{[['Verify ingredients and serving labels','foods'],['Review approved meal plans','planner'],['Check food expiry','waste'],['Manage personal goals','goals']].map(([t,r])=><button type="button" key={t} onClick={()=>p.navigate(r as LiveProps['route'])}><span>{t}</span><ArrowRight size={15}/></button>)}</div>
   <p className="lv-help">Automated meal suitability and allergen clearance are disabled pending validated food provenance and consent policies.</p>
  </Card><Card title="Family data remains private" detail="Shared kitchen logistics are a distinct domain.">
   <Note><strong>Access control:</strong> Family boards expose only meals explicitly shared, grocery items and cooking tasks. Other members' intake records and targets are never included.</Note>
   <Action outline onClick={()=>p.navigate('family')}>Shared kitchen board</Action>
  </Card></div></div>
 </div>;
}
const medical=/\b(newborn|infant|baby|toddler|pregnan\w*|breastfeed\w*|diabet\w*|allerg\w*|medication|anorexia|bulimia|eating disorder|severe|fasting|purge|starve|kidney disease|weight loss pill)\b/i;
function answer(p:LiveProps,question:string):{title:string;answer:string;source:string;to:LiveProps['route']|null}{
 const q=question.trim().toLowerCase();
 if(medical.test(q))return {title:'Medical nutrition safety boundary',
  answer:'Nutrition OS cannot diagnose or prescribe diets for medical conditions, pregnancy, children, allergies or disordered eating. Seek guidance from a qualified clinician or registered dietitian. Seek urgent care for severe symptoms.',
  source:'Safety policy · no clinical engine or validated allergies',to:null};
 if(/\b(protein|calories|calorie|intake|logged|today)\b/.test(q)){
  const s=p.data.state;
  return s.intake?
   {title:'Your partial observed intake',answer:s.observedMeals+' recorded meal(s) on '+p.date+' sum to '+s.intake.energyKcal+' kcal and '+s.intake.proteinG+'g protein. Unknown unlogged intake must not be treated as zero.',source:'GET /state · verified actor, unverified user-entered food snapshots',to:'meals'}:
   {title:'No observed intake',answer:'No meals are logged for '+p.date+'. That is unknown intake, not evidence of a dietary deficit. Record only meals you actually ate.',source:'GET /state → intake: null',to:'today'};
 }
 if(/\b(shopping|grocer|buy|budget|spend|money|cost|kes)\b/.test(q)){
  const active=p.data.groceries.find(g=>g.status==='active');
  return {title:'Manual grocery and budget context',answer:(active?.lines.length??0)+' current grocery line(s). '+money(p.data.budget.explicitRecordedPaidKes)+' total manually entered paid amounts; no bank or Finance OS is connected.',source:'GET /groceries and GET /budget',to:'groceries'};
 }
 if(/\b(family|household|member|share|privacy)\b/.test(q)){
  return {title:'Shared kitchen privacy',answer:'Only meal schedules you explicitly publish, shared grocery items and cooking tasks are available to members who accept their invitations. Personal meal observations, goals and private preferences are not shared.',source:'GET /family · accepted-member server/RLS projection',to:'family'};
 }
 if(/\b(expir|waste|pantry|inventory|fridge)\b/.test(q)){
  return {title:'Recorded stock facts',answer:p.data.inventory.length+' personal inventory lot(s) have been recorded. Dates are user-entered, not an assurance of food safety. Check current stock and recorded expiry.',source:'GET /inventory · database-derived ledger balances',to:'waste'};
 }
 if(/\b(plan|dinner|lunch|breakfast|recipe|food|eat)\b/.test(q)){
  return {title:'Planning without prescriptions',answer:'You have '+p.data.plans.filter(x=>x.status==='approved').length+' approved weekly plan(s). Recipes use unverified food records. I cannot prescribe or certify meal suitability, allergens or medical requirements. Open Planner to make a human-approved choice.',source:'GET /plans and personal recipe records',to:'planner'};
 }
 return {title:'Nutrition Guide capabilities',answer:'I can explain your observed meal data, grocery estimates, plan status, pantry records and family sharing. This is a local deterministic guide, not a connected AI model. I cannot mutate data, diagnose illness or inspect other members’ private records.',source:'Read-only signed API snapshot in browser memory',to:'insights'};
}
type Turn={id:number;role:'user'|'guide';text:string;title?:string;source?:string;to?:LiveProps['route']|null};
export function GuideScreen({p}:{p:LiveProps}){
 const [input,setInput]=useState(''),[turns,setTurns]=useState<Turn[]>([{id:0,role:'guide',title:'Nutrition Guide — explainable preview',
  text:'Ask about the actual meal log, pantry, planning, groceries and privacy. I am rule-based and read-only; no AI model is connected.',source:'Phase 6 scope'}]);
 function ask(text:string){
  if(!text.trim()||text.length>300)return;
  const result=answer(p,text),id=Date.now()+Math.random();
  setTurns(v=>[...v,{id:id,role:'user',text},{id:id+1,role:'guide',text:result.answer,title:result.title,source:result.source,to:result.to}]);setInput('');
 }
 return <div className="lv-page"><Head icon={Sparkles} tag="READ-ONLY GUIDE" title="Ask. Understand. Decide." description="Context comes only from your authorized backend records. Responses are deterministic, not LLM-generated or medical advice."/>
  <div className="lv-grid-two lv-guide-grid"><Card title="Nutrition Guide" detail="No chatbot API, no silent tool calls or automatic actions">
    <div className="lv-chat" role="log" aria-label="Nutrition guide conversation" aria-live="polite">{turns.map(t=><div className={'lv-chat-turn '+t.role} key={t.id}><span className="lv-chat-avatar">{t.role==='guide'?'❧':'You'}</span><div><strong>{t.title}</strong><p>{t.text}</p>{t.source&&<small><ShieldCheck size={13}/> {t.source}</small>}{t.to&&<button type="button" className="lv-link" onClick={()=>p.navigate(t.to!)}>Open {t.to} <ArrowRight size={13}/></button>}</div></div>)}</div>
    <div className="lv-suggestions">{['What have I logged today?','What is my grocery budget?','Which foods expire?','How does sharing work?'].map(q=><button className="outlined-button" type="button" key={q} onClick={()=>ask(q)}>{q}</button>)}</div>
    <form className="lv-chat-input" onSubmit={e=>{e.preventDefault();ask(input);}}><label className="sr-only" htmlFor="live-guide-query">Ask Nutrition Guide</label><input id="live-guide-query" value={input} maxLength={300} onChange={e=>setInput(e.target.value)} placeholder="Ask about your recorded nutrition…"/><button type="submit" disabled={!input.trim()} className="primary-button"><Send size={16}/>Ask</button></form>
    <p className="lv-help">No transcript is sent to a model or stored in a database. Refreshing the page clears this session.</p>
  </Card><div className="lv-stack"><Card title="Trust and boundaries"><div className="lv-permission"><ShieldCheck size={18}/>Signed, scoped nutrition data</div><div className="lv-permission"><LockKeyhole size={18}/>Cannot access other people’s private meals</div><div className="lv-permission"><AlertTriangle size={18}/>No medical or allergen safety advice</div><div className="lv-permission"><Info size={18}/>No autonomous mutations or purchases</div></Card><Card title="Need more evidence?"><Action outline onClick={()=>p.navigate('insights')}>View observed insights</Action><p className="lv-help">Nutrition intelligence is limited until validated food sources and an authorized AI gateway are implemented.</p></Card></div></div>
 </div>;
}
export function FamilyScreen({p}:{p:LiveProps}){
 const [name,setName]=useState(''),[userId,setUserId]=useState(''),[alias,setAlias]=useState(''),[role,setRole]=useState<'viewer'|'editor'>('viewer');
 const [boardId,setBoardId]=useState(''),[planId,setPlanId]=useState('');
 const [taskMealId,setTaskMealId]=useState(''),[assigned,setAssigned]=useState(''),[taskStatus,setTaskStatus]=useState<'planned'|'preparing'|'completed'>('planned'),[taskNote,setTaskNote]=useState('');
 const [groceryTitle,setGroceryTitle]=useState(''),[groceryQty,setGroceryQty]=useState('1'),[groceryCost,setGroceryCost]=useState('0');
 const boards=p.data.family.boards,board=boards.find(b=>b.id===boardId)??boards[0]??null;
 const canEdit=board?.role==='owner'||board?.role==='editor';
 async function create(e:FormEvent<HTMLFormElement>){e.preventDefault();
  if(await p.perform(()=>p.client.post('/family',{name:name.trim()}),'Household kitchen created; personal health records remain private.'))setName('');
 }
 async function invite(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!board)return;
  if(await p.perform(()=>p.client.post('/family/'+board.id+'/invites',{userId,alias,role}),'Invitation created. The signed subject must accept before viewing the board.')){setUserId('');setAlias('');}
 }
 async function accept(id:string){await p.perform(()=>p.client.post('/family/'+id+'/accept',{}),'Invitation accepted. Shared kitchen resources are now available.');}
 async function share(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!board)return;
  await p.perform(()=>p.client.post('/family/'+board.id+'/share-plan',{planId}),'Approved meal schedule explicitly published; no personal intake data shared.');
 }
 async function task(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!board)return;
  await p.perform(()=>p.client.put('/family/'+board.id+'/tasks',{mealId:taskMealId,assignedUserId:assigned,note:taskNote,status:taskStatus}),'Shared kitchen task saved. No meal was logged as eaten.');
 }
 async function grocery(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!board)return;
  if(await p.perform(()=>p.client.post('/family/'+board.id+'/groceries',{title:groceryTitle,quantity:groceryQty,estimateKes:Number(groceryCost)}),
   'Shared grocery added. No private purchase or Finance OS information shared.')){setGroceryTitle('');setGroceryQty('1');setGroceryCost('0');}
 }
 async function check(itemId:string,checked:boolean){if(!board)return;
  await p.perform(()=>p.client.patch('/family/'+board.id+'/groceries/'+itemId,{checked}),'Shared grocery task updated.');
 }
 const participants=board?[{id:board.ownerUserId,alias:'Household owner',role:'owner'},...board.members.filter(m=>m.state==='accepted').map(m=>({id:m.member_user_id,alias:m.alias,role:m.role}))]:[];
 return <div className="lv-page"><Head icon={Users} tag="SHARED KITCHEN AUTHORITY" title="Family Nutrition Command Center" description="Real signed-member invitations and consent-by-acceptance for shared meal plans, grocery checklists and cooking tasks. No private intake or health profiles."/>
  <Note><strong>Household boundary:</strong> This is a temporary Nutrition OS kitchen-sharing arrangement, not Family OS membership authority. Only the invited signed-in subject can accept access. Personal meal logs and goals are not projected.</Note>
  {p.data.family.invites.length>0&&<Card title="Pending invitations addressed to you" detail="Accept with your verified signed identity; another user cannot accept on your behalf.">
    <div className="lv-rows">{p.data.family.invites.map(inv=><div className="lv-row" key={inv.household_id}><LockKeyhole size={20}/><span><strong>Household invitation</strong><small>Role: {inv.role} · invited as {inv.alias}</small></span><button className="primary-button" type="button" disabled={p.busy} onClick={()=>void accept(inv.household_id)}>Accept invitation</button></div>)}</div>
  </Card>}
  {!boards.length?<Card title="Create your shared kitchen" detail="Start a private, explicitly shared workspace—not a fake family roster."><form onSubmit={create} className="lv-form"><Field title="Household kitchen name"><input required value={name} maxLength={120} placeholder="Our kitchen" onChange={e=>setName(e.target.value)}/></Field><button className="primary-button" type="submit" disabled={p.busy||!name.trim()}><Plus size={16}/>Create kitchen workspace</button></form></Card>:
  <>
   <div className="lv-house-selector"><Field title="Shared kitchen workspace"><select value={board?.id??''} onChange={e=>setBoardId(e.target.value)}>{boards.map(b=><option value={b.id} key={b.id}>{b.name} · {b.role}</option>)}</select></Field><span>{board?.role==='owner'?'You own this shared board':board?.role==='editor'?'Editing granted after invitation acceptance':'View-only shared access'}</span></div>
   {board&&<><div className="lv-stats"><Stat icon={Users} title="Accepted members" value={String(board.members.filter(m=>m.state==='accepted').length+1)} detail="Owner included"/><Stat icon={CalendarDays} title="Published meals" value={String(board.meals.length)} detail="Planned, never consumed"/><Stat icon={ShoppingBasket} title="Shared groceries" value={String(board.groceries.length)} detail="No personal financial amounts"/><Stat icon={HeartHandshake} title="Cooking assignments" value={String(board.tasks.length)} detail="Tasks are not meal logs"/></div>
   <div className="lv-grid-two"><Card title="Published family meal schedule" detail="Only the owner can explicitly publish an approved personal plan.">
     {!board.meals.length?<Empty title="Nothing published yet" description="No private planning information is shared automatically."/>:
     <div className="lv-rows">{board.meals.map(m=><div className="lv-row" key={m.id}><span className="lv-emojibox">🍲</span><span><strong>{m.title}</strong><small>{dateOnly(m.meal_date)} · {m.slot} · {asNumber(m.portions)} portions</small></span></div>)}</div>}
     {board.role==='owner'&&<form className="lv-form" onSubmit={share}><Field title="Publish an approved plan"><select value={planId} required onChange={e=>setPlanId(e.target.value)}><option value="">Select your approved plan</option>{p.data.plans.filter(x=>x.status==='approved').map(x=><option key={x.id} value={x.id}>{dateOnly(x.week_start)} · {x.entries.length} planned meals</option>)}</select></Field><button className="outlined-button" type="submit" disabled={p.busy||!planId}>Publish shared schedule <ArrowRight size={14}/></button></form>}
   </Card><Card title="Household grocery checklist" detail="This list is separate from your private grocery payments.">
     {!board.groceries.length?<Empty title="No shared groceries" description="An editor can add groceries when needed."/>:
     <div className="lv-rows">{board.groceries.map(g=><div className="lv-row" key={g.id}><label className="lv-check"><input type="checkbox" disabled={!canEdit||p.busy} checked={g.checked} onChange={e=>void check(g.id,e.target.checked)} aria-label={'Shared grocery '+g.title}/></label><span><strong>{g.title}</strong><small>{g.quantity} · estimate {money(g.estimate_kes)} (unverified)</small></span></div>)}</div>}
     {canEdit&&<form className="lv-form" onSubmit={grocery}><Field title="Food / item"><input maxLength={140} required value={groceryTitle} onChange={e=>setGroceryTitle(e.target.value)}/></Field><div className="lv-form-grid"><Field title="Quantity description"><input required maxLength={80} value={groceryQty} onChange={e=>setGroceryQty(e.target.value)}/></Field><Field title="Estimated KES"><input required type="number" min="0" max="1000000" step=".01" value={groceryCost} onChange={e=>setGroceryCost(e.target.value)}/></Field></div><button type="submit" className="outlined-button" disabled={p.busy||!groceryTitle.trim()}><Plus size={14}/> Add shared grocery</button></form>}
   </Card></div>
   <div className="lv-grid-two"><Card title="Cooking coordination" detail="Assigned members are the owner or accepted invitees. No individual nutrition tracking.">
     {!board.tasks.length?<p className="lv-help">No cooking responsibilities assigned.</p>:<div className="lv-rows">{board.tasks.map(t=><div className="lv-row" key={t.id}><CalendarDays size={18}/><span><strong>{board.meals.find(m=>m.id===t.meal_id)?.title??'Shared meal'}</strong><small>{participants.find(m=>m.id===t.assigned_user_id)?.alias??'Member'} · {t.status}</small><small>{t.note}</small></span></div>)}</div>}
     {canEdit&&board.meals.length>0&&<form className="lv-form" onSubmit={task}><Field title="Shared meal"><select required value={taskMealId} onChange={e=>setTaskMealId(e.target.value)}><option value="">Select published meal</option>{board.meals.map(m=><option key={m.id} value={m.id}>{m.title} · {dateOnly(m.meal_date)}</option>)}</select></Field>
      <div className="lv-form-grid"><Field title="Assigned participant"><select required value={assigned} onChange={e=>setAssigned(e.target.value)}><option value="">Choose accepted participant</option>{participants.map(m=><option value={m.id} key={m.id}>{m.alias} · {m.role}</option>)}</select></Field><Field title="Status"><select value={taskStatus} onChange={e=>setTaskStatus(e.target.value as typeof taskStatus)}><option value="planned">Planned</option><option value="preparing">Preparing</option><option value="completed">Completed</option></select></Field></div>
      <Field title="Preparation note"><input maxLength={160} value={taskNote} onChange={e=>setTaskNote(e.target.value)}/></Field><button className="outlined-button" type="submit" disabled={!taskMealId||!assigned||p.busy}>Save cooking assignment</button>
     </form>}
   </Card><Card title="Participants & permissions" detail="Only owner can invite or change roles. Signed members accept for themselves.">
     <div className="lv-rows">{participants.map(m=><div className="lv-row" key={m.id}><span className="lv-emojibox">👤</span><span><strong>{m.alias}</strong><small>{m.role} · {m.id.slice(0,8)}</small></span>
       {board.role==='owner'&&m.role!=='owner'&&<select aria-label={'Permission for '+m.alias} value={m.role} disabled={p.busy} onChange={e=>void p.perform(()=>p.client.patch('/family/'+board.id+'/members/'+m.id,{role:e.target.value}),'Household role updated.')}>
        <option value="viewer">Viewer</option><option value="editor">Editor</option></select>}
      </div>)}</div>
     {board.role==='owner'&&<form className="lv-form" onSubmit={invite}><Field title="Invited subject UUID (from verified identity)"><input required placeholder="Signed user UUID" value={userId} onChange={e=>setUserId(e.target.value)}/></Field><div className="lv-form-grid"><Field title="Display alias"><input required maxLength={70} value={alias} onChange={e=>setAlias(e.target.value)}/></Field><Field title="Initial role"><select value={role} onChange={e=>setRole(e.target.value as typeof role)}><option value="viewer">Viewer</option><option value="editor">Editor</option></select></Field></div><button className="outlined-button" type="submit" disabled={!userId||!alias||p.busy}><Plus size={14}/> Invite member</button></form>}
     {board.role==='owner'&&board.members.some(m=>m.state==='invited')&&<div className="lv-note"><Info size={17}/><span>Pending invitations cannot view the board until accepted. No email/SMS invitation service is connected.</span></div>}
   </Card></div></>}
  </>}
 </div>;
}
