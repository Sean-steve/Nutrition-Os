import type {ReactNode} from 'react';
import type {LucideIcon} from 'lucide-react';
import {Info,ArrowRight,ShieldCheck} from 'lucide-react';
export function Head({icon:Icon,title,description,tag,action}:{icon:LucideIcon;title:string;description:string;tag:string;action?:ReactNode}){
 return <header className="lv-head"><div><span className="eyebrow"><Icon size={16}/>{tag}</span><h1>{title}</h1><p>{description}</p></div>{action&&<div className="lv-head-actions">{action}</div>}</header>;
}
export function Card({title,detail,children,action}:{title:string;detail?:string;children:ReactNode;action?:ReactNode}){
 return <section className="panel lv-panel"><div className="lv-panel-heading"><div><h2>{title}</h2>{detail&&<p>{detail}</p>}</div>{action}</div>{children}</section>;
}
export function Stat({icon:Icon,title,value,detail}:{icon:LucideIcon;title:string;value:string;detail:string}){
 return <article className="panel lv-stat"><span className="lv-stat-icon"><Icon size={20}/></span><div><small>{title}</small><strong>{value}</strong><em>{detail}</em></div></article>;
}
export function Field({title,children}:{title:string;children:ReactNode}){return <label className="lv-field"><span>{title}</span>{children}</label>;}
export function Empty({title,description,action}:{title:string;description:string;action?:ReactNode}){return <div className="lv-empty"><Info size={22}/><strong>{title}</strong><p>{description}</p>{action}</div>;}
export function Note({children,warn=false}:{children:ReactNode;warn?:boolean}){return <div className={'lv-note '+(warn?'warn':'')}><ShieldCheck size={17}/><div>{children}</div></div>;}
export function Action({children,onClick,disabled,outline=false}:{children:ReactNode;onClick:()=>void;disabled?:boolean;outline?:boolean}){
 return <button type="button" className={outline?'outlined-button':'primary-button'} disabled={disabled} onClick={onClick}>{children}<ArrowRight size={14}/></button>;
}
export function Loading(){return <div className="lv-loading" role="status"><span className="lv-spinner"/>Loading authorized nutrition records…</div>;}
export const slots=['Breakfast','Lunch','Snack','Dinner'] as const;
export const locations=['Pantry','Fridge','Freezer'] as const;
export function todayIso():string{const d=new Date();const off=d.getTimezoneOffset()*60000;return new Date(d.getTime()-off).toISOString().slice(0,10);}
export function shiftDay(iso:string,by:number):string{const d=new Date(iso+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+by);return d.toISOString().slice(0,10);}
export function monday(iso:string):string{const d=new Date(iso+'T12:00:00Z'),day=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-day);return d.toISOString().slice(0,10);}
export const safeNumber=(s:string)=>s.trim()===''?NaN:Number(s);
export function stringDate(v:string):string{return v.slice(0,10);}
export function shortId(id:string):string{return id.slice(0,8)+'…';}
