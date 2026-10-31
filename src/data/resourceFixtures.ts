/** Phase 3 illustrative household resource fixtures. These are not purchases, receipts or live prices. */
import type {InventoryLot,StockMovement,WeeklyPlan} from '../domain/resources';
import { generateGroceries } from '../domain/resources';
import {sampleRecipes} from './personalFixtures';

export const sampleUnitPricesKes:Record<string,number>={
  eggs:78,banana:30,yoghurt:110,ugali:100,beans:170,
  chicken:175,rice:85,sukuma:35,tilapia:210,githeri:145,
  sweetpotato:55,avocado:75,oats:65,milk:85,lentils:125,
  chapati:80,mango:50,spinach:45,peanuts:85,beef:195
};

export const sampleInventoryLots:InventoryLot[]=[
  {id:'stock-rice',foodId:'rice',location:'Pantry',acquiredOn:'2026-10-24',expiresOn:'2027-01-10',unitPriceKes:85},
  {id:'stock-sukuma',foodId:'sukuma',location:'Fridge',acquiredOn:'2026-10-30',expiresOn:'2026-11-01',unitPriceKes:35},
  {id:'stock-eggs',foodId:'eggs',location:'Fridge',acquiredOn:'2026-10-29',expiresOn:'2026-11-06',unitPriceKes:78},
  {id:'stock-chicken',foodId:'chicken',location:'Freezer',acquiredOn:'2026-10-30',expiresOn:'2026-11-15',unitPriceKes:175},
  {id:'stock-avocado',foodId:'avocado',location:'Fridge',acquiredOn:'2026-10-30',expiresOn:'2026-11-02',unitPriceKes:75},
  {id:'stock-githeri',foodId:'githeri',location:'Fridge',acquiredOn:'2026-10-30',expiresOn:'2026-11-01',unitPriceKes:145},
];
export const sampleStockMovements:StockMovement[]=sampleInventoryLots.map((lot,i)=>({
  id:'initial-'+lot.id,lotId:lot.id,date:lot.acquiredOn,kind:'PURCHASE' as const,
  deltaServings:[3,2,5,1,2,2][i],note:'Illustrative opening stock'
}));

export const sampleWeeklyPlan:WeeklyPlan={
  id:'plan-2026-10-26',
  weekStart:'2026-10-26',
  status:'approved',
  revision:1,
  entries:[
    {id:'plan-meal-1',date:'2026-10-26',slot:'Lunch',recipeId:'example-githeri',portions:1,locked:true},
    {id:'plan-meal-2',date:'2026-10-27',slot:'Dinner',recipeId:'example-chicken-bowl',portions:1,locked:false},
    {id:'plan-meal-3',date:'2026-10-29',slot:'Lunch',recipeId:'example-githeri',portions:1,locked:false},
    {id:'plan-meal-4',date:'2026-10-30',slot:'Dinner',recipeId:'example-chicken-bowl',portions:1,locked:false},
    {id:'plan-meal-5',date:'2026-10-31',slot:'Dinner',recipeId:'example-githeri',portions:1,locked:false},
    {id:'plan-meal-6',date:'2026-11-01',slot:'Dinner',recipeId:'example-chicken-bowl',portions:1,locked:false},
  ]
};
export const sampleGroceriesGenerated=generateGroceries(sampleWeeklyPlan,sampleRecipes,sampleInventoryLots,sampleStockMovements,sampleUnitPricesKes,'2026-10-31');
export const sampleFoodBudgetKes=5500;
