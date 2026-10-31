import {useMemo,useState,type FormEvent,type ReactNode} from 'react';
import {
  Activity, AlertTriangle, ArrowRight, BarChart3, CalendarDays,
  ChevronDown, ChevronRight, CircleHelp, EyeOff, HeartHandshake,
  LockKeyhole, Plus, RotateCcw, Send,
  ShieldCheck, ShoppingBasket, Sparkles, Target, Trash2,
  Users, Wallet, X, type LucideIcon,
} from 'lucide-react';
import type {DecisionContext,Evidence,GuidedReply,InsightFeedback,NutritionInsight,FeedbackStatus} from '../domain/intelligence';
import {answerGuided,deriveInsights,loggedOnDate,previewCandidates} from '../domain/intelligence';
import {DEFAULT_PROFILE,DEFAULT_TARGETS,observedDays} from '../domain/personal';
import type {FamilyWorkspaceState,HouseholdRole,TaskStatus} from '../domain/family';
import {addMember,changeMember,familyProjection,memberRole,removeTask,saveTask,setPreferenceSharing} from '../domain/family';
import {daysUntil,lotBalance,mondayOf} from '../domain/resources';
import './intelligence.css';

export type IntelligenceRoute='insights'|'assistant'|'family';
export interface IntelligenceProps {
  route:IntelligenceRoute;context:DecisionContext;
  feedback:InsightFeedback[];onFeedback:(value:InsightFeedback)=>void;
  family:FamilyWorkspaceState;onFamily:(value:FamilyWorkspaceState)=>void;
  navigate:(route:string)=>void;notify:(title:string,body:string)=>void;
}
const money=(n:number)=>'KES '+Math.round(n).toLocaleString('en-KE');
function Header({icon:Icon,kicker,title,desc,actions}:{icon:LucideIcon;kicker:string;title:string;desc:string;actions?:ReactNode}){
  return <header className="in-head"><div><span className="eyebrow"><Icon size={15}/>{kicker}</span><h1>{title}</h1><p>{desc}</p></div>{actions&&<div className="in-head-actions">{actions}</div>}</header>;
}
function Panel({title,sub,children,action}:{title:string;sub?:string;children:ReactNode;action?:ReactNode}){
  return <section className="panel in-panel"><div className="in-panel-heading"><div><h2>{title}</h2>{sub&&<p>{sub}</p>}</div>{action}</div>{children}</section>;
}
function EvidenceDetails({items}:{items:Evidence[]}){
  return <details className="in-evidence"><summary><CircleHelp size={14}/> Why this appears · {items.length} evidence item{items.length===1?'':'s'} <ChevronDown size={14}/></summary>
    <div className="in-evidence-list">{items.map((item,i)=><div key={item.kind+'-'+i}><span className={'in-evidence-tag '+item.kind}>{item.kind}</span><div><strong>{item.label}</strong><p>{item.detail}</p></div></div>)}</div></details>;
}
function Badge({children,theme='green'}:{children:ReactNode;theme?:'green'|'gold'|'blue'|'red'}){
  return <span className={'in-badge '+theme}>{children}</span>;
}
function InsightCard({insight,status,onFeedback,onRoute}:{insight:NutritionInsight;status:FeedbackStatus|undefined;onFeedback:(status:FeedbackStatus)=>void;onRoute:()=>void}){
  const kindTheme=insight.kind==='limitation'?'gold':insight.kind==='resource'?'blue':'green';
  return <article className={'in-insight-card '+(status==='dismissed'?'muted':'')}>
    <div className="in-insight-top"><Badge theme={kindTheme}>{insight.kind}</Badge><span className="in-confidence">Confidence: {insight.confidence}</span></div>
    <h3>{insight.title}</h3><p>{insight.statement}</p><EvidenceDetails items={insight.evidence}/>
    <div className="in-insight-actions"><button className="outlined-button" type="button" onClick={onRoute}>{insight.action} <ArrowRight size={14}/></button>
      <button type="button" title="Mark insight helpful" className={'in-feedback-btn '+(status==='helpful'?'active':'')} aria-pressed={status==='helpful'} onClick={()=>onFeedback('helpful')}>Helpful</button>
      <button type="button" title="Mark insight not helpful" className={'in-feedback-btn '+(status==='not-helpful'?'active':'')} aria-pressed={status==='not-helpful'} onClick={()=>onFeedback('not-helpful')}>Not useful</button>
      <button type="button" title="Dismiss this insight" className={'in-feedback-btn '+(status==='dismissed'?'active':'')} aria-pressed={status==='dismissed'} onClick={()=>onFeedback('dismissed')}>Dismiss</button>
    </div>
  </article>;
}
function InsightsPage({p}:{p:IntelligenceProps}){
  const [category,setCategory]=useState<'all'|'observation'|'planning'|'resource'|'limitation'>('all');
  const [includeDismissed,setIncludeDismissed]=useState(false);
  const insights=useMemo(()=>deriveInsights(p.context),[p.context]);
  const candidates=useMemo(()=>previewCandidates(p.context),[p.context]);
  const records=observedDays(p.context.meals,'2026-10-31');
  const today=loggedOnDate(p.context);
  const helpful=p.feedback.filter(f=>f.status==='helpful').length;
  const visible=insights.filter(i=>(category==='all'||i.kind===category)&&(includeDismissed||!p.feedback.some(f=>f.insightId===i.id&&f.status==='dismissed')));
  const summary=records.length>=3?records.reduce((s,d)=>s+d.proteinG,0)/records.length:null;
  const selectedPlan=p.context.plans.find(x=>x.weekStart===mondayOf(p.context.asOf));
  return <div className="in-page"><Header icon={BarChart3} kicker="NUTRITION INTELLIGENCE" title="Understand the patterns. Choose the next action." desc="Explainable insights from observed example meals, approved plans and shared food resources—never synthetic health predictions." actions={<button className="primary-button" type="button" onClick={()=>p.navigate('assistant')}><Sparkles size={16}/>Ask Nutrition Guide</button>}/>
    <div className="in-stats">
      <div className="panel in-stat"><CalendarDays size={21}/><div><small>Observed dates</small><strong>{records.length}</strong><span>Only dates with logged meals</span></div></div>
      <div className="panel in-stat"><Activity size={21}/><div><small>Recorded meals today</small><strong>{today.length}</strong><span>Planned meals excluded</span></div></div>
      <div className="panel in-stat"><Target size={21}/><div><small>Protein across observed days</small><strong>{summary!==null?Math.round(summary)+' g':'Not enough data'}</strong><span>{summary!==null?'Partial observed-day mean':'Requires ≥3 observed dates'}</span></div></div>
      <div className="panel in-stat"><HeartHandshake size={21}/><div><small>Useful feedback</small><strong>{helpful}</strong><span>Only explicit preview feedback</span></div></div>
    </div>
    <div className="in-notice"><ShieldCheck size={18}/><div><strong>Intelligence with limits</strong><p>No medical status, nutrient deficiency, behavior success rate or next-week forecast is inferred from incomplete logs. All food composition and costs remain unverified example data.</p></div></div>
    <div className="in-columns"><Panel title="What the data actually says" sub={insights.length+' reasoned signals; select a type or review their evidence.'} action={<label className="in-small-select">Show <select aria-label="Filter insights" value={category} onChange={e=>setCategory(e.target.value as typeof category)}><option value="all">All</option><option value="observation">Observations</option><option value="planning">Planning</option><option value="resource">Resources</option><option value="limitation">Uncertainty</option></select></label>}>
      <div className="in-insight-list">{visible.map(item=><InsightCard insight={item} key={item.id}
        status={p.feedback.find(f=>f.insightId===item.id)?.status}
        onFeedback={status=>p.onFeedback({insightId:item.id,status,recordedOn:p.context.asOf})}
        onRoute={()=>p.navigate(item.route)}/>)}
        {!visible.length&&<div className="in-empty">Nothing in this filter. Dismissed signals can be shown below.</div>}</div>
      <label className="in-checkbox"><input type="checkbox" checked={includeDismissed} onChange={e=>setIncludeDismissed(e.target.checked)}/> Show dismissed insights</label>
    </Panel><div className="in-stack">
      <Panel title="Meal options to review" sub="Deterministic examples, not autonomous recommendations.">
        {p.context.profile.excludedFoods.trim() || p.context.profile.dietStyle!=='flexible'?
          <div className="in-warning"><AlertTriangle size={20}/><strong>Ingredient or dietary restrictions need verification</strong><p>Recipe suggestions are withheld because this prototype cannot reliably verify hidden allergens or exclusions.</p><button className="outlined-button" type="button" onClick={()=>p.navigate('profile')}>Review preferences</button></div> :
          candidates.length?<div className="in-candidates">{candidates.slice(0,4).map(r=><div className="in-candidate" key={r.id}><span>{r.emoji}</span><div><strong>{r.title}</strong><small>{Math.round(r.proteinG)}g protein · {money(r.costKes)} · {r.minutes} min</small><small>{r.availableIngredients}/{r.totalIngredients} ingredient(s) shown in eligible pantry stock</small><EvidenceDetails items={r.evidence}/></div></div>)}</div>:
          <div className="in-empty">No valid recipe options can be derived. Check your sample food records.</div>}
        <button className="outlined-button in-full" type="button" onClick={()=>p.navigate('planner')}>Review meal planner <ArrowRight size={15}/></button>
      </Panel>
      <Panel title="Plan, not consumption" sub="Current preview planning summary">
        <div className="in-plan-summary"><span><CalendarDays size={18}/>Meal plan</span><strong>{selectedPlan?.status??'No plan'}</strong></div>
        <p className="in-muted">{selectedPlan?.entries.length??0} planned meals in the selected period. Planning never automatically logs consumption or modifies inventory.</p>
        <button className="in-link" type="button" onClick={()=>p.navigate('planner')}>View plans <ArrowRight size={15}/></button>
      </Panel>
      <Panel title="Available observation history" sub="Missing days are not scored as zero.">
        {records.length?<div className="in-history">{records.slice(-7).map(d=><div key={d.date}><span>{d.date}<small>{d.logged} recorded meal(s)</small></span><div className="in-track"><i style={{width:Math.min(100,d.energyKcal/Math.max(1,p.context.targets.energyKcal)*100)+'%'}}/></div><b>{d.energyKcal} kcal</b></div>)}</div>:<div className="in-empty">No observed meal days in the preview.</div>}
        <button className="in-link" type="button" onClick={()=>p.navigate('progress')}>Open full progress <ArrowRight size={14}/></button>
      </Panel>
    </div></div></div>;
}
type ChatTurn={id:string;role:'user'|'guide';text:string;reply?:GuidedReply};
const starter:ChatTurn={id:'intro',role:'guide',text:'Hello! I am a guided, rule-based preview—not a live AI model. I can explain the sample meal log, planned food, groceries, expiry and family privacy. I will not diagnose, prescribe or make changes for you.'};
const questions=['How much protein have I logged?','What could I prepare for dinner?','What is the grocery budget?','Which foods expire soon?','How does family sharing work?'];
function AssistantPage({p}:{p:IntelligenceProps}){
  const [history,setHistory]=useState<ChatTurn[]>([starter]),[input,setInput]=useState('');
  const [showEvidence,setShowEvidence]=useState(true);
  const [scope,setScope]=useState<'personal'|'household'>('personal');
  const intents=['read-only','local preview','no AI provider','no medical advice'];
  function ask(question:string){
    const trimmed=question.trim();if(!trimmed)return;
    const safeContext=scope==='household'?{...p.context,meals:[],profile:DEFAULT_PROFILE,targets:DEFAULT_TARGETS}:p.context;
    const reply=answerGuided(safeContext,trimmed,scope);
    const stamp=Date.now()+'-'+Math.random().toString(36).slice(2,7);
    setHistory(old=>[...old,{id:stamp+'-u',role:'user',text:trimmed},{id:stamp+'-g',role:'guide',text:reply.message,reply}]);
    setInput('');
  }
  function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();ask(input);}
  return <div className="in-page"><Header icon={Sparkles} kicker="GUIDED NUTRITION" title="Ask. Understand. Decide." desc="A transparent, read-only nutrition assistant preview. No LLM provider, account data or medical intelligence is connected." actions={<button className="outlined-button" type="button" onClick={()=>{setHistory([starter]);setInput('');}}><RotateCcw size={15}/>Clear session chat</button>}/>
    <div className="in-columns in-assistant-columns"><Panel title="Nutrition Guide" sub="A contextual walkthrough of the local demonstration data." action={<Badge theme="gold">Rule-based · Offline</Badge>}>
      <div className="in-assistant-bar"><label>Preview context <select value={scope} onChange={e=>setScope(e.target.value as typeof scope)}><option value="personal">My nutrition</option><option value="household">Shared household only</option></select></label><label className="in-checkbox"><input checked={showEvidence} onChange={e=>setShowEvidence(e.target.checked)} type="checkbox"/>Show evidence</label></div>
      <div className="in-chat-log" role="log" aria-label="Nutrition assistant conversation" aria-live="polite">
        {history.map(turn=><article className={'in-chat-turn '+turn.role} key={turn.id}><span className="in-chat-avatar">{turn.role==='guide'?'❧':'You'}</span><div className="in-chat-bubble">{turn.reply?.title&&<strong>{turn.reply.title}</strong>}<p>{turn.text}</p>{turn.reply&&<div className="in-chat-meta"><Badge theme={turn.reply.guardrail==='sensitive'?'red':turn.reply.guardrail==='limited'?'gold':'green'}>{turn.reply.guardrail==='sensitive'?'Safety boundary':turn.reply.guardrail==='limited'?'Limited evidence':'General information'}</Badge>{turn.reply.route&&<button className="in-link" type="button" onClick={()=>p.navigate(turn.reply!.route!)}>Open {turn.reply.route} <ArrowRight size={13}/></button>}</div>}{turn.reply&&showEvidence&&<EvidenceDetails items={turn.reply.evidence}/>}</div></article>)}
      </div>
      <div className="in-suggested"><span>Try asking</span><div>{questions.map(q=><button key={q} type="button" onClick={()=>ask(q)}>{q}</button>)}</div></div>
      <form className="in-chat-form" onSubmit={submit}><label className="sr-only" htmlFor="phase4-assistant-input">Ask the guided assistant</label><input id="phase4-assistant-input" maxLength={300} value={input} onChange={e=>setInput(e.target.value)} placeholder="Ask about the example nutrition workspace…"/><button type="submit" className="primary-button" disabled={!input.trim()}><Send size={17}/>Send</button></form>
      <p className="in-footnote">Conversation text stays in React state, is not saved to a server and disappears on reload. This UI cannot call tools that mutate meals, plans or finances.</p>
    </Panel>
    <div className="in-stack">
      <Panel title="Assistant permissions" sub="Explicitly restricted until the real Kernel security boundary exists."><div className="in-permissions">{intents.map(x=><span key={x}><ShieldCheck size={17}/>{x}</span>)}</div><p className="in-muted">Allowed: explain sample log and target comparisons, summarize shopping and stock, navigate to user-controlled screens. Not allowed: data sharing, financial actions, clinical decisions, autonomous plan approval, inventory changes, unverified allergy assurances.</p></Panel>
      <Panel title="What powers this answer?" sub="Source-of-truth hierarchy"><div className="in-explain-steps">{[['01','Logged food','Only confirmed meal entries'],['02','Targets','Editable demonstration values'],['03','Kitchen resources','Recorded pantry ledger and basket'],['04','Guardrails','No clinical inference or hidden permissions']].map(([n,t,d])=><div key={n}><span>{n}</span><div><strong>{t}</strong><small>{d}</small></div></div>)}</div></Panel>
      <Panel title="More informed choices" sub="Navigate to the next operator-controlled action"><div className="in-action-stack">{[['Insights','insights'],['Meal planning','planner'],['Shared family space','family'],['Privacy settings','privacy']].map(([label,route])=><button className="outlined-button" type="button" key={route} onClick={()=>p.navigate(route)}>{label}<ArrowRight size={14}/></button>)}</div></Panel>
    </div></div>
  </div>;
}
function FamilyPage({p}:{p:IntelligenceProps}){
  const [tab,setTab]=useState<'overview'|'meals'|'members'|'privacy'>('overview');
  const [actor,setActor]=useState('self');
  const [memberName,setMemberName]=useState('');const [addError,setAddError]=useState('');
  const [editingTask,setEditingTask]=useState<string|null>(null);
  const [taskMember,setTaskMember]=useState('self');
  const [taskNote,setTaskNote]=useState('');
  const [taskStatus,setTaskStatus]=useState<TaskStatus>('planned');
  const [taskError,setTaskError]=useState('');
  const role=memberRole(p.family.members,actor);
  const canEdit=role==='owner'||role==='editor';
  const approved=p.context.plans.filter(plan=>plan.status==='approved');
  const entries=approved.flatMap(plan=>plan.entries.map(e=>({entry:e,plan}))).sort((a,b)=>a.entry.date.localeCompare(b.entry.date));
  const projected=useMemo(()=>familyProjection(p.family,p.context.plans,p.context.groceries,p.context.lots,p.context.movements,actor),[p.family,p.context,actor]);
  const expiring=p.context.lots.filter(l=>lotBalance(l.id,p.context.movements)>0&&l.expiresOn&&daysUntil(l.expiresOn,p.context.asOf)>=0&&daysUntil(l.expiresOn,p.context.asOf)<=2).length;
  function attempt(action:()=>void,onError:(s:string)=>void){try{action();onError('');}catch(error){onError(error instanceof Error?error.message:'Action not permitted.');}}
  function invite(e:FormEvent<HTMLFormElement>){e.preventDefault();attempt(()=>{
    const id='shared-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);
    p.onFamily(addMember(p.family,actor,{id,alias:memberName,role:'viewer',active:true}));
    setMemberName('');p.notify('Member added in preview','Viewer access only. No invitation was sent and no actual account was provisioned.');
  },setAddError);}
  function editTask(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!editingTask)return;
    const old=p.family.tasks.find(t=>t.planEntryId===editingTask);
    attempt(()=>{
      p.onFamily(saveTask(p.family,actor,{id:old?.id??'task-'+editingTask,planEntryId:editingTask,memberId:taskMember,note:taskNote,status:taskStatus},p.context.plans));
      setEditingTask(null);p.notify('Kitchen assignment saved','Shared meal task updated in the local demo only.');
    },setTaskError);
  }
  function startTask(id:string){
    const old=p.family.tasks.find(t=>t.planEntryId===id);
    setTaskMember(old?.memberId??'self');setTaskNote(old?.note??'');setTaskStatus(old?.status??'planned');setEditingTask(id);setTaskError('');
  }
  return <div className="in-page"><Header icon={Users} kicker="SHARED HOUSEHOLD WORKSPACE" title="Family Nutrition Command Center" desc="Coordinate meals, shopping, pantry and responsibilities without revealing anyone's private nutrition records." actions={<div className="in-head-actions"><button className="outlined-button" type="button" onClick={()=>p.navigate('groceries')}><ShoppingBasket size={16}/>Shared groceries</button><button className="primary-button" type="button" onClick={()=>p.navigate('planner')}><CalendarDays size={16}/>Meal plan</button></div>}/>
    <div className="in-note"><LockKeyhole size={18}/><div><strong>Household-only projection</strong><p>The view intentionally contains no individual logged meals, protein goals, derived nutrition scores or health context. Member roles are demonstrative UI rules, not actual authenticated access.</p></div></div>
    <div className="in-house-stats">
      <div className="panel in-stat"><Users size={21}/><div><small>Shared participants</small><strong>{projected.members.filter(m=>m.active).length}</strong><span>Aliases only · no personal health</span></div></div>
      <div className="panel in-stat"><CalendarDays size={21}/><div><small>Approved shared meals</small><strong>{projected.plannedMealCount}</strong><span>Planned, not eaten</span></div></div>
      <div className="panel in-stat"><ShoppingBasket size={21}/><div><small>Grocery forecast</small><strong>{money(projected.groceryForecastKes)}</strong><span>{projected.sharedGroceryCount} shared list items</span></div></div>
      <div className="panel in-stat"><Wallet size={21}/><div><small>Food allocation</small><strong>{money(p.context.budgetKes)}</strong><span>Example KES budget</span></div></div>
    </div>
    <div className="in-family-tabs" role="tablist" aria-label="Family Nutrition views">
      {([['overview','Command Center'],['meals','Meal coordination'],['members','Members & roles'],['privacy','Privacy rules']] as const).map(([id,label])=><button role="tab" aria-selected={tab===id} type="button" className={tab===id?'selected':''} onClick={()=>setTab(id)} key={id}>{label}</button>)}
    </div>
    {tab==='overview'&&<div className="in-columns"><Panel title="Household operating picture" sub="No member-specific tracking data or synthetic wellbeing scores.">
      <div className="in-house-hero"><span>🍲</span><div><strong>Plan together, respect every person.</strong><p>{entries.length} approved shared example meals; {p.family.tasks.length} cooking tasks assigned; {expiring} stock lot(s) nearing expiry.</p></div></div>
      <div className="in-family-tiles">{[
        {icon:CalendarDays,title:'Meal coordination',value:entries.length+' meals',route:'meals'},
        {icon:ShoppingBasket,title:'Shared grocery list',value:projected.sharedGroceryCount+' items',route:'groceries'},
        {icon:Wallet,title:'Shared food budget',value:money(p.context.budgetKes),route:'budget'},
        {icon:AlertTriangle,title:'Use-soon watch',value:expiring+' lots',route:'waste'},
      ].map(item=><button type="button" key={item.title} onClick={()=>item.route==='meals'?setTab('meals'):p.navigate(item.route)}><item.icon size={20}/><div><strong>{item.title}</strong><span>{item.value}</span></div><ChevronRight size={16}/></button>)}</div>
    </Panel><div className="in-stack"><Panel title="Household snapshot" sub="Shared resources from current Phase 3 state.">
      <div className="in-family-row"><span>Food inventory</span><strong>{projected.stockedLots} stocked lots</strong></div>
      <div className="in-family-row"><span>Manually recorded paid</span><strong>{money(projected.explicitlyRecordedSpendKes)}</strong></div>
      <div className="in-family-row"><span>Cooking tasks</span><strong>{projected.taskCount} assigned</strong></div>
      <div className="in-family-row"><span>Personal metrics visible</span><Badge theme="green">None</Badge></div>
      <button className="outlined-button in-full" type="button" onClick={()=>setTab('privacy')}>View privacy boundaries <ArrowRight size={15}/></button>
    </Panel>
    <Panel title="Shared household members" sub="Role aliases, not real-user identities.">
      <div className="in-member-chips">{projected.members.filter(m=>m.active).map(m=><div key={m.id}><span>{m.alias.slice(0,1).toUpperCase()}</span><strong>{m.alias}</strong><small>{m.role}</small></div>)}</div>
      <button className="in-link" type="button" onClick={()=>setTab('members')}>Manage access preview <ArrowRight size={14}/></button>
    </Panel></div></div>}
    {tab==='meals'&&<div className="in-columns"><Panel title="Shared meal schedule" sub="Approved recipe plan entries only; no personal consumption records." action={<button className="outlined-button" type="button" onClick={()=>p.navigate('planner')}>Open planner <ArrowRight size={14}/></button>}>
      <div className="in-shared-meals">{entries.map(({entry})=>{
        const recipe=p.context.recipes.find(r=>r.id===entry.recipeId);
        const assignment=p.family.tasks.find(t=>t.planEntryId===entry.id);
        return <article key={entry.id}><span className="in-meal-icon">{recipe?.emoji??'🍲'}</span><div><strong>{recipe?.name??'Unavailable recipe'}</strong><small>{entry.date} · {entry.slot} · {entry.portions} recipe serving(s)</small><span>{assignment?'Cooking: '+(p.family.members.find(m=>m.id===assignment.memberId)?.alias??'Unassigned')+' · '+assignment.status:'No cooking assignment'}</span></div><button className="outlined-button" type="button" disabled={!canEdit} onClick={()=>startTask(entry.id)}>{assignment?'Edit task':'Assign cook'} <ChevronRight size={13}/></button></article>;
      })}{!entries.length&&<div className="in-empty">Approve a household example meal plan to see shared meals here.</div>}</div>
    </Panel><div className="in-stack"><Panel title="Role preview" sub="Simulated permission checks for shared schedules.">
      <label className="in-field">Preview as<select value={actor} onChange={e=>{setActor(e.target.value);setEditingTask(null);}}>{p.family.members.filter(m=>m.active).map(m=><option value={m.id} key={m.id}>{m.alias} · {m.role}</option>)}</select></label>
      <p className="in-muted">{canEdit?'This demo role may assign cooking tasks to approved meals.':'This demo role can read shared plans but cannot modify assignments.'}</p>
    </Panel><Panel title="Cooking coordination" sub="Tasks are collaboration only; they do not log consumption.">
      <div className="in-task-list">{p.family.tasks.map(t=><div key={t.id}><div><strong>{p.context.recipes.find(r=>p.context.plans.some(pl=>pl.entries.some(e=>e.id===t.planEntryId&&e.recipeId===r.id)))?.name??'Meal task'}</strong><small>{p.family.members.find(m=>m.id===t.memberId)?.alias??'Member'} · {t.status}</small></div><button type="button" className="in-icon-delete" disabled={!canEdit} aria-label="Remove kitchen assignment" onClick={()=>p.onFamily(removeTask(p.family,actor,t.id))}><Trash2 size={15}/></button></div>)}{!p.family.tasks.length&&<p className="in-muted">Assign a cook to an approved shared meal.</p>}</div>
    </Panel></div></div>}
    {tab==='members'&&<div className="in-columns"><Panel title="Household member roles" sub="Preview owner can manage role aliases; invites and real authentication are not implemented.">
      <div className="in-role-table">{p.family.members.map(m=><div key={m.id}><span className="in-role-avatar">{m.alias.slice(0,1).toUpperCase()}</span><div><strong>{m.alias}</strong><small>{m.id==='self'?'Preview owner identity':'Local placeholder'} · {m.active?'Active':'Inactive'}</small></div><select disabled={role!=='owner'||m.role==='owner'||!m.active} value={m.role} aria-label={'Role for '+m.alias} onChange={e=>attempt(()=>p.onFamily(changeMember(p.family,actor,m.id,{role:e.target.value as HouseholdRole})),setAddError)}><option value="owner">Owner</option><option value="editor">Editor</option><option value="viewer">Viewer</option></select>{m.role!=='owner'&&<button className="outlined-button" type="button" disabled={role!=='owner'} onClick={()=>attempt(()=>p.onFamily(changeMember(p.family,actor,m.id,{active:!m.active})),setAddError)}>{m.active?'Deactivate':'Reactivate'}</button>}</div>)}</div>
      <form className="in-member-add" onSubmit={invite}><label>Add a participant alias<input value={memberName} maxLength={50} onChange={e=>setMemberName(e.target.value)} placeholder="Example: Member D" required/></label><button type="submit" className="primary-button" disabled={role!=='owner'}><Plus size={15}/>Add viewer</button></form>
      {addError&&<p className="in-error" role="alert">{addError}</p>}
    </Panel><Panel title="Simulated role permissions" sub="A backend and Kernel authorization are required before real sharing.">
      <label className="in-field">View role as<select value={actor} onChange={e=>setActor(e.target.value)}>{p.family.members.filter(m=>m.active).map(m=><option key={m.id} value={m.id}>{m.alias} · {m.role}</option>)}</select></label>
      <div className="in-permission-matrix">{[['Read shared meals','All active members'],['Read shared groceries','All active members'],['Assign cooking task','Owner / Editor'],['Manage member roles','Owner only'],['Read individual health/nutrient data','Nobody in this view']].map(([feature,who])=><div key={feature}><span>{feature}</span><strong>{who}</strong></div>)}</div>
    </Panel></div>}
    {tab==='privacy'&&<div className="in-columns"><Panel title="Privacy and sharing rules" sub="No individual nutritional profile is copied to the family view.">
      <div className="in-privacy-cards">{[['Shareable: meal plans','Approved household recipe schedule and cooking tasks.'],['Shareable: grocery resources','Shared lists, estimated budget and pantry locations.'],['Private: individual nutrition','Consumed meals, goals, intake patterns, progress, health factors and recommendations.'],['Controlled: consent','Each person must explicitly authorize future optional sharing; this preview cannot grant actual identity permissions.']].map(([name,desc],i)=><div key={name}><span className={'in-shield '+(i>=2?'gold':'')}><LockKeyhole size={19}/></span><div><strong>{name}</strong><p>{desc}</p></div></div>)}</div>
      <label className="in-checkbox in-opt-in"><input type="checkbox" checked={p.family.shareMyPreferences} disabled={role!=='owner'} onChange={e=>attempt(()=>{p.onFamily(setPreferenceSharing(p.family,actor,e.target.checked));p.notify('Preview preference updated','No private values were exposed. Real identity, consent and sharing must be enforced by the backend.');},setAddError)}/> Enable future preference-sharing request (preview flag only)</label>
      <p className="in-footnote">Even with the preview flag enabled, no preferences, medical conditions or private nutrient metrics are made visible. This is not an actual consent grant or live access control.</p>
    </Panel><div className="in-stack"><Panel title="Family data boundary"><div className="in-permissions"><span><ShieldCheck size={17}/>Least privilege</span><span><EyeOff size={17}/>No member nutrition profiles</span><span><LockKeyhole size={17}/>No health context</span><span><Users size={17}/>Shared resource coordination</span></div><p className="in-muted">Role selection on this demo page is for UI evaluation only. Never deploy it as an authorization substitute.</p></Panel><Panel title="Your next step"><button className="outlined-button in-full" type="button" onClick={()=>p.navigate('groceries')}>Review household groceries <ArrowRight size={15}/></button><button className="outlined-button in-full" type="button" onClick={()=>setTab('meals')}>Assign meal preparation <ArrowRight size={15}/></button></Panel></div></div>}
    {editingTask&&<div className="modal-backdrop" onMouseDown={e=>{if(e.currentTarget===e.target)setEditingTask(null);}}><div role="dialog" aria-modal="true" aria-label="Cooking assignment" className="modal in-task-dialog"><div className="modal-header"><h2>Cooking assignment</h2><button className="icon-button" type="button" aria-label="Close" onClick={()=>setEditingTask(null)}><X size={20}/></button></div>
      <form onSubmit={editTask} className="in-task-form"><label>Responsible household participant<select value={taskMember} onChange={e=>setTaskMember(e.target.value)}>{p.family.members.filter(m=>m.active).map(m=><option key={m.id} value={m.id}>{m.alias}</option>)}</select></label><label>Task status<select value={taskStatus} onChange={e=>setTaskStatus(e.target.value as TaskStatus)}><option value="planned">Planned</option><option value="preparing">Preparing</option><option value="completed">Completed</option></select></label><label>Household cooking notes<input maxLength={160} value={taskNote} onChange={e=>setTaskNote(e.target.value)} placeholder="Example: Prepare vegetables in advance"/></label>
      <p className="in-footnote">Completing a cooking task is not proof that anyone consumed the meal.</p>{taskError&&<p className="in-error" role="alert">{taskError}</p>}<div className="in-form-actions"><button className="primary-button" type="submit">Save assignment</button><button className="outlined-button" type="button" onClick={()=>setEditingTask(null)}>Cancel</button></div></form>
    </div></div>}
  </div>;
}
export default function IntelligenceExperience(p:IntelligenceProps){
  if(p.route==='insights')return <InsightsPage p={p}/>;
  if(p.route==='assistant')return <AssistantPage p={p}/>;
  return <FamilyPage p={p}/>;
}
