/**
 * Nutrition OS Phase 4 -- deterministic, frontend-only decision explanations.
 * No LLM, medical inference, predictive claims, connected data or secret API calls.
 */
import type {MealRecord, FoodChoice} from './nutrition';
import type {NutritionProfile,NutritionTargets,RecipeRecord} from './personal';
import {observedDays, recipeAmount} from './personal';
import type {WeeklyPlan,InventoryLot,StockMovement,GroceryList} from './resources';
import {daysUntil,estimatedRecipeCost,inventoryStock,lotBalance,estimateGroceries,recordedGrocerySpend} from './resources';

export type Confidence='limited'|'partial'|'documented';
export type EvidenceKind='observation'|'estimate'|'rule'|'missing-data';
export interface Evidence { kind:EvidenceKind; label:string; detail:string; }
export type InsightKind='observation'|'planning'|'resource'|'limitation';
export interface NutritionInsight {
  id:string; kind:InsightKind; title:string; statement:string; action:string;
  route:'today'|'meals'|'goals'|'planner'|'groceries'|'inventory'|'waste'|'progress';
  confidence:Confidence; evidence:Evidence[]; rank:number;
}
export interface Candidate {
  id:string;recipeId:string;title:string;emoji:string;energyKcal:number;proteinG:number;
  costKes:number;minutes:number;availableIngredients:number;totalIngredients:number;
  confidence:Confidence;evidence:Evidence[];
}
export interface DecisionContext {
  asOf:string; meals:readonly MealRecord[]; profile:NutritionProfile; targets:NutritionTargets;
  recipes:readonly RecipeRecord[];foods:readonly FoodChoice[];
  plans:readonly WeeklyPlan[];lots:readonly InventoryLot[];movements:readonly StockMovement[];
  groceries:GroceryList;budgetKes:number;prices:Record<string,number>;
}
export type FeedbackStatus='helpful'|'not-helpful'|'dismissed';
export type InsightFeedback={insightId:string;status:FeedbackStatus;recordedOn:string};
export function loggedOnDate(ctx:DecisionContext):MealRecord[] {
  return ctx.meals.filter(m=>m.status==='logged' && (m.recordedOn??'2026-10-31')===ctx.asOf);
}
export function observedDateCount(ctx:DecisionContext):number {
  return observedDays(ctx.meals,'2026-10-31').length;
}
function observedEvidence(ctx:DecisionContext):Evidence[]{
  const onDate=loggedOnDate(ctx);
  return [
    {kind:'observation',label:'Observed meal records',detail:onDate.length+' logged meal(s) dated '+ctx.asOf},
    {kind:'missing-data',label:'Completeness',detail:'Meal logging may be incomplete; no estimate of unlogged intake.'},
  ];
}
function round(value:number):number{return Math.round(value*10)/10;}
/** Only demonstrably unexpired lot balances can inform options, never proof of food safety. */
export function eligibleStock(ctx:DecisionContext):Record<string,number>{
  const all=inventoryStock(ctx.lots,ctx.movements);
  const eligible:Record<string,number>={};
  for(const lot of ctx.lots){
    if(lot.expiresOn && daysUntil(lot.expiresOn,ctx.asOf)<0)continue;
    eligible[lot.foodId]=(eligible[lot.foodId]??0)+Math.max(0,lotBalance(lot.id,ctx.movements));
  }
  for(const key of Object.keys(eligible))eligible[key]=round(eligible[key]);
  // Check for no unexpected item from an invalid balance.
  for(const key of Object.keys(eligible))if((all[key]??0)<eligible[key])eligible[key]=all[key];
  return eligible;
}
export function previewCandidates(ctx:DecisionContext):Candidate[]{
  // A free-text exclusion cannot be reliably matched to ingredients or hidden allergens.
  // Fail closed on explicit exclusions: no supposedly compliant meal suggestions.
  if(ctx.profile.excludedFoods.trim())return [];
  const stock=eligibleStock(ctx);
  const result:Candidate[]=[];
  for(const recipe of ctx.recipes){
    if(!recipe.ingredients.length)continue;
    try{
      const nutrients=recipeAmount(recipe,ctx.foods);
      const cost=estimatedRecipeCost(recipe,ctx.prices);
      const stocked=recipe.ingredients.filter(i=>(stock[i.foodId]??0)>=i.servings/recipe.servings).length;
      result.push({id:'option-'+recipe.id,recipeId:recipe.id,title:recipe.name,emoji:recipe.emoji,
        energyKcal:nutrients.energyKcal,proteinG:nutrients.proteinG,costKes:Math.round(cost),
        minutes:recipe.prepMinutes,availableIngredients:stocked,totalIngredients:recipe.ingredients.length,
        confidence:'limited',
        evidence:[
          {kind:'estimate',label:'Recipe portion',detail:'From '+recipe.ingredients.length+' illustrative food record(s); 1 of '+recipe.servings+' recipe servings.'},
          {kind:'estimate',label:'Estimated ingredient cost',detail:'KES '+Math.round(cost)+' using editable example unit prices.'},
          {kind:'observation',label:'Stock at reference date',detail:stocked+'/'+recipe.ingredients.length+' ingredients have sufficient example, unexpired stock.'},
          {kind:'rule',label:'Safety limits',detail:'Ingredients, allergens, and individual requirements are not clinically validated. Verify independently.'},
        ],
      });
    }catch{/* A missing ingredient cannot be guessed. */}
  }
  return result.sort((a,b)=>{
    const ca=a.totalIngredients?a.availableIngredients/a.totalIngredients:0;
    const cb=b.totalIngredients?b.availableIngredients/b.totalIngredients:0;
    return (cb-ca)*40+(b.proteinG-a.proteinG)*.35+(a.costKes-b.costKes)*.03+(a.minutes-b.minutes)*.1;
  }).slice(0,5);
}
export function deriveInsights(ctx:DecisionContext):NutritionInsight[] {
  const list:NutritionInsight[]=[];
  const logged=loggedOnDate(ctx);
  const dayCount=observedDateCount(ctx);
  const sumProtein=logged.reduce((n,m)=>n+m.proteinG,0);
  const sumEnergy=logged.reduce((n,m)=>n+m.energyKcal,0);
  const observed=observedEvidence(ctx);
  if(!logged.length){
    list.push({id:'intake-not-observed',kind:'limitation',title:'No confirmed intake for this date',
      statement:'There are no logged meals for this selected date. Missing entries cannot be interpreted as zero food consumption or a nutrient deficit.',
      action:'Open Today',route:'today',confidence:'documented',evidence:observed,rank:100});
  }else{
    list.push({id:'logged-intake',kind:'observation',title:'What you recorded today',
      statement:logged.length+' meal(s) logged: about '+Math.round(sumEnergy)+' kcal and '+round(sumProtein)+'g protein in the available entries. This is recorded intake, not a complete dietary assessment.',
      action:'Review meals',route:'meals',confidence:'partial',evidence:observed,rank:98});
    list.push({id:'comparison-not-deficiency',kind:'observation',title:'Logged protein versus selected target',
      statement:round(sumProtein)+'g logged versus the example '+ctx.targets.proteinG+'g target; '+round(Math.max(0,ctx.targets.proteinG-sumProtein))+'g is not reflected in currently recorded entries. This is not evidence of physiological deficiency.',
      action:'Review targets',route:'goals',confidence:'limited',
      evidence:[...observed,{kind:'rule',label:'Example target',detail:'User-editable preview target: '+ctx.targets.proteinG+'g per day.'}],rank:70});
  }
  const allObserved=observedDays(ctx.meals,'2026-10-31');
  if(dayCount>=3){
    const avg=Math.round(allObserved.reduce((n,d)=>n+d.proteinG,0)/dayCount);
    list.push({id:'observed-trend',kind:'observation',title:'Protein across observed dates',
      statement:avg+'g average across '+dayCount+' separately logged dates. Unobserved dates are excluded; incomplete records may understate actual intake.',
      action:'Open progress',route:'progress',confidence:'partial',
      evidence:[{kind:'observation',label:'Distinct observed dates',detail:dayCount+' date(s) with at least one logged meal.'},{kind:'missing-data',label:'Recording gap',detail:'Only observed logs are included; no synthetic days.'}],rank:58});
  }else{
    list.push({id:'limited-history',kind:'limitation',title:'Not enough history for a pattern',
      statement:'Only '+dayCount+' date(s) contain logged meals. Nutrition OS will not invent a week of results or make a behavior prediction.',
      action:'Open progress',route:'progress',confidence:'documented',
      evidence:[{kind:'observation',label:'Observed dates',detail:dayCount+' recorded date(s)'},{kind:'rule',label:'Minimum evidence',detail:'Pattern analysis requires at least three distinct observed dates.'}],rank:64});
  }
  const week=ctx.plans.find(p=>p.weekStart<=ctx.asOf&&p.weekStart>=shiftBackSix(ctx.asOf));
  if(week){
    list.push({id:'week-plan',kind:'planning',title:week.status==='approved'?'Approved meals ready for review':'Meal plan is still a draft',
      statement:week.entries.length+' meal(s) '+(week.status==='approved'?'approved':'in draft')+' for the week. Planned nutrition is not counted as eaten.',
      action:'Open planner',route:'planner',confidence:'documented',
      evidence:[{kind:'observation',label:'Plan state',detail:week.status+', revision '+week.revision+', '+week.entries.length+' meal(s).'}],rank:83});
  }
  const forecast=estimateGroceries(ctx.groceries);
  const spent=recordedGrocerySpend(ctx.groceries);
  list.push({id:'shopping-budget',kind:'resource',title:'Food budget is a planning estimate',
    statement:'Example basket '+money(forecast)+' versus '+money(ctx.budgetKes)+' allocation; '+money(spent)+' explicitly recorded as paid in the current list. Checkmarks without amounts are not transactions.',
    action:'Review groceries',route:'groceries',confidence:'partial',
    evidence:[{kind:'estimate',label:'Basket forecast',detail:money(forecast)+' from illustrative unit costs.'},{kind:'observation',label:'Current list actuals',detail:money(spent)+' manually entered; archived lists are excluded from this insight.'}],rank:78});
  const soon=ctx.lots.filter(l=>lotBalance(l.id,ctx.movements)>0 && l.expiresOn!==null && daysUntil(l.expiresOn,ctx.asOf)>=0 && daysUntil(l.expiresOn,ctx.asOf)<=2);
  const expired=ctx.lots.filter(l=>lotBalance(l.id,ctx.movements)>0 && l.expiresOn!==null && daysUntil(l.expiresOn,ctx.asOf)<0);
  if(soon.length||expired.length){
    list.push({id:'expiry-watch',kind:'resource',title:'Food inventory needs attention',
      statement:soon.length+' lot(s) nearing recorded expiry, '+expired.length+' already past it. Do not use expired food; check labels and food safety before preparing anything.',
      action:'Check expiry',route:'waste',confidence:'partial',
      evidence:[{kind:'observation',label:'Stock ledger',detail:ctx.lots.length+' sample lots evaluated as of '+ctx.asOf},
        {kind:'rule',label:'Expiry classification',detail:'Current stock with dates at most two days away, plus already-expired lots.'}],rank:90});
  }
  return list.sort((a,b)=>b.rank-a.rank);
}
function shiftBackSix(date:string):string {
  const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-6);return d.toISOString().slice(0,10);
}
function money(v:number):string{return 'KES '+Math.round(v).toLocaleString('en-KE');}

export type AssistantIntent='safety'|'protein'|'today'|'meals'|'plan'|'inventory'|'grocery'|'budget'|'waste'|'family'|'explain'|'unknown';
export interface GuidedReply {
  intent:AssistantIntent;title:string;message:string;route:string|null;
  evidence:Evidence[];guardrail:'general'|'sensitive'|'limited';
}
const sensitive=/\b(infant|newborn|baby|toddler|child|pregnan|breastfeed|postpartum|post.partum|diabetes|insulin|cancer|eating disorder|anorexia|bulimia|medication|kidney disease|allerg|anaphyla|severe|fasting|starve|purge|weight loss pill|laxative)\b/i;
export function classifyIntent(text:string):AssistantIntent{
  if(sensitive.test(text))return 'safety';
  if(/\b(protein|macro|nutrient|target)\b/i.test(text))return 'protein';
  if(/\b(today|calorie|logged|intake|nutrition status)\b/i.test(text))return 'today';
  if(/\b(budget|kes|expense|spend|paid|cost)\b/i.test(text))return 'budget';
  if(/\b(expir|waste|spoiled|discard)\b/i.test(text))return 'waste';
  if(/\b(grocery|groceries|shopping|buy)\b/i.test(text))return 'grocery';
  if(/\b(pantry|fridge|freezer|stock|inventory)\b/i.test(text))return 'inventory';
  if(/\b(family|household|members|sharing|share)\b/i.test(text))return 'family';
  if(/\b(plan|dinner|lunch|breakfast|recipe|suggest|eat|food)\b/i.test(text))return 'plan';
  if(/\b(meal|history)\b/i.test(text))return 'meals';
  if(/\b(why|explain|confidence|source|accuracy)\b/i.test(text))return 'explain';
  return 'unknown';
}
export function answerGuided(ctx:DecisionContext,text:string,scope:'personal'|'household'='personal'):GuidedReply{
  const question=text.trim();
  if(!question||question.length>300)return {intent:'unknown',title:'Please enter a shorter question',message:'Questions are limited to 300 characters in the local preview.',route:null,evidence:[],guardrail:'limited'};
  const intent=classifyIntent(question);
  if(intent==='safety')return {intent,title:'Nutrition safety boundary',
    message:'This preview cannot assess medical conditions, infant or pregnancy nutrition, eating disorders, allergens or medication interactions. Do not use unverified sample values for care decisions. For individualized advice, contact a qualified clinician or registered dietitian; seek urgent care for severe symptoms.',
    route:null,evidence:[{kind:'rule',label:'Safety scope',detail:'Clinical, pediatric, allergy and disordered-eating requests do not generate meal or target prescriptions.'}],guardrail:'sensitive'};
  if(scope==='household' && ['protein','today','meals','explain'].includes(intent))
    return {intent,title:'Private information stays private',message:'This household view can discuss shared meals, groceries and inventory, not another person’s logged food, goals or nutrition status.',route:'family',evidence:[{kind:'rule',label:'Household data boundary',detail:'Personal intake and derived scores are not included in family context.'}],guardrail:'limited'};
  const insights=deriveInsights(ctx);
  const observed=loggedOnDate(ctx);
  const values=observedEvidence(ctx);
  if(intent==='protein'||intent==='today'){
    if(!observed.length)return {intent,title:'No confirmed intake observations',message:'No meals were logged on '+ctx.asOf+'. There is no basis to conclude intake was zero or below target. You can log what you remember in Today.',route:'today',evidence:values,guardrail:'limited'};
    const kcal=observed.reduce((n,m)=>n+m.energyKcal,0),protein=observed.reduce((n,m)=>n+m.proteinG,0);
    return {intent,title:'Recorded intake (partial)',message:observed.length+' example logged meal(s) sum to '+Math.round(kcal)+' kcal and '+round(protein)+'g protein against a user-editable target of '+ctx.targets.proteinG+'g. Unlogged intake is unknown; no clinical conclusion follows.',route:'today',evidence:[...values,{kind:'rule',label:'Target basis',detail:'Manually editable preview target, not personalized clinical requirement.'}],guardrail:'limited'};
  }
  if(intent==='plan'){
    const recs=previewCandidates(ctx);
    return {intent,title:ctx.profile.excludedFoods.trim()?'Ingredient verification required':'Meal ideas, not instructions',
      message:ctx.profile.excludedFoods.trim()?'The current profile lists food exclusions. Without authoritative ingredient and allergen screening, I will not suggest a supposedly compatible recipe. Review foods with a qualified professional when needed.':
      recs.length?'You can review '+recs.slice(0,2).map(r=>r.title).join(' or ')+' in the Recipe Studio and Meal Planner. Estimates use example records; check all ingredients and preparation safety.':'No valid recipe suggestions can be calculated from available example foods.',
      route:'planner',evidence:[{kind:'estimate',label:'Candidate source',detail:recs.length+' recipes with valid sample ingredients.'},{kind:'rule',label:'No auto actions',detail:'The assistant cannot create or approve plans.'}],guardrail:'limited'};
  }
  if(intent==='inventory')return {intent,title:'Shared inventory summary',
    message:ctx.lots.filter(l=>lotBalance(l.id,ctx.movements)>0).length+' sample lots still have recorded quantities. Expiry and exact serving sizes must be verified manually.',route:'inventory',
    evidence:[{kind:'observation',label:'Recorded lot balances',detail:ctx.movements.length+' preview ledger movements included.'}],guardrail:'general'};
  if(intent==='budget'||intent==='grocery')return {intent,title:'Illustrative basket and spending',
    message:'The current grocery list is forecast at '+money(estimateGroceries(ctx.groceries))+' against a '+money(ctx.budgetKes)+' example allocation. Manually recorded paid amounts total '+money(recordedGrocerySpend(ctx.groceries))+' on this list only; there is no linked bank account.',
    route:intent==='budget'?'budget':'groceries',evidence:[{kind:'estimate',label:'Prices',detail:'Unverified KES unit estimates from sample catalogue.'},{kind:'rule',label:'Financial boundary',detail:'Finance OS remains authoritative over actual transactions.'}],guardrail:'limited'};
  if(intent==='waste'){
    const i=insights.find(x=>x.id==='expiry-watch');
    return {intent,title:'Expiry and food waste',message:i?.statement??'No stock lot with a recorded balance is within two days of its example expiry date. This is not a food safety certification.',route:'waste',evidence:i?.evidence??[{kind:'rule',label:'Expiry',detail:'Dates are self-entered examples.'}],guardrail:'limited'};
  }
  if(intent==='family')return {intent,title:'Household coordination',
    message:'Family Nutrition shares meal planning, kitchen stock, grocery tasks and food budget only. Private meal logs, goals, health-derived context and nutrition scores are never shown to other family members in this preview.',route:'family',
    evidence:[{kind:'rule',label:'Privacy',detail:'Household views use shared-resource data only.'}],guardrail:'general'};
  if(intent==='meals')return {intent,title:'Meal history',message:'Your personal meal history separates planned meals from logged meals. Only logged records contribute to the daily totals; edits remain local to this preview.',route:'meals',evidence:values,guardrail:'general'};
  if(intent==='explain')return {intent,title:'Where the guidance comes from',message:'Every insight includes an evidence list and confidence label. Numbers come from logged demo meals, recipe calculations, pantry ledger events and editable KES assumptions—not AI predictions or lab measurements.',route:'insights',evidence:[{kind:'rule',label:'Method',detail:'Deterministic local functions; no model API or external data exchange.'}],guardrail:'general'};
  return {intent,title:'Guided assistant preview',message:'I can explain the example meal log, goals, plan, groceries, food budget, expiry, and family sharing. No AI model is connected, and I cannot diagnose conditions or perform autonomous mutations.',route:'insights',evidence:[{kind:'rule',label:'Capabilities',detail:'Read-only, local and rule-based.'}],guardrail:'limited'};
}
