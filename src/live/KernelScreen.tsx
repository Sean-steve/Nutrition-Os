import {useState,type FormEvent} from 'react';
import {AlertTriangle,ArrowRight,CalendarDays,CheckCircle2,Clock,LockKeyhole,ShieldCheck,Signpost,Users} from 'lucide-react';
import type {LiveProps} from './types';
import {dateOnly} from './client';
import {Card,Empty,Field,Head,Note,Stat,shiftDay} from './components';

const scopeNames:Record<string,string>={
 'nutrition.signal.publish':'Share minimal observed nutrition signals',
 'nutrition.schedule.propose':'Send proposals to Kernel Daily Operating Plan',
 'nutrition.context.fitness':'Receive workout-duration projection',
 'nutrition.context.finance':'Receive food-budget headroom projection',
 'nutrition.context.calendar':'Receive approved meal-window projection',
 'nutrition.context.health':'Receive clinical-review-required safety flag',
 'nutrition.context.family':'Validate family sharing authority'
};
export default function KernelScreen({p}:{p:LiveProps}){
 const {status,context,proposals}=p.data.kernel;
 const plans=p.data.plans.filter(x=>x.status==='approved');
 const canPropose=status.active&&status.grants.some(x=>x.scope==='nutrition.schedule.propose'&&x.granted);
 const [planId,setPlanId]=useState(''),[day,setDay]=useState(p.date),
 [startTime,setStart]=useState('12:30'),[endTime,setEnd]=useState('13:00'),
 [reason,setReason]=useState<'meal_preparation'|'meal_break'|'grocery_trip'>('meal_break');
 const chosen=plans.find(x=>x.id===planId);
 const start=chosen?dateOnly(chosen.week_start):'';
 const validDay=Boolean(start&&day>=start&&day<=shiftDay(start,6));
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!canPropose||!validDay)return;
  await p.perform(()=>p.client.post('/kernel/proposals',{planId,day,startTime,endTime,reason}),
   'Proposal recorded locally. The Kernel has not yet accepted this Daily Operating Plan request.');
 }
 const approved=proposals.filter(x=>x.state==='accepted').length;
 return <div className="lv-page">
  <Head icon={Signpost} tag="HUMAN KERNEL GOVERNANCE" title="Human Kernel Integration"
   description="Kernel-managed lifecycle and consent; narrowly scoped, expiring external signals. Nutrition OS never becomes the global identity, Human State or schedule authority."/>
  <div className="lv-stats">
   <Stat icon={ShieldCheck} title="Engine lifecycle" value={status.engineState} detail={status.active?'Signed authority lease current':'No current enablement assertion'}/>
   <Stat icon={LockKeyhole} title="Service trust" value={status.bridgeConfigured?'Configured':'Unconfigured'} detail="Distinct Kernel-signed service JWT required"/>
   <Stat icon={Users} title="Granted scopes" value={String(status.grants.filter(s=>s.granted).length)} detail="Current, individually granted and expiring"/>
   <Stat icon={CalendarDays} title="Schedule decisions" value={String(approved)} detail="Only Kernel can accept proposals"/>
  </div>
  <Note warn>{status.notice} No live HumanKernelOS transport is certified for this deployment. Domain integrations remain disabled until an independent Kernel service is configured and verified.</Note>
  <div className="lv-grid-two">
   <Card title="Kernel consent and lifecycle" detail="This panel is read-only. Permissions cannot be granted from Nutrition OS.">
    <div className="lv-rows">{status.grants.map(grant=><div className="lv-row" key={grant.scope}><span className="lv-emojibox">{grant.granted?'✓':'⊘'}</span><span><strong>{scopeNames[grant.scope]??grant.scope}</strong><small>{grant.scope}</small><small>{grant.expiresAt?'Lease expires '+new Date(grant.expiresAt).toLocaleString('en-KE'):'No Kernel grant asserted'}</small></span><strong className={grant.granted?'lv-positive':'lv-negative'}>{grant.granted?'Granted':'Not granted'}</strong></div>)}</div>
    <p className="lv-help">To install, enable, revoke or change consent, use the authoritative HumanKernelOS Platform Studio. This screen cannot self-approve its own integration.</p>
   </Card>
   <Card title="Authorized cross-engine context" detail="All values are minimal projections, not other engines' original records.">
    {!context.sources.length?<Empty title="No current external projections" description="No signed, consented, nonexpired event has been ingested. Missing data is not treated as an absence of need or an automatic optimization."/>:
     <div className="lv-rows">{context.sources.map(source=>{
      const value=context.context[source];return <div className="lv-row" key={source}><span className="lv-emojibox">⌁</span><span><strong>{source.toUpperCase()} · {value.key.replaceAll('_',' ')}</strong>
       <small>Source observed {new Date(value.observedAt).toLocaleString('en-KE')} · expires {new Date(value.expiresAt).toLocaleString('en-KE')}</small>
       <small>{value.key==='clinical_review_required'?'Clinical review required: '+String(value.value):value.key==='food_budget_headroom_kes'?'KES headroom projection: '+String(value.value):value.key==='last_workout_duration_minutes'?'Recorded workout duration projection: '+String(value.value)+' min':'Authorized availability window'}</small></span></div>;
     })}</div>}
    <Note><strong>Minimum-necessary data:</strong> Nutrition OS does not copy raw diagnoses, private medical histories, financial transactions, complete calendar events or other members' nutrition records.</Note>
   </Card>
  </div>
  <div className="lv-grid-two">
   <Card title="Propose to the Daily Operating Plan" detail="An explicit intent, NOT an accepted or calendar-authoritative schedule.">
    {!canPropose?<Empty title="Schedule proposal permission not granted" description="Kernel must enable this engine and explicitly grant nutrition.schedule.propose. The UI cannot override the missing permission."/>:
     <form className="lv-form" onSubmit={submit}>
      <Field title="Approved personal meal plan"><select value={planId} onChange={e=>{setPlanId(e.target.value);const plan=plans.find(p=>p.id===e.target.value);if(plan)setDay(dateOnly(plan.week_start));}} required><option value="">Select approved plan</option>{plans.map(plan=><option key={plan.id} value={plan.id}>{dateOnly(plan.week_start)} · {plan.entries.length} meals</option>)}</select></Field>
      <div className="lv-form-grid"><Field title="Proposed day"><input type="date" value={day} min={start||undefined} max={start?shiftDay(start,6):undefined} required onChange={e=>setDay(e.target.value)}/></Field><Field title="Intent type"><select value={reason} onChange={e=>setReason(e.target.value as typeof reason)}><option value="meal_break">Meal break</option><option value="meal_preparation">Meal preparation</option><option value="grocery_trip">Grocery shopping window</option></select></Field></div>
      <div className="lv-form-grid"><Field title="Start time"><input required type="time" value={startTime} onChange={e=>setStart(e.target.value)}/></Field><Field title="End time"><input required type="time" value={endTime} onChange={e=>setEnd(e.target.value)}/></Field></div>
      <button type="submit" className="primary-button" disabled={!validDay||startTime>=endTime||p.busy}>Submit to Kernel proposal queue <ArrowRight size={15}/></button>
      <p className="lv-help">A real Kernel Event Mesh consumer is not connected yet. Submitted proposals remain pending until an independently signed decision is received.</p>
     </form>}
   </Card>
   <Card title="Kernel decision ledger" detail="Only Kernel-signed decisions can change proposal status.">
    {!proposals.length?<Empty title="No Kernel proposals recorded" description="Proposals are not generated from demo plans. They require an actual approved plan and explicit consent."/>:
     <div className="lv-rows">{proposals.map(pr=><div className="lv-row" key={pr.id}><Clock size={18}/><span><strong>{pr.rationale_code.replaceAll('_',' ')} · {dateOnly(pr.proposed_day)}</strong>
       <small>{pr.start_time.slice(0,5)}–{pr.end_time.slice(0,5)} · {pr.state.toUpperCase()}</small>
       <small>{pr.kernel_decision_id?'Kernel decision ID '+pr.kernel_decision_id.slice(0,8):'Kernel has not decided this proposal'}</small></span>
       {pr.state==='accepted'?<CheckCircle2 size={18}/>:pr.state==='revoked'?<AlertTriangle size={18}/>:<Clock size={18}/>}</div>)}</div>}
   </Card>
  </div>
 </div>;
}
