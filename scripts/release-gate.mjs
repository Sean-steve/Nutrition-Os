#!/usr/bin/env node
import {readFileSync,writeFileSync} from 'node:fs';
const file=new URL('../docs/PHASE_8_RELEASE_EVIDENCE.json',import.meta.url);
const data=JSON.parse(readFileSync(file,'utf8'));
const required=[
 'code_ci','postgres_migrations_rls','security_tests','browser_accessibility',
 'backup_restore_drill','performance_baseline','kernel_identity_provider',
 'kernel_external_engine_install','kernel_event_mesh_delivery','family_authority',
 'nutrition_safety_review','privacy_dpia','production_infrastructure',
 'production_backup_pitr','monitoring_incident_response','staging_e2e',
 'operational_approval','pages_preview'
];
const checks=data.gates??{},blockers=[],malformed=[];
for(const key of required){
 const item=checks[key];
 if(!item||!['verified','blocked','pending'].includes(item.state)){
   malformed.push(key+': absent or invalid gate');blockers.push(key);continue;
 }
 if(item.state!=='verified'){blockers.push(key);continue;}
 if(typeof item.evidence!=='string'||!/^https:\/\/[A-Za-z0-9.-]+\/\S+$/.test(item.evidence)){
  malformed.push(key+': verified requires externally reviewable HTTPS evidence');blockers.push(key);
 }
}
if(Object.keys(checks).some(x=>!required.includes(x)))malformed.push('Unexpected gate key');
const verdict=blockers.length===0&&malformed.length===0?'READY':'NOT_READY';
const result={product:'Nutrition OS',phase:'8',verdict,
 checkedAt:new Date().toISOString(),gateCount:required.length,
 passed:required.filter(x=>!blockers.includes(x)),blocked:blockers,malformed,
 disclaimer:'Evidence links must be independently verified; this gate does not sign clinical, security or production approvals.'};
console.log(JSON.stringify(result,null,2));
if(process.argv.includes('--output')){
 const i=process.argv.indexOf('--output'),out=process.argv[i+1];
 if(!out||!out.endsWith('.json')){console.error('Expected JSON output file');process.exit(2);}
 writeFileSync(out,JSON.stringify(result,null,2)+'\n');
}
if(malformed.length)process.exitCode=2;
else if(process.argv.includes('--require-ready')&&verdict!=='READY')process.exitCode=1;
else if(process.argv.includes('--expect-blocked')&&verdict!=='NOT_READY')process.exitCode=1;
