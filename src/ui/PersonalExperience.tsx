import { useState, type FormEvent, type ReactNode } from 'react';
import {
  Activity, ArrowRight, BookOpen, CalendarDays, Check, ChevronLeft,
  Clock, Droplets, Edit3, Flame, Heart, Info, Leaf, Plus, Search, ShieldCheck,
  Target, Trash2, TrendingUp, Utensils, X,
} from 'lucide-react';
import { calculateLoggedTotals, clampProgress, type FoodChoice, type MealRecord, type MealSlot } from '../domain/nutrition';
import {
  DEFAULT_TARGETS, foodAmount, mealsOnDate, observedDays, recipeAmount,
  validProfile, validTargets, type NutritionProfile, type NutritionTargets, type RecipeIngredient, type RecipeRecord,
} from '../domain/personal';
import { SAMPLE_DATE } from '../data/sample';
import './personal.css';

export type PersonalRoute = 'onboarding' | 'profile' | 'today' | 'meals' | 'foods' | 'recipes' | 'goals' | 'progress';
export interface Phase2Props {
  route: PersonalRoute;
  meals: MealRecord[];
  activeDate: string;
  waterL: number;
  profile: NutritionProfile;
  targets: NutritionTargets;
  recipes: RecipeRecord[];
  foods: FoodChoice[];
  navigate: (route: string) => void;
  onOpenMealLogger: () => void;
  onViewMeal: (meal: MealRecord) => void;
  onAddMeal: (meal: MealRecord) => void;
  onEditMeal: (meal: MealRecord) => void;
  onDeleteMeal: (id: string) => void;
  onSaveProfile: (p: NutritionProfile) => void;
  onSaveTargets: (p: NutritionTargets) => void;
  onSaveRecipe: (p: RecipeRecord) => void;
  onDeleteRecipe: (id: string) => void;
  onAdjustWater: (delta: number) => void;
  onNotice: (title: string, body: string) => void;
}

function Header({ icon: Icon, eyebrow, title, description, actions }: {
  icon: typeof Leaf; eyebrow: string; title: string; description: string; actions?: ReactNode;
}) {
  return <header className="p2-header">
    <div><span className="eyebrow"><Icon size={14}/> {eyebrow}</span><h1>{title}</h1><p>{description}</p></div>
    {actions && <div className="p2-header-actions">{actions}</div>}
  </header>;
}
function Card({ title, subtitle, children, action }: {title: string; subtitle?: string; children: ReactNode; action?: ReactNode}) {
  return <section className="panel p2-card"><div className="p2-card-head"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div>{children}</section>;
}
function Metric({ label, value, info, icon: Icon }: {label:string;value:string;info:string;icon:typeof Leaf}) {
  return <div className="panel p2-metric"><span className="p2-metric-icon"><Icon size={20}/></span><div><small>{label}</small><strong>{value}</strong><span>{info}</span></div></div>;
}
function Bar({ label, actual, target, suffix }: {label:string; actual:number; target:number; suffix:string}) {
  const pct=clampProgress(actual,target);
  return <div className="p2-bar-row"><div><strong>{label}</strong><span>{Math.round(actual*10)/10} / {target} {suffix}</span></div><div className="progress-track" role="progressbar" aria-label={label} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><span className="progress-fill" style={{width:pct+'%'}}/></div></div>;
}
const mealTypes: MealSlot[]=['Breakfast','Lunch','Snack','Dinner'];

function TargetsEditor({ initial, save, cancel, buttonText = 'Save example targets' }: {
  initial:NutritionTargets;save:(t:NutritionTargets)=>void;cancel?:()=>void;buttonText?:string
}) {
  const [value,setValue]=useState<NutritionTargets>({...initial});
  const [error,setError]=useState('');
  const fields: {id:keyof NutritionTargets;label:string;unit:string;step:string}[]=[
    {id:'energyKcal',label:'Energy target',unit:'kcal',step:'10'},
    {id:'proteinG',label:'Protein target',unit:'g',step:'1'},
    {id:'carbsG',label:'Carbohydrates target',unit:'g',step:'1'},
    {id:'fatG',label:'Fat target',unit:'g',step:'1'},
    {id:'hydrationL',label:'Hydration target',unit:'L',step:'0.1'},
  ];
  function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();const issue=validTargets(value);if(issue){setError(issue);return;}save(value);}
  return <form onSubmit={submit} className="p2-form"><div className="p2-field-grid">
    {fields.map(field=><label className="p2-field" key={field.id}>{field.label}<span className="p2-input-wrap"><input required type="number" step={field.step} min="0" value={value[field.id]} onChange={e=>setValue(v=>({...v,[field.id]:Number(e.target.value)}))}/><em>{field.unit}</em></span></label>)}
  </div><p className="p2-hint"><Info size={15}/> These editable values are demonstration targets, not clinically calculated requirements.</p>
  {error&&<p className="form-error" role="alert">{error}</p>}
  <div className="p2-actions"><button className="primary-button" type="submit"><Check size={16}/>{buttonText}</button>{cancel&&<button type="button" className="outlined-button" onClick={cancel}>Cancel</button>}</div></form>;
}
function ProfileFields({ value, setValue }: {value:NutritionProfile;setValue:(p:NutritionProfile)=>void}) {
  return <div className="p2-form"><div className="p2-field-grid">
    <label className="p2-field">Display name<input maxLength={60} required value={value.displayName} onChange={e=>setValue({...value,displayName:e.target.value})} placeholder="How should Nutrition OS greet you?"/></label>
    <label className="p2-field">Dietary style<select value={value.dietStyle} onChange={e=>setValue({...value,dietStyle:e.target.value as NutritionProfile['dietStyle']})}>
      <option value="flexible">Flexible / no specific pattern</option><option value="plant-focused">Plant-focused</option><option value="vegetarian">Vegetarian</option><option value="vegan">Vegan</option><option value="other">Other preference</option>
    </select></label>
    <label className="p2-field p2-field-wide">Foods to exclude (separate with commas)<input maxLength={250} value={value.excludedFoods} onChange={e=>setValue({...value,excludedFoods:e.target.value})} placeholder="Example: peanuts, shellfish"/></label>
    <label className="p2-field">Preferred meals per day<select value={value.preferredMeals} onChange={e=>setValue({...value,preferredMeals:Number(e.target.value)})}>{[1,2,3,4,5,6].map(n=><option value={n} key={n}>{n}</option>)}</select></label>
    <label className="p2-field">Display units<select value={value.units} onChange={e=>setValue({...value,units:e.target.value as NutritionProfile['units']})}><option value="metric">Metric (g, kg, ml)</option><option value="imperial">Imperial (lb, oz) — display preference</option></select></label>
  </div><p className="p2-hint"><ShieldCheck size={15}/> Exclusions are stored only in this temporary preview session. Automatic allergy safety checks are not yet implemented; always review ingredients yourself.</p></div>;
}

function Onboarding({ p }: {p:Phase2Props}) {
  const [step,setStep]=useState(0);
  const [profile,setProfile]=useState<NutritionProfile>({...p.profile});
  const targets = p.targets;
  const [error,setError]=useState('');
  const steps=['Your basics','Your preferences','Your targets'];
  function next(){if(step===0 && !profile.displayName.trim()){setError('Enter a display name to continue.');return;}setError('');setStep(s=>Math.min(2,s+1));}
  function finish(values:NutritionTargets){const issue=validProfile(profile);if(issue){setError(issue);return;}p.onSaveProfile({...profile,onboardingComplete:true});p.onSaveTargets(values);p.onNotice('Onboarding preview complete','Your choices are active only for this browser session; no account or backend was created.');p.navigate('today');}
  return <div className="p2-page"><Header icon={Leaf} eyebrow="PERSONAL NUTRITION" title="Make nutrition work for you" description="Set up a personal nutrition workspace in three simple steps. This is an in-memory preview."/>
    <div className="p2-onboarding"><div className="p2-step-nav">{steps.map((s,i)=><button type="button" key={s} className={i===step?'active':''} disabled={i>step} onClick={()=>{setStep(i);setError('');}}><span>{i<step?'✓':i+1}</span>{s}</button>)}</div>
    <section className="panel p2-form-card"><span className="p2-section-kicker">STEP {step+1} OF 3</span><h2>{steps[step]}</h2>
    {step===0?<div className="p2-form"><label className="p2-field">Display name<input autoFocus required value={profile.displayName} maxLength={60} placeholder="Your preferred name" onChange={e=>setProfile({...profile,displayName:e.target.value})}/></label><p className="p2-hint">You do not need to share a date of birth, medical history or body measurements for this interface preview.</p></div>:
      step===1?<ProfileFields value={profile} setValue={setProfile}/>:
      <TargetsEditor initial={targets} save={finish} buttonText="Finish setup" cancel={()=>setStep(1)}/>}
    {error&&<p className="form-error" role="alert">{error}</p>}
    {step<2&&<div className="p2-actions"><button className="primary-button" type="button" onClick={next}>Continue <ArrowRight size={16}/></button>{step===1&&<button className="outlined-button" type="button" onClick={()=>setStep(0)}><ChevronLeft size={16}/>Back</button>}</div>}
    </section><div className="p2-assurance"><ShieldCheck size={20}/><span>No sign-in or transmission of your responses. Settings reset on reload until real persistence is built.</span></div></div></div>;
}

function ProfilePage({p}:{p:Phase2Props}){
  const [value,setValue]=useState({...p.profile});
  const [error,setError]=useState('');
  function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();const issue=validProfile(value);if(issue){setError(issue);return;}p.onSaveProfile({...value,onboardingComplete:true});p.onNotice('Profile updated','Demo preferences now appear in your personal workspace. No account data was saved.');}
  return <div className="p2-page"><Header icon={Heart} eyebrow="YOUR PREFERENCES" title="Nutrition profile" description="Shape your experience through your preferences, not assumptions about your health." actions={<button className="outlined-button" onClick={()=>p.navigate('onboarding')} type="button">Restart setup <ArrowRight size={15}/></button>}/>
    <div className="p2-two-column"><Card title="Personal preferences" subtitle="Edit your example profile and dietary choices."><form onSubmit={submit}><ProfileFields value={value} setValue={setValue}/>{error&&<p role="alert" className="form-error">{error}</p>}<div className="p2-actions"><button className="primary-button" type="submit"><Check size={16}/>Save profile</button></div></form></Card>
      <div className="p2-stack"><Card title="Profile status"><div className="p2-status-pill">{p.profile.onboardingComplete?'✓ Setup completed':'○ Setup not completed'}</div><p className="p2-muted">Your profile applies to this temporary demo session only.</p><button className="outlined-button" type="button" onClick={()=>p.navigate('goals')}>Manage nutrition goals <ArrowRight size={15}/></button></Card>
      <Card title="Your privacy"><div className="p2-privacy"><ShieldCheck size={23}/><p>Health records, family-member metrics and cross-engine data are not accessed. Personalization and consent checks will be connected during backend and Kernel integration phases.</p></div></Card></div></div>
  </div>;
}

function TodayPage({p}:{p:Phase2Props}){
  const daysMeals=mealsOnDate(p.meals,p.activeDate,SAMPLE_DATE);
  const totals=calculateLoggedTotals(daysMeals);
  const logged=daysMeals.filter(m=>m.status==='logged');
  return <div className="p2-page"><Header icon={CalendarDays} eyebrow="DAILY NUTRITION" title="Today & meal timeline" description={'Viewing '+p.activeDate+' · Only logged meals count toward observed intake.'} actions={<button className="primary-button" onClick={p.onOpenMealLogger} type="button"><Plus size={16}/>Log a meal</button>}/>
    <div className="p2-metrics"><Metric icon={Flame} label="Observed energy" value={totals.hasObservations?totals.energyKcal+' kcal':'Not recorded'} info={totals.hasObservations?'From logged meals only':'No intake data for this day'}/><Metric icon={Activity} label="Observed protein" value={totals.hasObservations?Math.round(totals.proteinG)+' g':'Not recorded'} info="Not an estimate of total intake"/><Metric icon={Droplets} label="Water logged (sample day)" value={p.activeDate===SAMPLE_DATE?p.waterL+' L':'Not recorded'} info="No hydration record for other days"/><Metric icon={Utensils} label="Logged meals" value={String(logged.length)} info={daysMeals.filter(m=>m.status==='planned').length+' meals remain planned'}/></div>
    <div className="p2-two-column"><Card title="Meal timeline" subtitle="Planned and consumed food remain separate.">
      {daysMeals.length ? <div className="p2-timeline">{daysMeals.sort((a,b)=>a.time.localeCompare(b.time)).map(m=><div className="p2-timeline-row" key={m.id}>
        <span className={'p2-timeline-status '+m.status}>{m.status==='logged'?<Check size={14}/>:<Clock size={14}/>}</span><div><small>{m.time} · {m.slot}</small><strong>{m.emoji} &nbsp;{m.name}</strong><span>{m.status==='logged'?'Logged · '+m.energyKcal+' kcal · '+m.proteinG+'g protein':'Planned · not counted'}</span></div>
        <div className="p2-timeline-actions"><button className="outlined-button" type="button" onClick={()=>p.onViewMeal(m)}>Details</button>{m.status==='planned'&&<button type="button" className="primary-button" onClick={()=>{if(window.confirm('Confirm that you consumed this sample meal?'))p.onEditMeal({...m,status:'logged'});}}>Confirm eaten</button>}</div>
      </div>)}</div> : <div className="p2-empty"><Utensils size={29}/><b>No logged or planned meals for this date</b><p>Unknown intake is not zero intake. Add a meal to start tracking this demo date.</p><button className="outlined-button" type="button" onClick={p.onOpenMealLogger}>Log meal <Plus size={14}/></button></div>}</Card>
      <div className="p2-stack"><Card title="Daily coverage" subtitle="Calculated from available example entries, not a medical status.">
        {totals.hasObservations?<div className="p2-bars"><Bar label="Energy" actual={totals.energyKcal} target={p.targets.energyKcal} suffix="kcal"/><Bar label="Protein" actual={totals.proteinG} target={p.targets.proteinG} suffix="g"/><Bar label="Carbs" actual={totals.carbsG} target={p.targets.carbsG} suffix="g"/><Bar label="Fat" actual={totals.fatG} target={p.targets.fatG} suffix="g"/></div>:<p className="p2-muted">Log a meal to see estimated tracking progress.</p>}<button className="p2-link" type="button" onClick={()=>p.navigate('goals')}>Edit targets <ArrowRight size={14}/></button></Card>
      <Card title="Hydration quick add" subtitle="Available for the sample day in this preview."><div className="p2-hydration"><Droplets size={27}/><div><strong>{p.activeDate===SAMPLE_DATE?p.waterL.toFixed(2)+' L':'No record'}</strong><span>Example hydration log</span></div></div><div className="p2-actions"><button disabled={p.activeDate!==SAMPLE_DATE} className="outlined-button" type="button" onClick={()=>p.onAdjustWater(-0.25)}>− 250 ml</button><button disabled={p.activeDate!==SAMPLE_DATE} className="primary-button" type="button" onClick={()=>p.onAdjustWater(0.25)}>+ 250 ml</button></div></Card></div></div>
    <div className="p2-next-action"><span>✦</span><div><strong>Next: explore meals & recipes</strong><p>Capture foods, review your meal history, or use a saved recipe.</p></div><button className="outlined-button" type="button" onClick={()=>p.navigate('meals')}>Open meals <ArrowRight size={15}/></button></div></div>;
}

function MealsPage({p}:{p:Phase2Props}){
  const [query,setQuery]=useState('');const [status,setStatus]=useState<'all'|'logged'|'planned'>('all');
  const [editing,setEditing]=useState<MealRecord|null>(null);
  const [error,setError]=useState('');
  const visible=mealsOnDate(p.meals,p.activeDate,SAMPLE_DATE).filter(m=>(status==='all'||m.status===status)&&(m.name+' '+m.details+' '+m.slot).toLowerCase().includes(query.toLowerCase())).sort((a,b)=>a.time.localeCompare(b.time));
  const totals=calculateLoggedTotals(visible);
  function saveEdit(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!editing)return;
    const nums=[editing.energyKcal,editing.proteinG,editing.carbsG,editing.fatG];
    if(!editing.name.trim()||!/^([01]\d|2[0-3]):[0-5]\d$/.test(editing.time)||nums.some(n=>!Number.isFinite(n)||n<0||n>10000)){setError('Enter a meal name, a valid 24-hour time and nonnegative finite nutrition values.');return;}
    p.onEditMeal({...editing,name:editing.name.trim()});setEditing(null);p.onNotice('Meal corrected','The example meal record and dashboard totals were updated in memory.');
  }
  return <div className="p2-page"><Header icon={Utensils} eyebrow="MEAL HISTORY" title="Meals & consumption" description={'Review, correct and organize sample meal records for '+p.activeDate+'.'} actions={<button className="primary-button" type="button" onClick={p.onOpenMealLogger}><Plus size={16}/>Log meal</button>}/>
    <div className="p2-metrics"><Metric icon={Check} label="Logged meals" value={String(visible.filter(m=>m.status==='logged').length)} info="Visible filtered records"/><Metric icon={Flame} label="Logged energy" value={totals.energyKcal+' kcal'} info="Visible logged records only"/><Metric icon={Activity} label="Logged protein" value={totals.proteinG+' g'} info="Values are estimates"/><Metric icon={CalendarDays} label="Planned meals" value={String(visible.filter(m=>m.status==='planned').length)} info="Not counted as consumed"/></div>
    <Card title="Meal records" subtitle="Select a meal to inspect or correct the sample snapshot." action={<div className="p2-filter-row"><label className="p2-search"><Search size={15}/><input value={query} aria-label="Filter meals" onChange={e=>setQuery(e.target.value)} placeholder="Search meals…"/></label><select aria-label="Filter meal status" value={status} onChange={e=>setStatus(e.target.value as typeof status)}><option value="all">All statuses</option><option value="logged">Logged</option><option value="planned">Planned</option></select></div>}>
      {visible.length?<div className="p2-meal-records">{visible.map(m=><article className="p2-record" key={m.id}><div className="p2-food-photo">{m.emoji}</div><div className="p2-record-main"><strong>{m.name}</strong><small>{m.slot} · {m.time} · <span className={'p2-tag '+m.status}>{m.status}</span></small><span>{m.energyKcal} kcal · {m.proteinG}g protein · {m.carbsG}g carbs</span></div><div className="p2-record-actions"><button className="outlined-button" type="button" onClick={()=>p.onViewMeal(m)}>View</button>{m.status==='planned' && m.planEntryId ? <button className="outlined-button" type="button" onClick={()=>p.navigate('planner')}>Open plan <ArrowRight size={14}/></button> : <><button className="outlined-button" type="button" onClick={()=>{setEditing({...m});setError('');}} aria-label={'Edit '+m.name}><Edit3 size={15}/></button><button className="outlined-button p2-danger" type="button" aria-label={'Remove '+m.name} onClick={()=>{if(window.confirm('Remove this sample meal? It will no longer contribute to dashboard totals.'))p.onDeleteMeal(m.id);}}><Trash2 size={15}/></button></>}</div></article>)}</div>:<div className="p2-empty"><Search size={26}/><b>No meals match your filters</b><p>Try a different search or log a new example meal.</p></div>}</Card>
    <div className="p2-next-action"><span>🍽</span><div><strong>Build consistent meals</strong><p>Explore the sample food composition library or compose reusable recipes.</p></div><button className="outlined-button" type="button" onClick={()=>p.navigate('foods')}>Browse foods <ArrowRight size={14}/></button></div>
    {editing&&<div className="modal-backdrop" onMouseDown={e=>{if(e.currentTarget===e.target)setEditing(null);}}><div className="modal p2-modal" role="dialog" aria-modal="true" aria-labelledby="p2-edit-title"><div className="modal-header"><div><span className="eyebrow">HISTORICAL CORRECTION · DEMO</span><h2 id="p2-edit-title">Correct meal snapshot</h2></div><button className="icon-button" type="button" aria-label="Close editor" onClick={()=>setEditing(null)}><X size={20}/></button></div>
      <form className="p2-form" onSubmit={saveEdit}><div className="p2-field-grid"><label className="p2-field p2-field-wide">Meal name<input required value={editing.name} onChange={e=>setEditing({...editing,name:e.target.value})}/></label><label className="p2-field">Meal slot<select value={editing.slot} onChange={e=>setEditing({...editing,slot:e.target.value as MealSlot})}>{mealTypes.map(t=><option key={t}>{t}</option>)}</select></label><label className="p2-field">Time<input type="time" required value={editing.time} onChange={e=>setEditing({...editing,time:e.target.value})}/></label>
      {([['energyKcal','Energy (kcal)'],['proteinG','Protein (g)'],['carbsG','Carbs (g)'],['fatG','Fat (g)']] as [keyof MealRecord,string][]).map(([k,label])=><label className="p2-field" key={k}>{label}<input type="number" min="0" max="10000" step="0.1" value={editing[k] as number} onChange={e=>setEditing({...editing,[k]:Number(e.target.value)})}/></label>)}</div>
      <p className="p2-hint"><Info size={15}/> Manual adjustments are not verified food composition. A correction changes this preview snapshot only.</p>{error&&<p className="form-error" role="alert">{error}</p>}<div className="p2-actions"><button className="primary-button" type="submit">Save correction</button><button className="outlined-button" type="button" onClick={()=>setEditing(null)}>Cancel</button></div></form></div></div>}
  </div>;
}

function FoodsPage({p}:{p:Phase2Props}){
  const [query,setQuery]=useState('');const [selected,setSelected]=useState<FoodChoice|null>(null);const [servings,setServings]=useState(1);const [slot,setSlot]=useState<MealSlot>('Snack');const [error,setError]=useState('');
  const filtered=p.foods.filter(f=>(f.name+' '+f.serving).toLowerCase().includes(query.toLowerCase()));
  function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!selected)return;try{const macros=foodAmount(selected,servings);p.onAddMeal({id:'food-'+Date.now()+'-'+Math.random().toString(36).slice(2,6),recordedOn:p.activeDate,slot,name:selected.name,details:servings+' × '+selected.serving+' · estimated demo nutrition',time:new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}),emoji:selected.emoji,...macros,status:'logged'});setSelected(null);p.onNotice('Sample food logged','This record is linked to the selected demo date and will appear in Today and Meals.');}catch(err){setError(err instanceof Error?err.message:'Invalid quantity.');}}
  return <div className="p2-page"><Header icon={BookOpen} eyebrow="FOOD KNOWLEDGE" title="Foods & portions" description="Explore a sample food catalogue, compare serving estimates and log an observed meal." actions={<button className="outlined-button" onClick={()=>p.navigate('recipes')} type="button">Open recipes <ArrowRight size={15}/></button>}/>
    <div className="p2-notice"><Info size={18}/><span>Every food value shown is illustrative. The verified composition database, serving provenance and allergen validation arrive with the authoritative backend.</span></div>
    <Card title="Food library" subtitle={filtered.length+' sample foods · nutrition per listed serving'} action={<label className="p2-search"><Search size={17}/><input aria-label="Search foods" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search chicken, tilapia, ugali…"/></label>}>
      {filtered.length?<div className="p2-food-grid">{filtered.map(f=><article className="p2-food-card" key={f.id}><span className="p2-food-emoji">{f.emoji}</span><h3>{f.name}</h3><small>{f.serving}</small><div className="p2-food-nutrients"><span><b>{f.energyKcal}</b> kcal</span><span><b>{f.proteinG}</b>g protein</span></div><button className="outlined-button" type="button" onClick={()=>{setSelected(f);setServings(1);setError('');}}>Log portion <Plus size={14}/></button></article>)}</div>:<div className="p2-empty"><Search size={26}/><b>No matching sample foods</b><p>Try a different food. The production catalogue will support additional regional foods and aliases.</p></div>}</Card>
    {selected&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setSelected(null);}}><div className="modal p2-modal" role="dialog" aria-modal="true" aria-labelledby="p2-food-log"><div className="modal-header"><div><span className="eyebrow">SAMPLE FOOD ENTRY</span><h2 id="p2-food-log">{selected.emoji} {selected.name}</h2></div><button className="icon-button" type="button" onClick={()=>setSelected(null)} aria-label="Close food portion"><X size={20}/></button></div>
    <form onSubmit={submit} className="p2-form"><div className="p2-field-grid"><label className="p2-field">Servings of {selected.serving}<input type="number" required min=".25" max="10" step=".25" value={servings} onChange={e=>setServings(Number(e.target.value))}/></label><label className="p2-field">Meal slot<select value={slot} onChange={e=>setSlot(e.target.value as MealSlot)}>{mealTypes.map(x=><option key={x}>{x}</option>)}</select></label></div><div className="p2-estimate"><Flame size={17}/> {Number.isFinite(servings)&&servings>0?Math.round(selected.energyKcal*servings):'—'} kcal <Activity size={17}/> {Number.isFinite(servings)&&servings>0?Math.round(selected.proteinG*servings*10)/10:'—'}g protein</div>{error&&<p className="form-error" role="alert">{error}</p>}<div className="p2-actions"><button className="primary-button" type="submit">Confirm sample consumption</button><button type="button" className="outlined-button" onClick={()=>setSelected(null)}>Cancel</button></div></form></div></div>}
  </div>;
}

function RecipeEditor({foods, initial, onSave, onCancel}:{foods:FoodChoice[];initial:RecipeRecord|null;onSave:(recipe:RecipeRecord)=>void;onCancel:()=>void}){
  const [value,setValue]=useState<RecipeRecord>(initial??{id:'recipe-'+Date.now(),name:'',description:'',emoji:'🍲',servings:2,prepMinutes:20,instructions:'',ingredients:[{foodId:foods[0].id,servings:1}]});
  const [error,setError]=useState('');
  let estimate:string='Add ingredients to calculate a serving';
  try {const n=recipeAmount(value,foods);estimate=n.energyKcal+' kcal · '+n.proteinG+'g protein per serving';}catch{ /* incomplete draft */ }
  function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();try{recipeAmount(value,foods);if(value.name.trim().length<2||value.name.length>90)throw new Error('Enter a recipe name of 2–90 characters.');if(!Number.isFinite(value.prepMinutes)||value.prepMinutes<0||value.prepMinutes>600)throw new Error('Preparation time must be 0–600 minutes.');onSave({...value,name:value.name.trim()});}catch(err){setError(err instanceof Error?err.message:'Invalid recipe.');}}
  function updateIngredient(index:number,patch:Partial<RecipeIngredient>){setValue(v=>({...v,ingredients:v.ingredients.map((ingredient,i)=>i===index?{...ingredient,...patch}:ingredient)}));}
  return <form className="p2-form p2-recipe-editor" onSubmit={submit}><div className="p2-field-grid"><label className="p2-field">Recipe name<input required maxLength={90} value={value.name} onChange={e=>setValue({...value,name:e.target.value})} placeholder="Example: chicken rice bowl"/></label><label className="p2-field">Description<input maxLength={180} value={value.description} onChange={e=>setValue({...value,description:e.target.value})} placeholder="A simple weeknight dinner"/></label><label className="p2-field">Recipe yield (servings)<input type="number" required min="1" max="30" step="1" value={value.servings} onChange={e=>setValue({...value,servings:Number(e.target.value)})}/></label><label className="p2-field">Preparation time (minutes)<input type="number" min="0" max="600" step="1" value={value.prepMinutes} onChange={e=>setValue({...value,prepMinutes:Number(e.target.value)})}/></label></div>
    <div className="p2-ingredient-heading"><strong>Ingredients</strong><button type="button" className="outlined-button" disabled={value.ingredients.length>=12} onClick={()=>setValue({...value,ingredients:[...value.ingredients,{foodId:foods[0].id,servings:1}]})}><Plus size={14}/>Ingredient</button></div>
    {value.ingredients.map((ing,i)=><div className="p2-ingredient" key={i}><label>Food<select value={ing.foodId} onChange={e=>updateIngredient(i,{foodId:e.target.value})}>{foods.map(f=><option key={f.id} value={f.id}>{f.name} · {f.serving}</option>)}</select></label><label>Servings<input type="number" required min=".25" max="10" step=".25" value={ing.servings} onChange={e=>updateIngredient(i,{servings:Number(e.target.value)})}/></label><button type="button" aria-label={'Remove ingredient '+(i+1)} className="outlined-button p2-danger" onClick={()=>setValue({...value,ingredients:value.ingredients.filter((_,index)=>index!==i)})}><X size={15}/></button></div>)}
    <label className="p2-field">Preparation instructions<textarea rows={3} maxLength={1500} value={value.instructions} onChange={e=>setValue({...value,instructions:e.target.value})} placeholder="Write your instructions…"/></label>
    <div className="p2-estimate"><Activity size={17}/>{estimate} <span>· Estimate from demo portions</span></div>{error&&<p className="form-error" role="alert">{error}</p>}
    <div className="p2-actions"><button className="primary-button" type="submit"><Check size={16}/>Save recipe</button><button className="outlined-button" type="button" onClick={onCancel}>Cancel</button></div></form>;
}

function RecipesPage({p}:{p:Phase2Props}){
  const [draft,setDraft]=useState<RecipeRecord|null|undefined>(undefined);const [query,setQuery]=useState('');const [selected,setSelected]=useState<RecipeRecord|null>(null);const [portions,setPortions]=useState(1);const [slot,setSlot]=useState<MealSlot>('Dinner');const [error,setError]=useState('');
  const visible=p.recipes.filter(r=>r.name.toLowerCase().includes(query.toLowerCase()));
  function logRecipe(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!selected)return;try{const macros=recipeAmount(selected,p.foods,portions);p.onAddMeal({id:'recipe-log-'+Date.now(),recordedOn:p.activeDate,slot,name:selected.name,details:portions+' × recipe serving · demo estimate',emoji:selected.emoji,time:new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}),...macros,status:'logged'});setSelected(null);p.onNotice('Recipe logged','A snapshot of this recipe portion was added as a consumed example meal.');}catch(err){setError(err instanceof Error?err.message:'Invalid portion.');}}
  return <div className="p2-page"><Header icon={BookOpen} eyebrow="REUSABLE MEALS" title="Recipe studio" description="Build recipes from foods, estimate portions and reuse them in your daily log." actions={<button type="button" className="primary-button" onClick={()=>setDraft(null)}><Plus size={15}/>New recipe</button>}/>
    <div className="p2-notice"><Info size={17}/><span>Recipes use unverified sample food quantities and cannot establish accurate nutrient content or allergen safety.</span></div>
    {draft!==undefined?<Card title={draft?'Edit recipe':'Create recipe'} subtitle="Your recipe changes remain in this browser session."><RecipeEditor key={draft?.id??'new'} initial={draft} foods={p.foods} onSave={r=>{p.onSaveRecipe(r);setDraft(undefined);p.onNotice('Recipe saved','Recipe library updated in memory.');}} onCancel={()=>setDraft(undefined)}/></Card>:<Card title="Your recipes" subtitle={p.recipes.length+' temporary preview recipes'} action={<label className="p2-search"><Search size={15}/><input aria-label="Search recipes" placeholder="Search recipes…" value={query} onChange={e=>setQuery(e.target.value)}/></label>}>
      {visible.length?<div className="p2-recipe-grid">{visible.map(r=>{let estimate='Not calculated';try{const n=recipeAmount(r,p.foods);estimate=n.energyKcal+' kcal · '+n.proteinG+'g protein / serving';}catch{/* missing ingredient */}return <article className="p2-recipe-card" key={r.id}><div className="p2-recipe-art">{r.emoji}</div><div><h3>{r.name}</h3><p>{r.description||'Custom meal recipe'}</p><small><Clock size={13}/>{r.prepMinutes} minutes · Serves {r.servings}</small><span className="p2-recipe-macro">{estimate}</span><div className="p2-recipe-actions"><button className="primary-button" type="button" onClick={()=>{setSelected(r);setPortions(1);setError('');}}>Log portion <Plus size={14}/></button><button className="outlined-button" type="button" aria-label={'Edit '+r.name} onClick={()=>setDraft(r)}><Edit3 size={15}/></button><button className="outlined-button p2-danger" type="button" aria-label={'Delete '+r.name} onClick={()=>{if(window.confirm('Delete this recipe from the temporary preview? Past logged meal snapshots will remain.'))p.onDeleteRecipe(r.id);}}><Trash2 size={15}/></button></div></div></article>;})}</div>:<div className="p2-empty"><BookOpen size={27}/><b>No recipes found</b><p>Create a recipe to save reusable ingredient combinations.</p><button type="button" className="outlined-button" onClick={()=>setDraft(null)}>Create recipe <Plus size={14}/></button></div>}</Card>}
    {selected&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setSelected(null);}}><div className="modal p2-modal" role="dialog" aria-modal="true" aria-labelledby="p2-recipe-log"><div className="modal-header"><div><span className="eyebrow">RECIPE CONSUMPTION</span><h2 id="p2-recipe-log">{selected.name}</h2></div><button className="icon-button" aria-label="Close" type="button" onClick={()=>setSelected(null)}><X size={20}/></button></div>
      <form className="p2-form" onSubmit={logRecipe}><div className="p2-field-grid"><label className="p2-field">Servings eaten<input type="number" required min=".25" max="10" step=".25" value={portions} onChange={e=>setPortions(Number(e.target.value))}/></label><label className="p2-field">Meal slot<select value={slot} onChange={e=>setSlot(e.target.value as MealSlot)}>{mealTypes.map(s=><option key={s}>{s}</option>)}</select></label></div>
      {error&&<p className="form-error" role="alert">{error}</p>}<div className="p2-actions"><button type="submit" className="primary-button">Log estimated portion</button><button className="outlined-button" type="button" onClick={()=>setSelected(null)}>Cancel</button></div></form></div></div>}
  </div>;
}

function GoalsPage({p}:{p:Phase2Props}){
  const totals=calculateLoggedTotals(mealsOnDate(p.meals,p.activeDate,SAMPLE_DATE));
  const [editing,setEditing]=useState(false);
  return <div className="p2-page"><Header icon={Target} eyebrow="PERSONAL TARGETS" title="Nutrition goals" description="Set your own example targets and see how logged intake compares with them." actions={<button className="primary-button" type="button" onClick={()=>setEditing(e=>!e)}><Edit3 size={15}/>{editing?'Close editor':'Edit targets'}</button>}/>
    {editing&&<Card title="Edit example targets" subtitle="These are user-chosen demonstration values, not medical prescriptions."><TargetsEditor initial={p.targets} save={t=>{p.onSaveTargets(t);setEditing(false);p.onNotice('Goals updated','The dashboard and progress screens now use your example targets.');}} cancel={()=>setEditing(false)}/></Card>}
    <div className="p2-two-column"><Card title="Daily target coverage" subtitle={'Logged sample intake on '+p.activeDate}>
      {totals.hasObservations?<div className="p2-bars"><Bar label="Energy" actual={totals.energyKcal} target={p.targets.energyKcal} suffix="kcal"/><Bar label="Protein" actual={totals.proteinG} target={p.targets.proteinG} suffix="g"/><Bar label="Carbs" actual={totals.carbsG} target={p.targets.carbsG} suffix="g"/><Bar label="Fat" actual={totals.fatG} target={p.targets.fatG} suffix="g"/></div>:<div className="p2-empty"><Target size={28}/><b>No observed meals for this date</b><p>Goal comparison will appear when the demo log contains entries.</p></div>}
    </Card><div className="p2-stack"><Card title="Targets at a glance"><div className="p2-target-list">{([['Energy',p.targets.energyKcal,'kcal'],['Protein',p.targets.proteinG,'g'],['Carbohydrates',p.targets.carbsG,'g'],['Fat',p.targets.fatG,'g'],['Hydration',p.targets.hydrationL,'L']] as [string,number,string][]).map(([n,v,u])=><div key={n}><span>{n}</span><strong>{v} {u}</strong></div>)}</div></Card><Card title="How targets work"><p className="p2-muted">Nutrition OS will later derive requirements from approved context, with provenance, effective dates and safety rules. For now, only explicitly entered example targets are used.</p><button type="button" className="outlined-button" onClick={()=>{p.onSaveTargets({...DEFAULT_TARGETS});p.onNotice('Targets reset','Restored the example default targets.');}}>Reset example targets</button></Card></div></div>
    <div className="p2-next-action"><span>↗</span><div><strong>Check your trend</strong><p>Review observed days without filling missing days with fabricated zero intake.</p></div><button type="button" className="outlined-button" onClick={()=>p.navigate('progress')}>View progress <ArrowRight size={14}/></button></div></div>;
}

function ProgressPage({p}:{p:Phase2Props}){
  const days=observedDays(p.meals,SAMPLE_DATE);
  const latest=days[days.length-1];
  return <div className="p2-page"><Header icon={TrendingUp} eyebrow="PROGRESS OVER TIME" title="Nutrition progress" description="Review only days with sample observations; missing days are never scored as zero." actions={<button className="outlined-button" type="button" onClick={()=>p.navigate('goals')}>Review targets <ArrowRight size={15}/></button>}/>
    <div className="p2-metrics"><Metric icon={CalendarDays} label="Observed days" value={String(days.length)} info="Not a measure of adherence"/><Metric icon={Utensils} label="Total logged meals" value={String(days.reduce((s,d)=>s+d.logged,0))} info="Across observed dates"/><Metric icon={Activity} label="Latest observed protein" value={latest?latest.proteinG.toFixed(1)+' g':'No data'} info={latest?.date??'No observations'}/><Metric icon={Flame} label="Latest observed energy" value={latest?latest.energyKcal+' kcal':'No data'} info="From explicitly logged meals"/></div>
    <div className="p2-two-column"><Card title="Observed energy by date" subtitle="Bars show recorded intake only; shorter bars may mean incomplete logging.">
      {days.length?<div className="p2-chart">{days.map(d=><div className="p2-chart-row" key={d.date}><span>{d.date}</span><div><i style={{width:clampProgress(d.energyKcal,p.targets.energyKcal)+'%'}}/></div><strong>{d.energyKcal} kcal</strong></div>)}</div>:<div className="p2-empty"><BarPlaceholder/><b>Not enough observations</b><p>Log a meal to begin showing dates with recorded intake.</p></div>}
    </Card><Card title="Observed protein by date" subtitle="Relative to your editable demo protein target.">{days.length?<div className="p2-chart">{days.map(d=><div className="p2-chart-row" key={d.date}><span>{d.date}</span><div><i className="blue" style={{width:clampProgress(d.proteinG,p.targets.proteinG)+'%'}}/></div><strong>{Math.round(d.proteinG)} g</strong></div>)}</div>:<p className="p2-muted">No logged protein observations available.</p>}</Card></div>
    <Card title="How to interpret these results"><div className="p2-insights"><div><Info size={21}/><strong>Incomplete tracking ≠ insufficient eating</strong><p>A missing meal may simply be unlogged; the dashboard cannot infer a physiological deficiency from that gap.</p></div><div><ShieldCheck size={21}/><strong>Only known data is charted</strong><p>No synthetic day-by-day progress, personal health status, or unwarranted predictions are generated.</p></div><div><Target size={21}/><strong>Targets can be changed</strong><p>These visual comparisons are not a nutritional prescription and do not replace clinician guidance.</p></div></div></Card>
  </div>;
}
function BarPlaceholder(){return <TrendingUp size={27}/>;}

export default function PersonalExperience(p:Phase2Props) {
  switch(p.route){
    case 'onboarding':return <Onboarding p={p}/>;
    case 'profile':return <ProfilePage p={p}/>;
    case 'today':return <TodayPage p={p}/>;
    case 'meals':return <MealsPage p={p}/>;
    case 'foods':return <FoodsPage p={p}/>;
    case 'recipes':return <RecipesPage p={p}/>;
    case 'goals':return <GoalsPage p={p}/>;
    case 'progress':return <ProgressPage p={p}/>;
  }
}
