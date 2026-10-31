import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  Activity, AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight,
  Clock, Edit3, Flame, Info, Leaf, Lock, LockOpen, Package, Plus, RefreshCw, Search,
  ShieldCheck, ShoppingBasket, Trash2, TrendingUp, Wallet, Warehouse, X,
} from 'lucide-react';
import type {FoodChoice, MealSlot} from '../domain/nutrition';
import type {RecipeRecord} from '../domain/personal';
import {
  changePlanStatus, datesOfWeek, daysUntil, editPlan, estimateGroceries,
  getWasteStats, isoDate, LOCATIONS, lotBalance, mondayOf,
  newWeeklyPlan, rankRecipeCandidates, recordedGrocerySpend, shiftDate, summarizePlan,
  validateShoppingLine, type GroceryList, type InventoryLot, type ShoppingLine,
  type StockKind, type StockMovement, type StorageLocation, type WeeklyPlan,
} from '../domain/resources';
import './resources.css';

export type ResourceRoute='planner'|'groceries'|'inventory'|'budget'|'waste';
export interface ResourceProps {
  route:ResourceRoute;
  activeDate:string;
  plans:WeeklyPlan[];
  recipes:RecipeRecord[];
  foods:FoodChoice[];
  priceBook:Record<string,number>;
  lots:InventoryLot[];
  movements:StockMovement[];
  list:GroceryList;
  archivedLists:GroceryList[];
  budgetKes:number;
  onPlan:(plan:WeeklyPlan)=>void;
  onList:(list:GroceryList)=>void;
  onGenerate:(plan:WeeklyPlan)=>void;
  onBudget:(kes:number)=>void;
  onAddLot:(lot:InventoryLot,quantity:number)=>void;
  onRecord:(movement:StockMovement)=>void;
  onTransfer:(sourceId:string,destination:StorageLocation,quantity:number,date:string)=>void;
  onReceive:(line:ShoppingLine,location:StorageLocation,expiry:string|null)=>void;
  navigate:(route:string)=>void;
  notify:(title:string,body:string)=>void;
}
const slots:MealSlot[]=['Breakfast','Lunch','Snack','Dinner'];
const price = (n:number)=>'KES '+Math.round(n).toLocaleString('en-KE');
const makeId=(prefix:string)=>prefix+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);
const foodOf=(p:ResourceProps,id:string)=>p.foods.find(f=>f.id===id);
const recipeOf=(p:ResourceProps,id:string)=>p.recipes.find(r=>r.id===id);
const qty=(number:number)=>Number(number.toFixed(2));
function ScreenHead({icon:Icon,tag,title,description,action}:{icon:typeof Leaf;tag:string;title:string;description:string;action?:ReactNode}) {
  return <header className="rs-head"><div><span className="eyebrow"><Icon size={14}/>{tag}</span><h1>{title}</h1><p>{description}</p></div>{action&&<div className="rs-head-actions">{action}</div>}</header>;
}
function Panel({title,description,action,children}:{title:string;description?:string;action?:ReactNode;children:ReactNode}) {
  return <section className="panel rs-panel"><div className="rs-panel-top"><div><h2>{title}</h2>{description&&<p>{description}</p>}</div>{action}</div>{children}</section>;
}
function Stat({icon:Icon,label,value,hint}:{icon:typeof Leaf;label:string;value:string;hint:string}) {
  return <article className="panel rs-stat"><span><Icon size={19}/></span><div><small>{label}</small><strong>{value}</strong><em>{hint}</em></div></article>;
}
function SafetyNote({children}:{children:ReactNode}) { return <div className="rs-note"><Info size={17}/><span>{children}</span></div>; }
function Modal({title,children,onClose}:{title:string;children:ReactNode;onClose:()=>void}) {
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
    <div role="dialog" aria-modal="true" aria-label={title} className="modal rs-dialog">
      <div className="modal-header"><h2>{title}</h2><button className="icon-button" type="button" aria-label="Close dialog" onClick={onClose}><X size={19}/></button></div>{children}
    </div>
  </div>;
}
function useIssue() {
  const [issue,setIssue]=useState('');
  const clear=()=>setIssue('');
  const attempt=(action:()=>void)=>{
    try {action();setIssue('');}
    catch(error){setIssue(error instanceof Error?error.message:'Unable to complete this action.');}
  };
  return {issue,setIssue,clear,attempt};
}
function Issue({text}:{text:string}) {return text?<p className="rs-error" role="alert">{text}</p>:null;}

function Planner({p}:{p:ResourceProps}) {
  const [start,setStart]=useState(()=>mondayOf(p.activeDate));
  const plan=p.plans.find(item=>item.weekStart===start)??newWeeklyPlan(start);
  const [day,setDay]=useState(()=>p.activeDate);
  const [slot,setSlot]=useState<MealSlot>('Dinner');
  const [recipeId,setRecipeId]=useState(p.recipes[0]?.id??'');
  const [portions,setPortions]=useState(1);
  const [maxPrep,setMaxPrep]=useState(30);
  const [editing,setEditing]=useState<string|null>(null);
  const {issue,attempt,clear}=useIssue();
  const days=datesOfWeek(start);
  const current=days.includes(day)?day:days[0];
  const stock=useMemo(()=>{
    const safe:Record<string,number>={};
    for(const lot of p.lots){
      if(lot.expiresOn&&daysUntil(lot.expiresOn,p.activeDate)<0)continue;
      safe[lot.foodId]=(safe[lot.foodId]??0)+Math.max(0,lotBalance(lot.id,p.movements));
    }
    return safe;
  },[p.lots,p.movements,p.activeDate]);
  const best=useMemo(()=>{
    try{return rankRecipeCandidates(p.recipes,p.foods,p.priceBook,stock,maxPrep).slice(0,3);}catch{return [];}
  },[p.recipes,p.foods,p.priceBook,stock,maxPrep]);
  const totals=useMemo(()=>{try{return summarizePlan(plan,p.recipes,p.foods,p.priceBook);}catch{return null;}},[plan,p.recipes,p.foods,p.priceBook]);
  const isApproved=plan.status==='approved';
  function navigateWeek(delta:number){const next=shiftDate(start,delta*7);setStart(next);setDay(next);setEditing(null);clear();}
  function save(change:Parameters<typeof editPlan>[1]) {
    attempt(()=>{p.onPlan(editPlan(plan,change));setEditing(null);p.notify('Meal plan updated','Draft plan updated for '+start+'. Changes remain in browser memory.');});
  }
  function submit(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();
    save({action:'add',entry:{id:makeId('planned'),date:current,slot,recipeId,portions,locked:false}});
  }
  function statusChange(){
    attempt(()=>{
      const to=isApproved?'draft':'approved';
      if(to==='approved'&&!window.confirm('Approve this illustrative meal plan? Allergy checks and professional nutrition validation are NOT available.'))return;
      p.onPlan(changePlanStatus(plan,to));
      p.notify(to==='approved'?'Plan approved':'Plan reopened',to==='approved'?'Grocery generation is now available. Planned meals are not recorded intake.':'The draft can now be edited.');
    });
  }
  const forecast=totals?.estimatedCostKes??0;
  const exclusionsNotice='Dietary preferences and allergies cannot be automatically verified using these unverified recipes. Carefully check every ingredient yourself.';
  return <div className="rs-page"><ScreenHead icon={CalendarDays} tag="MEAL PLANNING" title="Plan the week, live the day" description="Build, approve and adapt meals—without confusing what you plan with what you consume." action={<div className="rs-inline-actions"><button className="outlined-button" type="button" onClick={()=>p.navigate('recipes')}>Recipe studio <ArrowRight size={15}/></button><button className="primary-button" type="button" onClick={()=>p.navigate('groceries')}>Groceries <ArrowRight size={15}/></button></div>}/>
    <div className="rs-stats"><Stat icon={CalendarDays} label="Planned meals" value={String(plan.entries.length)} hint={plan.status==='approved'?'Approved plan':'Working draft'}/><Stat icon={Flame} label="Estimated planned energy" value={totals?totals.energyKcal.toLocaleString()+' kcal':'—'} hint="Sum across the week"/><Stat icon={Activity} label="Planned protein" value={totals?qty(totals.proteinG)+' g':'—'} hint="Estimated, not consumed"/><Stat icon={Wallet} label="Estimated food cost" value={price(forecast)} hint="Sample unit prices"/></div>
    <SafetyNote>{exclusionsNotice} Planning suggestions are examples, not medical or dietary prescriptions.</SafetyNote>
    <Panel title="Weekly meal calendar" description="One meal per slot per day. Locked meals cannot be replaced or removed until unlocked." action={<div className="rs-inline-actions"><button type="button" className="rs-compact-icon" onClick={()=>navigateWeek(-1)} aria-label="Previous week"><ChevronLeft size={17}/></button><span className="rs-week-label">{days[0]} → {days[6]}</span><button type="button" className="rs-compact-icon" onClick={()=>navigateWeek(1)} aria-label="Next week"><ChevronRight size={17}/></button><span className={'rs-status '+plan.status}>{isApproved?'✓ Approved':'● Draft'}</span><button className={isApproved?'outlined-button':'primary-button'} type="button" onClick={statusChange}>{isApproved?'Reopen plan':'Approve plan'}</button></div>}>
      <div className="rs-week-grid">{days.map(d=>{
        const entries=plan.entries.filter(e=>e.date===d).sort((a,b)=>slots.indexOf(a.slot)-slots.indexOf(b.slot));
        const label=new Intl.DateTimeFormat('en-KE',{weekday:'short',timeZone:'UTC'}).format(new Date(d+'T12:00:00Z'));
        return <article key={d} className={'rs-day '+(d===current?'selected':'')}><button className="rs-day-head" type="button" onClick={()=>setDay(d)} aria-current={d===current?'date':undefined}><strong>{label}</strong><span>{d.slice(8)}</span><small>{entries.length} planned</small></button>
          <div className="rs-day-entries">{entries.map(e=>{const recipe=recipeOf(p,e.recipeId);return <div className="rs-planned-card" key={e.id}><small>{e.slot}</small><b>{recipe?.emoji||'🍽️'} {recipe?.name||'Missing recipe'}</b><span>{e.portions} serving{e.portions===1?'':'s'}</span>{!isApproved&&<div className="rs-mini-actions"><button type="button" aria-label={e.locked?'Unlock meal':'Lock meal'} title={e.locked?'Unlock':'Lock'} onClick={()=>save({action:'toggleLock',id:e.id})}>{e.locked?<Lock size={14}/>:<LockOpen size={14}/>}</button><button type="button" disabled={e.locked} aria-label="Edit meal" title="Edit" onClick={()=>{setEditing(e.id);setDay(d);setRecipeId(e.recipeId);setPortions(e.portions);setSlot(e.slot);}}><Edit3 size={14}/></button><button type="button" disabled={e.locked} title="Remove" aria-label="Remove planned meal" onClick={()=>save({action:'remove',id:e.id})}><Trash2 size={14}/></button></div>}</div>})}</div>
          {!entries.length&&<div className="rs-day-empty">No meals yet</div>}
          {!isApproved&&<button className="rs-day-add" type="button" onClick={()=>{setDay(d);setEditing(null);setSlot('Dinner');}}>+ Add</button>}
        </article>;
      })}</div>
      {!isApproved&&<form className="rs-planner-form" onSubmit={e=>{
        if(!editing){submit(e);return;}e.preventDefault();const old=plan.entries.find(x=>x.id===editing);if(!old)return;save({action:'update',entry:{...old,date:current,slot,recipeId,portions}});
      }}>
        <div><strong>{editing?'Edit selected meal':'Add planned meal'}</strong><small>Selected: {current} · {isApproved?'Approved':'Draft'}</small></div>
        <label>Recipe<select value={recipeId} onChange={e=>setRecipeId(e.target.value)}>{p.recipes.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
        <label>Meal slot<select value={slot} onChange={e=>setSlot(e.target.value as MealSlot)}>{slots.map(s=><option key={s}>{s}</option>)}</select></label>
        <label>Servings<input type="number" min=".25" max="10" step=".25" required value={portions} onChange={e=>setPortions(Number(e.target.value))}/></label>
        <button className="primary-button" disabled={!p.recipes.length} type="submit">{editing?'Save change':'Add meal'} <Plus size={15}/></button>
        {editing&&<button className="outlined-button" type="button" onClick={()=>setEditing(null)}>Cancel</button>}
      </form>}
      <Issue text={issue}/>
    </Panel>
    <div className="rs-two-columns">
      <Panel title="Ingredient-aware ideas" description="Illustrative deterministic ranking—protein, cost, pantry coverage and prep time." action={<label className="rs-small-select">Max prep <select value={maxPrep} onChange={e=>setMaxPrep(Number(e.target.value))}><option value={15}>15 min</option><option value={30}>30 min</option><option value={60}>60 min</option><option value={120}>120 min</option></select></label>}>
        {best.length?<div className="rs-candidate-list">{best.map(({recipe,proteinG,estimatedCostKes,stockCoverage})=><div className="rs-candidate" key={recipe.id}><span className="rs-candidate-emoji">{recipe.emoji}</span><div><strong>{recipe.name}</strong><small>{qty(proteinG)}g protein · {price(estimatedCostKes)} · {stockCoverage}% ingredients in stock</small></div><button className="outlined-button" disabled={isApproved} type="button" onClick={()=>{setRecipeId(recipe.id);setEditing(null);p.notify('Recipe selected','Choose a day and slot above to add this suggested recipe.');}}>Select</button></div>)}</div>:<p className="rs-muted">No recipes fit that preparation-time filter.</p>}
        <p className="rs-footnote">Ranking cannot verify allergens, medical restrictions, or food provenance. It does not automatically change your plan.</p>
      </Panel>
      <Panel title="Plan → Grocery handoff" description="Approved plan requirements can be grouped and reduced by available inventory.">
        <div className="rs-handoff"><span className="rs-handoff-icon"><ShoppingBasket size={27}/></span><div><strong>{plan.entries.length} planned meals</strong><p>Approved: {isApproved?'Yes':'No'} · Forecast: {price(forecast)}</p></div></div>
        <div className="rs-handoff-steps"><span>1. Plan meals</span><ArrowRight size={15}/><span>2. Approve</span><ArrowRight size={15}/><span>3. Shop</span></div>
        <button className="primary-button rs-full" type="button" disabled={!isApproved} onClick={()=>attempt(()=>{p.onGenerate(plan);p.navigate('groceries');})}>Generate grocery needs <ArrowRight size={15}/></button>
        {!isApproved&&<p className="rs-footnote">Approve this draft before generating a grocery list.</p>}
        <button className="rs-link" type="button" onClick={()=>p.navigate('inventory')}>Check available inventory <ArrowRight size={14}/></button>
      </Panel>
    </div>
  </div>;
}

function Groceries({p}:{p:ResourceProps}) {
  const [query,setQuery]=useState('');
  const [editor,setEditor]=useState<ShoppingLine|null>(null);
  const [manual,setManual]=useState(false);
  const [newFood,setNewFood]=useState(p.foods[0]?.id??'');
  const [newQty,setNewQty]=useState(1);
  const [newPrice,setNewPrice]=useState(p.priceBook[p.foods[0]?.id??'']??0);
  const [receiving,setReceiving]=useState<ShoppingLine|null>(null);
  const [location,setLocation]=useState<StorageLocation>('Pantry');
  const [expiry,setExpiry]=useState('');
  const {issue,attempt,clear}=useIssue();
  const total=estimateGroceries(p.list);
  const spent=recordedGrocerySpend(p.list)+p.archivedLists.reduce((sum,l)=>sum+recordedGrocerySpend(l),0);
  const checked=p.list.lines.filter(l=>l.purchased).length;
  const filtered=p.list.lines.filter(l=>(foodOf(p,l.foodId)?.name??l.foodId).toLowerCase().includes(query.toLowerCase()));
  const plan=p.plans.find(x=>x.weekStart===mondayOf(p.activeDate));
  const stale=Boolean(plan&&p.list.sourcePlanId===plan.id&&plan.revision!==p.list.sourceRevision);
  const stockStale=p.list.sourceStockEventCount!==null&&p.list.sourceStockEventCount!==p.movements.length;
  function replace(line:ShoppingLine){const original=p.list.lines.find(l=>l.id===line.id);if(original?.received&&(original.quantityServings!==line.quantityServings||original.unitPriceKes!==line.unitPriceKes||original.purchased!==line.purchased))throw new Error("Received stock quantities and unit prices are locked; only the recorded paid amount may be corrected.");if(!validateShoppingLine(line))throw new Error('Enter a positive quantity, nonnegative price, and valid actual cost.');p.onList({...p.list,lines:p.list.lines.map(l=>l.id===line.id?line:l)});}
  function check(line:ShoppingLine){
    attempt(()=>{
      if(line.received)throw new Error('Already received into inventory. This purchase cannot be unchecked.');
      replace({...line,purchased:!line.purchased,paidKes:line.purchased?null:line.paidKes});
    });
  }
  function addManual(e:FormEvent<HTMLFormElement>){e.preventDefault();attempt(()=>{
    const line:ShoppingLine={id:makeId('manual'),foodId:newFood,quantityServings:newQty,unitPriceKes:newPrice,source:'manual',purchased:false,paidKes:null,received:false,neededServings:0,stockOffsetServings:0};
    if(!validateShoppingLine(line))throw new Error('Enter a valid food, quantity and unit price.');
    p.onList({...p.list,lines:[...p.list.lines,line]});setManual(false);p.notify('Grocery added','Added a manual item to the example shopping list.');
  });}
  function generate(){
    attempt(()=>{
      if(!plan)throw new Error('No meal plan exists for the currently selected week.');
      if(p.list.lines.length&& !window.confirm('Replace current draft quantities and manual items with fresh plan requirements? Received purchases will be retained in spending history. Purchased items not received must be resolved first.'))return;
      p.onGenerate(plan);
      p.notify('Grocery list generated','Requirements were derived from approved recipes minus eligible example inventory.');
    });
  }
  return <div className="rs-page"><ScreenHead icon={ShoppingBasket} tag="GROCERY WORKSPACE" title="Shop with a plan" description="Consolidated ingredient requirements, editable quantities and transparent costs in Kenyan shillings." action={<div className="rs-inline-actions"><button className="outlined-button" type="button" onClick={()=>p.navigate('planner')}>Meal planner</button><button className="primary-button" type="button" onClick={generate}><RefreshCw size={15}/>Generate from plan</button></div>}/>
    <div className="rs-stats"><Stat icon={ShoppingBasket} label="Basket forecast" value={price(total)} hint="Quantity × illustrative unit price"/><Stat icon={CheckCircle2} label="Checked off" value={checked+' / '+p.list.lines.length} hint="Not a financial transaction"/><Stat icon={Wallet} label="Recorded purchase amounts" value={price(spent)} hint="Only explicitly entered actuals"/><Stat icon={TrendingUp} label="Budget remaining after recorded" value={price(p.budgetKes-spent)} hint="Can be negative"/></div>
    {stale&&<div className="rs-warning"><AlertTriangle size={18}/>Plan changed after list generation. Review the approved plan and regenerate groceries to refresh requirements.</div>}
    {stockStale&&<div className="rs-warning"><AlertTriangle size={18}/>Inventory changed after grocery generation. Quantities may be outdated; regenerate after reviewing the current plan and existing purchases.</div>}
    <SafetyNote>Checkoffs do not automatically change pantry stock or count as spending. Enter an actual amount and explicitly receive purchases. Regeneration archives received purchases so their recorded spending is retained.</SafetyNote>
    <Panel title="Shopping list" description={p.list.sourcePlanId?'From approved plan revision '+p.list.sourceRevision:'Manual or empty list'} action={<div className="rs-inline-actions"><label className="rs-search"><Search size={15}/><input aria-label="Search grocery items" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Find an item…"/></label><button className="outlined-button" type="button" onClick={()=>{setManual(true);clear();}}>+ Manual item</button></div>}>
      <div className="rs-shopping-rows">{filtered.map(line=>{
        const food=foodOf(p,line.foodId);
        return <div className={'rs-shopping-row '+(line.purchased?'checked':'')} key={line.id}>
          <label className="rs-checkbox"><input type="checkbox" aria-label={'Mark '+(food?.name??line.foodId)+' purchased'} checked={line.purchased} disabled={line.received} onChange={()=>check(line)}/></label>
          <span className="rs-food-icon">{food?.emoji??'🧺'}</span>
          <div className="rs-shopping-title"><strong>{food?.name??line.foodId}</strong><small>{qty(line.quantityServings)} × {food?.serving??'serving'} · {line.source==='plan'?'Plan requirement':'Manual'}</small><small>{line.source==='plan'?'Needed '+qty(line.neededServings)+', stock offset '+qty(line.stockOffsetServings)+' servings':'Custom shopping item'}</small></div>
          <div className="rs-shopping-money"><strong>{price(line.quantityServings*line.unitPriceKes)}</strong><small>{line.paidKes!==null?'Recorded amount: '+price(line.paidKes):line.purchased?'Checked · actual not recorded':'Estimated only'}</small></div>
          <div className="rs-shopping-actions"><button className="outlined-button" type="button" aria-label={'Edit '+(food?.name??'item')} onClick={()=>{setEditor({...line});clear();}}><Edit3 size={15}/></button>
          <button className="outlined-button" disabled={!line.purchased||line.received} type="button" onClick={()=>{setReceiving(line);setExpiry('');setLocation('Pantry');clear();}}>{line.received?'Received':'Receive'}</button>
          {line.source==='manual'&&<button type="button" className="outlined-button rs-danger" aria-label="Remove manual item" onClick={()=>p.onList({...p.list,lines:p.list.lines.filter(l=>l.id!==line.id)})}><Trash2 size={15}/></button>}
          </div>
        </div>;
      })}</div>
      {!filtered.length&&<div className="rs-empty">No items match the current shopping list. Generate from an approved meal plan or add a manual item.</div>}
      <Issue text={issue}/>
      <div className="rs-list-bottom"><div><small>Estimated subtotal</small><strong>{price(total)}</strong><span>Example budget {price(p.budgetKes)} · Forecast {price(p.budgetKes-total)} remaining</span></div><button className="primary-button" type="button" onClick={()=>p.navigate('budget')}>Open food budget <ArrowRight size={15}/></button></div>
    </Panel>
    {manual&&<Modal title="Add manual grocery item" onClose={()=>setManual(false)}><form className="rs-form" onSubmit={addManual}>
      <label>Food<select value={newFood} onChange={e=>{const f=e.target.value;setNewFood(f);setNewPrice(p.priceBook[f]??0);}}>{p.foods.map(f=><option key={f.id} value={f.id}>{f.name} · {f.serving}</option>)}</select></label>
      <div className="rs-form-grid"><label>Quantity (servings)<input type="number" min=".25" max="1000" step=".25" value={newQty} onChange={e=>setNewQty(Number(e.target.value))}/></label><label>Unit price KES<input type="number" min="0" max="100000" step="1" value={newPrice} onChange={e=>setNewPrice(Number(e.target.value))}/></label></div>
      <Issue text={issue}/><div className="rs-form-actions"><button className="primary-button" type="submit">Add item</button><button className="outlined-button" type="button" onClick={()=>setManual(false)}>Cancel</button></div></form></Modal>}
    {editor&&<Modal title="Edit grocery item" onClose={()=>setEditor(null)}><form className="rs-form" onSubmit={e=>{e.preventDefault();attempt(()=>{replace(editor);setEditor(null);p.notify('Grocery item updated','Quantities and costs are local preview values.');});}}>
      <p><strong>{foodOf(p,editor.foodId)?.name}</strong> · {foodOf(p,editor.foodId)?.serving}</p>
      <div className="rs-form-grid"><label>Quantity (servings)<input type="number" disabled={editor.received} required min=".25" max="1000" step=".25" value={editor.quantityServings} onChange={e=>setEditor({...editor,quantityServings:Number(e.target.value)})}/></label>
      <label>Unit price (KES)<input type="number" disabled={editor.received} required min="0" max="100000" value={editor.unitPriceKes} onChange={e=>setEditor({...editor,unitPriceKes:Number(e.target.value)})}/></label></div>
      <label>Actual paid (KES) · optional<input disabled={!editor.purchased} type="number" min="0" max="1000000" placeholder="Not recorded" value={editor.paidKes??''} onChange={e=>setEditor({...editor,paidKes:e.target.value===''?null:Number(e.target.value)})}/></label>
      <SafetyNote>Actual spending only counts when the item is checked off AND an amount has been explicitly recorded. A purchase checkmark alone is not a receipt.</SafetyNote>
      <Issue text={issue}/><div className="rs-form-actions"><button className="primary-button" type="submit">Save changes</button><button className="outlined-button" type="button" onClick={()=>setEditor(null)}>Cancel</button></div></form></Modal>}
    {receiving&&<Modal title="Receive purchase into inventory" onClose={()=>setReceiving(null)}><form className="rs-form" onSubmit={e=>{e.preventDefault();attempt(()=>{
      if(expiry&&!isoDate(expiry))throw new Error('Enter a valid expiry date.');
      p.onReceive(receiving,location,expiry||null);setReceiving(null);p.notify('Stock received','Inventory ledger contains a new purchase receipt. Grocery item cannot be received again.');
    });}}>
      <p>Receive <strong>{qty(receiving.quantityServings)}</strong> servings of <strong>{foodOf(p,receiving.foodId)?.name}</strong>. Verify the actual purchased quantity before confirming.</p>
      <div className="rs-form-grid"><label>Location<select value={location} onChange={e=>setLocation(e.target.value as StorageLocation)}>{LOCATIONS.map(s=><option key={s}>{s}</option>)}</select></label><label>Expiry date (optional)<input type="date" value={expiry} onChange={e=>setExpiry(e.target.value)}/></label></div>
      <Issue text={issue}/><div className="rs-form-actions"><button className="primary-button" type="submit">Confirm receipt</button><button className="outlined-button" type="button" onClick={()=>setReceiving(null)}>Cancel</button></div></form></Modal>}
  </div>;
}

function Inventory({p}:{p:ResourceProps}) {
  const [filter,setFilter]=useState<'All'|StorageLocation>('All');
  const [openAdd,setOpenAdd]=useState(false);
  const [foodId,setFoodId]=useState(p.foods[0]?.id??'');
  const [location,setLocation]=useState<StorageLocation>('Pantry');
  const [amount,setAmount]=useState(1);
  const [unitPrice,setUnitPrice]=useState(0);
  const [expiry,setExpiry]=useState('');
  const [actionLot,setActionLot]=useState<InventoryLot|null>(null);
  const [kind,setKind]=useState<StockKind|'TRANSFER'>('CONSUMPTION');
  const [actionQty,setActionQty]=useState(1);
  const [actionNote,setActionNote]=useState('');
  const [dest,setDest]=useState<StorageLocation>('Fridge');
  const {issue,attempt,clear}=useIssue();
  const balances=useMemo(()=>p.lots.map(l=>({lot:l,balance:lotBalance(l.id,p.movements),expires:l.expiresOn?daysUntil(l.expiresOn,p.activeDate):null})),[p.lots,p.movements,p.activeDate]);
  const visible=balances.filter(x=>x.balance>0&& (filter==='All'||x.lot.location===filter));
  const locations=LOCATIONS.map(location=>({location,count:balances.filter(x=>x.lot.location===location&&x.balance>0).length}));
  const expiring=balances.filter(x=>x.balance>0&&x.expires!==null&&x.expires<=2);
  function add(e:FormEvent<HTMLFormElement>){e.preventDefault();attempt(()=>{
    if(!foodId||!Number.isFinite(amount)||amount<=0||amount>1000||!Number.isFinite(unitPrice)||unitPrice<0||unitPrice>100000)throw new Error('Enter valid food quantity and example unit cost.');
    if(expiry&&!isoDate(expiry))throw new Error('Invalid expiry date.');
    p.onAddLot({id:makeId('lot'),foodId,location,unitPriceKes:unitPrice,expiresOn:expiry||null,acquiredOn:p.activeDate},amount);
    setOpenAdd(false);p.notify('Stock added','An illustrative purchase event was appended to the inventory ledger.');
  });}
  function stockAction(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!actionLot)return;attempt(()=>{
    if(!Number.isFinite(actionQty)||actionQty<=0||actionQty>1000)throw new Error('Enter a positive quantity up to 1,000 servings.');
    if(kind==='TRANSFER')p.onTransfer(actionLot.id,dest,actionQty,p.activeDate);
    else{
      if(kind==='EXPIRY'&&(!actionLot.expiresOn||daysUntil(actionLot.expiresOn,p.activeDate)>0))throw new Error('The food has not reached its expiry date. Use Waste for early disposal.');
      p.onRecord({id:makeId('movement'),lotId:actionLot.id,date:p.activeDate,kind,deltaServings:kind==='PURCHASE'?actionQty:-actionQty,note:actionNote.trim()||kind.toLowerCase()+' recorded in demo'});
    }
    setActionLot(null);p.notify('Inventory updated',kind==='TRANSFER'?'A paired stock transfer was recorded.':'Stock movement recorded; quantity and waste reports updated.');
  });}
  return <div className="rs-page"><ScreenHead icon={Warehouse} tag="HOUSEHOLD RESOURCES" title="Know what's in your kitchen" description="Track pantry, fridge and freezer food in explicit serving units using a transparent stock-movement ledger." action={<div className="rs-inline-actions"><button className="outlined-button" type="button" onClick={()=>p.navigate('waste')}>Waste & expiry <ArrowRight size={14}/></button><button className="primary-button" type="button" onClick={()=>{setOpenAdd(true);clear();}}><Plus size={16}/>Add stock</button></div>}/>
    <div className="rs-stats">{locations.map(x=><Stat key={x.location} icon={Package} label={x.location} value={String(x.count)+' lots'} hint="With quantity remaining"/>)}<Stat icon={AlertTriangle} label="Expiring or expired" value={String(expiring.length)} hint="Within two days of selected date"/></div>
    <SafetyNote>Stock is not automatically consumed when a meal is logged, and groceries are not stocked until you confirm receipt. Expired lots remain visible until an explicit expiry or waste movement is recorded; do not use expired food.</SafetyNote>
    <Panel title="Available inventory lots" description="Serving units refer to the sample food catalogue—not kilograms or actual kitchen measurements." action={<label className="rs-small-select">Location<select aria-label="Filter inventory location" value={filter} onChange={e=>setFilter(e.target.value as typeof filter)}><option>All</option>{LOCATIONS.map(s=><option key={s}>{s}</option>)}</select></label>}>
      <div className="rs-inventory-grid">{visible.map(({lot,balance,expires})=>{const food=foodOf(p,lot.foodId);return <article className="rs-stock-card" key={lot.id}>
        <div className="rs-stock-emoji">{food?.emoji??'📦'}</div><div className="rs-stock-content"><strong>{food?.name??lot.foodId}</strong><small>{lot.location} · {food?.serving??'serving'} units</small><div className="rs-stock-meta"><span><b>{qty(balance)}</b> servings</span><span className={'rs-expiry '+(expires!==null&&expires<=0?'bad':expires!==null&&expires<=2?'warn':'')}>{expires===null?'No expiry entered':expires<0?'Expired '+Math.abs(expires)+'d ago':expires===0?'Expires today':expires+'d to expiry'}</span></div></div>
        <button className="outlined-button" type="button" onClick={()=>{setActionLot(lot);setKind('CONSUMPTION');setActionQty(Math.min(1,balance));setDest(lot.location==='Fridge'?'Freezer':'Fridge');clear();}}>Manage stock</button></article>;})}</div>
      {!visible.length&&<div className="rs-empty">No stock lots in this location. Add a lot or receive checked-off grocery items.</div>}
    </Panel>
    <Panel title="Stock movement ledger" description="Append-only activity. Quantity corrections are new events, not silent edits.">
      <div className="rs-ledger"><div className="rs-ledger-head"><span>Date</span><span>Food · location</span><span>Movement</span><span>Servings</span></div>
        {[...p.movements].reverse().slice(0,20).map(m=>{const lot=p.lots.find(l=>l.id===m.lotId);return <div className="rs-ledger-row" key={m.id}><span>{m.date}</span><span>{foodOf(p,lot?.foodId??'')?.name??'Unknown food'}<small>{lot?.location} · {m.note}</small></span><span className="rs-kind">{m.kind.replace('_',' ')}</span><strong className={m.deltaServings<0?'rs-minus':'rs-plus'}>{m.deltaServings>0?'+':''}{qty(m.deltaServings)}</strong></div>;})}
      </div>
    </Panel>
    {openAdd&&<Modal title="Add sample stock" onClose={()=>setOpenAdd(false)}><form className="rs-form" onSubmit={add}><label>Food<select value={foodId} onChange={e=>{setFoodId(e.target.value);setUnitPrice(p.priceBook[e.target.value]??0);}}>{p.foods.map(f=><option value={f.id} key={f.id}>{f.name} · {f.serving}</option>)}</select></label>
      <div className="rs-form-grid"><label>Location<select value={location} onChange={e=>setLocation(e.target.value as StorageLocation)}>{LOCATIONS.map(s=><option key={s}>{s}</option>)}</select></label><label>Quantity (servings)<input type="number" required min=".25" max="1000" step=".25" value={amount} onChange={e=>setAmount(Number(e.target.value))}/></label><label>Unit cost KES<input type="number" min="0" max="100000" required value={unitPrice} onChange={e=>setUnitPrice(Number(e.target.value))}/></label><label>Expiry (optional)<input type="date" value={expiry} onChange={e=>setExpiry(e.target.value)}/></label></div>
      <Issue text={issue}/><div className="rs-form-actions"><button className="primary-button" type="submit">Record purchase stock</button><button className="outlined-button" type="button" onClick={()=>setOpenAdd(false)}>Cancel</button></div></form></Modal>}
    {actionLot&&<Modal title={'Manage '+(foodOf(p,actionLot.foodId)?.name??'inventory')} onClose={()=>setActionLot(null)}><form className="rs-form" onSubmit={stockAction}><p>Available stock: <strong>{qty(lotBalance(actionLot.id,p.movements))}</strong> servings · {actionLot.location}</p><label>Stock action<select value={kind} onChange={e=>setKind(e.target.value as StockKind|'TRANSFER')}><option value="CONSUMPTION">Record consumption (reduce stock)</option><option value="WASTE">Record food waste</option><option value="EXPIRY">Discard expired food</option><option value="PURCHASE">Add purchased quantity</option><option value="TRANSFER">Move to another location</option></select></label>
      <label>Servings<input type="number" required min=".25" max="1000" step=".25" value={actionQty} onChange={e=>setActionQty(Number(e.target.value))}/></label>
      {kind==='TRANSFER'?<label>Move to<select value={dest} onChange={e=>setDest(e.target.value as StorageLocation)}>{LOCATIONS.filter(l=>l!==actionLot.location).map(l=><option key={l}>{l}</option>)}</select></label>:
      <label>Reason / note<input maxLength={120} value={actionNote} onChange={e=>setActionNote(e.target.value)} placeholder="What changed?"/></label>}
      <Issue text={issue}/><div className="rs-form-actions"><button className="primary-button" type="submit">Record movement</button><button className="outlined-button" type="button" onClick={()=>setActionLot(null)}>Cancel</button></div></form></Modal>}
  </div>;
}

function Budget({p}:{p:ResourceProps}) {
  const [editing,setEditing]=useState(false),[input,setInput]=useState(p.budgetKes),[error,setError]=useState('');
  const forecast=estimateGroceries(p.list),spent=recordedGrocerySpend(p.list)+p.archivedLists.reduce((sum,l)=>sum+recordedGrocerySpend(l),0);
  const hasUnpriced=p.list.lines.some(l=>l.unitPriceKes===0);
  const remaining=p.budgetKes-spent,forecastDifference=p.budgetKes-forecast;
  function save(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!Number.isFinite(input)||input<0||input>10000000){setError('Budget must be between KES 0 and KES 10,000,000.');return;}p.onBudget(input);setEditing(false);setError('');p.notify('Example food budget updated','Your changes are limited to this browser session.');}
  return <div className="rs-page"><ScreenHead icon={Wallet} tag="FOOD FINANCES" title="Every shilling has a purpose" description="Keep meal cost forecasts, grocery checkoffs and explicitly recorded purchase amounts distinct." action={<div className="rs-inline-actions"><button className="outlined-button" type="button" onClick={()=>p.navigate('groceries')}>Shopping list <ArrowRight size={14}/></button><button type="button" className="primary-button" onClick={()=>setEditing(true)}><Edit3 size={15}/>Edit budget</button></div>}/>
    <div className="rs-stats"><Stat icon={Wallet} label="Example allocation" value={price(p.budgetKes)} hint="Manual nutrition food budget"/><Stat icon={ShoppingBasket} label="Basket forecast" value={price(forecast)} hint="Estimated, not paid"/><Stat icon={CheckCircle2} label="Recorded purchases" value={price(spent)} hint="From explicit paid amounts"/><Stat icon={TrendingUp} label="Unspent allocation" value={price(remaining)} hint="Budget minus recorded purchases"/></div>
    <SafetyNote>Nutrition OS does not own bank transactions. These are manually entered example amounts, including archived received purchases. Finance OS reconciliation is future work. Checkoffs without an actual amount are excluded from recorded spending.</SafetyNote>
    {hasUnpriced&&<div className="rs-warning"><AlertTriangle size={17}/>One or more grocery items have a zero unit price. The forecast may be understated.</div>}
    <div className="rs-two-columns"><Panel title="Budget health" description="Compare projected basket and manual spending against your food allocation.">
      <div className="rs-budget-meter"><span className="rs-budget-meter-caption"><strong>{price(forecast)}</strong><small>of {price(p.budgetKes)} estimated</small></span><div className="rs-budget-track"><i style={{width:Math.min(100,p.budgetKes>0?forecast/p.budgetKes*100:forecast>0?100:0)+'%'}}/></div></div>
      <div className="rs-budget-split"><div><small>Forecast headroom</small><strong className={forecastDifference<0?'rs-negative':''}>{price(forecastDifference)}</strong></div><div><small>Actual unspent</small><strong className={remaining<0?'rs-negative':''}>{price(remaining)}</strong></div></div>
      <p className="rs-footnote">Forecast is a modeled basket. Recorded spending is based only on items with explicit paid amounts; remaining allocation is not a live account balance.</p>
    </Panel><Panel title="Shopping cost reconciliation" description="A grocery checkoff alone is not recognized as paid.">
      <div className="rs-cost-list">{p.list.lines.map(l=>{const food=foodOf(p,l.foodId);return <div key={l.id}><span>{food?.emoji} {food?.name??l.foodId}</span><span><strong>{price(l.quantityServings*l.unitPriceKes)}</strong><small>{l.paidKes!==null&&l.purchased?'Actual: '+price(l.paidKes):l.purchased?'Checked · actual unknown':'Not purchased'}</small></span></div>})}</div>
      {!p.list.lines.length&&<p className="rs-muted">Generate groceries to begin planning spending.</p>}
      {p.archivedLists.length>0&&<><h3 className="rs-history-title">Archived received purchases</h3><div className="rs-cost-list">{p.archivedLists.flatMap(l=>l.lines.filter(line=>line.purchased)).map(line=><div key={line.id}><span>{foodOf(p,line.foodId)?.name??line.foodId}</span><span><strong>{line.paidKes!==null?price(line.paidKes):'Actual not entered'}</strong><small>Received · previous grocery list</small></span></div>)}</div></>}
      <button className="outlined-button" type="button" onClick={()=>p.navigate('groceries')}>Record purchases in groceries <ArrowRight size={15}/></button>
    </Panel></div>
    <Panel title="Resource decisions" description="Useful next steps based on the current sample numbers."><div className="rs-decision-grid"><div><ShoppingBasket size={22}/><strong>Review shopping quantities</strong><p>Change estimated units and compare prices.</p><button className="outlined-button" onClick={()=>p.navigate('groceries')} type="button">Groceries</button></div><div><Package size={22}/><strong>Check pantry first</strong><p>Subtract available food from planned recipe ingredients.</p><button className="outlined-button" onClick={()=>p.navigate('inventory')} type="button">Inventory</button></div><div><AlertTriangle size={22}/><strong>Reduce avoidable waste</strong><p>Review stock nearing expiration before buying more.</p><button className="outlined-button" onClick={()=>p.navigate('waste')} type="button">Waste & expiry</button></div></div></Panel>
    {editing&&<Modal title="Edit food budget" onClose={()=>setEditing(false)}><form className="rs-form" onSubmit={save}><label>Food allocation for this sample basket (KES)<input required type="number" min="0" max="10000000" step="100" value={input} onChange={e=>setInput(Number(e.target.value))}/></label><Issue text={error}/><div className="rs-form-actions"><button className="primary-button" type="submit">Save allocation</button><button className="outlined-button" type="button" onClick={()=>setEditing(false)}>Cancel</button></div></form></Modal>}
  </div>;
}

function Waste({p}:{p:ResourceProps}) {
  const [selected,setSelected]=useState<InventoryLot|null>(null);
  const [amount,setAmount]=useState(1);
  const [reason,setReason]=useState('Food spoiled / quality changed');
  const {issue,attempt,clear}=useIssue();
  const summary=getWasteStats(p.lots,p.movements);
  const risky=p.lots.map(l=>({lot:l,balance:lotBalance(l.id,p.movements),days:l.expiresOn?daysUntil(l.expiresOn,p.activeDate):null}))
    .filter(x=>x.balance>0&&x.days!==null&&x.days<=3).sort((a,b)=>(a.days??0)-(b.days??0));
  const wasteEvents=[...p.movements].filter(m=>m.kind==='WASTE'||m.kind==='EXPIRY').reverse();
  function discard(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!selected)return;attempt(()=>{
    if(!Number.isFinite(amount)||amount<=0||amount>1000)throw new Error('Enter a positive quantity of 1,000 servings or less.');
    p.onRecord({id:makeId('waste'),lotId:selected.id,date:p.activeDate,kind:'WASTE',deltaServings:-amount,note:reason.slice(0,120)});
    p.notify('Waste recorded','The ledger and waste cost estimate have been updated.');setSelected(null);
  });}
  return <div className="rs-page"><ScreenHead icon={AlertTriangle} tag="FOOD STEWARDSHIP" title="Use more. Waste less." description="See expiry risk, record food disposal and understand the estimated value of wasted servings." action={<div className="rs-inline-actions"><button className="outlined-button" type="button" onClick={()=>p.navigate('inventory')}>Inventory <ArrowRight size={14}/></button><button className="primary-button" type="button" onClick={()=>p.navigate('planner')}>Plan with stock <ArrowRight size={15}/></button></div>}/>
    <div className="rs-stats"><Stat icon={AlertTriangle} label="At-risk food lots" value={String(risky.length)} hint="Expiry within 3 days or earlier"/><Stat icon={Trash2} label="Waste events" value={String(summary.events)} hint="Explicitly recorded only"/><Stat icon={Package} label="Servings discarded" value={String(qty(summary.servings))} hint="No automatic expiry writeoffs"/><Stat icon={Wallet} label="Estimated waste cost" value={price(summary.estimatedCostKes)} hint="Historical sample unit costs"/></div>
    <SafetyNote>Expiry dates are user-entered examples, not food-safety guarantees. Foods past their recorded expiry date should not be recommended for consumption. No stock is silently discarded or deducted.</SafetyNote>
    <div className="rs-two-columns"><Panel title="Use-soon watchlist" description="Food at or within three days of its entered expiry.">
      <div className="rs-risk-list">{risky.map(({lot,balance,days})=>{
        const food=foodOf(p,lot.foodId);
        const usedBy=p.recipes.filter(r=>r.ingredients.some(i=>i.foodId===lot.foodId)).slice(0,2);
        return <div className="rs-risk-row" key={lot.id}><span className="rs-food-icon">{food?.emoji??'🥕'}</span><div><strong>{food?.name??lot.foodId}</strong><small>{lot.location} · {qty(balance)} servings · {lot.expiresOn}</small><span className={'rs-expiry '+((days??0)<=0?'bad':'warn')}>{(days??0)<0?'Past expiry':days===0?'Expires today':days+' days remaining'}</span>
        {usedBy.length>0&&(days??0)>=0&&<small>Recipe idea: {usedBy.map(x=>x.name).join(', ')} (check safety first)</small>}</div><button type="button" className="outlined-button" onClick={()=>{setSelected(lot);setAmount(Math.min(1,balance));clear();}}>Record waste</button></div>;
      })}</div>
      {!risky.length&&<div className="rs-empty">No remaining lots are within the three-day example expiry window.</div>}
    </Panel>
    <Panel title="Waste history" description="Only explicit waste/expiry movements are counted.">
      {wasteEvents.length?<div className="rs-waste-history">{wasteEvents.map(m=>{const lot=p.lots.find(x=>x.id===m.lotId);return <div key={m.id}><span><strong>{foodOf(p,lot?.foodId??'')?.name??'Food item'}</strong><small>{m.date} · {m.kind} · {m.note}</small></span><span><b>{qty(-m.deltaServings)} servings</b><small>{price(-m.deltaServings*(lot?.unitPriceKes??0))}</small></span></div>})}</div>:<div className="rs-empty">No food waste has been recorded in this preview.</div>}
      <button className="rs-link" type="button" onClick={()=>p.navigate('inventory')}>Manage all inventory <ArrowRight size={15}/></button>
    </Panel></div>
    <Panel title="Waste reduction decisions" description="Simple cost and expiry awareness; no hidden prediction models."><div className="rs-decision-grid"><div><Clock size={22}/><strong>Use soon</strong><p>Prioritize unexpired foods close to their recorded date, after a safety check.</p></div><div><ShoppingBasket size={22}/><strong>Shop with inventory</strong><p>Recreate the grocery list when pantry availability changes.</p></div><div><ShieldCheck size={22}/><strong>Record actual disposal</strong><p>Use the ledger so wasted food is not counted as stock available.</p></div></div></Panel>
    {selected&&<Modal title={'Record wasted '+(foodOf(p,selected.foodId)?.name??'food')} onClose={()=>setSelected(null)}><form className="rs-form" onSubmit={discard}><p>Remaining: {qty(lotBalance(selected.id,p.movements))} servings · cost estimate {price(selected.unitPriceKes)} per serving.</p>
      <label>Discarded servings<input type="number" min=".25" max="1000" step=".25" value={amount} onChange={e=>setAmount(Number(e.target.value))}/></label>
      <label>Reason<select value={reason} onChange={e=>setReason(e.target.value)}><option>Food spoiled / quality changed</option><option>Expired food disposal</option><option>Preparation leftovers</option><option>Other waste</option></select></label>
      <Issue text={issue}/><div className="rs-form-actions"><button className="primary-button" type="submit">Confirm waste record</button><button className="outlined-button" type="button" onClick={()=>setSelected(null)}>Cancel</button></div></form></Modal>}
  </div>;
}
export default function ResourceExperience(p:ResourceProps){
  if(p.route==='planner')return <Planner p={p}/>;
  if(p.route==='groceries')return <Groceries p={p}/>;
  if(p.route==='inventory')return <Inventory p={p}/>;
  if(p.route==='budget')return <Budget p={p}/>;
  return <Waste p={p}/>;
}
