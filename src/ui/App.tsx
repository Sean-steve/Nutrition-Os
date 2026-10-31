import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import {
  Activity, Apple, ArrowRight, BarChart3, Bell, BookOpen, CalendarDays,
  Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Clock,
  Droplets, Flame, Heart, Home, Info, Leaf, LockKeyhole, Menu,
  Package, Plus, Search, Send, Settings, ShieldCheck, ShoppingBasket,
  Sparkles, Target, TrendingUp, Users, Utensils, Wallet, AlertTriangle, X,
  type LucideIcon,
} from 'lucide-react';
import {
  calculateLoggedTotals, calculateTrackingAlignment,
  clampProgress, formatKes, remaining, type FoodChoice, type GroceryItem, type MealRecord, type MealSlot,
} from '../domain/nutrition';
import {
  SAMPLE_DATE, sampleFoodChoices, sampleMeals, sampleRecommendations,
  sampleRoadmap, sampleWeeklyProgress,
} from '../data/sample';
import { DEFAULT_PROFILE, DEFAULT_TARGETS, mealsOnDate, type NutritionProfile, type NutritionTargets, type RecipeRecord } from '../domain/personal';
import { sampleRecipes } from '../data/personalFixtures';
import PersonalExperience, { type PersonalRoute } from './PersonalExperience';
import ResourceExperience, { type ResourceRoute } from './ResourceExperience';
import { sampleWeeklyPlan, sampleInventoryLots, sampleStockMovements, sampleGroceriesGenerated, sampleUnitPricesKes, sampleFoodBudgetKes } from '../data/resourceFixtures';
import { appendMovement, generateGroceries, isoDate, lotBalance, transferStock, type WeeklyPlan, type GroceryList, type InventoryLot, type ShoppingLine, type StockMovement, type StorageLocation } from '../domain/resources';
import { recipeAmount } from '../domain/personal';

type RouteId = 'dashboard' | keyof typeof sampleRoadmap;
type NutriTab = 'macros' | 'micros' | 'other';
type GroceryTab = 'list' | 'inventory';
type ViewMode = 'personal' | 'family';
type Notice = { title: string; body: string };

const NAV_ITEMS: { id: RouteId; label: string; icon: LucideIcon }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: Home },
  { id: 'today', label: 'Today', icon: CalendarDays },
  { id: 'meals', label: 'Meals', icon: Utensils },
  { id: 'planner', label: 'Meal Planner', icon: CalendarDays },
  { id: 'foods', label: 'Foods & Recipes', icon: BookOpen },
  { id: 'recipes', label: 'Recipe Studio', icon: Utensils },
  { id: 'groceries', label: 'Groceries', icon: ShoppingBasket },
  { id: 'inventory', label: 'Inventory', icon: Package },
  { id: 'budget', label: 'Food Budget', icon: Wallet },
  { id: 'waste', label: 'Waste & Expiry', icon: AlertTriangle },
  { id: 'goals', label: 'Goals', icon: Target },
  { id: 'insights', label: 'Insights', icon: BarChart3 },
  { id: 'progress', label: 'Progress', icon: TrendingUp },
  { id: 'family', label: 'Family', icon: Users },
];
const SECONDARY_NAV: { id: RouteId; label: string; icon: LucideIcon }[] = [
  { id: 'assistant', label: 'AI Nutrition Guide', icon: Sparkles },
  { id: 'integrations', label: 'Integrations', icon: Activity },
  { id: 'privacy', label: 'Privacy & Sharing', icon: ShieldCheck },
  { id: 'profile', label: 'Nutrition Profile', icon: Heart },
  { id: 'settings', label: 'Settings', icon: Settings },
];

function routeFromHash(): RouteId {
  const candidate = window.location.hash.replace(/^#\/?/, '').split('/')[0];
  if (candidate === 'dashboard' || candidate === '' || candidate === undefined) return 'dashboard';
  if (Object.prototype.hasOwnProperty.call(sampleRoadmap, candidate)) return candidate as RouteId;
  return 'dashboard';
}

function RadialProgress({ value, color = 'green', size = 'normal' }: { value: number; color?: 'green'|'blue'|'amber'|'orange'; size?: 'normal'|'large' }) {
  return <div className={`radial radial-${color} radial-${size}`} style={{ '--radial-pct': `${value}%` } as CSSProperties}>
    <div className="radial-inner"><strong>{value}%</strong></div>
  </div>;
}

function ProgressBar({ value, color = 'green' }: { value: number; color?: 'green' | 'blue' | 'orange' | 'amber' }) {
  return <div className="progress-track" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
    <span className={`progress-fill fill-${color}`} style={{ width: `${value}%` }} />
  </div>;
}

function CardHeading({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return <div className="card-heading"><h2>{title}</h2>{action && onAction && <button className="text-action" type="button" onClick={onAction}>{action}<ArrowRight size={15}/></button>}</div>;
}

function SummaryCard({ icon: Icon, title, value, detail, progress, color }: {
  icon: LucideIcon; title: string; value: string; detail: string; progress: number;
  color: 'orange' | 'blue' | 'cyan';
}) {
  return <article className="summary-card">
    <div className="summary-top"><span className={`summary-icon icon-${color}`}><Icon size={21}/></span><div className="summary-copy"><span className="metric-label">{title}</span><div className="metric-value">{value}</div></div></div>
    <ProgressBar value={progress} color={color === 'cyan' ? 'blue' : color} />
    <div className="metric-hint">{detail}</div>
  </article>;
}

function MealTimeline({ meals, onAdd, onView, onNavigate }: { meals: MealRecord[]; onAdd: () => void; onView: (meal: MealRecord) => void; onNavigate: (id: RouteId) => void }) {
  return <section className="panel meals-panel">
    <CardHeading title="Today's meals" action="Meal history" onAction={() => onNavigate('meals')}/>
    <div className="meal-timeline">
      {meals.map((meal) => <div className="meal-row" key={meal.id}>
        <div className="meal-when"><span className={`timeline-check ${meal.status === 'logged' ? 'is-done' : ''}`}>{meal.status === 'logged' ? <Check size={14} strokeWidth={3}/> : null}</span><span className="meal-clock">{meal.time}</span><span className="meal-slot">{meal.slot}</span></div>
        <div className="meal-photo" aria-hidden="true">{meal.emoji}</div>
        <div className="meal-description"><h3>{meal.name}</h3><p>{meal.details}</p><span className="meal-macros"><Flame size={13}/>{meal.energyKcal} kcal <span className="tiny-divider"/> <Activity size={13}/>{meal.proteinG}g protein</span></div>
        <button className={`meal-cta ${meal.status !== 'logged' ? 'emphasis' : ''}`} type="button" onClick={() => meal.status === 'planned' ? meal.planEntryId ? onNavigate('today') : onAdd() : onView(meal)}>{meal.status === 'planned' ? meal.planEntryId ? 'Confirm' : 'Log meal' : 'View'}</button>
      </div>)}
    </div>
    <div className="meal-tip"><span className="tip-light"><Sparkles size={18}/></span><div><strong>Small steps, better nutrition.</strong><p>Planned meals are not counted until you log them.</p></div><button type="button" onClick={onAdd}>+ Add meal <ArrowRight size={14}/></button></div>
  </section>;
}

function NutrientsPanel({ tab, setTab, totals, navigate, targets }: { tab: NutriTab; setTab: (tab: NutriTab) => void; totals: ReturnType<typeof calculateLoggedTotals>; navigate: (id: RouteId) => void; targets: NutritionTargets }) {
  const macro = [
    { name: 'Protein', value: totals.proteinG, target: targets.proteinG, unit: 'g', color: 'blue' as const },
    { name: 'Carbs', value: totals.carbsG, target: targets.carbsG, unit: 'g', color: 'orange' as const },
    { name: 'Fat', value: totals.fatG, target: targets.fatG, unit: 'g', color: 'amber' as const },
    { name: 'Energy', value: totals.energyKcal, target: targets.energyKcal, unit: 'kcal', color: 'green' as const },
  ];
  return <section className="panel nutrients-panel">
    <CardHeading title="Key nutrients" action="View details" onAction={() => navigate('insights')}/>
    <div className="segmented tabs-nutrients" role="tablist" aria-label="Nutrition metric categories">
      {(['macros','micros','other'] as NutriTab[]).map(id => <button type="button" role="tab" aria-selected={tab===id} className={tab===id?'selected':''} onClick={()=>setTab(id)} key={id}>{id==='macros'?'Macros':id==='micros'?'Micronutrients':'Other'}</button>)}
    </div>
    {tab === 'macros' ? <div className="nutrient-rings">{macro.map(m => <div className="nutrient" key={m.name}><RadialProgress value={clampProgress(m.value,m.target)} color={m.color}/><b>{m.name}</b><span>{Math.round(m.value)} / {m.target}{m.unit}</span></div>)}</div> :
      <div className="nutrient-empty"><Info size={26}/><b>{tab === 'micros' ? 'Micronutrient tracking' : 'Hydration & fibre'}</b><p>{tab === 'micros' ? 'Detailed vitamin and mineral data depends on verified food composition. This is part of the real nutrition engine.' : 'Hydration is shown above. Fibre and food diversity require validated food nutrient data.'}</p><button className="outlined-button" type="button" onClick={() => navigate('insights')}>See upcoming insights <ArrowRight size={14}/></button></div>}
    <div className="goals-subsection"><div className="subsection-title"><h3>Nutrition goals</h3><button className="text-action" onClick={() => navigate('goals')} type="button">View goals <ArrowRight size={14}/></button></div>
      {[
        { label: 'Daily protein target', icon: Activity, value: clampProgress(totals.proteinG, targets.proteinG), color: 'green' as const },
        { label: 'Energy target', icon: Flame, value: clampProgress(totals.energyKcal, targets.energyKcal), color: 'orange' as const },
        { label: 'Meal consistency', icon: CalendarDays, value: 67, color: 'blue' as const },
      ].map(g => <div className="goal-row" key={g.label}><span className="goal-icon"><g.icon size={17}/></span><span className="goal-name">{g.label}</span><ProgressBar value={g.value} color={g.color}/><strong>{g.value}%</strong></div>)}
      <p className="subdued micro">Targets shown are illustrative, not personalized clinical recommendations.</p>
    </div>
  </section>;
}

function WeeklyCard({ navigate }: { navigate: (id: RouteId)=>void }) {
  return <section className="panel week-panel"><CardHeading title="This week" action="View progress" onAction={()=>navigate('progress')}/>
    <div className="week-days">{sampleWeeklyProgress.map(d => <div className="week-day" key={d.label}><span>{d.label}</span><div className={`day-dot ${d.pct===null?'future':d.pct>=80?'done':'partial'}`}>{d.pct===null?'':d.pct>=80?<Check size={16}/>:<span style={{height:`${d.pct}%`}}/>}</div></div>)}</div>
    <div className="week-kpis"><div><b>82%</b><span>Goal alignment*</span></div><div><b>4 / 7</b><span>Meals planned</span></div><div><b>KES 4,850</b><span>Grocery estimate</span></div></div>
    <p className="subdued micro">*Illustrative weekly values from sample fixtures.</p>
  </section>;
}

function GroceryCard({ groceries, toggleGrocery, tab, setTab, navigate, budget, inventoryPreview }: { groceries: GroceryItem[]; toggleGrocery: (id: string) => void; tab: GroceryTab; setTab: (t:GroceryTab)=>void; navigate: (id:RouteId)=>void; budget:number; inventoryPreview:{id:string;name:string;emoji:string;quantity:number}[] }) {
  const sum = groceries.reduce((n,g)=>n+g.priceKes,0);
  const done = groceries.filter(g=>g.purchased).length;
  return <section className="panel grocery-panel"><CardHeading title="Grocery & inventory" action="View all" onAction={()=>navigate('groceries')}/>
    <div className="grocery-tabs segmented" role="tablist" aria-label="Shopping preview">
      <button role="tab" aria-selected={tab==='list'} type="button" className={tab==='list'?'selected':''} onClick={()=>setTab('list')}>Grocery list</button>
      <button role="tab" aria-selected={tab==='inventory'} type="button" className={tab==='inventory'?'selected':''} onClick={()=>setTab('inventory')}>Inventory</button>
    </div>
    {tab === 'list' ? <div className="grocery-content"><div className="grocery-items">{groceries.slice(0,4).map(g=><label className="grocery-item" key={g.id}><input type="checkbox" checked={g.purchased} disabled={g.received} title={g.received?"Already received into stock":undefined} onChange={()=>toggleGrocery(g.id)}/><span className="grocery-emoji" aria-hidden="true">{g.emoji}</span><span className="grocery-item-name"><b>{g.name}</b><small>{g.quantity}</small></span><span className="grocery-price">{formatKes(g.priceKes)}</span></label>)}</div>
      <div className="budget-box"><small>Estimated basket</small><strong>{formatKes(sum)}</strong><small>Example budget: {formatKes(budget)}</small><ProgressBar value={clampProgress(sum,budget)}/><span>{done} of {groceries.length} checked off</span><button className="primary-button small" type="button" onClick={()=>navigate('groceries')}>Open groceries <ArrowRight size={15}/></button></div></div> :
      <div className="inventory-preview">{inventoryPreview.slice(0,3).map(l=><div key={l.id}>{l.emoji} <strong>{l.name}</strong><span>{l.quantity} servings</span></div>)}{!inventoryPreview.length&&<div>No recorded stock</div>}<button type="button" className="text-action" onClick={()=>navigate('inventory')}>Open inventory <ArrowRight size={15}/></button></div>}
  </section>;
}

function FamilyCard({ navigate }: { navigate: (id:RouteId)=>void }) {
  return <section className="panel family-panel"><CardHeading title="Family nutrition" action="Family center" onAction={()=>navigate('family')}/>
    <div className="family-summary-grid"><div><span className="family-icon green">🍽️</span><b>5 / 7</b><small>Shared dinners planned</small></div><div><span className="family-icon peach">🛒</span><b>6 items</b><small>Household groceries</small></div><div><span className="family-icon blue">💰</span><b>KES 5,500</b><small>Example grocery budget</small></div></div>
    <div className="family-safe"><LockKeyhole size={16}/><span>Household logistics only. Individual nutrition data stays private.</span></div>
  </section>;
}

function Guide({ totalProtein, onPlan, onNavigate, notify, targets }: { totalProtein: number; targets: NutritionTargets; onPlan: (id: string)=>void; onNavigate: (id:RouteId)=>void; notify: (n:Notice)=>void }) {
  const [start,setStart]=useState(0);
  const [input,setInput]=useState('');
  const [reply,setReply]=useState('');
  const options=[0,1,2].map(i=>sampleRecommendations[(start+i)%sampleRecommendations.length]);
  const gap=remaining(totalProtein, targets.proteinG);
  function ask(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q=input.trim();
    if(!q)return;
    const lower=q.toLowerCase();
    if(lower.includes('protein')) setReply(`The sample meal log has ${Math.round(totalProtein)}g of protein against an illustrative ${targets.proteinG}g target. This does not establish actual intake.`);
    else if(lower.includes('plan') || lower.includes('dinner')) setReply('You can choose a dinner option above to update the demo plan. Full adaptive planning will arrive in Phase 3.');
    else if(lower.includes('groc') || lower.includes('inventory')) setReply('The sample basket is under Grocery & Inventory. Real household inventory connections are planned for Phase 3.');
    else setReply('This is a rule-based dashboard preview, not a connected AI model. The policy-controlled assistant arrives in Phase 4.');
    setInput('');
  }
  return <aside className="guide-panel">
    <div className="guide-head"><div><Leaf size={22}/><h2>AI Nutrition Guide</h2></div><span className="beta-tag">Preview</span></div>
    <div className="guide-body"><div className="guide-alert"><span>✦</span><strong>About {Math.round(gap)}g below the sample protein target.</strong></div>
      <p className="guide-explain">Based on this example meal log, here are some dinner ideas. Confirm actual ingredients, portions and any dietary restrictions.</p>
      <div className="suggestion-list">{options.map((item, idx) => <article className={`suggestion ${idx===0?'featured':''}`} key={item.id}><span className="suggestion-photo">{item.emoji}</span><div className="suggestion-content"><b>{item.title}</b>{idx===0&&<div className="tags">{item.tags.map(t=><span key={t}>{t}</span>)}</div>}<div className="suggestion-meta"><span><Flame size={12}/>{item.energyKcal} kcal</span><span><Activity size={12}/>{item.proteinG}g protein</span><span><Clock size={12}/>{item.minutes} min</span></div></div><button type="button" className="suggestion-select" title={`Review ${item.title} in planner`} aria-label={`Review ${item.title} in planner`} onClick={()=>{onPlan(item.id);notify({title:'Review this dinner',body:`${item.title} is an illustrative suggestion. Choose an available recipe and approve it in the Meal Planner; no meal was silently changed.`});}}><ChevronRight size={18}/></button></article>)}</div>
      <button className="primary-button guide-generate" type="button" onClick={()=>setStart((start+1)%sampleRecommendations.length)}>Explore more meal ideas <ArrowRight size={16}/></button>
      <form className="guide-ask" onSubmit={ask}><label htmlFor="guide-query" className="sr-only">Ask about demo nutrition</label><input id="guide-query" value={input} onChange={e=>setInput(e.target.value)} placeholder="Ask about this nutrition preview..." maxLength={180}/><button title="Send preview question" aria-label="Send preview question" type="submit"><Send size={17}/></button></form>
      {reply && <div className="guide-reply" role="status">{reply}</div>}
      <div className="guide-shortcuts"><button type="button" onClick={()=>onNavigate('planner')}>Plan meals</button><button type="button" onClick={()=>onNavigate('goals')}>View goals</button><button type="button" onClick={()=>onNavigate('inventory')}>Check inventory</button></div>
      <p className="guide-disclaimer"><Info size={13}/>Rule-based preview · No live AI or health assessment</p>
    </div>
  </aside>;
}

function Dashboard({ meals, waterL, groceries, toggleGrocery, onAdd, onViewMeal, onPlanDinner, navigate, notify, isSampleDay, onReset, targets, waterObserved, displayName, budget, inventoryPreview }: {
  meals: MealRecord[]; waterL:number; groceries:GroceryItem[]; toggleGrocery:(id:string)=>void;
  onAdd:()=>void; onViewMeal:(m:MealRecord)=>void; onPlanDinner:(id:string)=>void;
  navigate:(id:RouteId)=>void; notify:(n:Notice)=>void; isSampleDay:boolean; onReset:()=>void; targets:NutritionTargets; waterObserved:boolean; displayName:string; budget:number; inventoryPreview:{id:string;name:string;emoji:string;quantity:number}[];
}) {
  const [nutriTab,setNutriTab]=useState<NutriTab>('macros');
  const [groceryTab,setGroceryTab]=useState<GroceryTab>('list');
  const totals=useMemo(()=>calculateLoggedTotals(meals),[meals]);
  const energyPct=clampProgress(totals.energyKcal,targets.energyKcal);
  const proteinPct=clampProgress(totals.proteinG,targets.proteinG);
  const waterPct=waterObserved?clampProgress(waterL,targets.hydrationL):0;
  const overall=waterObserved?calculateTrackingAlignment(energyPct,proteinPct,waterPct):Math.round((energyPct+proteinPct)/2);
  return <div className="dashboard">
    <header className="hero"><div className="hero-copy"><span className="eyebrow"><Leaf size={14}/> PERSONAL NUTRITION</span><h1>Good morning{displayName ? ', '+displayName : ', welcome back'} <span className="wave">👋</span></h1><p>Here's your nutrition picture today.</p></div>
      <svg className="hero-landscape" viewBox="0 0 600 160" aria-hidden="true" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="sky" x1="0" x2="1" y1="0" y2="1"><stop stopColor="#e9e9d7"/><stop offset="1" stopColor="#c6e3d5"/></linearGradient><linearGradient id="hill" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#699f75"/><stop offset="1" stopColor="#1e634c"/></linearGradient></defs><rect width="600" height="160" fill="url(#sky)"/><circle cx="438" cy="30" r="22" fill="#fff7d6" opacity=".8"/><path d="M0 100 Q110 16 220 95 Q329 0 450 90 Q537 32 600 97 V160 H0" fill="#aac6a7" opacity=".55"/><path d="M0 117 Q150 72 300 116 Q436 56 600 112 V160 H0" fill="#84ab81" opacity=".62"/><path d="M0 135 Q160 96 315 131 Q460 95 600 127 V160 H0" fill="url(#hill)" opacity=".83"/></svg>
      <div className="hero-quote"><Leaf size={18}/><span>Better nutrition, one choice at a time.</span></div>
    </header>
    {!isSampleDay ? <section className="panel empty-date"><CalendarDays size={34}/><h2>No sample records for this date</h2><p>Missing records are unknown intake, not zero intake. The demo figures are only available for its example day.</p><button className="primary-button" type="button" onClick={onReset}>Return to sample day <ArrowRight size={16}/></button></section> :
    <>
    <div className="stats-grid"><article className="summary-card score-card"><RadialProgress value={overall} size="large"/><div><span className="metric-label">Goal alignment</span><h2>Daily overview</h2><p>Illustrative progress from logged example meals.</p></div></article>
      <SummaryCard icon={Flame} title="Energy" value={`${totals.energyKcal.toLocaleString()} / ${targets.energyKcal.toLocaleString()} kcal`} detail={`${remaining(totals.energyKcal,targets.energyKcal)} kcal to example target`} progress={energyPct} color="orange"/>
      <SummaryCard icon={Activity} title="Protein" value={`${Math.round(totals.proteinG)} / ${targets.proteinG} g`} detail={`${Math.round(remaining(totals.proteinG,targets.proteinG))}g to example target`} progress={proteinPct} color="blue"/>
      <SummaryCard icon={Droplets} title="Hydration" value={waterObserved ? `${waterL.toFixed(2).replace(/0$/,"")} / ${targets.hydrationL} L` : "Not recorded"} detail={waterObserved ? `${remaining(waterL,targets.hydrationL).toFixed(2)} L to example target` : "No hydration observation for this date"} progress={waterPct} color="cyan"/>
    </div>
    <div className="dashboard-content"><div className="dashboard-main">
      <div className="mid-grid"><MealTimeline meals={meals} onAdd={onAdd} onView={onViewMeal} onNavigate={navigate}/><NutrientsPanel tab={nutriTab} setTab={setNutriTab} totals={totals} navigate={navigate} targets={targets}/></div>
      <div className="bottom-grid"><WeeklyCard navigate={navigate}/><GroceryCard groceries={groceries} toggleGrocery={toggleGrocery} tab={groceryTab} setTab={setGroceryTab} navigate={navigate} budget={budget} inventoryPreview={inventoryPreview}/><FamilyCard navigate={navigate}/></div>
    </div><Guide totalProtein={totals.proteinG} targets={targets} onPlan={onPlanDinner} onNavigate={navigate} notify={notify}/></div>
    </>
    }
  </div>;
}

function FamilyOverview({ navigate }: { navigate:(id:RouteId)=>void }) {
  return <div className="family-page"><div className="page-heading"><span className="eyebrow"><Users size={14}/> HOUSEHOLD SPACE</span><h1>Family Nutrition Command Center</h1><p>Plan together, keep everyone's private health and nutrition data protected.</p></div>
    <div className="family-stat-cards"><div className="panel"><span className="family-icon green">🍲</span><small>Shared dinners</small><strong>5 / 7 planned</strong></div><div className="panel"><span className="family-icon peach">🛒</span><small>Grocery list</small><strong>6 example items</strong></div><div className="panel"><span className="family-icon blue">💳</span><small>Example food budget</small><strong>KES 5,500</strong></div></div>
    <section className="panel family-overview-panel"><h2>What's coming in Phase 4</h2><p>Shared meal planning with member-specific adaptations, a household grocery workflow and budget-aware nutrition suggestions.</p><div className="roadmap-tiles"><span><CheckCircle2 size={18}/> Household meal coordination</span><span><ShoppingBasket size={18}/> Shared resources</span><span><LockKeyhole size={18}/> Member-by-member consent</span></div><button type="button" className="outlined-button" onClick={()=>navigate('dashboard')}>Back to dashboard <ArrowRight size={16}/></button></section>
    <div className="privacy-strip"><ShieldCheck size={20}/><div><strong>Privacy by design</strong><p>No individual family member's nutrient scores, inferred health data or recommendations are exposed in this preview.</p></div></div>
  </div>;
}

function ModulePreview({ route, navigate }: { route: Exclude<RouteId,'dashboard'>; navigate:(id:RouteId)=>void }) {
  const data=sampleRoadmap[route];
  return <div className="module-page"><div className="page-heading"><span className="eyebrow"><Leaf size={14}/> NUTRITION OS</span><h1>{[...NAV_ITEMS,...SECONDARY_NAV].find(i=>i.id===route)?.label ?? route}</h1><p>{data.description}</p></div>
    <div className="panel module-preview"><span className="phase-chip">{data.phase}</span><div className="module-icon"><Apple size={34}/></div><h2>This experience is scheduled for {data.phase}</h2><p>The design system and navigation are established in Phase 1. This module is not yet implemented as a functional product.</p>
      <div className="roadmap-tiles">{data.highlights.map(h=><span key={h}><CheckCircle2 size={18}/>{h}</span>)}</div>
      <button className="primary-button" type="button" onClick={()=>navigate('dashboard')}>Return to Nutrition Dashboard <ArrowRight size={16}/></button>
    </div>
  </div>;
}

function AddMealDialog({ onClose, onAdd }: { onClose:()=>void; onAdd:(meal:MealRecord)=>void }) {
  const [foodId,setFoodId]=useState(sampleFoodChoices[0].id);
  const [slot,setSlot]=useState<MealSlot>('Snack');
  const [quantity,setQuantity]=useState(1);
  const [error,setError]=useState('');
  const food:FoodChoice=sampleFoodChoices.find(f=>f.id===foodId) ?? sampleFoodChoices[0];
  function submit(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if(!Number.isFinite(quantity)||quantity<=0||quantity>10){setError('Choose a quantity between 0 and 10 servings.');return;}
    onAdd({id:`custom-${Date.now()}`,slot,name:food.name,details:`${quantity} × ${food.serving} · demo estimate`,emoji:food.emoji,
      time:new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}),
      energyKcal:Math.round(food.energyKcal*quantity),proteinG:Math.round(food.proteinG*quantity*10)/10,
      carbsG:Math.round(food.carbsG*quantity*10)/10,fatG:Math.round(food.fatG*quantity*10)/10,status:'logged'});
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={(e)=>{if(e.target===e.currentTarget)onClose();}}>
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="add-meal-title"><div className="modal-header"><div><span className="eyebrow">SAMPLE INTERACTION</span><h2 id="add-meal-title">Log a sample meal</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close meal form"><X size={21}/></button></div>
      <p className="subdued">This changes only the in-memory dashboard preview. It does not save your nutrition data.</p>
      <form onSubmit={submit} className="modal-form"><label>Food<select value={foodId} onChange={e=>setFoodId(e.target.value)}>{sampleFoodChoices.map(f=><option value={f.id} key={f.id}>{f.name} · {f.serving}</option>)}</select></label>
        <label>Meal type<select value={slot} onChange={e=>setSlot(e.target.value as MealSlot)}>{(['Breakfast','Lunch','Snack','Dinner'] as MealSlot[]).map(s=><option key={s}>{s}</option>)}</select></label>
        <label>Servings<input type="number" min="0.25" max="10" step="0.25" value={quantity} onChange={e=>setQuantity(Number(e.target.value))}/></label>
        <div className="meal-estimate"><strong>Approximate demo values</strong><span>{Math.round(food.energyKcal*quantity)} kcal · {Math.round(food.proteinG*quantity*10)/10}g protein</span></div>
        {error&&<p className="form-error" role="alert">{error}</p>}
        <div className="modal-actions"><button className="outlined-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit"><Plus size={16}/> Add sample meal</button></div>
      </form></div>
  </div>;
}

function MealDetailsDialog({ meal, onClose }: { meal:MealRecord; onClose:()=>void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="meal-detail-title"><div className="modal-header"><div><span className="eyebrow">SAMPLE MEAL</span><h2 id="meal-detail-title">{meal.name}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close meal details"><X size={20}/></button></div>
    <div className="meal-detail-hero"><span>{meal.emoji}</span><div><b>{meal.slot} · {meal.time}</b><p>{meal.details}</p></div></div><div className="detail-numbers"><div><strong>{meal.energyKcal}</strong><span>kcal</span></div><div><strong>{meal.proteinG}g</strong><span>protein</span></div><div><strong>{meal.carbsG}g</strong><span>carbs</span></div><div><strong>{meal.fatG}g</strong><span>fat</span></div></div><p className="subdued">Illustrative meal data. Food composition and portion calculations are not yet connected to an authoritative nutrition engine.</p><button className="primary-button full" type="button" onClick={onClose}>Close details</button></div></div>;
}

export default function App() {
  const [route,setRoute]=useState<RouteId>(routeFromHash);
  const [mobileOpen,setMobileOpen]=useState(false);
  const [view,setView]=useState<ViewMode>('personal');
  const [meals,setMeals]=useState<MealRecord[]>(sampleMeals);
  const [profile,setProfile]=useState<NutritionProfile>(DEFAULT_PROFILE);
  const [targets,setTargets]=useState<NutritionTargets>(DEFAULT_TARGETS);
  const [recipes,setRecipes]=useState<RecipeRecord[]>(sampleRecipes);
  const [waterL,setWaterL]=useState(1.7);
  const [plans,setPlans]=useState<WeeklyPlan[]>([sampleWeeklyPlan]);
  const [lots,setLots]=useState<InventoryLot[]>(sampleInventoryLots);
  const [stockMovements,setStockMovements]=useState<StockMovement[]>(sampleStockMovements);
  const [shoppingList,setShoppingList]=useState<GroceryList>(sampleGroceriesGenerated);
  const [foodBudget,setFoodBudget]=useState(sampleFoodBudgetKes);
  const [dayOffset,setDayOffset]=useState(0);
  const [search,setSearch]=useState('');
  const [showSearch,setShowSearch]=useState(false);
  const [notifications,setNotifications]=useState(false);
  const [profileOpen,setProfileOpen]=useState(false);
  const [mealModal,setMealModal]=useState(false);
  const [selectedMeal,setSelectedMeal]=useState<MealRecord|null>(null);
  const [notice,setNotice]=useState<Notice|null>(null);
  useEffect(()=>{const update=()=>setRoute(routeFromHash());window.addEventListener('hashchange',update);return()=>window.removeEventListener('hashchange',update);},[]);
  useEffect(()=>{if(!notice)return;const id=window.setTimeout(()=>setNotice(null),5000);return()=>window.clearTimeout(id);},[notice]);
  const date=useMemo(()=>{const d=new Date(`${SAMPLE_DATE}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+dayOffset);return d.toLocaleDateString('en-KE',{weekday:'short',month:'short',day:'numeric',year:'numeric',timeZone:'UTC'});},[dayOffset]);
  const activeDate=useMemo(()=>{const d=new Date(SAMPLE_DATE+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+dayOffset);return d.toISOString().slice(0,10);},[dayOffset]);
  const nav=(id:RouteId)=>{setRoute(id);window.location.hash=id==='dashboard'?'#/':'#/'+id;setMobileOpen(false);setShowSearch(false);setProfileOpen(false);};
  const toggleGrocery=(id:string)=>setShoppingList(prev=>({...prev,lines:prev.lines.map(l=>l.id===id&&!l.received?{...l,purchased:!l.purchased,paidKes:l.purchased?null:l.paidKes}:l)}));
  const dashboardGroceries:GroceryItem[]=shoppingList.lines.map(l=>{
    const f=sampleFoodChoices.find(f=>f.id===l.foodId);
    return {id:l.id,name:f?.name??l.foodId,quantity:l.quantityServings+' × '+(f?.serving??'serving'),priceKes:Math.round(l.quantityServings*l.unitPriceKes),emoji:f?.emoji??'🧺',purchased:l.purchased,received:l.received};
  });
  const inventoryPreview=lots.map(l=>({id:l.id,name:sampleFoodChoices.find(f=>f.id===l.foodId)?.name??l.foodId,emoji:sampleFoodChoices.find(f=>f.id===l.foodId)?.emoji??'📦',quantity:lotBalance(l.id,stockMovements)})).filter(x=>x.quantity>0);
  const onSavePlan=(plan:WeeklyPlan)=>setPlans(prev=>prev.some(p=>p.id===plan.id)?prev.map(p=>p.id===plan.id?plan:p):[...prev,plan]);
  const onGenerateGroceries=(plan:WeeklyPlan)=>setShoppingList(generateGroceries(plan,recipes,lots,stockMovements,sampleUnitPricesKes,activeDate));
  const onAddLot=(lot:InventoryLot,quantity:number)=>{
    if(lots.some(l=>l.id===lot.id)||!Number.isFinite(quantity)||quantity<=0||quantity>1000||!Number.isFinite(lot.unitPriceKes)||lot.unitPriceKes<0||lot.unitPriceKes>100000||!isoDate(lot.acquiredOn)||(lot.expiresOn&&!isoDate(lot.expiresOn)))throw new Error('Invalid stock lot, quantity or unit price.');
    const newLots=[...lots,lot];
    const newLedger=appendMovement(newLots,stockMovements,{id:'initial-'+lot.id,lotId:lot.id,date:lot.acquiredOn,kind:'PURCHASE',deltaServings:quantity,note:'Stock receipt entered in preview'});
    setLots(newLots);setStockMovements(newLedger);
  };
  const onRecordMovement=(movement:StockMovement)=>{const updated=appendMovement(lots,stockMovements,movement);setStockMovements(updated);};
  const onTransferStock=(sourceId:string,destination:StorageLocation,quantity:number,date:string)=>{
    const result=transferStock(lots,stockMovements,sourceId,destination,quantity,date,'transfer-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7));
    setLots(result.lots);setStockMovements(result.movements);
  };
  const onReceive=(line:ShoppingLine,location:StorageLocation,expiry:string|null)=>{
    const actual=shoppingList.lines.find(l=>l.id===line.id);
    if(!actual||!actual.purchased||actual.received||actual.quantityServings<=0||!Number.isFinite(actual.quantityServings)||(expiry&&!isoDate(expiry)))throw new Error('Purchase must be checked, unreceived and have valid quantity.');
    const lot:InventoryLot={id:'received-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7),foodId:actual.foodId,location,acquiredOn:activeDate,expiresOn:expiry,unitPriceKes:actual.unitPriceKes};
    const newLots=[...lots,lot],ledger=appendMovement(newLots,stockMovements,{id:'receipt-'+lot.id,lotId:lot.id,date:activeDate,kind:'PURCHASE',deltaServings:actual.quantityServings,note:'Confirmed grocery receipt'});
    setLots(newLots);setStockMovements(ledger);
    setShoppingList(prev=>({...prev,lines:prev.lines.map(l=>l.id===line.id?{...l,received:true}:l)}));
  };
  function planDinner(id:string){const choice=sampleRecommendations.find(r=>r.id===id);if(!choice)return;nav('planner');}
  function addMeal(meal:MealRecord){setMeals(prev=>[...prev,{...meal,recordedOn:meal.recordedOn??activeDate}].sort((a,b)=>a.time.localeCompare(b.time)));setMealModal(false);setNotice({title:'Sample meal added',body:'Your preview totals were updated in memory. No data was saved to a server.'});}
  const personalRoutes:PersonalRoute[]=['onboarding','profile','today','meals','foods','recipes','goals','progress'];
  const editMeal=(meal:MealRecord)=>setMeals(prev=>{
    const found=prev.some(m=>m.id===meal.id);
    if(found)return prev.map(m=>m.id===meal.id?meal:m);
    if(meal.planEntryId&&meal.status==='logged'&&!prev.some(m=>m.planEntryId===meal.planEntryId&&m.status==='logged'))return [...prev,{...meal,id:'consumed-'+meal.planEntryId}];
    return prev;
  });
  const removeMeal=(id:string)=>{setMeals(prev=>prev.filter(m=>m.id!==id));setNotice({title:'Meal removed',body:'Example record removed from the session. No server data was changed.'});};
  const saveRecipe=(recipe:RecipeRecord)=>setRecipes(prev=>prev.some(r=>r.id===recipe.id)?prev.map(r=>r.id===recipe.id?recipe:r):[...prev,recipe]);
  const adjustWater=(delta:number)=>setWaterL(v=>Math.max(0,Math.min(10,Math.round((v+delta)*100)/100)));
  const visibleMeals=useMemo(()=>{
    const approved=plans.filter(p=>p.status==='approved').flatMap(p=>p.entries);
    const loggedIds=new Set(meals.filter(m=>m.status==='logged'&&m.planEntryId).map(m=>m.planEntryId));
    const planned=approved.filter(e=>!loggedIds.has(e.id)).flatMap(e=>{
      const recipe=recipes.find(r=>r.id===e.recipeId);if(!recipe)return [];
      try {
        const macros=recipeAmount(recipe,sampleFoodChoices,e.portions);
        const record:MealRecord={id:'from-plan-'+e.id,planEntryId:e.id,recordedOn:e.date,slot:e.slot,name:recipe.name,emoji:recipe.emoji,details:e.portions+' serving(s) · approved plan, not consumed',time:e.slot==='Breakfast'?'08:00':e.slot==='Lunch'?'13:00':e.slot==='Snack'?'16:00':'19:00',status:'planned',...macros};
        return [record];
      } catch {return [];}
    });
    const base=meals.filter(m=>!(m.status==='planned'&&approved.some(e=>e.date===(m.recordedOn??SAMPLE_DATE)&&e.slot===m.slot)));
    return [...base,...planned];
  },[meals,plans,recipes]);
  const resourceRoutes:ResourceRoute[]=['planner','groceries','inventory','budget','waste'];
  const foodResults=sampleFoodChoices.filter(f=>f.name.toLowerCase().includes(search.toLowerCase())).slice(0,5);
  return <div className="app-shell">
    <div className={`sidebar-overlay ${mobileOpen?'show':''}`} onClick={()=>setMobileOpen(false)} aria-hidden="true"/>
    <aside className={`sidebar ${mobileOpen?'open':''}`} aria-label="Primary navigation">
      <div className="brand"><div className="brand-mark"><Leaf size={29} fill="currentColor" strokeWidth={1.5}/></div><div><strong>Nutrition OS</strong><small>Eat · Plan · Live Better</small></div><button type="button" className="mobile-close" onClick={()=>setMobileOpen(false)} aria-label="Close navigation"><X size={21}/></button></div>
      <nav className="sidebar-links" aria-label="Nutrition screens">{NAV_ITEMS.map(item=><button key={item.id} type="button" className={`side-link ${route===item.id?'active':''}`} onClick={()=>nav(item.id)} aria-current={route===item.id?'page':undefined}><item.icon size={19} strokeWidth={2}/><span>{item.label}</span></button>)}</nav>
      <div className="sidebar-separator"/>
      <nav className="sidebar-links secondary" aria-label="Other settings">{SECONDARY_NAV.map(item=><button key={item.id} type="button" className={`side-link ${route===item.id?'active':''}`} onClick={()=>nav(item.id)}><item.icon size={19}/><span>{item.label}</span></button>)}</nav>
      <div className="sidebar-bottom"><div className="focus-box"><span className="focus-glyph"><Target size={24}/></span><div><small>Nutrition focus</small><strong>Wellbeing & consistency</strong></div><ProgressBar value={84}/><span className="focus-note">Example goal <strong>84%</strong></span><button type="button" onClick={()=>nav('goals')}>Explore goals <ArrowRight size={14}/></button></div><div className="sidebar-caption"><Heart size={14}/> Built around real life.</div></div>
    </aside>
    <div className="app-column"><header className="topbar"><div className="topbar-left"><button type="button" className="icon-button hamburger" onClick={()=>setMobileOpen(true)} aria-label="Open navigation"><Menu size={23}/></button>
      <div className="global-search"><Search size={18}/><label htmlFor="global-search-input" className="sr-only">Search sample foods and modules</label><input id="global-search-input" value={search} onFocus={()=>setShowSearch(true)} onChange={e=>{setSearch(e.target.value);setShowSearch(true);}} placeholder="Search foods, recipes, meals or ask anything..."/><kbd>⌘ K</kbd>
      {showSearch&&<div className="search-results"><div className="search-results-head">Sample foods <button type="button" onClick={()=>setShowSearch(false)}><X size={14}/></button></div>{foodResults.length?foodResults.map(f=><button type="button" key={f.id} onClick={()=>{setSearch(f.name);setShowSearch(false);setNotice({title:f.name,body:`${f.serving} · ${f.energyKcal} kcal · ${f.proteinG}g protein (sample values)`});}}><span>{f.emoji}</span>{f.name}<ChevronRight size={15}/></button>):<p>No matching sample food. Food catalogue arrives in Phase 2.</p>}</div>}
      </div></div>
      <div className="topbar-right"><div className="date-picker"><button className="icon-button" type="button" onClick={()=>setDayOffset(n=>Math.max(-30,n-1))} aria-label="Previous day"><ChevronLeft size={17}/></button><span><CalendarDays size={16}/>{date}</span><button type="button" className="icon-button" onClick={()=>setDayOffset(n=>Math.min(30,n+1))} aria-label="Next day"><ChevronRight size={17}/></button></div>
      <div className="popover-wrap"><button type="button" className="icon-button bell-button" onClick={()=>{setNotifications(!notifications);setProfileOpen(false);}} aria-label="Preview notifications"><Bell size={20}/><span className="notification-dot">2</span></button>{notifications&&<div className="top-popover notification-popover"><h3>Sample notifications</h3><p><Clock size={15}/> Dinner is planned for 19:00</p><p><ShoppingBasket size={15}/> 5 grocery items still unchecked</p><small>Illustrative, not live reminders.</small></div>}</div>
      <div className="profile-wrap"><button type="button" className="profile-button" onClick={()=>{setProfileOpen(!profileOpen);setNotifications(false);}} aria-expanded={profileOpen}><span className="avatar">A</span><span className="profile-copy"><b>Demo profile</b><small>{view==='personal'?'Personal view':'Family view'}</small></span><ChevronDown size={16}/></button>{profileOpen&&<div className="top-popover profile-popover"><button type="button" onClick={()=>{setView('personal');nav('dashboard');}}>Personal dashboard</button><button type="button" onClick={()=>{setView('family');nav('dashboard');}}>Family dashboard</button><button type="button" onClick={()=>nav('profile')}>Nutrition profile</button><button type="button" onClick={()=>nav('onboarding')}>Run onboarding</button><span>Sample session · no sign-in</span></div>}</div>
      </div></header>
      <main className="workspace"><div className="workspace-toolbar"><span className="preview-badge"><span className="preview-dot"/> SAMPLE DATA · INTERACTIVE PREVIEW</span><div className="toolbar-actions"><button className="utility-btn" type="button" disabled={dayOffset!==0} onClick={()=>{adjustWater(.25);setNotice({title:'Hydration updated',body:'Added 250 ml to the example day. This change is temporary.'});}}><Droplets size={16}/> +250 ml water</button><button className="primary-button toolbar-add" type="button" onClick={()=>setMealModal(true)}><Plus size={17}/> Log meal</button></div></div>
      {route==='dashboard' ? view==='personal'?<Dashboard meals={mealsOnDate(visibleMeals,activeDate,SAMPLE_DATE)} budget={foodBudget} inventoryPreview={inventoryPreview} waterL={dayOffset===0?waterL:0} waterObserved={dayOffset===0} displayName={profile.onboardingComplete?profile.displayName:""} targets={targets} groceries={dashboardGroceries} toggleGrocery={toggleGrocery} onAdd={()=>setMealModal(true)} onViewMeal={setSelectedMeal} onPlanDinner={planDinner} navigate={nav} notify={setNotice} isSampleDay={dayOffset===0 || mealsOnDate(visibleMeals,activeDate,SAMPLE_DATE).length>0} onReset={()=>setDayOffset(0)}/>:<FamilyOverview navigate={nav}/> :
        personalRoutes.includes(route as PersonalRoute)?<PersonalExperience key={route} route={route as PersonalRoute} meals={visibleMeals} activeDate={activeDate} waterL={waterL} profile={profile} targets={targets} recipes={recipes} foods={sampleFoodChoices} navigate={nav} onOpenMealLogger={()=>setMealModal(true)} onViewMeal={setSelectedMeal} onAddMeal={addMeal} onEditMeal={editMeal} onDeleteMeal={removeMeal} onSaveProfile={setProfile} onSaveTargets={setTargets} onSaveRecipe={saveRecipe} onDeleteRecipe={id=>setRecipes(prev=>prev.filter(r=>r.id!==id))} onAdjustWater={adjustWater} onNotice={(title,body)=>setNotice({title,body})}/>:resourceRoutes.includes(route as ResourceRoute)?<ResourceExperience key={route} route={route as ResourceRoute} activeDate={activeDate} plans={plans} recipes={recipes} foods={sampleFoodChoices} priceBook={sampleUnitPricesKes} lots={lots} movements={stockMovements} list={shoppingList} budgetKes={foodBudget} onPlan={onSavePlan} onList={setShoppingList} onGenerate={onGenerateGroceries} onBudget={setFoodBudget} onAddLot={onAddLot} onRecord={onRecordMovement} onTransfer={onTransferStock} onReceive={onReceive} navigate={nav} notify={(title,body)=>setNotice({title,body})}/>:route==='family'?<FamilyOverview navigate={nav}/>:<ModulePreview route={route} navigate={nav}/>}
      <footer className="page-footer">Nutrition OS · Phase 3 meal planning & resources preview <span>Sample values only · Not medical advice · No account data is used</span></footer>
      </main>
    </div>
    {notice&&<div className="toast" role="status"><div><CheckCircle2 size={20}/><strong>{notice.title}</strong></div><p>{notice.body}</p><button type="button" onClick={()=>setNotice(null)} aria-label="Dismiss notice"><X size={16}/></button></div>}
    {mealModal&&<AddMealDialog onClose={()=>setMealModal(false)} onAdd={addMeal}/>}
    {selectedMeal&&<MealDetailsDialog meal={selectedMeal} onClose={()=>setSelectedMeal(null)}/>}
  </div>;
}
