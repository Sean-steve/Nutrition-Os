import {describe,it,expect,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import type {LiveSnapshot,NutritionClient} from './client';
import type {LiveProps,LiveRoute} from './types';
import {DashboardScreen,ProfileScreen,FoodScreen,RecipeScreen,MealsScreen,ProgressScreen} from './screens/Personal';
import {PlanScreen,GroceriesScreen,InventoryScreen,BudgetScreen,WasteScreen} from './screens/Resources';
import {InsightsScreen,GuideScreen,FamilyScreen} from './screens/FamilyInsights';

const snapshot:LiveSnapshot={
 session:{userId:'11111111-1111-4111-8111-111111111111',tenantId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',scopes:['nutrition:read','nutrition:write'],identitySource:'development_signed_token'},
 profile:null,foods:[],recipes:[],goals:[],meals:[],plans:[],inventory:[],movements:[],groceries:[],
 budget:{allocation:null,explicitRecordedPaidKes:0,source:'manually_entered'},water:{date:'2026-10-31',observedL:null,revision:null},
 progress:{from:'2026-08-01',to:'2026-10-31',observations:[],hydration:[],missingDates:'unknown',disclaimer:'No observed days'},
 state:{date:'2026-10-31',observedMeals:0,observationStatus:'unknown',intake:null,disclaimer:'Missing logs do not imply zero intake.'},
 insight:{date:'2026-10-31',kind:'missing_data',state:{date:'2026-10-31',observedMeals:0,observationStatus:'unknown',intake:null,disclaimer:'unknown'},explanation:'unknown',confidence:'limited',provenance:'unverified_user_food_snapshots'},
 family:{boards:[],invites:[],disclaimer:'No private data shared.'}
};
const navigation=vi.fn();
const fakeClient={} as NutritionClient;
function props(route:LiveRoute):LiveProps{return {route,data:snapshot,client:fakeClient,date:'2026-10-31',busy:false,
 perform:async()=>false,navigate:navigation,setDate:vi.fn()};}
const pages=[
 ['dashboard',DashboardScreen],['onboarding',ProfileScreen],['profile',ProfileScreen],['goals',ProfileScreen],
 ['today',MealsScreen],['meals',MealsScreen],['foods',FoodScreen],['recipes',RecipeScreen],['progress',ProgressScreen],
 ['planner',PlanScreen],['groceries',GroceriesScreen],['inventory',InventoryScreen],['budget',BudgetScreen],
 ['waste',WasteScreen],['insights',InsightsScreen],['assistant',GuideScreen],['family',FamilyScreen]
] as const;
describe('Authenticated frontend renders only verified empty API state',()=>{
 it.each(pages)('renders %s with no fabricated data', (name,Component)=>{
   const html=renderToStaticMarkup(<Component p={props(name)}/>);
   expect(html.length).toBeGreaterThan(100);
   expect(html).not.toContain('Eggs &amp; avocado toast');
   expect(html).not.toContain('Member A');
   expect(html).not.toContain('m-breakfast');
 });
 it('does not turn missing meal or hydration observations into zero or a target failure',()=>{
   const html=renderToStaticMarkup(<DashboardScreen p={props('dashboard')}/>);
   expect(html).toContain('Not recorded');
   expect(html).toContain('No intake conclusion from missing logs');
   expect(html).not.toContain('0 kcal');
 });
 it('shows no family member data until explicit backend sharing',()=>{
   const html=renderToStaticMarkup(<FamilyScreen p={props('family')}/>);
   expect(html).toContain('Create your shared kitchen');
   expect(html).not.toContain('Sample household');
 });
});
