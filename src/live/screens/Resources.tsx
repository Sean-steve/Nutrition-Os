import {useState,type FormEvent} from 'react';
import {AlertTriangle,ArrowRight,CalendarDays,Check,CheckCircle2,ChevronLeft,ChevronRight,Clock,Package,Plus,ShoppingBasket,Trash2,Wallet,Warehouse} from 'lucide-react';
import type {LiveProps} from '../types';
import type {ServerGroceryLine,ServerPlan,ServerLot} from '../client';
import {asNumber,money,dateOnly} from '../client';
import {Head,Card,Stat,Empty,Note,Action,Field,slots,locations,monday,shiftDay} from '../components';
const upper=(str:string)=>str.charAt(0).toUpperCase()+str.slice(1);
function fName(p:LiveProps,id:string){return p.data.foods.find(f=>f.id===id)?.name??'Retired food ('+id.slice(0,8)+')';}
function recipeName(p:LiveProps,id:string){return p.data.recipes.find(r=>r.id===id)?.name??'Archived recipe';}
function bestPlan(p:LiveProps,weekStart:string){return p.data.plans.find(pl=>dateOnly(pl.week_start)===weekStart);}
function active(p:LiveProps){return p.data.groceries.find(g=>g.status==='active')??null;}
function uidTitle(code:string){return code.replaceAll('_',' ').replace(/\b\w/g,s=>s.toUpperCase());}
export function PlanScreen({p}:{p:LiveProps}){
 const [week,setWeek]=useState(monday(p.date));
 const [day,setDay]=useState(p.date),[slot,setSlot]=useState<'Breakfast'|'Lunch'|'Snack'|'Dinner'>('Dinner');
 const [recipeId,setRecipeId]=useState(''),[portions,setPortions]=useState('1'),[locked,setLocked]=useState(false);
 const plan=bestPlan(p,week),entries=plan?.entries??[];
 const days=Array.from({length:7},(_,i)=>shiftDay(week,i));
 async function createPlan(){
  await p.perform(()=>p.client.post('/plans',{weekStart:week}),'Weekly plan created in PostgreSQL.');
 }
 async function add(e:FormEvent<HTMLFormElement>){e.preventDefault();
  if(!plan)return;await p.perform(()=>p.client.post('/plans/'+plan.id+'/entries',{plannedOn:day,slot,recipeId,portions:Number(portions),locked}),
   'Meal added to the draft plan. It is not a consumed meal.');
 }
 async function setStatus(status:'approved'|'reopen'){if(!plan)return;
  await p.perform(()=>p.client.post('/plans/'+plan.id+'/'+(status==='approved'?'approve':'reopen'),{}),
   status==='approved'?'Plan approved; no intake was logged.':'Plan reopened for editing.');
 }
 async function remove(entryId:string){if(!plan)return;
  if(!window.confirm('Remove this draft meal from the plan?'))return;
  await p.perform(()=>p.client.delete('/plans/'+plan.id+'/entries/'+entryId),'Draft plan entry removed.');
 }
 async function toggleLock(entryId:string,isLocked:boolean){if(!plan)return;
  await p.perform(()=>p.client.patch('/plans/'+plan.id+'/entries/'+entryId+'/lock',{locked:!isLocked}),'Plan entry lock updated.');
 }
 return <div className="lv-page"><Head icon={CalendarDays} tag="PLAN AUTHORITY" title="Weekly Meal Planning" description="Approved plans can generate shopping requirements or be explicitly shared with a household. Plans never create consumption records." action={<Action outline onClick={()=>p.navigate('groceries')}>Open grocery workflow</Action>}/>
  <div className="lv-stats"><Stat icon={CalendarDays} title="Selected week" value={week} detail="Weeks begin Monday"/><Stat icon={CheckCircle2} title="Plan status" value={plan?upper(plan.status):'Not created'} detail={plan?'Revision '+plan.revision:'No synthetic plan created'}/><Stat icon={Clock} title="Plan entries" value={String(entries.length)} detail="Intent only, not consumption"/><Stat icon={ShoppingBasket} title="Shopping bridge" value={plan?.status==='approved'?'Ready':'Await approval'} detail="Requires your explicit action"/></div>
  <div className="lv-grid-two"><Card title="Seven-day meal schedule" detail="Choose a week and review its actual plan entries." action={<div className="lv-inline"><button className="lv-icon" type="button" aria-label="Previous week" onClick={()=>{const d=shiftDay(week,-7);setWeek(d);setDay(d);}}><ChevronLeft size={16}/></button><strong>{week}</strong><button className="lv-icon" type="button" aria-label="Next week" onClick={()=>{const d=shiftDay(week,7);setWeek(d);setDay(d);}}><ChevronRight size={16}/></button></div>}>
   <div className="lv-week-grid">{days.map(date=><article className={'lv-week-day '+(day===date?'selected':'')} key={date}>
    <button type="button" className="lv-week-heading" onClick={()=>setDay(date)}><small>{new Date(date+'T12:00:00Z').toLocaleDateString('en-KE',{weekday:'short',timeZone:'UTC'})}</small><strong>{date.slice(8)}</strong></button>
    <div className="lv-week-items">{entries.filter(e=>dateOnly(e.planned_on)===date).map(entry=><div className="lv-week-meal" key={entry.id}>
      <small>{entry.slot}</small><strong>{recipeName(p,entry.recipe_id)}</strong><span>{asNumber(entry.portions)} portion(s)</span>{plan?.status==='draft'&&<div className="lv-inline">
       <button type="button" className="lv-icon" onClick={()=>void toggleLock(entry.id,entry.locked)} title={entry.locked?'Unlock':'Lock'} aria-label={entry.locked?'Unlock meal':'Lock meal'}>{entry.locked?'🔒':'🔓'}</button>
       <button type="button" className="lv-icon lv-danger" disabled={entry.locked} onClick={()=>void remove(entry.id)} aria-label="Remove planned meal"><Trash2 size={13}/></button>
      </div>}
    </div>)}{!entries.some(e=>dateOnly(e.planned_on)===date)&&<span className="lv-week-blank">No planned meals</span>}</div>
   </article>)}</div>
   <div className="lv-inline lv-bottom-actions">{!plan?<button className="primary-button" type="button" disabled={p.busy} onClick={()=>void createPlan()}>Create weekly plan</button>:<><button className={plan.status==='draft'?'primary-button':'outlined-button'} type="button" disabled={p.busy} onClick={()=>void setStatus(plan.status==='draft'?'approved':'reopen')}>{plan.status==='draft'?'Approve plan':'Reopen plan'}</button><button className="outlined-button" type="button" onClick={()=>p.navigate('groceries')}>Generate groceries <ArrowRight size={14}/></button></>}</div>
  </Card><div className="lv-stack"><Card title="Add a planned meal" detail="Editable only while the weekly plan is a draft.">
    {!plan?<Empty title="Create a week first" description="No plan is inferred or imported for this signed-in account."/>:plan.status==='approved'?<Empty title="Approved plan is locked for edits" description="Reopen the plan to make changes; associated grocery lists may become stale."/>:
    <form className="lv-form" onSubmit={add}><div className="lv-form-grid"><Field title="Plan date"><select value={day} onChange={e=>setDay(e.target.value)}>{days.map(d=><option value={d} key={d}>{d}</option>)}</select></Field><Field title="Meal slot"><select value={slot} onChange={e=>setSlot(e.target.value as typeof slot)}>{slots.map(s=><option key={s} value={s}>{s}</option>)}</select></Field></div>
     <Field title="Recipe"><select value={recipeId} onChange={e=>setRecipeId(e.target.value)} required><option value="">Select a saved recipe</option>{p.data.recipes.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></Field>
     <div className="lv-form-grid"><Field title="Portions"><input type="number" step=".25" min=".25" max="1000" required value={portions} onChange={e=>setPortions(e.target.value)}/></Field><label className="lv-check"><input type="checkbox" checked={locked} onChange={e=>setLocked(e.target.checked)}/> Lock this entry</label></div>
     <button className="primary-button" type="submit" disabled={p.busy||!recipeId}><Plus size={14}/> Add to plan</button>
    </form>}
   </Card><Card title="Workflow continuity" detail="Review requirements before committing resources">
    <div className="lv-action-list"><button type="button" onClick={()=>p.navigate('recipes')}><span>Recipe Studio <small>Manage ingredient assumptions</small></span><ArrowRight size={15}/></button><button type="button" onClick={()=>p.navigate('groceries')}><span>Grocery requirements <small>Generate only after approval</small></span><ArrowRight size={15}/></button><button type="button" onClick={()=>p.navigate('family')}><span>Family sharing <small>Explicitly publish only sanitized meal logistics</small></span><ArrowRight size={15}/></button></div>
   </Card></div></div>
  <Note warn>Plan approval does not establish a medical nutrition recommendation, pantry consumption, or an actual eating event. Recipe portions are estimated using user-entered data.</Note>
 </div>;
}
export function GroceriesScreen({p}:{p:LiveProps}){
 const list=active(p),plans=p.data.plans.filter(x=>x.status==='approved');
 const [planId,setPlanId]=useState(''),[prices,setPrices]=useState<Record<string,string>>({});
 const [foodId,setFoodId]=useState(''),[quantity,setQuantity]=useState('1'),[unit,setUnit]=useState('');
 const [received,setReceived]=useState<ServerGroceryLine|null>(null),[location,setLocation]=useState<'Pantry'|'Fridge'|'Freezer'>('Pantry'),[expiry,setExpiry]=useState('');
 const [paid,setPaid]=useState<Record<string,string>>({}),[edit,setEdit]=useState<ServerGroceryLine|null>(null);
 const chosenPlan=plans.find(x=>x.id===planId),ingredientIds=[...new Set((chosenPlan?.entries??[]).flatMap(entry=>{
   const recipe=p.data.recipes.find(r=>r.id===entry.recipe_id);return recipe?.ingredients.map(i=>i.food_id)??[];
 }))];
 const total=(list?.lines??[]).reduce((sum,l)=>sum+asNumber(l.quantity_servings)*asNumber(l.unit_price_kes),0);
 const spent=p.data.groceries.flatMap(l=>l.lines).reduce((sum,l)=>sum+(l.purchased&&l.actual_paid_kes!==null?asNumber(l.actual_paid_kes):0),0);
 async function generate(){if(!chosenPlan)return;
   const priceMap:Record<string,number>={};
   for(const id of ingredientIds){const val=prices[id];if(val!==undefined&&val!=='')priceMap[id]=Number(val);}
   await p.perform(()=>p.client.post('/groceries/generate',{planId:chosenPlan.id,unitPricesKes:priceMap}),'Shopping list generated from approved recipe needs and eligible stock.');
 }
 async function newList(){if(!window.confirm('Create an empty shopping list? The previous list is archived, not deleted. Unreceived purchases must be resolved first.'))return;
  await p.perform(()=>p.client.post('/groceries/lists',{}),'New grocery list created. Previous purchases remain in history.');
 }
 async function addManual(e:FormEvent<HTMLFormElement>){e.preventDefault();
  const ok=await p.perform(()=>p.client.post('/groceries/lines',{foodId,quantityServings:Number(quantity),unitPriceKes:Number(unit)}),'Manual grocery item added.');
  if(ok){setQuantity('1');setUnit('');}
 }
 async function purchase(line:ServerGroceryLine,next:boolean){
  const amt=paid[line.id]?.trim()||'';
  await p.perform(()=>p.client.put('/groceries/lines/'+line.id+'/purchase',
    {purchased:next,actualPaidKes:next&&amt?Number(amt):null}),
    next?'Purchase checked. Amount recorded only if entered.':'Purchase checkoff cleared. No money moved.');
 }
 async function confirmReceive(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!received)return;
  const ok=await p.perform(()=>p.client.post('/groceries/lines/'+received.id+'/receive',
   {location,acquiredOn:p.date,expiresOn:expiry||null}),'Purchased food explicitly received into the stock ledger.');
  if(ok){setReceived(null);setExpiry('');}
 }
 async function editLine(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!edit)return;
  const val=paid['quantity-'+edit.id]??String(edit.quantity_servings),cost=paid['price-'+edit.id]??String(edit.unit_price_kes);
  if(await p.perform(()=>p.client.put('/groceries/lines/'+edit.id,{quantityServings:Number(val),unitPriceKes:Number(cost)}),'Unpurchased grocery estimate updated.'))setEdit(null);
 }
 async function removeLine(id:string){if(!window.confirm('Delete unchecked item from current list?'))return;
  await p.perform(()=>p.client.delete('/groceries/lines/'+id),'Unchecked grocery item removed.');
 }
 return <div className="lv-page"><Head icon={ShoppingBasket} tag="FOOD ACQUISITION" title="Groceries & Purchase Flow" description="Plan → grocery requirements → checked purchase → explicit inventory receipt. All prices and amounts are manually entered, not payment transactions." action={<Action outline onClick={()=>p.navigate('inventory')}>Open inventory</Action>}/>
  <div className="lv-stats"><Stat icon={ShoppingBasket} title="Active list lines" value={String(list?.lines.length??0)} detail="Previous lists remain in history"/><Stat icon={Wallet} title="Basket estimate" value={list?money(total):'Not generated'} detail="Your own per-serving prices"/><Stat icon={CheckCircle2} title="Recorded paid" value={money(spent)} detail="Manual totals across lists"/><Stat icon={Package} title="Still to receive" value={String(list?.lines.filter(l=>l.purchased&&!l.received).length??0)} detail="Never changes stock automatically"/></div>
  <div className="lv-grid-two"><Card title="Approved plan → shopping requirements" detail="Pantry deductions exclude lots expiring before the last planned meal.">
    <Field title="Approved plan"><select value={planId} onChange={e=>{setPlanId(e.target.value);setPrices({});}}><option value="">Choose a plan</option>{plans.map(x=><option value={x.id} key={x.id}>{dateOnly(x.week_start)} · {x.entries.length} meals</option>)}</select></Field>
    {chosenPlan&&<><div className="lv-rows">{ingredientIds.map(id=><div key={id} className="lv-price-input"><span>{fName(p,id)}</span><label className="lv-field"><span>Estimated KES per serving</span><input type="number" min="0" step=".01" max="1000000" value={prices[id]??''} placeholder="Unknown (0)" onChange={e=>setPrices(v=>({...v,[id]:e.target.value}))}/></label></div>)}</div><p className="lv-help">Unspecified prices remain unknown (0), not verified retailer prices. A new generated list archives the last one.</p></>}
    <div className="lv-inline"><button className="primary-button" type="button" disabled={!chosenPlan||p.busy} onClick={()=>void generate()}>Generate from plan</button><button className="outlined-button" type="button" disabled={p.busy} onClick={()=>void newList()}>Start empty list</button></div>
   </Card><Card title="Manually add a grocery item" detail="Adds to the active list only; no stock movement or bank transaction.">
    {!list?<Empty title="No active list" description="Create one or generate groceries from an approved plan."/>:<form className="lv-form" onSubmit={addManual}>
      <Field title="Saved food"><select required value={foodId} onChange={e=>setFoodId(e.target.value)}><option value="">Select a food</option>{p.data.foods.map(f=><option key={f.id} value={f.id}>{f.name} · {f.serving_label}</option>)}</select></Field>
      <div className="lv-form-grid"><Field title="Serving quantity"><input type="number" min=".001" max="100000" step="any" required value={quantity} onChange={e=>setQuantity(e.target.value)}/></Field><Field title="KES per serving"><input type="number" min="0" max="1000000" step=".01" value={unit} onChange={e=>setUnit(e.target.value)} required/></Field></div>
      <button className="outlined-button" type="submit" disabled={p.busy||!foodId}><Plus size={15}/>Add shopping item</button>
    </form>}
   </Card></div>
  <Card title="Current grocery list" detail={list?'List '+list.id.slice(0,8)+' · '+list.status:'No list exists yet'}>
   {!list?<Empty title="Start your grocery list" description="No example or historical grocery lines have been imported."/>:
   !list.lines.length?<Empty title="Shopping list is empty" description="Add a food or generate requirements from an approved plan."/>:
   <div className="lv-rows">{list.lines.map(line=><div className="lv-grocery-line" key={line.id}>
     <label className="lv-check"><input type="checkbox" checked={line.purchased} disabled={p.busy||line.received}
       aria-label={'Purchased '+fName(p,line.food_id)} onChange={e=>void purchase(line,e.target.checked)}/></label>
     <div className="lv-grow"><strong>{fName(p,line.food_id)}</strong><small>{asNumber(line.quantity_servings)} serving(s) × {money(line.unit_price_kes)} · {line.source}</small>
       <small>{line.received?'Received into inventory':line.purchased?'Purchased · waiting for receipt':'Not marked purchased'}</small>
     </div><div className="lv-grocery-side"><strong>{money(asNumber(line.quantity_servings)*asNumber(line.unit_price_kes))}</strong>
      {line.received?<small>Actual: {line.actual_paid_kes===null?'Not entered':money(line.actual_paid_kes)}</small>:
      <label className="lv-field"><span>Actual paid (KES, optional)</span><input type="number" min="0" step=".01" placeholder={line.actual_paid_kes===null?'Not entered':String(line.actual_paid_kes)}
       value={paid[line.id]??''} onChange={e=>setPaid(v=>({...v,[line.id]:e.target.value}))}/></label>}
     </div><div className="lv-row-actions">
      {!line.received&&line.purchased&&<button type="button" className="outlined-button" disabled={p.busy} onClick={()=>setReceived(line)}>Receive stock <ArrowRight size={13}/></button>}
      {!line.received&&!line.purchased&&<><button className="lv-icon" type="button" aria-label="Edit grocery line" onClick={()=>setEdit(line)}><span>✎</span></button><button className="lv-icon lv-danger" type="button" disabled={p.busy} aria-label="Remove grocery line" onClick={()=>void removeLine(line.id)}><Trash2 size={14}/></button></>}
      {line.purchased&&!line.received&&<button type="button" className="outlined-button" disabled={p.busy} onClick={()=>void purchase(line,true)}>Save paid amount</button>}
     </div>
    </div>)}</div>}
    <Note>Checking an item does not create a financial transaction or stock receipt. Receiving into inventory is a separate, signed and idempotent action.</Note>
  </Card>
  {received&&<section className="panel lv-panel"><h2>Receive purchased item</h2><form className="lv-form" onSubmit={confirmReceive}><strong>{fName(p,received.food_id)} · {received.quantity_servings} serving(s)</strong>
   <div className="lv-form-grid"><Field title="Storage location"><select value={location} onChange={e=>setLocation(e.target.value as typeof location)}>{locations.map(x=><option key={x}>{x}</option>)}</select></Field><Field title="Expiry date, if known"><input type="date" value={expiry} onChange={e=>setExpiry(e.target.value)}/></Field></div>
   <div className="lv-inline"><button className="primary-button" type="submit" disabled={p.busy}>Confirm receipt</button><button className="outlined-button" type="button" onClick={()=>setReceived(null)}>Cancel</button></div>
  </form></section>}
  {edit&&<section className="panel lv-panel"><h2>Adjust unchecked grocery estimate</h2><form className="lv-form" onSubmit={editLine}><div className="lv-form-grid">
   <Field title="Servings"><input type="number" min=".001" step="any" required value={paid['quantity-'+edit.id]??String(edit.quantity_servings)} onChange={e=>setPaid(v=>({...v,['quantity-'+edit.id]:e.target.value}))}/></Field>
   <Field title="KES per serving"><input type="number" min="0" step=".01" required value={paid['price-'+edit.id]??String(edit.unit_price_kes)} onChange={e=>setPaid(v=>({...v,['price-'+edit.id]:e.target.value}))}/></Field></div><div className="lv-inline"><button className="primary-button" type="submit" disabled={p.busy}>Save quantity</button><button className="outlined-button" type="button" onClick={()=>setEdit(null)}>Cancel</button></div></form></section>}
  <Card title="Archived grocery history" detail="Received purchase records survive regeneration.">
   {p.data.groceries.filter(g=>g.status==='archived').map(g=><div className="lv-history-mini" key={g.id}><strong>{dateOnly(g.created_at)} · {g.lines.length} lines</strong><span>{money(g.lines.reduce((s,l)=>s+(l.purchased&&l.actual_paid_kes!==null?asNumber(l.actual_paid_kes):0),0))} manually recorded paid</span></div>)}
   {!p.data.groceries.some(g=>g.status==='archived')&&<p className="lv-help">No archived grocery lists exist yet.</p>}
  </Card>
 </div>;
}
export function InventoryScreen({p}:{p:LiveProps}){
 const [foodId,setFoodId]=useState(''),[location,setLocation]=useState<'Pantry'|'Fridge'|'Freezer'>('Pantry');
 const [acquired,setAcquired]=useState(p.date),[expires,setExpires]=useState(''),[unitCost,setUnitCost]=useState('0'),[quantity,setQuantity]=useState('1');
 const [selected,setSelected]=useState(''),[kind,setKind]=useState('CONSUMPTION'),[moveQty,setMoveQty]=useState('1');
 const [destination,setDestination]=useState<'Pantry'|'Fridge'|'Freezer'>('Fridge'),[note,setNote]=useState('');
 const visible=p.data.inventory;
 async function add(e:FormEvent<HTMLFormElement>){e.preventDefault();
  const ok=await p.perform(()=>p.client.post('/inventory/lots',{foodId,location,acquiredOn:acquired,expiresOn:expires||null,
   unitCostKes:Number(unitCost),initialServings:Number(quantity)}),'Stock received with an authoritative opening ledger movement.');
  if(ok){setQuantity('1');setExpires('');}
 }
 async function move(e:FormEvent<HTMLFormElement>){e.preventDefault();
  const num=Number(moveQty),outgoing=['CONSUMPTION','WASTE','EXPIRY'].includes(kind);
  await p.perform(()=>p.client.post('/inventory/movements',{lotId:selected,happenedOn:p.date,kind,
    deltaServings:outgoing?-num:num,note}),'Inventory event appended. Previous ledger entries were not rewritten.');
 }
 async function transfer(e:FormEvent<HTMLFormElement>){e.preventDefault();
  await p.perform(()=>p.client.post('/inventory/transfers',{sourceLotId:selected,destination,servings:Number(moveQty),happenedOn:p.date}),
   'Stock moved with matching debit and credit events.');
 }
 const total=visible.reduce((n,l)=>n+asNumber(l.balance),0),expiry=visible.filter(l=>asNumber(l.balance)>0&&l.expires_on&&dateOnly(l.expires_on)<p.date);
 return <div className="lv-page"><Head icon={Warehouse} tag="KITCHEN OPERATIONS" title="Inventory & Stock Ledger" description="Pantry, fridge and freezer balances are calculated only from confirmed append-only transactions. No consumption is automatically inferred."/>
  <div className="lv-stats"><Stat icon={Package} title="Stock lots" value={String(visible.length)} detail="Personal account only"/><Stat icon={Warehouse} title="Recorded serving units" value={total.toFixed(2)} detail="Do not compare dissimilar serving sizes"/><Stat icon={AlertTriangle} title="Past expiry" value={String(expiry.length)} detail="Never recommend expired food"/><Stat icon={Check} title="Ledger movements" value={String(p.data.movements.length)} detail="Immutable audit of resource changes"/></div>
  <div className="lv-grid-two"><Card title="Record incoming stock" detail="Explicitly create a lot and a purchase/receipt ledger entry.">
   <form className="lv-form" onSubmit={add}><Field title="Food"><select value={foodId} onChange={e=>setFoodId(e.target.value)} required><option value="">Choose an existing food</option>{p.data.foods.map(f=><option value={f.id} key={f.id}>{f.name} · {f.serving_label}</option>)}</select></Field>
    <div className="lv-form-grid"><Field title="Location"><select value={location} onChange={e=>setLocation(e.target.value as typeof location)}>{locations.map(x=><option key={x}>{x}</option>)}</select></Field><Field title="Quantity · food servings"><input required type="number" min=".001" max="1000" step="any" value={quantity} onChange={e=>setQuantity(e.target.value)}/></Field></div>
    <div className="lv-form-grid"><Field title="Received on"><input type="date" required value={acquired} onChange={e=>setAcquired(e.target.value)}/></Field><Field title="Expiry (optional)"><input type="date" value={expires} onChange={e=>setExpires(e.target.value)}/></Field></div>
    <Field title="Estimated KES per serving"><input type="number" min="0" max="1000000" step=".01" value={unitCost} onChange={e=>setUnitCost(e.target.value)}/></Field>
    <button className="primary-button" type="submit" disabled={p.busy||!foodId}><Plus size={15}/> Record stock</button>
   </form>
  </Card><Card title="Record consumption, waste or transfer" detail="Inventory events do not create or modify personal meal logs.">
   <form className="lv-form" onSubmit={kind==='TRANSFER'?transfer:move}><Field title="Stock lot"><select required value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Choose lot</option>{visible.filter(l=>asNumber(l.balance)>0).map(l=><option value={l.id} key={l.id}>{fName(p,l.food_id)} · {l.location} · {asNumber(l.balance)} servings</option>)}</select></Field>
    <div className="lv-form-grid"><Field title="Movement"><select value={kind} onChange={e=>setKind(e.target.value)}><option value="CONSUMPTION">Consumed (stock only)</option><option value="WASTE">Discarded / wasted</option><option value="EXPIRY">Expired / disposed</option><option value="ADJUSTMENT">Stock correction (+)</option><option value="TRANSFER">Move location</option></select></Field>
     <Field title="Quantity (positive)"><input type="number" required step=".001" min=".001" max="100000" value={moveQty} onChange={e=>setMoveQty(e.target.value)}/></Field></div>
    {kind==='TRANSFER'?<Field title="Destination"><select value={destination} onChange={e=>setDestination(e.target.value as typeof destination)}>{locations.map(x=><option key={x}>{x}</option>)}</select></Field>:<Field title="Optional note"><input maxLength={240} value={note} onChange={e=>setNote(e.target.value)}/></Field>}
    <button className="outlined-button" type="submit" disabled={p.busy||!selected}>Commit ledger event <ArrowRight size={14}/></button>
   </form>
  </Card></div>
  <Card title="Current lots" detail="Expired items require explicit removal from stock, never meal suggestions.">
   {!visible.length?<Empty title="No pantry records" description="Record real stock quantities to activate stock-aware grocery planning."/>:<div className="lv-rows">{visible.map(l=><div key={l.id} className="lv-row"><span className="lv-emojibox">📦</span><span><strong>{fName(p,l.food_id)}</strong><small>{l.location} · received {dateOnly(l.acquired_on)} · lot {l.id.slice(0,8)}</small><small>{l.expires_on?'Expiry '+dateOnly(l.expires_on):'No known expiry · verify label'}</small></span><div className="lv-stock-side"><strong>{asNumber(l.balance)} servings</strong>{l.expires_on&&dateOnly(l.expires_on)<p.date&&asNumber(l.balance)>0&&<span className="lv-status-red">Past recorded expiry — do not consume</span>}</div></div>)}</div>}
  </Card><Card title="Inventory movement history" detail="Immutable append-only events; no reconstructed demo balances.">
   {!p.data.movements.length?<Empty title="No stock movements yet" description="Movements appear only after explicit stock operations."/>:<div className="lv-rows">{p.data.movements.slice(0,80).map(m=><div className="lv-row" key={m.id}><CheckCircle2 size={18}/><span><strong>{uidTitle(m.kind)}</strong><small>{dateOnly(m.happened_on)} · lot {m.lot_id.slice(0,8)} · {m.note}</small></span><strong className={asNumber(m.delta_servings)<0?'lv-negative':'lv-positive'}>{asNumber(m.delta_servings)>0?'+':''}{asNumber(m.delta_servings)} servings</strong></div>)}</div>}
  </Card>
 </div>;
}
export function BudgetScreen({p}:{p:LiveProps}){
 const [amount,setAmount]=useState(String(p.data.budget.allocation?.amount_kes??''));
 const spent=p.data.budget.explicitRecordedPaidKes,allocation=p.data.budget.allocation?asNumber(p.data.budget.allocation.amount_kes):null;
 async function save(e:FormEvent<HTMLFormElement>){e.preventDefault();await p.perform(()=>p.client.put('/budget',{amountKes:Number(amount)}),'Your example food budget allocation was saved.');}
 return <div className="lv-page"><Head icon={Wallet} tag="HOUSEHOLD FOOD ECONOMICS" title="Food Budget & Cost Tracking" description="Manually entered KES projections and purchase amounts. Finance OS remains authoritative for real financial transactions."/>
  <div className="lv-stats"><Stat icon={Wallet} title="Food allocation" value={allocation===null?'Not configured':money(allocation)} detail="User-entered amount"/><Stat icon={CheckCircle2} title="Recorded purchase amounts" value={money(spent)} detail="Not bank verified"/><Stat icon={ShoppingBasket} title="Grocery lists" value={String(p.data.groceries.length)} detail="Including archived lists"/><Stat icon={AlertTriangle} title="Difference" value={allocation===null?'Unknown':money(allocation-spent)} detail="Planning remainder, not account balance"/></div>
  <div className="lv-grid-two"><Card title="Edit KES allocation" detail="No default or fabricated household food budget.">
    <form className="lv-form" onSubmit={save}><Field title="Planned food allocation in Kenyan shillings"><input type="number" min="0" max="100000000" step=".01" required value={amount} onChange={e=>setAmount(e.target.value)} placeholder="Choose amount"/></Field><button className="primary-button" type="submit" disabled={p.busy||!amount.trim()}>Save allocation</button></form><Note>Amounts in this workspace do not record bank, M-Pesa or SasaPay transactions. Financial integrations require consent and Finance OS authority.</Note>
   </Card><Card title="Recorded list expenses" detail="Explicit purchases only, across active and archived lists.">
    {!p.data.groceries.length?<Empty title="No grocery history" description="Create shopping lists to track your own manually entered amounts."/>:
      <div className="lv-rows">{p.data.groceries.map(g=><div className="lv-row" key={g.id}><ShoppingBasket size={19}/><span><strong>{dateOnly(g.created_at)} · {upper(g.status)} list</strong><small>{g.lines.length} item(s)</small></span><strong>{money(g.lines.reduce((s,l)=>s+(l.purchased&&l.actual_paid_kes!==null?asNumber(l.actual_paid_kes):0),0))}</strong></div>)}</div>}
    <Action onClick={()=>p.navigate('groceries')} outline>Record grocery purchases</Action>
   </Card></div>
 </div>;
}
export function WasteScreen({p}:{p:LiveProps}){
 const atRisk=p.data.inventory.filter(l=>asNumber(l.balance)>0&&l.expires_on);
 const expired=atRisk.filter(l=>dateOnly(l.expires_on!)<p.date),soon=atRisk.filter(l=>dateOnly(l.expires_on!)>=p.date&&dateOnly(l.expires_on!)<=shiftDay(p.date,2));
 const waste=p.data.movements.filter(m=>m.kind==='WASTE'||m.kind==='EXPIRY');
 const totalWaste=waste.reduce((s,m)=>s+Math.abs(asNumber(m.delta_servings)),0);
 const [qty,setQty]=useState<Record<string,string>>({});
 async function discard(l:ServerLot){
  const n=Number(qty[l.id]??l.balance);
  if(!Number.isFinite(n)||n<=0)return;
  if(!window.confirm('Record disposal of '+n+' servings from '+fName(p,l.food_id)+'? This permanently appends a stock ledger event.'))return;
  await p.perform(()=>p.client.post('/inventory/movements',{lotId:l.id,happenedOn:p.date,kind:l.expires_on&&dateOnly(l.expires_on)<p.date?'EXPIRY':'WASTE',deltaServings:-n,note:'Explicitly confirmed discarded stock'}),
   'Waste/expiry ledger entry recorded. Food was not treated as edible.');
 }
 return <div className="lv-page"><Head icon={AlertTriangle} tag="RESOURCE SAFETY" title="Food Waste & Expiry" description="Only recorded dates and explicit discard events. Past-expiry foods are not recommended for preparation."/>
  <div className="lv-stats"><Stat icon={AlertTriangle} title="Past recorded expiry" value={String(expired.length)} detail="Positive recorded balances"/><Stat icon={CalendarDays} title="Expiring within 2 days" value={String(soon.length)} detail="Verify packages manually"/><Stat icon={Package} title="Waste ledger events" value={String(waste.length)} detail="No invented disposal entries"/><Stat icon={Warehouse} title="Recorded discarded servings" value={totalWaste.toFixed(2)} detail="Serving units differ by food"/></div>
  <Note warn>Recorded expiry is not proof of food safety before that date. Check storage conditions, spoilage and labels. Do not consume past-expiry food.</Note>
  <Card title="Lots requiring attention" detail="Discarding stock requires an explicit confirmation.">
   {!atRisk.length?<Empty title="No dated stock at risk" description="No current lot has a positive balance and a recorded expiry date."/>:
   <div className="lv-rows">{atRisk.sort((a,b)=>String(a.expires_on).localeCompare(String(b.expires_on))).map(l=><div className="lv-row" key={l.id}><span className="lv-emojibox">🥬</span><span><strong>{fName(p,l.food_id)}</strong><small>{l.location} · {asNumber(l.balance)} servings · {dateOnly(l.expires_on!)}</small><small>{expired.includes(l)?'Past expiry — do not consume':soon.includes(l)?'Use-soon review (verify actual safety)':'Later dated expiry'}</small></span>
    <div className="lv-row-actions"><input className="lv-qty-small" aria-label={'Discard quantity '+fName(p,l.food_id)} type="number" min=".001" max={asNumber(l.balance)} step="any" value={qty[l.id]??String(l.balance)} onChange={e=>setQty(v=>({...v,[l.id]:e.target.value}))}/>
     <button className="outlined-button lv-danger" type="button" disabled={p.busy} onClick={()=>void discard(l)}>Record discard</button></div>
   </div>)}</div>}
  </Card><Card title="Recorded waste and expiry events" detail="Ledger-based history; never guessed.">
   {!waste.length?<Empty title="No discard events recorded" description="The system will not invent waste costs, quantities or historical performance."/>:
    <div className="lv-rows">{waste.map(m=><div className="lv-row" key={m.id}><AlertTriangle size={18}/><span><strong>{m.kind==='EXPIRY'?'Expiry disposal':'Food waste'}</strong><small>{dateOnly(m.happened_on)} · lot {m.lot_id.slice(0,8)}</small></span><strong>{Math.abs(asNumber(m.delta_servings))} servings</strong></div>)}</div>}
  </Card>
 </div>;
}
