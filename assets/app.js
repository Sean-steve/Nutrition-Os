(() => {
  'use strict';
  const root = document;
  const sampleMeals = [
    {time:'07:30',type:'Breakfast',icon:'🥑',title:'Eggs, toast & avocado',desc:'2 eggs, wholegrain bread, avocado',energy:'620 kcal',protein:'24g',state:'done'},
    {time:'12:45',type:'Lunch',icon:'🥗',title:'Chicken & rice bowl',desc:'Grilled chicken, rice, vegetables',energy:'720 kcal',protein:'42g',state:'done'},
    {time:'15:30',type:'Snack',icon:'🍌',title:'Yoghurt + banana',desc:'Suggested, not consumed',energy:'280 kcal',protein:'12g',state:'suggested'},
    {time:'19:00',type:'Dinner',icon:'🍛',title:'Chicken & vegetables',desc:'Planned meal, not yet consumed',energy:'520 kcal',protein:'36g',state:'planned'}
  ];
  const recommendationSets = [
    [{name:'Chicken + rice + vegetables',icon:'🍛',cal:'520 kcal',protein:'36g',time:'20 min'}, {name:'Eggs + spinach + rice',icon:'🍳',cal:'480 kcal',protein:'26g',time:'15 min'}, {name:'Beans + avocado bowl',icon:'🥑',cal:'460 kcal',protein:'24g',time:'15 min'}],
    [{name:'Grilled tilapia + sukuma wiki',icon:'🐟',cal:'510 kcal',protein:'39g',time:'25 min'}, {name:'Githeri + yoghurt',icon:'🥣',cal:'470 kcal',protein:'23g',time:'15 min'}, {name:'Chicken + sweet potato',icon:'🍗',cal:'550 kcal',protein:'41g',time:'30 min'}]
  ];
  const nutrientGroups = {
    macros:[['Protein',59,'82 / 140g','#4b9df0'],['Carbs',72,'236 / 325g','#fb923c'],['Fat',66,'57 / 85g','#f7be2a'],['Fiber',48,'14 / 30g','#38c477']],
    micro:[['Iron',65,'Estimated','#4b9df0'],['Calcium',53,'Estimated','#fb923c'],['Vitamin C',80,'Estimated','#f7be2a'],['Folate',42,'Estimated','#38c477']],
    other:[['Hydration',68,'1.7 / 2.5 L','#4b9df0'],['Consistency',67,'4 / 7 days','#fb923c'],['Vegetables',60,'Example target','#f7be2a'],['Energy',80,'1840 / 2300','#38c477']]
  };
  const groceries = [['🍗','Chicken','2 kg · KES 1,200'],['🥚','Eggs','30 pcs · KES 450'],['🥬','Spinach','500 g · KES 120'],['🍅','Tomatoes','1 kg · KES 150']];
  const inventory = [['🍚','Rice','3 kg on hand'],['🥚','Eggs','18 available'],['🥬','Spinach','Use soon'],['🥛','Milk','2 L on hand']];
  let groceryChecked = new Set(); let recommendationIndex = 0; let dateOffset = 0;
  const qs = s => root.querySelector(s);
  const qsa = s => [...root.querySelectorAll(s)];
  let toastTimer;
  function notify(message){const el=qs('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),4300);}
  function detail(title,html){qs('#dialogTitle').textContent=title;qs('#dialogBody').innerHTML=html;qs('#detailDialog').showModal();}
  function plannedInfo(name){detail(name,'This screen is scheduled for a later development phase. Phase 1 includes the complete dashboard visual foundation only. No personal data has been collected.');}
  function renderMeals(){
    qs('#mealsList').innerHTML=sampleMeals.map((m,i)=>'<div class="meal-row"><span class="meal-status '+m.state+'">'+(m.state==='done'?'✓':'')+'</span><span class="meal-time">'+m.time+'<b>'+m.type+'</b></span><span class="meal-thumb" aria-hidden="true">'+m.icon+'</span><div class="meal-copy"><strong>'+m.title+'</strong><p>'+m.desc+'</p><small>'+m.energy+' &nbsp; · &nbsp; '+m.protein+' protein</small></div><button class="subtle-button" data-meal="'+i+'">'+(m.state==='suggested'?'View':'Details')+'</button></div>').join('');
    qsa('[data-meal]').forEach(b=>b.addEventListener('click',()=>{const m=sampleMeals[Number(b.dataset.meal)];detail(m.type,'<strong>'+m.title+'</strong><p>'+m.desc+'</p><p>Illustrative nutrients: '+m.energy+', '+m.protein+' protein.</p><p>Status: '+(m.state==='done'?'Example consumed meal':m.state==='planned'?'Example planned meal':'Suggested only')+'. No changes are saved.</p>');}));
  }
  function renderNutrients(group='macros'){
    qs('#nutrients').innerHTML=nutrientGroups[group].map(([name,value,unit,color])=>'<div class="nutrient"><div class="ring" style="--value:'+value+';--ring-color:'+color+'"><div>'+value+'%</div></div><strong>'+name+'</strong><small>'+unit+'</small></div>').join('');
    qsa('#nutrientTabs button').forEach(b=>b.classList.toggle('selected',b.dataset.tab===group));
  }
  function renderResources(mode='grocery'){
    const source=mode==='grocery'?groceries:inventory;
    qs('#resourceList').innerHTML=source.map(([icon,name,detail],i)=>'<label class="resource-line">'+(mode==='grocery'?'<input type="checkbox" data-check="'+i+'" '+(groceryChecked.has(i)?'checked':'')+' aria-label="Mark '+name+' purchased">':'')+'<span>'+icon+'</span><b>'+name+'</b><small>'+detail+'</small></label>').join('');
    qsa('[data-check]').forEach(input=>input.addEventListener('change',()=>{const i=Number(input.dataset.check);input.checked?groceryChecked.add(i):groceryChecked.delete(i);notify('Preview checklist updated locally; nothing has been saved.');}));
    qsa('#resourceTabs button').forEach(b=>b.classList.toggle('selected',b.dataset.resource===mode));
  }
  function renderRecommendations(){qs('#recommendations').innerHTML=recommendationSets[recommendationIndex].map((r,i)=>'<button class="recommendation" data-rec="'+i+'"><span class="meal-thumb">'+r.icon+'</span><span><strong>'+r.name+'</strong><em>Example option</em><small>'+r.cal+' · '+r.protein+' protein · '+r.time+'</small></span></button>').join('');qsa('[data-rec]').forEach(b=>b.addEventListener('click',()=>{const r=recommendationSets[recommendationIndex][Number(b.dataset.rec)];detail(r.name,'<p>Illustrative nutrition: '+r.cal+', '+r.protein+' protein. Estimated preparation time: '+r.time+'.</p><p>This is not a personalized plan. Recipe, ingredient, allergen and safety checks are planned for later phases.</p>');}));}
  function updateDate(){const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+dateOffset);qs('#dateLabel').textContent=dateOffset===0?'Today · '+new Intl.DateTimeFormat('en-KE',{day:'numeric',month:'short'}).format(d):new Intl.DateTimeFormat('en-KE',{weekday:'short',day:'numeric',month:'short'}).format(d);if(dateOffset!==0)notify('Viewing date navigation only. Example dashboard values are not date-specific.');}
  function ask(question){const text=(question||'').toLowerCase();let response='I can explain the example dashboard, but live conversational AI is not connected in Phase 1.';if(text.includes('protein'))response='Example intake: 82g out of 140g, leaving 58g. These are demonstration values, not your personal targets.';else if(text.includes('dinner')||text.includes('eat'))response='The example dinner options include chicken with rice, eggs with spinach, or beans with avocado. Confirm ingredients and allergies before using a real meal plan.';else if(text.includes('budget')||text.includes('grocery'))response='The illustrative grocery estimate is KES 4,850 against an example KES 5,500 budget.';detail('Nutrition Guide · Preview','<p>'+response+'</p><p><small>No request was sent to an AI provider.</small></p>');}
  renderMeals();renderNutrients();renderResources();renderRecommendations();updateDate();
  qsa('#nutrientTabs button').forEach(b=>b.addEventListener('click',()=>renderNutrients(b.dataset.tab)));
  qsa('#resourceTabs button').forEach(b=>b.addEventListener('click',()=>renderResources(b.dataset.resource)));
  qs('#moreRecommendations').addEventListener('click',()=>{recommendationIndex=(recommendationIndex+1)%recommendationSets.length;renderRecommendations();});
  qs('#optimizeButton').addEventListener('click',()=>detail('Grocery optimization','This action will optimize ingredient quantities, existing inventory, and budget in Phase 3. Current values are only design examples.'));
  qsa('[data-preview]').forEach(b=>b.addEventListener('click',()=>plannedInfo(b.dataset.preview)));
  qsa('[data-recommendation]').forEach(b=>b.addEventListener('click',()=>{qs('#guide').scrollIntoView({behavior:'smooth',block:'start'});notify('Explore the sample dinner options in the Nutrition Guide.');}));
  qsa('.nav-item').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();const page=a.dataset.page;if(page==='Dashboard'){window.scrollTo({top:0,behavior:'smooth'});}else if(page==='AI Nutrition Guide'){qs('#guide').scrollIntoView({behavior:'smooth'});}else plannedInfo(page);qs('.sidebar').classList.remove('open');qs('#menuToggle').setAttribute('aria-expanded','false');}));
  qs('#menuToggle').addEventListener('click',()=>{const open=qs('.sidebar').classList.toggle('open');qs('#menuToggle').setAttribute('aria-expanded',String(open));});
  qs('#previousDay').addEventListener('click',()=>{dateOffset=Math.max(-30,dateOffset-1);updateDate();});
  qs('#nextDay').addEventListener('click',()=>{dateOffset=Math.min(30,dateOffset+1);updateDate();});
  qs('#notificationButton').addEventListener('click',()=>detail('Example notifications','<p>• Suggested snack not confirmed.</p><p>• Check the sample grocery list before dinner.</p><p>No real notifications have been generated.</p>'));
  qs('#searchForm').addEventListener('submit',e=>{e.preventDefault();const val=qs('#searchInput').value.trim();if(!val){notify('Enter a food or recipe to search the demo.');return;}const matches=[...sampleMeals.map(x=>x.title),...groceries.map(x=>x[1])].filter(x=>x.toLowerCase().includes(val.toLowerCase()));detail('Search · Preview',matches.length?'<p>Matching example items:</p><ul>'+matches.map(x=>'<li>'+x+'</li>').join('')+'</ul>':'<p>No matching item in the small example dataset. Full food search is scheduled for a later phase.</p>');});
  qs('#askForm').addEventListener('submit',e=>{e.preventDefault();const value=qs('#askInput').value.trim();if(value)ask(value);else notify('Enter a question first.');});
  qsa('[data-question]').forEach(b=>b.addEventListener('click',()=>ask(b.dataset.question)));
  qs('#closeDialog').addEventListener('click',()=>qs('#detailDialog').close());
  qs('#dialogCloseButton').addEventListener('click',()=>qs('#detailDialog').close());
  document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)&&!e.metaKey&&!e.ctrlKey){e.preventDefault();qs('#searchInput').focus();}});
})();