/** Deterministic nutrition math and API request contracts. */
import {z} from 'zod';
export const dateSchema=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(x=>!Number.isNaN(Date.parse(x+'T12:00:00Z'))&&new Date(x+'T12:00:00Z').toISOString().slice(0,10)===x,'Invalid ISO calendar date');
export const uuid=z.string().uuid();
export const servings=z.number().finite().positive().max(1000);
export const macrosSchema=z.object({
  energyKcal:z.number().finite().nonnegative().max(100000),
  proteinG:z.number().finite().nonnegative().max(100000),
  carbsG:z.number().finite().nonnegative().max(100000),
  fatG:z.number().finite().nonnegative().max(100000)
});
export type Macros=z.infer<typeof macrosSchema>;
export const foodInput=z.object({
  name:z.string().trim().min(1).max(140),servingLabel:z.string().trim().min(1).max(120),
  ...macrosSchema.shape
}).strict();
export const mealInput=z.object({
  consumedOn:dateSchema,slot:z.enum(['Breakfast','Lunch','Snack','Dinner']),
  name:z.string().trim().min(1).max(180),note:z.string().max(1000).default(''),
  items:z.array(z.object({foodId:uuid,servings})).min(1).max(40)
}).strict();
export const recipeInput=z.object({
  name:z.string().trim().min(1).max(140),yieldServings:servings,
  prepMinutes:z.number().int().nonnegative().max(20000).default(0),
  instructions:z.string().max(12000).default(''),
  ingredients:z.array(z.object({foodId:uuid,servings})).min(1).max(70)
}).strict();
export const goalInput=z.object({
  metric:z.enum(['energy_kcal','protein_g','carbs_g','fat_g','hydration_l']),
  target:z.number().finite().positive().max(100000),
  unit:z.string().min(1).max(16),effectiveFrom:dateSchema,effectiveTo:dateSchema.nullable().default(null)
}).strict().refine(v=>!v.effectiveTo||v.effectiveTo>=v.effectiveFrom,'Goal end date must not be before start.');
export const planInput=z.object({weekStart:dateSchema}).strict().refine(v=>monday(v.weekStart)===v.weekStart,'Plan start must be Monday.');
export const entryInput=z.object({
  plannedOn:dateSchema,slot:z.enum(['Breakfast','Lunch','Snack','Dinner']),
  recipeId:uuid,portions:servings,locked:z.boolean().default(false)
}).strict();
export const lotInput=z.object({
  foodId:uuid,location:z.enum(['Pantry','Fridge','Freezer']),
  acquiredOn:dateSchema,expiresOn:dateSchema.nullable().default(null),
  unitCostKes:z.number().finite().nonnegative().max(1000000).default(0),
  initialServings:servings
}).strict();
export const moveInput=z.object({
  lotId:uuid,happenedOn:dateSchema,
  kind:z.enum(['PURCHASE','CONSUMPTION','WASTE','EXPIRY','ADJUSTMENT']),
  deltaServings:z.number().finite().min(-100000).max(100000).refine(v=>v!==0),
  note:z.string().max(240).default('')
}).strict().superRefine((v,ctx)=>{
  const outgoing=['CONSUMPTION','WASTE','EXPIRY'].includes(v.kind);
  if(outgoing&&v.deltaServings>=0)ctx.addIssue({code:'custom',message:'Outgoing stock movement must be negative.'});
  if(v.kind==='PURCHASE'&&v.deltaServings<=0)ctx.addIssue({code:'custom',message:'Purchase stock must be positive.'});
});
export const profileInput=z.object({
  displayName:z.string().max(120).default(''),dietStyle:z.string().max(80).default('flexible'),
  excludedFoods:z.string().max(1000).default(''),preferences:z.record(z.unknown()).default({}),
  targets:z.record(z.number().finite().nonnegative().max(100000)).default({})
}).strict();
export const budgetInput=z.object({amountKes:z.number().finite().min(0).max(100000000)}).strict();
export const groceryPrices=z.object({
  planId:uuid,unitPricesKes:z.record(z.number().finite().min(0).max(1000000)).default({})
}).strict();
export const groceryPaid=z.object({
  purchased:z.boolean(),actualPaidKes:z.number().finite().nonnegative().max(100000000).nullable().default(null)
}).strict().refine(v=>v.purchased||v.actualPaidKes===null,'Unpurchased item cannot have actual spend.');
export const receiveInput=z.object({
  location:z.enum(['Pantry','Fridge','Freezer']),acquiredOn:dateSchema,expiresOn:dateSchema.nullable().default(null)
}).strict();
export function monday(iso:string):string{
  const d=new Date(iso+'T12:00:00Z');
  if(Number.isNaN(d.getTime()))return '';
  const day=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-day);
  return d.toISOString().slice(0,10);
}
export function withinWeek(start:string,date:string):boolean{
  if(monday(start)!==start)return false;
  const day=Date.parse(date+'T12:00:00Z')-Date.parse(start+'T12:00:00Z');
  return Number.isFinite(day)&&day>=0&&day<7*86400000;
}
export function round3(n:number):number{
  if(!Number.isFinite(n))throw new Error('Non-finite nutrient amount.');
  return Math.round((n+Number.EPSILON)*1000)/1000;
}
export function sumServings(items:Array<{servings:number;macros:Macros}>):Macros{
  return items.reduce<Macros>((a,i)=>({
    energyKcal:round3(a.energyKcal+round3(i.servings*i.macros.energyKcal)),
    proteinG:round3(a.proteinG+round3(i.servings*i.macros.proteinG)),
    carbsG:round3(a.carbsG+round3(i.servings*i.macros.carbsG)),
    fatG:round3(a.fatG+round3(i.servings*i.macros.fatG))
  }),{energyKcal:0,proteinG:0,carbsG:0,fatG:0});
}
