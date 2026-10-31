import type {NutritionClient,LiveSnapshot} from './client';
export type LiveRoute='dashboard'|'onboarding'|'profile'|'today'|'meals'|'foods'|'recipes'|'goals'|'progress'|
 'planner'|'groceries'|'inventory'|'budget'|'waste'|'insights'|'assistant'|'family'|'integrations'|'privacy';
export type LiveProps={
  data:LiveSnapshot;client:NutritionClient;date:string;route:LiveRoute;busy:boolean;
  perform:(action:()=>Promise<unknown>,message:string)=>Promise<boolean>;
  navigate:(to:LiveRoute)=>void;setDate:(date:string)=>void;
};
export const pageRoutes:LiveRoute[]=['dashboard','today','meals','foods','recipes','goals','progress','planner','groceries','inventory','budget','waste','insights','assistant','family','onboarding','profile','integrations','privacy'];
export function isLiveRoute(x:string):x is LiveRoute{return pageRoutes.includes(x as LiveRoute);}
