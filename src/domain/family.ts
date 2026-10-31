/**
 * Phase 4 family boundary. Shared resource view only -- no private user nutrition
 * measurements, food logs, health context or simulated real identity/authorization.
 */
import type {WeeklyPlan,GroceryList,InventoryLot,StockMovement} from './resources';
import {estimateGroceries,lotBalance,recordedGrocerySpend} from './resources';
export type HouseholdRole='owner'|'editor'|'viewer';
export interface SharedMember {id:string;alias:string;role:HouseholdRole;active:boolean;}
export type TaskStatus='planned'|'preparing'|'completed';
export interface KitchenTask {
  id:string; planEntryId:string; memberId:string; note:string; status:TaskStatus;
}
export interface FamilyWorkspaceState {
  members:SharedMember[];
  tasks:KitchenTask[];
  shareMyPreferences:boolean;
}
export interface PublicFamilySummary {
  members:Array<Pick<SharedMember,'id'|'alias'|'role'|'active'>>;
  taskCount:number;
  plannedMealCount:number;
  sharedGroceryCount:number;
  groceryForecastKes:number;
  explicitlyRecordedSpendKes:number;
  stockedLots:number;
  memberNutritionVisibility:'none';
}
export function memberRole(members:readonly SharedMember[],id:string):HouseholdRole|null{
  const found=members.find(m=>m.id===id&&m.active);
  return found?.role??null;
}
function requireEditor(state:FamilyWorkspaceState,actorId:string):void{
  const role=memberRole(state.members,actorId);
  if(role!=='owner'&&role!=='editor')throw new Error('This household role cannot modify shared schedules.');
}
function requireOwner(state:FamilyWorkspaceState,actorId:string):void{
  if(memberRole(state.members,actorId)!=='owner')throw new Error('Only the preview household owner can change member access.');
}
export function addMember(state:FamilyWorkspaceState,actorId:string,member:SharedMember):FamilyWorkspaceState{
  requireOwner(state,actorId);
  const alias=member.alias.trim();
  if(!alias||alias.length>50||state.members.some(m=>m.id===member.id)||state.members.length>=12)
    throw new Error('Use a unique member ID and an alias of 1–50 characters (max 12 members).');
  if(member.role==='owner')throw new Error('Owner access cannot be granted through the preview.');
  return {...state,members:[...state.members,{...member,alias,active:true}]};
}
export function changeMember(state:FamilyWorkspaceState,actorId:string,id:string,change:{alias?:string;role?:HouseholdRole;active?:boolean}):FamilyWorkspaceState{
  requireOwner(state,actorId);
  const member=state.members.find(m=>m.id===id);
  if(!member)throw new Error('Member not found.');
  if(member.role==='owner')throw new Error('Owner cannot be modified or removed.');
  if(change.role==='owner')throw new Error('Owner access cannot be granted through the preview.');
  if(change.alias!==undefined&&(!change.alias.trim()||change.alias.trim().length>50))throw new Error('Invalid member display name.');
  return {...state,members:state.members.map(m=>m.id===id?{...m,...change,alias:change.alias?.trim()??m.alias}:m),
    tasks:change.active===false?state.tasks.filter(t=>t.memberId!==id):state.tasks};
}
export function saveTask(state:FamilyWorkspaceState,actorId:string,task:KitchenTask,plans:readonly WeeklyPlan[]):FamilyWorkspaceState{
  requireEditor(state,actorId);
  const source=plans.flatMap(p=>p.status==='approved'?p.entries:[]);
  if(!source.some(p=>p.id===task.planEntryId))throw new Error('Assign tasks only to an approved shared planned meal.');
  if(!state.members.some(m=>m.id===task.memberId&&m.active))throw new Error('Choose an active household member.');
  if(!task.id||task.note.length>160||!['planned','preparing','completed'].includes(task.status))throw new Error('Invalid kitchen task.');
  if(state.tasks.some(x=>x.id===task.id))return {...state,tasks:state.tasks.map(x=>x.id===task.id?task:x)};
  if(state.tasks.some(x=>x.planEntryId===task.planEntryId))throw new Error('This shared meal already has a cooking assignment.');
  return {...state,tasks:[...state.tasks,task]};
}
export function removeTask(state:FamilyWorkspaceState,actorId:string,taskId:string):FamilyWorkspaceState{
  requireEditor(state,actorId);
  return {...state,tasks:state.tasks.filter(t=>t.id!==taskId)};
}
export function setPreferenceSharing(state:FamilyWorkspaceState,actorId:string,value:boolean):FamilyWorkspaceState{
  if(memberRole(state.members,actorId)!=='owner')throw new Error('Personal preferences can be changed only by their owner.');
  // Do not automatically publish private values; this is just the preview permission UI.
  return {...state,shareMyPreferences:!!value};
}
export function familyProjection(state:FamilyWorkspaceState,plans:readonly WeeklyPlan[],groceries:GroceryList,
  lots:readonly InventoryLot[],movements:readonly StockMovement[],viewerId:string):PublicFamilySummary{
  if(!memberRole(state.members,viewerId))throw new Error('Household access denied.');
  return {
    members:state.members.map(m=>({id:m.id,alias:m.alias,role:m.role,active:m.active})),
    taskCount:state.tasks.length,
    plannedMealCount:plans.filter(p=>p.status==='approved').reduce((sum,p)=>sum+p.entries.length,0),
    sharedGroceryCount:groceries.lines.length,
    groceryForecastKes:estimateGroceries(groceries),
    explicitlyRecordedSpendKes:recordedGrocerySpend(groceries),
    stockedLots:lots.filter(l=>lotBalance(l.id,movements)>0).length,
    memberNutritionVisibility:'none',
  };
}
