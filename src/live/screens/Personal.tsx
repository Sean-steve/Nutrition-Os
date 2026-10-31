import {useEffect,useState,type FormEvent} from 'react';
import {
  Activity,Apple,ArrowRight,BookOpen,CalendarDays,CheckCircle2,Droplets,Edit3,Flame,
  Heart,Leaf,Plus,Target,Trash2,TrendingUp,Utensils
} from 'lucide-react';
import type {LiveProps} from '../types';
import type {ServerFood,ServerMeal,ServerRecipe} from '../client';
import {asNumber,dateOnly,money} from '../client';
import {Action,Card,Empty,Field,Head,Note,Stat,slots} from '../components';
type FoodEdit={id:string;revision:number}|null;
type RecipeEdit={id:string;version:number}|null;
const value=(v:number|string|null|undefined)=>v==null?'':String(v);
export function DashboardScreen({p}:{p:LiveProps}){
 const state=p.data.state,targets=p.data.profile?.targets??{},today=p.data.meals.filter(m=>dateOnly(m.consumed_on)===p.date);
 const approved=p.data.plans.filter(x=>x.status==='approved'),basket=p.data.groceries.find(l=>l.status==='active');
 const pending=basket?.lines.filter(l=>!l.purchased).length??0;
 const expiry=p.data.inventory.filter(l=>asNumber(l.balance)>0&&l.expires_on&&dateOnly(l.expires_on)<=p.date).length;
 return <div className="lv-page">
  <Head icon={Leaf} tag="NUTRITION COMMAND CENTER" title="Your day, backed by your records." description={p.data.profile?.display_name?'Welcome, '+p.data.profile.display_name+'. Your nutrition overview uses confirmed observations only.':'Welcome to your Nutrition OS. Create a profile and log your first meal to establish your own observations.'}
    action={<Action disabled={p.busy} onClick={()=>p.navigate('today')}>Log observed meal</Action>}/>
  <div className="lv-stats">
   <Stat icon={Flame} title="Recorded energy" value={state.intake?Math.round(state.intake.energyKcal)+' kcal':'Not recorded'} detail={state.intake?(targets.energyKcal?'Target '+targets.energyKcal+' kcal · partial logs':'User-entered food totals'):'No intake conclusion from missing logs'}/>
   <Stat icon={Activity} title="Recorded protein" value={state.intake?state.intake.proteinG.toFixed(1)+' g':'Not recorded'} detail="Estimated from unverified composition snapshots"/>
   <Stat icon={Droplets} title="Observed water" value={p.data.water.observedL===null?'Not recorded':p.data.water.observedL+' L'} detail="Only explicitly entered hydration"/>
   <Stat icon={CalendarDays} title="Observed meals" value={String(state.observedMeals)} detail="Plan entries are not recorded intake"/>
  </div>
  <Note><strong>Interpretation boundary:</strong> {state.disclaimer} Nutrient snapshots are calculated from user-entered foods and are not clinical measurements.</Note>
  <div className="lv-grid-two"><Card title="Daily nutrition record" detail={p.date+' · logged entries and provenance'}>
    {!today.length?<Empty title="Nothing recorded for this date" description="Your intake is unknown, not zero. Use the meal logger to record what you actually ate." action={<Action onClick={()=>p.navigate('today')}>Record a meal</Action>}/>:<div className="lv-rows">{today.map(m=><button key={m.id} type="button" className="lv-click-row" onClick={()=>p.navigate('meals')}><span className="lv-emojibox">🍽️</span><span><strong>{m.name}</strong><small>{m.slot} · {asNumber(m.energy_kcal)} kcal · {asNumber(m.protein_g)}g protein</small></span><ArrowRight size={16}/></button>)}</div>}
   </Card><Card title="Next meaningful actions" detail="Operator-controlled workflows, no automatic consumption">
     <div className="lv-action-list">{[
      {title:'Plan the next meals',desc:approved.length+' approved weeks',route:'planner'},
      {title:'Complete grocery purchases',desc:pending+' unchecked items',route:'groceries'},
      {title:'Check stock and expiry',desc:expiry+' expired lots with recorded balance',route:'waste'},
      {title:'Review your nutrition evidence',desc:p.data.progress.observations.length+' logged days in 90-day window',route:'insights'}
     ].map(item=><button key={item.title} type="button" onClick={()=>p.navigate(item.route as LiveProps['route'])}><div><strong>{item.title}</strong><small>{item.desc}</small></div><ArrowRight size={16}/></button>)}</div>
   </Card></div>
  <div className="lv-grid-two"><Card title="Observed dates" detail="Only days with at least one logged meal appear.">
   {!p.data.progress.observations.length?<Empty title="No recorded history" description="Trends are unavailable until you begin logging confirmed meals."/>:<div className="lv-spark">{p.data.progress.observations.slice(-12).map(day=><div key={day.date} title={day.date+' · '+day.loggedMeals+' logged meal(s)'}><i style={{height:(Math.max(8,Math.min(100,day.energyKcal/Math.max(1,Number(targets.energyKcal)||2300)*100)))+'%'}}/><span>{day.date.slice(5)}</span></div>)}</div>}
  </Card><Card title="Food planning, not money movement" detail="No bank or Finance OS integration">
    <div className="lv-reading"><span>Food allocation</span><strong>{p.data.budget.allocation?money(p.data.budget.allocation.amount_kes):'Not configured'}</strong></div>
    <div className="lv-reading"><span>Explicitly entered purchases</span><strong>{money(p.data.budget.explicitRecordedPaidKes)}</strong></div>
    <p className="lv-help">These are budget estimates and manually entered amounts, not verified transactions.</p>
    <Action onClick={()=>p.navigate('budget')} outline>Manage budget</Action>
  </Card></div>
 </div>;
}
export function ProfileScreen({p}:{p:LiveProps}){
 const profile=p.data.profile,goals=p.data.goals;
 const [name,setName]=useState(profile?.display_name??''),[diet,setDiet]=useState(profile?.diet_style??'flexible');
 const [excluded,setExcluded]=useState(profile?.excluded_foods??'');
 const [mealFrequency,setMealFrequency]=useState(String(profile?.preferences?.preferredMeals??3));
 const [units,setUnits]=useState(String(profile?.preferences?.units??'metric'));
 const [targets,setTargets]=useState<Record<string,string>>(Object.fromEntries(Object.entries(profile?.targets??{}).map(([k,v])=>[k,String(v)])));
 const [metric,setMetric]=useState('protein_g'),[goalValue,setGoalValue]=useState(''),[since,setSince]=useState(p.date);
 const targetKeys=[['energyKcal','Energy · kcal'],['proteinG','Protein · g'],['carbsG','Carbs · g'],['fatG','Fat · g'],['hydrationL','Hydration · L']];
 async function saveProfile(e:FormEvent<HTMLFormElement>){
  e.preventDefault();const result:Record<string,number>={};
  for(const [key] of targetKeys){if(targets[key]?.trim()){const num=Number(targets[key]);if(!Number.isFinite(num)||num<=0)throw new Error('Targets must be positive finite values.');result[key]=num;}}
  await p.perform(()=>p.client.put('/profile',{displayName:name.trim(),dietStyle:diet,excludedFoods:excluded.trim(),
    preferences:{preferredMeals:Number(mealFrequency),units,onboardingComplete:true},targets:result}),'Profile and targets saved in PostgreSQL.');
 }
 async function addGoal(e:FormEvent<HTMLFormElement>){e.preventDefault();
  const unit=metric==='energy_kcal'?'kcal':metric==='hydration_l'?'L':'g';
  if(await p.perform(()=>p.client.post('/goals',{metric,target:Number(goalValue),unit,effectiveFrom:since,effectiveTo:null}),'Goal saved.'))setGoalValue('');
 }
 return <div className="lv-page"><Head icon={p.route==='goals'?Target:Heart} tag="PRIVATE NUTRITION PROFILE" title={p.route==='goals'?'Goals & Requirements':p.route==='onboarding'?'Create Your Nutrition Profile':'Your Nutrition Profile'}
  description="Your preferences and targets belong to your verified personal account. No profile values are published to family members."/>
  <div className="lv-grid-two"><Card title="Profile & preferences" detail="Stored under your signed tenant and user identity.">
   <form className="lv-form" onSubmit={saveProfile}>
    <Field title="Your display name"><input value={name} maxLength={120} onChange={e=>setName(e.target.value)} required placeholder="How should we greet you?"/></Field>
    <div className="lv-form-grid"><Field title="Dietary style"><select value={diet} onChange={e=>setDiet(e.target.value)}><option value="flexible">Flexible</option><option value="plant-focused">Plant-focused</option><option value="vegetarian">Vegetarian</option><option value="vegan">Vegan</option><option value="other">Other / custom</option></select></Field>
    <Field title="Preferred meals per day"><select value={mealFrequency} onChange={e=>setMealFrequency(e.target.value)}>{[1,2,3,4,5,6].map(n=><option key={n} value={n}>{n} meals</option>)}</select></Field></div>
    <Field title="Excluded foods (private; descriptive only)"><textarea value={excluded} maxLength={1000} rows={3} placeholder="Enter foods to avoid; this is not automatic allergen certification." onChange={e=>setExcluded(e.target.value)}/></Field>
    <Field title="Measurement preference"><select value={units} onChange={e=>setUnits(e.target.value)}><option value="metric">Metric</option><option value="imperial">Imperial</option></select></Field>
    <h3>Optional user-selected targets</h3><p className="lv-help">Leave blank rather than accepting fabricated clinical requirements. This app does not calculate medically appropriate targets.</p>
    <div className="lv-form-grid">{targetKeys.map(([k,label])=><Field title={label} key={k}><input min=".01" step="any" type="number" value={targets[k]??''} onChange={e=>setTargets(v=>({...v,[k]:e.target.value}))} placeholder="Not configured"/></Field>)}</div>
    <button type="submit" className="primary-button" disabled={p.busy}><CheckCircle2 size={16}/> Save personal profile</button>
   </form>
  </Card><div className="lv-stack"><Card title="Time-bound nutrition goals" detail="Explicit goals only; no autonomous prescription.">
   <form className="lv-form" onSubmit={addGoal}><Field title="Nutrient or hydration metric"><select value={metric} onChange={e=>setMetric(e.target.value)}><option value="energy_kcal">Energy · kcal</option><option value="protein_g">Protein · g</option><option value="carbs_g">Carbohydrates · g</option><option value="fat_g">Fat · g</option><option value="hydration_l">Water · L</option></select></Field>
    <div className="lv-form-grid"><Field title="Target"><input type="number" step="any" min=".01" value={goalValue} onChange={e=>setGoalValue(e.target.value)} required/></Field><Field title="Effective from"><input type="date" value={since} onChange={e=>setSince(e.target.value)} required/></Field></div>
    <button type="submit" className="outlined-button" disabled={p.busy||!goalValue}>Add goal <Plus size={14}/></button>
   </form>
   <div className="lv-rows">{goals.map(g=><div className="lv-row" key={g.id}><Target size={17}/><span><strong>{g.metric.replace('_',' ')} · {value(g.target)} {g.unit}</strong><small>From {dateOnly(g.effective_from)} · user-defined</small></span></div>)}{!goals.length&&<Empty title="No goals set" description="Set targets intentionally. No default goals are silently assigned."/>}</div>
  </Card><Card title="Access and health safety" detail="Boundaries enforced by data provenance and authorization."><Note><strong>Privacy:</strong> Personal intake and requirements never appear on the shared family board. Medical nutrition recommendations and consent/identity federation remain separate certified work.</Note><Action outline onClick={()=>p.navigate('privacy')}>Privacy details</Action></Card></div></div>
 </div>;
}
function foodInputFrom(form:{name:string;servingLabel:string;energyKcal:string;proteinG:string;carbsG:string;fatG:string}){
 return {name:form.name.trim(),servingLabel:form.servingLabel.trim(),energyKcal:Number(form.energyKcal),
  proteinG:Number(form.proteinG),carbsG:Number(form.carbsG),fatG:Number(form.fatG)};
}
const blankFood={name:'',servingLabel:'',energyKcal:'',proteinG:'',carbsG:'',fatG:''};
export function FoodScreen({p}:{p:LiveProps}){
 const [form,setForm]=useState({...blankFood}),[editing,setEditing]=useState<FoodEdit>(null),[filter,setFilter]=useState('');
 const foods=p.data.foods.filter(f=>f.name.toLowerCase().includes(filter.toLowerCase()));
 function editFood(f:ServerFood){setEditing({id:f.id,revision:f.revision});
  setForm({name:f.name,servingLabel:f.serving_label,energyKcal:value(f.energy_kcal),proteinG:value(f.protein_g),
   carbsG:value(f.carbs_g),fatG:value(f.fat_g)});}
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();
  const payload=foodInputFrom(form);
  const ok=await p.perform(()=>editing?p.client.put('/foods/'+editing.id,{...payload,expectedRevision:editing.revision}):p.client.post('/foods',payload),editing?'Food updated. Previous meal snapshots were preserved.':'Food added as unverified user data.');
  if(ok){setEditing(null);setForm({...blankFood});}
 }
 async function retire(id:string){
  if(!window.confirm('Retire this food from future selection? Historical meals and recipe references will remain.'))return;
  await p.perform(()=>p.client.delete('/foods/'+id),'Food retired. Historical nutrition snapshots remain unchanged.');
 }
 return <div className="lv-page"><Head icon={Apple} tag="FOOD KNOWLEDGE" title="Your Food Library" description="Create and maintain user-entered food portions and nutrient estimates. Entries remain unverified until a provenance workflow is certified."/>
  <div className="lv-grid-two"><Card title={editing?'Update food details':'Add a food record'} detail="Values are per one named serving. No fake catalogue data is imported.">
   <form className="lv-form" onSubmit={submit}>
    <div className="lv-form-grid"><Field title="Food name"><input value={form.name} onChange={e=>setForm(v=>({...v,name:e.target.value}))} maxLength={140} required/></Field>
    <Field title="Serving label"><input placeholder="e.g., 1 cup cooked" value={form.servingLabel} onChange={e=>setForm(v=>({...v,servingLabel:e.target.value}))} required/></Field></div>
    <div className="lv-form-grid">{([['energyKcal','Energy (kcal)'],['proteinG','Protein (g)'],['carbsG','Carbs (g)'],['fatG','Fat (g)']] as const).map(([key,label])=><Field title={label} key={key}><input type="number" required min="0" max="100000" step="any" value={form[key]} onChange={e=>setForm(v=>({...v,[key]:e.target.value}))}/></Field>)}</div>
    <Note warn><strong>Nutrition safety:</strong> These figures are estimates from your own entries, not a validated nutrition reference. Allergen and micronutrient databases are not connected.</Note>
    <div className="lv-inline"><button type="submit" className="primary-button" disabled={p.busy}>{editing?'Save changes':'Add food'}</button>{editing&&<button className="outlined-button" type="button" onClick={()=>{setEditing(null);setForm({...blankFood});}}>Cancel editing</button>}</div>
   </form>
  </Card><Card title="Saved food records" detail={p.data.foods.length+' scoped, real database records'} action={<input aria-label="Search food library" value={filter} placeholder="Search foods…" onChange={e=>setFilter(e.target.value)} className="lv-small-search"/>}>
   <div className="lv-rows">{foods.map(food=><div className="lv-row" key={food.id}><span className="lv-emojibox">🥗</span><span><strong>{food.name}</strong><small>{food.serving_label} · {asNumber(food.energy_kcal)} kcal · {asNumber(food.protein_g)}g protein</small><small>{food.verified?'Verified reference':'User-entered · unverified'}</small></span><div className="lv-row-actions"><button className="outlined-button" type="button" onClick={()=>editFood(food)}><Edit3 size={14}/> Edit</button><button className="outlined-button lv-danger" type="button" disabled={p.busy} onClick={()=>void retire(food.id)} aria-label={'Retire '+food.name}><Trash2 size={14}/></button></div></div>)}
    {!foods.length&&<Empty title="Your food library is empty" description="Add an actual food record to begin. No demonstration foods will be copied into this account."/>}</div>
  </Card></div>
 </div>;
}
type IngredientRow={foodId:string;servings:string};
export function RecipeScreen({p}:{p:LiveProps}){
 const [editing,setEditing]=useState<RecipeEdit>(null),[name,setName]=useState(''),[yieldServings,setYield]=useState('2'),[prep,setPrep]=useState('15'),[instructions,setInstructions]=useState('');
 const [ingredients,setIngredients]=useState<IngredientRow[]>([]);
 function reset(){setEditing(null);setName('');setYield('2');setPrep('15');setInstructions('');setIngredients([]);}
 function editRecipe(r:ServerRecipe){setEditing({id:r.id,version:r.version});setName(r.name);setYield(value(r.yield_servings));setPrep(String(r.prep_minutes));
  setInstructions(r.instructions);setIngredients(r.ingredients.map(i=>({foodId:i.food_id,servings:value(i.servings)})));}
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();
  if(!ingredients.length){window.alert('Add at least one food ingredient.');return;}
  const body={name:name.trim(),yieldServings:Number(yieldServings),prepMinutes:Number(prep),instructions,
   ingredients:ingredients.map(i=>({foodId:i.foodId,servings:Number(i.servings)}))};
  const ok=await p.perform(()=>editing?p.client.put('/recipes/'+editing.id,{...body,expectedRevision:editing.version}):p.client.post('/recipes',body),
    editing?'Recipe updated with optimistic revision protection.':'Recipe saved to your private database.');
  if(ok)reset();
 }
 async function retire(id:string){if(!window.confirm('Retire recipe? Planned historical references remain.'))return;
  await p.perform(()=>p.client.delete('/recipes/'+id),'Recipe retired from the active library.');
 }
 return <div className="lv-page"><Head icon={BookOpen} tag="RECIPE STUDIO" title="Recipe Knowledge & Portions" description="Build recipes from foods that belong to your personal library. Recipe estimates are not certified for allergies or clinical diets."/>
 <div className="lv-grid-two"><Card title={editing?'Edit recipe':'New recipe'} detail="Ingredient amounts use each food’s own serving unit.">
  <form className="lv-form" onSubmit={submit}><Field title="Recipe title"><input required value={name} onChange={e=>setName(e.target.value)} maxLength={140}/></Field>
   <div className="lv-form-grid"><Field title="Total recipe yield (servings)"><input type="number" min=".25" max="1000" step=".25" required value={yieldServings} onChange={e=>setYield(e.target.value)}/></Field><Field title="Preparation time (minutes)"><input type="number" min="0" max="20000" value={prep} onChange={e=>setPrep(e.target.value)}/></Field></div>
   <Field title="Preparation notes"><textarea value={instructions} onChange={e=>setInstructions(e.target.value)} rows={3} maxLength={12000}/></Field>
   <div className="lv-section-label"><strong>Food ingredients</strong><button className="outlined-button" type="button" disabled={!p.data.foods.length} onClick={()=>setIngredients(rows=>[...rows,{foodId:p.data.foods[0].id,servings:'1'}])}><Plus size={14}/> Ingredient</button></div>
   {ingredients.map((i,index)=><div className="lv-ingredient" key={index}><label className="sr-only" htmlFor={'recipe-food-'+index}>Ingredient food</label><select id={'recipe-food-'+index} value={i.foodId} onChange={e=>setIngredients(rows=>rows.map((r,n)=>n===index?{...r,foodId:e.target.value}:r))}>{p.data.foods.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select>
    <label className="sr-only" htmlFor={'recipe-qty-'+index}>Ingredient servings</label><input id={'recipe-qty-'+index} type="number" min=".25" max="1000" step=".25" required value={i.servings} onChange={e=>setIngredients(rows=>rows.map((r,n)=>n===index?{...r,servings:e.target.value}:r))}/>
    <button type="button" className="lv-icon" aria-label="Remove ingredient" onClick={()=>setIngredients(rows=>rows.filter((_,n)=>n!==index))}><Trash2 size={16}/></button></div>)}
   {!p.data.foods.length&&<p className="lv-help">Add foods first. Recipes cannot refer to imaginary ingredients.</p>}
   <Note warn>Recipe nutrition is derived from user-entered foods. Review ingredient exclusions, allergens and food safety independently.</Note>
   <div className="lv-inline"><button className="primary-button" type="submit" disabled={p.busy||!p.data.foods.length||!ingredients.length}>{editing?'Save recipe version':'Create recipe'}</button>{editing&&<button className="outlined-button" type="button" onClick={reset}>Cancel</button>}</div>
  </form>
 </Card><Card title="Your recipes" detail="Approved-plan recipes are protected from in-place changes.">
  <div className="lv-rows">{p.data.recipes.map(r=><div className="lv-row" key={r.id}><span className="lv-emojibox">🍲</span><span><strong>{r.name}</strong><small>{r.ingredients.length} ingredients · {r.yield_servings} servings · v{r.version}</small></span><div className="lv-row-actions"><button className="outlined-button" type="button" onClick={()=>editRecipe(r)}><Edit3 size={14}/>Edit</button><button className="outlined-button lv-danger" type="button" disabled={p.busy} aria-label={'Retire '+r.name} onClick={()=>void retire(r.id)}><Trash2 size={14}/></button></div></div>)}{!p.data.recipes.length&&<Empty title="No recipes yet" description="Create your first recipe from your own food records."/>}</div>
 </Card></div>
 </div>;
}
type LogItem={foodId:string;servings:string};
export function MealsScreen({p}:{p:LiveProps}){
 const [showForm,setShowForm]=useState(p.route==='today');
 const [slot,setSlot]=useState<ServerMeal['slot']>('Lunch'),[name,setName]=useState(''),[note,setNote]=useState('');
 const [items,setItems]=useState<LogItem[]>([]);
 const [editing,setEditing]=useState<{id:string;revision:number}|null>(null);
 const [opened,setOpened]=useState<ServerMeal|null>(null);
 const [portion,setPortion]=useState('1');
 const [water,setWater]=useState(String(p.data.water.observedL??''));
 const [dayFilter,setDayFilter]=useState(p.route==='today'?p.date:'');
 const meals=p.data.meals.filter(m=>!dayFilter||dateOnly(m.consumed_on)===dayFilter);
 const today=p.data.state;
 useEffect(()=>{setWater(String(p.data.water.observedL??''));},[p.data.water.observedL]);
 async function open(m:ServerMeal){
  try{
   const detail=await p.client.get<ServerMeal>('/meals/'+m.id);
   setOpened(detail);setEditing({id:detail.id,revision:detail.revision});setName(detail.name);setSlot(detail.slot);
   setNote(detail.note);setItems((detail.items??[]).map(i=>({foodId:i.food_id,servings:String(i.servings)})));setShowForm(true);
  }catch(e){window.alert(e instanceof Error?e.message:'Meal could not be opened.');}
 }
 function reset(){setEditing(null);setOpened(null);setName('');setNote('');setItems([]);setShowForm(false);}
 function useRecipe(recipeId:string){
  const recipe=p.data.recipes.find(r=>r.id===recipeId),factor=Number(portion);
  if(!recipe||!Number.isFinite(factor)||factor<=0)return;
  setName(recipe.name);setItems(recipe.ingredients.map(i=>({foodId:i.food_id,
   servings:String(Math.round(asNumber(i.servings)*factor/asNumber(recipe.yield_servings)*1000)/1000)})));
  setShowForm(true);
 }
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();
  if(!items.length)return;
  const body={consumedOn:p.date,slot,name:name.trim(),note,items:items.map(i=>({foodId:i.foodId,servings:Number(i.servings)}))};
  const ok=await p.perform(()=>editing?p.client.put('/meals/'+editing.id,{...body,expectedRevision:editing.revision}):p.client.post('/meals',body),
   editing?'Observed meal corrected. Snapshots have been recalculated.':'Observed meal saved. Daily intake updated from the database.');
  if(ok)reset();
 }
 async function remove(id:string){if(!window.confirm('Remove this observed meal? The log will no longer contribute to daily totals.'))return;
  if(await p.perform(()=>p.client.delete('/meals/'+id),'Meal removed from observed intake.'))reset();
 }
 async function saveWater(e:FormEvent<HTMLFormElement>){e.preventDefault();await p.perform(()=>p.client.put('/hydration',{date:p.date,observedL:Number(water)}),'Observed water intake saved.');}
 return <div className="lv-page"><Head icon={Utensils} tag="OBSERVED NUTRITION" title={p.route==='today'?'Today’s Nutrition Journal':'Meal History & Corrections'} description="Only meals you confirm as consumed count toward nutrient totals. Planned meals and cooking tasks never auto-log intake." action={<button type="button" className="primary-button" onClick={()=>{reset();setShowForm(true);}}><Plus size={16}/> Log meal</button>}/>
  <div className="lv-stats"><Stat icon={CalendarDays} title="Selected date" value={p.date} detail="Date controlled by top toolbar"/><Stat icon={Flame} title="Recorded energy" value={today.intake?today.intake.energyKcal+' kcal':'Unknown'} detail="Only confirmed meals"/><Stat icon={Activity} title="Protein in log" value={today.intake?today.intake.proteinG+' g':'Unknown'} detail="Incomplete records are not deficits"/><Stat icon={Droplets} title="Water observation" value={p.data.water.observedL===null?'Unknown':p.data.water.observedL+' L'} detail="User-entered observed volume"/></div>
  <div className="lv-grid-two"><Card title={editing?'Correct logged meal':'Log observed intake'} detail={editing?'An update requires the latest revision.':'Confirm each food and serving before submitting.'}>
   {!showForm?<Empty title="Ready to log?" description="Open the meal logger when you have an actual observation." action={<Action onClick={()=>setShowForm(true)}>Log a meal</Action>}/>:<form className="lv-form" onSubmit={submit}>
    <div className="lv-form-grid"><Field title="What did you eat?"><input required value={name} onChange={e=>setName(e.target.value)} maxLength={180}/></Field>
    <Field title="Meal slot"><select value={slot} onChange={e=>setSlot(e.target.value as ServerMeal['slot'])}>{slots.map(x=><option value={x} key={x}>{x}</option>)}</select></Field></div>
    <Field title="Optional note"><textarea maxLength={1000} rows={2} value={note} onChange={e=>setNote(e.target.value)}/></Field>
    <div className="lv-section-label"><strong>Observed ingredients</strong><button className="outlined-button" type="button" disabled={!p.data.foods.length||items.length>=40} onClick={()=>setItems(r=>[...r,{foodId:p.data.foods[0].id,servings:'1'}])}><Plus size={14}/> Add food</button></div>
    {items.map((item,i)=><div className="lv-ingredient" key={i}><label className="sr-only" htmlFor={'meal-food-'+i}>Food</label><select id={'meal-food-'+i} value={item.foodId} onChange={e=>setItems(rows=>rows.map((r,n)=>n===i?{...r,foodId:e.target.value}:r))}>{p.data.foods.map(f=><option value={f.id} key={f.id}>{f.name} · {f.serving_label}</option>)}</select><label className="sr-only" htmlFor={'meal-qty-'+i}>Quantity in servings</label><input id={'meal-qty-'+i} type="number" min=".001" max="1000" step="any" required value={item.servings} onChange={e=>setItems(rows=>rows.map((r,n)=>n===i?{...r,servings:e.target.value}:r))}/><button type="button" className="lv-icon" aria-label="Remove ingredient" onClick={()=>setItems(rows=>rows.filter((_,n)=>n!==i))}><Trash2 size={16}/></button></div>)}
    {!p.data.foods.length&&<p className="lv-help">Create actual foods in Food Library first. No sample foods are imported into your authenticated account.</p>}
    {opened&&<div className="lv-reading"><span>Current revision</span><strong>{opened.revision}</strong></div>}
    <Note warn>Submitting confirms actual intake, not planned consumption. Quantities and food composition may be approximate. The server records a nutrient snapshot.</Note>
    <div className="lv-inline"><button className="primary-button" type="submit" disabled={p.busy||!items.length}>{editing?'Save correction':'Confirm eaten & log'}</button><button className="outlined-button" type="button" onClick={reset}>Cancel</button></div>
   </form>}
  </Card><div className="lv-stack"><Card title="Use a saved recipe" detail="Expands a recipe into editable ingredients; it does not log anything automatically.">
    <div className="lv-form-grid"><Field title="Portions consumed"><input type="number" min=".25" max="1000" step=".25" value={portion} onChange={e=>setPortion(e.target.value)}/></Field><div className="lv-field"><span>Choose a recipe</span><select aria-label="Load recipe ingredients" defaultValue="" onChange={e=>{if(e.target.value)useRecipe(e.target.value);e.target.value='';}}><option value="" disabled>Select recipe…</option>{p.data.recipes.map(r=><option value={r.id} key={r.id}>{r.name}</option>)}</select></div></div>
    <p className="lv-help">Ingredient quantities are derived using declared recipe yield and your chosen portions. Review carefully before saving.</p>
   </Card><Card title="Hydration" detail={'Observation for '+p.date}>
    <form className="lv-form" onSubmit={saveWater}><Field title="Total observed water today (litres)"><input type="number" min="0" max="15" step=".05" value={water} onChange={e=>setWater(e.target.value)} required placeholder="No entry recorded"/></Field>
     <button className="outlined-button" type="submit" disabled={p.busy||!water.trim()}><Droplets size={15}/> Save observed amount</button></form>
    <p className="lv-help">No amount is inferred from an empty record.</p>
   </Card></div></div>
  <Card title="Recorded meals" detail="Use Edit to correct individual food snapshots.">
   {p.route==='meals'&&<Field title="Filter by observed date"><input type="date" value={dayFilter} onChange={e=>setDayFilter(e.target.value)}/></Field>}
   {!meals.length?<Empty title="No matching meal records" description="No observations have been recorded for the selected period."/>:<div className="lv-rows">{meals.map(m=><div className="lv-row" key={m.id}><span className="lv-emojibox">🍽️</span><span><strong>{m.name}</strong><small>{dateOnly(m.consumed_on)} · {m.slot} · {asNumber(m.energy_kcal)} kcal · {asNumber(m.protein_g)}g protein</small><small>Revision {m.revision} · logged, not planned</small></span><div className="lv-row-actions"><button className="outlined-button" type="button" disabled={p.busy} onClick={()=>void open(m)}><Edit3 size={14}/>Edit</button><button className="outlined-button lv-danger" type="button" disabled={p.busy} onClick={()=>void remove(m.id)} aria-label={'Delete '+m.name}><Trash2 size={14}/></button></div></div>)}</div>}
  </Card>
 </div>;
}
export function ProgressScreen({p}:{p:LiveProps}){
 const rows=p.data.progress.observations,water=p.data.progress.hydration;
 return <div className="lv-page"><Head icon={TrendingUp} tag="OBSERVED PERFORMANCE" title="Nutrition Progress" description="Up to 90 days of actual logged observations. Missing dates are unknown, not zeros. No synthetic trend, habit streak or adaptation score."/>
  <div className="lv-stats"><Stat icon={CalendarDays} title="Dates with observations" value={String(rows.length)} detail="No imputed days"/><Stat icon={Utensils} title="Logged meals" value={String(rows.reduce((s,r)=>s+r.loggedMeals,0))} detail="Not a completeness score"/><Stat icon={Activity} title="Average logged protein" value={rows.length>=3?(rows.reduce((s,r)=>s+r.proteinG,0)/rows.length).toFixed(1)+' g':'Insufficient history'} detail="Observed dates only"/><Stat icon={Droplets} title="Hydration entries" value={String(water.length)} detail="User-recorded amounts"/></div>
  <Note>Logs may be incomplete. The observed-only graph never establishes actual dietary adequacy or deficiency. At least three observed dates are needed to display a simple descriptive mean.</Note>
  <Card title="Available date history" detail="Actual recorded days only.">
   {!rows.length?<Empty title="No logged history yet" description="Record real meals to see trends derived from your own dates."/>:
   <div className="lv-history">{rows.map(day=><div className="lv-history-row" key={day.date}><strong>{day.date}</strong><div className="lv-track"><i style={{width:Math.min(100,Math.max(1,day.energyKcal/3000*100))+'%'}}/></div><span>{day.loggedMeals} meals</span><b>{day.energyKcal.toFixed(0)} kcal</b><small>{day.proteinG.toFixed(1)}g protein</small></div>)}</div>}
   <p className="lv-help">Bars use a fixed visualization scale, not a clinical calorie target.</p>
  </Card>
 </div>;
}
