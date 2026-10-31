/** Illustrative household participants and cooking responsibilities, never real identities. */
import type {FamilyWorkspaceState} from '../domain/family';
export const sampleFamilyWorkspace:FamilyWorkspaceState={
  members:[
    {id:'self',alias:'Household owner',role:'owner',active:true},
    {id:'member-a',alias:'Member A',role:'editor',active:true},
    {id:'member-b',alias:'Member B',role:'viewer',active:true},
  ],
  tasks:[
    {id:'kitchen-task-1',planEntryId:'plan-meal-5',memberId:'member-a',note:'Prepare ingredients',status:'planned'},
    {id:'kitchen-task-2',planEntryId:'plan-meal-6',memberId:'self',note:'Confirm shopping needs',status:'planned'},
  ],
  shareMyPreferences:false,
};
