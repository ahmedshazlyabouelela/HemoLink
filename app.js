/* HemoLink. Local, deterministic case analysis; no external API calls. */
(() => {
  'use strict';
  const S=window.HemoSolver,$=s=>document.querySelector(s);
  const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=(v,d=1)=>Number.isFinite(v)?new Intl.NumberFormat('en-US',{maximumFractionDigits:d}).format(Math.abs(v)<1e-8?0:v):v===Infinity?'∞':'—';
  const iconPaths={
    overview:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
    lab:'M9 3h6 M10 3v6l-6 10a1.4 1.4 0 0 0 1.2 2h13.6a1.4 1.4 0 0 0 1.2-2L14 9V3 M7 15h10',
    steps:'M8 4h13 M8 12h13 M8 20h13 M3 4h.01 M3 12h.01 M3 20h.01',
    shield:'M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7Z M8 12l3 3 5-6',
    report:'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z M14 2v6h6 M8 13h8 M8 17h6',
    download:'M12 3v12 M7 10l5 5 5-5 M4 16v5h16v-5',
    arrow:'M4 12h16 M15 7l5 5-5 5',
    check:'M5 12l4 4L19 6',
    chevron:'M9 5l7 7-7 7',
    help:'M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2-3 4 M12 17h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
    reset:'M3 10a9 9 0 1 1 2 9 M3 3v7h7',
    cost:'M12 2v20 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
    box:'M3 7l9-4 9 4-9 4Z M3 7v10l9 4 9-4V7 M12 11v10 M7 5l10 4',
    drop:'M12 3C9 8 5 11 5 15a7 7 0 0 0 14 0c0-4-4-7-7-12Z M8 15a4 4 0 0 0 4 4',
    capacity:'M4 7h16v14H4z M8 7V3h8v4 M8 12h8 M8 16h5',
    trend:'M3 17l6-6 4 4 8-10 M15 5h6v6',
    edit:'M14 5l5 5 M4 20l4-1L20 7a2 2 0 0 0-4-4L4 15Z',
    screen:'M3 4h18v13H3z M8 21h8 M12 17v4',
    close:'M6 6l12 12 M18 6 6 18',
    menu:'M3 6h18 M3 12h18 M3 18h18',
    play:'M8 4l12 8-12 8Z',
    pause:'M8 4v16 M16 4v16',
    warning:'M12 3 2 21h20Z M12 9v5 M12 17h.01',
    printer:'M6 9V3h12v6 M6 18H3V9h18v9h-3 M6 14h12v7H6z M17 12h.01',
    upload:'M12 16V3 M7 8l5-5 5 5 M4 16v5h16v-5',
    settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2'
  };
  const I=name=>`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${iconPaths[name]||iconPaths.overview}"></path></svg>`;
  const navItems=[['overview','overview','Overview'],['scenarios','lab','Scenario lab'],['methods','steps','Method studio'],['audit','shield','Model & audit'],['report','report','Report & exports']];
  let saved=null;try{saved=JSON.parse(localStorage.getItem('hemolink-studio-v1'));}catch{}
  const hydrate=p=>{const q=S.clone(p);q.upper=q.upper.map(row=>row.map(v=>v===null?Infinity:v));q.realRows=4;q.realCols=6;return q;};
  let initialData=S.clone(S.BASE);try{if(saved?.data){initialData=hydrate(saved.data);if(initialData.cost.length!==4||initialData.cost[0].length!==6)throw Error();S.validate(initialData);}}catch{initialData=S.clone(S.BASE);}
  const state={data:initialData,config:{...S.DEFAULT,...saved?.config},draft:{...S.DEFAULT,...saved?.config},view:'overview',method:'LCM',phase:'modi',step:1,selected:[2,3],run:null,error:null,presentation:false,playing:false};
  let timer=null,toastTimer=null,scenarioCache=null,frontierCache=null;
  const sameConfig=(a,b)=>Object.keys(S.DEFAULT).every(k=>a[k]===b[k]);
  const presetFor=c=>S.PRESETS.find(p=>sameConfig(c,{...S.DEFAULT,...p.config}));
  const dirty=()=>!sameConfig(state.config,state.draft);
  const isOriginalData=()=>JSON.stringify(state.data.cost)===JSON.stringify(S.BASE.cost)&&JSON.stringify(state.data.supply)===JSON.stringify(S.BASE.supply)&&JSON.stringify(state.data.demand)===JSON.stringify(S.BASE.demand);
  function persist(){try{localStorage.setItem('hemolink-studio-v1',JSON.stringify({data:state.data,config:state.config}));}catch{}}
  function toast(text){$('#toast').textContent=text;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3000);}
  function stop(){if(timer)clearInterval(timer);timer=null;state.playing=false;}
  function apply(config=state.draft,announce=true){
    stop();state.config={...config};state.draft={...config};state.step=1;state.error=null;state.selected=[2,3];frontierCache=null;
    try{const p=S.build(state.config,state.data);p.name=presetFor(state.config)?.label||'Custom scenario';state.run=S.solve(p);}catch(e){state.run=null;state.error=e.message;}
    persist();render();if(announce)toast(state.run?.feasible?'Plan calculated and certified.':state.run?'This network is infeasible. Review its route constraints.':'Please review the case inputs.');
  }
  function header(title,subtitle,eyebrow='HEMOLINK / OPERATIONS STUDIO'){
    return `<header class="page-header"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${subtitle}</p></div><div class="page-actions"><button class="button export-button" data-action="export-csv" ${!state.run?.feasible?'disabled':''}>${I('download')}Export CSV</button><button class="button primary" data-action="presentation">${I('screen')}Presentation mode</button></div></header>`;
  }
  function shell(content){
    const current=navItems.find(n=>n[0]===state.view),r=state.run,good=r?.feasible;
    return `<div class="layout"><aside class="sidebar" id="sidebar"><a class="brand" href="#overview" data-view="overview" aria-label="HemoLink home"><span class="brand-symbol"><svg viewBox="0 0 30 36" aria-hidden="true"><path d="M15 1C11 9 3 16 3 23a12 12 0 0 0 24 0C27 16 19 9 15 1Z"/></svg></span><span><span class="brand-name">HemoLink</span><span class="brand-caption" style="display:block">Distribution studio</span></span></a><div class="nav-label">WORKSPACE</div><nav aria-label="Main navigation">${navItems.map(([id,icon,label])=>`<button class="nav-link ${state.view===id?'active':''}" data-view="${id}" ${state.view===id?'aria-current="page"':''}>${I(icon)}${label}${state.view===id?`<span class="chevron">${I('chevron')}</span>`:''}</button>`).join('')}</nav><div class="sidebar-divider"></div><div class="nav-label">PROJECT RESOURCES</div><a class="nav-link" href="assets/HemoLink_Complete_Project.ipynb" download>${I('report')}Project notebook</a><a class="nav-link" href="assets/HemoLink_Offline.zip" download>${I('download')}Offline dashboard</a><button class="nav-link" data-action="guide">${I('help')}How to use · الدليل</button><div class="sidebar-footer"><div class="simulation-mark"><span class="status-dot"></span>Simulation workspace</div><p>Operations Research project<br>One product. One delivery round.<br>Provided dataset is synthetic.</p></div></aside><div class="workspace"><div class="topbar"><div class="breadcrumb"><button class="icon-button mobile-nav" data-action="mobile-nav" aria-label="Open navigation">${I('menu')}</button><span>Workspace</span><span>/</span><strong>${esc(current[2])}</strong></div><div class="top-actions"><span class="badge ${good?'green':'red'}">${good?I('shield'):I('warning')}${good?'Optimality certified':'Review required'}</span><span class="badge neutral">SYNTHETIC CASE</span><span class="top-rule"></span><button class="icon-button" data-action="guide" aria-label="Open usage guide">${I('help')}</button><span class="avatar" title="Operations Research">OR</span></div></div><main class="main" id="main">${content}<footer class="footer"><span><strong>HemoLink</strong> · Medical transportation optimization</span><span>Local calculations · Single-round model · Synthetic teaching data</span></footer></main></div></div>${state.presentation?'<button class="exit-presentation" data-action="presentation">Exit presentation · Esc</button>':''}`;
  }
  function alerts(){
    if(state.error)return `<div class="alert">${I('warning')}<div><h3>Unable to calculate this case</h3><p>${esc(state.error)} Use valid whole-unit stock and demand values, or restore the base case.</p></div></div>`;
    if(!state.run?.feasible)return `<div class="alert">${I('warning')}<div><h3>The route network cannot fulfill all requests</h3><p>Demand is ${fmt(state.run?.check.required)} units, but the maximum assignable flow is ${fmt(state.run?.check.maxFlow)}. No optimal shipment plan is reported. Equal totals alone cannot overcome blocked or insufficient routes.</p></div></div>`;
    if(state.run.metrics.unmet)return `<div class="alert" style="background:#fff8e9;border-color:#f1dfb9;color:#9b732f">${I('warning')}<div><h3>${fmt(state.run.metrics.unmet)} requested units remain unmet</h3><p>The dummy source records this shortfall; it is not a blood delivery. Physical transport costs ${fmt(state.run.metrics.transport)} EGP. The objective of ${fmt(state.run.metrics.objective)} EGP also includes ${fmt(state.run.metrics.penalty)} EGP in stated shortage-policy penalties.</p></div></div>`;
    return '';
  }
  function kpis(){
    const r=state.run;if(!r?.feasible)return '';
    const {metrics:m,problem:p,final:f}=r,flow=f.x[2][3],cap=p.upper[2][3],baseline=r.comparison.find(c=>c.method==='NWC'),saving=baseline?.saving||0;
    const cards=[
      ['Transport cost',fmt(m.transport),'EGP','cost','',m.penalty?`Objective ${fmt(m.objective)} EGP incl. penalty`:`${fmt(saving)} EGP below the NWC start`,false],
      ['Blood units delivered',fmt(m.delivered),'units','drop','blue',m.retained?`${fmt(m.retained)} units retained at banks`:`${fmt(m.realDemand)} units requested this round`,false],
      ['Request coverage',fmt(m.coverage),'%','shield','teal',m.unmet?`${fmt(m.unmet)} units recorded as unmet`:'All real hospital requests fulfilled',true],
      ['Cold-chain lane',`${fmt(flow)}<span style="font-size:20px;margin-left:2px">/ ${fmt(cap)}</span>`,'units','capacity','amber',`${flow>=cap-S.EPS?'At capacity':'Spare capacity available'} · B3 → H4`,true]
    ];
    return `<section class="kpi-grid" aria-label="Plan summary">${cards.map(([label,value,unit,icon,color,foot,bar],i)=>`<article class="kpi"><div class="kpi-top"><span class="kpi-label">${label}</span><span class="kpi-icon ${color}">${I(icon)}</span></div><div class="kpi-value number">${value}<span>${unit}</span></div>${bar?`<div class="progress-track ${i===3?'amber':''}"><span style="width:${Math.min(100,Math.max(0,i===3?(cap?flow/cap*100:0):m.coverage))}%"></span></div>`:''}<div class="kpi-foot ${i===0&&saving>0?'positive':''}">${i===0?I('trend'):''}${foot}</div></article>`).join('')}</section>`;
  }
  function network(){
    const r=state.run;if(!r?.feasible)return `<section class="panel network-panel"><div class="empty-state"><h2 style="color:white">No feasible shipment plan</h2><p style="color:#9db1cb">Restore a qualified service or an adequate capacity before optimizing. The infeasibility example is intentionally blocked.</p><button class="button" data-preset="base">Restore base configuration</button></div></section>`;
    const p=r.problem,x=r.final.x,m=p.supply.length,n=p.demand.length,ys=(count,i)=>55+(count>1?i*285/(count-1):142);
    const lines=[],nodes=[];
    for(let i=0;i<m;i++)for(let j=0;j<n;j++){
      const used=x[i][j]>S.EPS,blocked=p.upper[i][j]===0,capped=Number.isFinite(p.upper[i][j])&&!blocked,dummy=i>=p.realRows||j>=p.realCols;
      if(!used&&!blocked&&!capped)continue;
      const d=`M168 ${ys(m,i)} C340 ${ys(m,i)} 474 ${ys(n,j)} 646 ${ys(n,j)}`,id=`edge-${i}-${j}`;
      const selected=state.selected[0]===i&&state.selected[1]===j;
      const color=blocked?'#ed6c86':dummy?'#f2ad6e':capped?'#e9b05c':'#46bda8';
      const width=used?1.4+Math.min(4,x[i][j]/10):1.5;
      lines.push(`<g tabindex="0" role="button" aria-label="${esc(p.sources[i]+' to '+p.hospitals[j]+', '+fmt(x[i][j])+' units'+(blocked?', prohibited':''))}" data-route="${i},${j}"><path class="route-hit" d="${d}"/><path id="${id}" class="route-line" d="${d}" fill="none" stroke="${color}" stroke-width="${selected?width+1:width}" opacity="${selected ? 1 : blocked ? 0.55 : used ? 0.58 : 0.25}" ${blocked||dummy?'stroke-dasharray="5 6"':''}/>${used&&!dummy?`<circle class="flow-dot" r="2.3" fill="${color}"><animateMotion path="${d}" dur="${2.6+(i+j)*.25}s" repeatCount="indefinite"/></circle>`:''}<title>${esc(p.sources[i])} → ${esc(p.hospitals[j])}: ${fmt(x[i][j])} units${blocked?' · PROHIBITED':''}${capped?' · cap '+fmt(p.upper[i][j]):''}</title></g>`);
    }
    for(let i=0;i<m;i++){
      const dummy=i>=p.realRows,parts=p.sources[i].split(' '),label=dummy?'Unmet demand':parts.slice(1).join(' '),code=dummy?'DUMMY':parts[0];
      nodes.push(`<g><rect x="18" y="${ys(m,i)-22}" width="150" height="44" rx="9" fill="${dummy?'#3c3040':'#203753'}" stroke="${dummy?'#b58369':'#36506e'}" ${dummy?'stroke-dasharray="4 3"':''}/><circle cx="34" cy="${ys(m,i)}" r="4" fill="${dummy?'#e3a676':'#5da9be'}"/><text x="46" y="${ys(m,i)-3}" fill="#e4eefb" font-size="10" font-weight="650">${esc(code)} <tspan fill="#9db3cc" font-weight="400">${esc(label)}</tspan></text><text x="46" y="${ys(m,i)+11}" fill="#7d97b4" font-size="8">${dummy?'Accounting only':'Stock this round'}</text><text x="155" y="${ys(m,i)+5}" text-anchor="end" fill="#dce8f7" font-size="13" font-weight="650">${fmt(p.supply[i])}</text></g>`);
    }
    for(let j=0;j<n;j++){
      const dummy=j>=p.realCols,parts=p.hospitals[j].split(' '),label=dummy?'Retained stock':parts.slice(1).join(' '),code=dummy?'DUMMY':parts[0],real=sumColumn(x,j,p.realRows),coverage=dummy?true:real>=p.demand[j]-S.EPS;
      nodes.push(`<g><rect x="646" y="${ys(n,j)-21}" width="157" height="42" rx="8" fill="${dummy?'#3c3040':'#1f344e'}" stroke="${dummy?'#b58369':'#34506c'}" ${dummy?'stroke-dasharray="4 3"':''}/><text x="659" y="${ys(n,j)-2}" fill="#e1edfb" font-size="10" font-weight="600">${esc(code)} <tspan font-weight="400" fill="#98b0ca">${esc(label)}</tspan></text><text x="659" y="${ys(n,j)+11}" fill="#7d97b4" font-size="8">${dummy?'Accounting only':fmt(real)+' / '+fmt(p.demand[j])+' units · '+(coverage?'Fulfilled':'Shortfall')}</text><circle cx="787" cy="${ys(n,j)}" r="4" fill="${dummy?'#e3a676':coverage?'#4db7a0':'#f2ad6e'}"/></g>`);
    }
    const [i,j]=state.selected,valid=i<m&&j<n,ii=valid?i:2,jj=valid?j:3,flow=x[ii][jj],cap=p.upper[ii][jj],blocked=cap===0,dummy=ii>=p.realRows||jj>=p.realCols;
    const laneStatus=blocked?'Prohibited':dummy?(ii>=p.realRows?'Unmet demand':'Retained inventory'):Number.isFinite(cap)&&flow>=cap-S.EPS?'Capacity binding':flow>0?'In use':'Unused';
    return `<section class="panel network-panel"><div class="panel-head"><div><h2>Distribution network</h2><p>${m===4?'4 blood banks':`${p.realRows} banks + accounting node`} · ${p.realCols} hospitals · One delivery round</p></div><span class="badge dark">${I('shield')}CERTIFIED PLAN</span></div><div class="network-wrap"><svg class="network-svg" viewBox="0 0 820 390" role="img" aria-label="Schematic of bank-to-hospital allocations; select a lane to inspect it"><text x="18" y="23" font-size="8" fill="#6d89a9" letter-spacing="1.6">BLOOD BANKS / STOCK</text><text x="646" y="23" font-size="8" fill="#6d89a9" letter-spacing="1.6">HOSPITAL REQUESTS</text>${lines.join('')}${nodes.join('')}</svg></div><div class="route-inspector"><div class="route-fact"><label>SELECTED LANE</label><strong>${esc(p.sources[ii].split(' ')[0])} → ${esc(p.hospitals[jj].split(' ')[0])} <span class="tiny">· ${laneStatus}</span></strong></div><div class="route-fact"><label>${dummy?'ACCOUNTED UNITS':'ALLOCATED'}</label><span>${fmt(flow)} units</span></div><div class="route-fact"><label>${dummy?'ACCOUNTING RATE':'UNIT COST'}</label><span>${fmt(p.cost[ii][jj])} EGP</span></div><div class="route-fact"><label>LANE LIMIT</label><span>${blocked?'Unavailable':cap===Infinity?'No extra cap':fmt(cap)+' units'}</span></div></div><div class="network-foot"><div class="legend"><span class="legend-item"><i class="legend-line"></i>Used lane</span><span class="legend-item"><i class="legend-line capped"></i>Capped</span><span class="legend-item"><i class="legend-line blocked"></i>Prohibited</span>${p.dummyKind?'<span class="legend-item" style="color:#e3a676">Dashed dummy flow = accounting</span>':''}</div><span>Schematic · select any lane</span></div></section>`;
  }
  function sumColumn(x,j,max=x.length){let total=0;for(let i=0;i<max;i++)total+=x[i][j];return total;}
  function control(key,label,min,max,step=1,unit=''){
    const v=state.draft[key];return `<div class="range-control"><label class="range-label" for="control-${key}">${label}<output data-output="${key}" for="control-${key}">${fmt(v)}${unit}</output></label><input type="range" id="control-${key}" data-range="${key}" min="${min}" max="${max}" step="${step}" value="${v}" aria-label="${label}"><div class="range-extents"><span>${min}${unit}</span><span>${max}${unit}</span></div></div>`;
  }
  function lab(){
    const selected=presetFor(state.draft)?.id;
    return `<section class="panel lab-panel"><div class="panel-head"><div><h2>Scenario laboratory</h2><p>Change a condition. Recalculate the plan.</p></div>${I('lab')}</div><div class="lab-content"><div class="preset-label"><span>QUICK SCENARIOS</span><button class="button ghost small" data-action="reset-config" title="Restore the base settings">${I('reset')}</button></div><div class="preset-grid">${S.PRESETS.filter(p=>p.id!=='g').map(p=>`<button class="preset-button ${selected===p.id?'active':''}" data-preset="${p.id}" title="${esc(p.description)}">${esc(p.short)}</button>`).join('')}</div><div class="control-divider"></div>${control('capacity','B3 → H4 cold-box capacity',0,35,1,'')}${control('costPct','H4 transport cost increase',0,60,5,'%')}${control('surgeH1','Extra H1 trauma demand',0,45,5,'')}${control('surgeH4','Extra H4 surgery demand',0,30,5,'')}<label class="check-control"><input type="checkbox" data-check="vehicleFailure" ${state.draft.vehicleFailure?'checked':''}>Close B2 → H5 transport service</label><details class="lab-advanced"><summary>More settings${state.draft.extraSupply?' · Stock +'+fmt(state.draft.extraSupply):''}${state.draft.shift?' · Demand shifted':''}${state.draft.disconnected?' · H4 disconnected':''}</summary>${control('extraSupply','Extra B4 stock',0,60,5,'')}${control('shift','Shift H5 demand to H2',0,20,5,'')}<label class="check-control"><input type="checkbox" data-check="disconnected" ${state.draft.disconnected?'checked':''}>Close all real H4 services</label><label class="range-label" for="shortage-policy">Shortage penalty policy</label><select id="shortage-policy"><option value="weighted" ${state.draft.priority==='weighted'?'selected':''}>Weighted: 800 / 600 / 600 / 750 / 650 / 500</option><option value="uniform" ${state.draft.priority==='uniform'?'selected':''}>Uniform: 500 EGP per unmet unit</option></select></details><button class="button primary" data-action="optimize">${I('trend')}Optimize plan</button><p class="dirty-note ${dirty()?'':'hidden'}" data-dirty>Settings changed. Optimize to apply them.</p><p class="lab-bottom-note">B1 → H4 remains prohibited. Dummy flow is reported separately from real delivery.</p></div></section>`;
  }
  function matrixTable(p,x,{interactive=false,loop=null,selected=null}={}){
    return `<table class="shipment-matrix"><thead><tr><th scope="col"></th>${p.hospitals.map(h=>`<th scope="col" title="${esc(h)}">${esc(h.split(' ')[0])}</th>`).join('')}</tr></thead><tbody>${x.map((row,i)=>`<tr><th scope="row" title="${esc(p.sources[i])}">${esc(p.sources[i].split(' ')[0])}</th>${row.map((value,j)=>{
      const blocked=p.upper[i][j]===0,capped=!blocked&&Number.isFinite(p.upper[i][j]),corner=loop?.find(e=>e.cell[0]===i&&e.cell[1]===j),hot=selected&&selected[0]===i&&selected[1]===j;
      const cls=`${interactive?'matrix-button':'matrix-cell'} ${blocked?'blocked':capped?'capped':value>0?'used':''} ${corner?(corner.sign>0?'plus':'minus'):''} ${hot?'entering':''} ${interactive&&state.selected[0]===i&&state.selected[1]===j?'selected':''}`;
      const contents=`${corner?`<span class="corner-sign">${corner.sign>0?'+':'−'}</span>`:''}${blocked?'×':fmt(value)}`;
      return `<td>${interactive?`<button class="${cls}" data-route="${i},${j}" title="${esc(p.sources[i])} to ${esc(p.hospitals[j])}: ${blocked?'prohibited':fmt(value)+' units'}">${contents}</button>`:`<span class="${cls}">${contents}</span>`}</td>`;
    }).join('')}</tr>`).join('')}</tbody></table>`;
  }
  function comparisonPanel(){
    const r=state.run;if(!r?.feasible)return '';
    const max=Math.max(...r.comparison.map(c=>c.initial),1),optimal=r.final.cost;
    return `<section class="panel"><div class="panel-head"><div><h2>Methods, compared</h2><p>Initial feasible allocations → bounded MODI</p></div><span class="badge green">Same optimum</span></div><div class="method-rows">${r.comparison.map(c=>`<div class="method-row"><span class="method-name">${c.method}</span><div class="method-bar-track"><div class="method-bar ${c.method.toLowerCase()}" style="width:${100*c.initial/max}%"></div><span class="optimal-marker" style="left:${100*optimal/max}%" title="Optimal objective"></span></div><span class="method-cost number">${fmt(c.initial)}</span></div>`).join('')}</div><div class="table-wrap"><table class="data-table"><thead><tr><th>METHOD</th><th>INITIAL EGP</th><th>FINAL EGP</th><th>PIVOTS</th></tr></thead><tbody>${r.comparison.map(c=>`<tr><td><strong>${c.method}</strong></td><td>${fmt(c.initial)}</td><td class="emphasis">${fmt(c.final)}</td><td>${c.pivots}</td></tr>`).join('')}</tbody></table></div><div class="panel-note">Deterministic ties + residual-feasibility guard. Bars show the objective; the dashed marker shows its optimum.</div></section>`;
  }
  function overview(){
    const r=state.run;
    return header('Blood distribution overview','A complete view of the allocation, the constraints, and the cost of each decision.')+alerts()+kpis()+`<div class="overview-grid">${network()}${lab()}</div>${r?.feasible?`<div class="bottom-grid">${comparisonPanel()}<section class="panel"><div class="panel-head"><div><h2>Optimal shipment matrix</h2><p>Allocated units · select a cell to inspect its lane</p></div><button class="button ghost small" data-view="audit">Full audit ${I('arrow')}</button></div>${matrixTable(r.problem,r.final.x,{interactive:true})}<div class="matrix-footer"><span><span class="positive">●</span> Used · <span style="color:var(--amber)">●</span> Capped · <span class="negative">×</span> Prohibited</span><span>${S.shipments(r.problem,r.final.x).length} occupied cells</span></div></section></div>`:''}`;
  }

  function analyses(){
    const signature=JSON.stringify(state.data);
    if(scenarioCache?.signature===signature)return scenarioCache.rows;
    const rows=S.PRESETS.map(p=>{try{return {...p,run:S.solve(S.build({...S.DEFAULT,...p.config},state.data))};}catch(e){return {...p,run:{feasible:false,error:e.message}};}});
    scenarioCache={signature,rows};return rows;
  }
  function frontier(){
    const signature=JSON.stringify([state.data,state.config]);
    if(frontierCache?.signature===signature)return frontierCache;
    const points=[];
    for(let capacity=0;capacity<=35;capacity++){
      const run=S.solve(S.build({...state.config,capacity},state.data),['VAM']);
      if(run.feasible)points.push({capacity,cost:run.final.cost});
    }
    const best=points.length?Math.min(...points.map(p=>p.cost)):null;
    frontierCache={signature,points,best,first:points.find(p=>Math.abs(p.cost-best)<S.EPS)?.capacity};return frontierCache;
  }
  function capacityChart(){
    const f=frontier();if(!f.points.length)return `<div class="empty-state"><p>None of the tested capacities can restore feasibility. Reopen an eligible service or review the requests.</p></div>`;
    const W=650,H=255,pad={l:55,r:18,t:20,b:39},lo=Math.min(...f.points.map(p=>p.cost)),hi=Math.max(...f.points.map(p=>p.cost)),span=hi-lo||10;
    const min=lo-span*.1,max=hi+span*.1,xx=v=>pad.l+v/35*(W-pad.l-pad.r),yy=v=>H-pad.b-(v-min)/(max-min)*(H-pad.b-pad.t);
    const line=f.points.map((p,i)=>(i?'L':'M')+xx(p.capacity).toFixed(2)+' '+yy(p.cost).toFixed(2)).join(' ');
    const area=line+` L${xx(f.points.at(-1).capacity)} ${H-pad.b} L${xx(f.points[0].capacity)} ${H-pad.b}Z`;
    const yTicks=Array.from({length:4},(_,i)=>min+(max-min)*i/3),xTicks=[0,10,20,30,35];
    return `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Optimal objective as the B3-H4 capacity varies from 0 to 35 units"><defs><linearGradient id="capacity-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#429dbe" stop-opacity=".18"/><stop offset="100%" stop-color="#429dbe" stop-opacity=".01"/></linearGradient></defs>${yTicks.map(v=>`<line x1="${pad.l}" x2="${W-pad.r}" y1="${yy(v)}" y2="${yy(v)}" stroke="#e8edf4"/><text x="${pad.l-10}" y="${yy(v)+3}" text-anchor="end" font-size="9" fill="#93a0b2">${fmt(v,0)}</text>`).join('')}<path d="${area}" fill="url(#capacity-fill)"/><path d="${line}" fill="none" stroke="#3489aa" stroke-width="2.5"/><line x1="${xx(state.config.capacity)}" x2="${xx(state.config.capacity)}" y1="${pad.t}" y2="${H-pad.b}" stroke="#d93652" stroke-dasharray="4 4"/>${f.points.map(p=>`<circle cx="${xx(p.capacity)}" cy="${yy(p.cost)}" r="${p.capacity===state.config.capacity?4:2}" fill="${p.capacity===state.config.capacity?'#d93652':'#3489aa'}"><title>Capacity ${p.capacity}: ${fmt(p.cost)} EGP</title></circle>`).join('')}${xTicks.map(v=>`<text x="${xx(v)}" y="${H-20}" text-anchor="middle" font-size="9" fill="#93a0b2">${v}</text>`).join('')}<text x="${W/2}" y="${H-2}" text-anchor="middle" font-size="9" fill="#8391a4">B3 → H4 cold-box capacity · units per round</text></svg><div class="chart-caption">Best tested objective: <strong>${fmt(f.best)} EGP</strong>, first reached at capacity <strong>${f.first}</strong>. The red line is the applied capacity. Shortage penalties are included when present.</div>`;
  }
  function scenariosView(){
    const rows=analyses(),active=presetFor(state.config)?.id;
    return header('Explore the what-ifs','Compare cost, coverage, and capacity under the same clearly stated case assumptions.')+alerts()+`<div class="scenario-cards">${rows.map(p=>`<button class="scenario-card ${active===p.id?'active':''}" data-preset="${p.id}" aria-label="Apply ${esc(p.label)}"><span class="scenario-letter">${p.id==='base'?'•':p.id.toUpperCase()}</span><h3>${esc(p.label)}</h3><p>${esc(p.id==='base'&&!isOriginalData()?'Current base inputs, one prohibited lane, capacity 18.':p.description)}</p><div class="scenario-cost">${p.run.feasible?fmt(p.run.final.cost):p.run.error?'Input conflict':'Infeasible'} <small>${p.run.feasible?'EGP objective':''}</small></div><span class="badge ${!p.run.feasible?'red':p.run.metrics.unmet?'amber':'green'}">${p.run.feasible?(p.run.metrics.unmet?fmt(p.run.metrics.unmet)+' unmet units':'Full request coverage'):p.run.error?'Review scenario inputs':'No feasible allocation'}</span></button>`).join('')}</div><div class="wide-grid"><section class="panel"><div class="panel-head"><div><h2>Capacity sensitivity</h2><p>Applied scenario · 36 re-optimized capacity levels</p></div><span class="badge blue">0–35 UNITS</span></div><div class="panel-content">${capacityChart()}</div><div class="panel-note">Each point uses bounded MODI and a primal-dual certificate. This curve tests the current scenario, with other inputs held fixed.</div></section><div class="lab-page-controls">${lab()}</div></div><section class="panel section-gap"><div class="panel-head"><div><h2>Scenario comparison ledger</h2><p>Presets are independent changes from this dataset's base.</p></div><button class="button small" data-action="export-scenarios">${I('download')}Export comparisons</button></div><div class="table-wrap"><table class="data-table"><thead><tr><th>SCENARIO</th><th>TRANSPORT EGP</th><th>PENALTY EGP</th><th>OBJECTIVE EGP</th><th>COVERAGE</th><th>UNMET UNITS</th><th>RETAINED</th></tr></thead><tbody>${rows.map(p=>`<tr><td><strong>${esc(p.label)}</strong></td>${p.run.feasible?`<td>${fmt(p.run.metrics.transport)}</td><td>${fmt(p.run.metrics.penalty)}</td><td class="emphasis">${fmt(p.run.metrics.objective)}</td><td>${fmt(p.run.metrics.coverage)}%</td><td class="${p.run.metrics.unmet?'negative':''}">${fmt(p.run.metrics.unmet)}</td><td>${fmt(p.run.metrics.retained)}</td>`:`<td colspan="6" class="negative">${p.run.error?'Input conflict: '+esc(p.run.error):'No feasible plan; excluded from cost comparisons.'}</td>`}</tr>`).join('')}</tbody></table></div><div class="panel-note">A lower transport cost with unmet requests does not mean a better full-service plan. Compare coverage and the full objective together.</div></section>`;
  }
  function studioSnapshot(){
    const r=state.run;if(!r?.feasible)return null;
    const a=r.starts[state.method],b=r.optimized[state.method],history=state.phase==='construct'?a.history:b.history;
    state.step=Math.max(0,Math.min(state.step,history.length));
    const h=state.step?history[state.step-1]:null;
    return {p:r.problem,a,b,history,h,x:h?h.after:state.phase==='construct'?S.matrix(r.problem.supply.length,r.problem.demand.length):(b.history[0]?.before||b.x)};
  }
  function penaltyTable(items,chosen){
    return `<table class="data-table"><thead><tr><th>LINE</th><th>ELIGIBLE COSTS</th><th>PENALTY</th></tr></thead><tbody>${items.map(row=>`<tr ${chosen.includes(row.line)?'style="background:#eaf5f0"':''}><td>${esc(row.line)}</td><td>${row.costs.map(v=>fmt(v)).join(' · ')}</td><td class="emphasis">${fmt(row.penalty)}</td></tr>`).join('')}</tbody></table>`;
  }
  function methodsView(){
    const r=state.run;if(!r?.feasible)return header('Inside the optimization','Follow construction, penalties, and closed-loop improvements.')+alerts()+`<div class="panel empty-state"><h2>A feasible case is needed</h2><p>Restore the base configuration to explore the algorithm.</p><button class="button primary" data-preset="base">Restore base</button></div>`;
    const sn=studioSnapshot(),{p,a,b,history,h,x}=sn,isConstruction=state.phase==='construct';
    const chosen=h?(isConstruction?h.cell:h.entering):null,loop=!isConstruction&&h?h.loop:null;
    const prevCost=h?(isConstruction?S.objective(p,h.before):h.costBefore):isConstruction?0:b.normalizedCost;
    const nextCost=h?(isConstruction?h.cost:h.costAfter):prevCost;
    let details='',right='';
    if(h&&isConstruction){
      const [i,j]=h.cell,room=p.upper[i][j]-h.before[i][j];
      details=`<div class="calculation"><h3>${esc(h.reason)}</h3><p>Chosen lane: <strong>${esc(p.sources[i])} → ${esc(p.hospitals[j])}</strong>.</p><div class="math-box">q<sub>proposed</sub> = min(${fmt(h.sBefore[i])}, ${fmt(h.dBefore[j])}, ${fmt(room)}) = <strong>${fmt(h.proposed)}</strong><br>Committed allocation = <strong>${fmt(h.quantity)} units</strong></div><p>${h.guarded?'The residual-feasibility guard reduced or skipped the proposal so the remaining requests can still be assigned.':'The proposed quantity preserves a feasible remaining network.'}</p><p>Running objective: <strong>${fmt(nextCost)} EGP</strong></p></div>`;
      right=state.method==='VAM'?`<section class="panel"><div class="panel-head"><div><h2>VAM penalties</h2><p>Second-lowest eligible cost − lowest eligible cost</p></div><span class="badge ${h.guarded?'amber':'green'}">${h.guarded?'Guard used':'Feasible step'}</span></div><div class="table-wrap">${penaltyTable(h.rp,h.reason)}${penaltyTable(h.cp,h.reason)}</div><div class="panel-note">One eligible cell receives ∞ priority. Prohibited and full lanes are excluded from penalties.</div></section>`:`<section class="panel"><div class="panel-head"><div><h2>Selection rule</h2><p>${state.method==='LCM'?'Lowest eligible unit cost':'First eligible northwest cell'}</p></div></div><div class="panel-content"><div class="math-box">Unit cost = ${fmt(p.cost[i][j])} EGP<br>Allocated = ${fmt(h.quantity)} units</div><p class="chart-caption">${state.method==='LCM'?'Cost ties favor the larger immediate allocation, followed by source and hospital indices.':'The source and hospital order determines the candidate; costs do not choose the lane.'}</p><div class="note-box">${h.guarded?'A greedy commitment would block the remaining table. The guard preserves feasibility.':'No extra guard adjustment was needed at this step.'}</div></div></section>`;
    } else if(h){
      const [i,j]=h.entering,rc=h.delta[i][j];
      details=`<div class="calculation"><h3>Iteration ${h.iteration} · ${h.enteringStatus==='U'?'Decrease an upper-bound cell':'Increase a zero nonbasic cell'}</h3><p>Entering lane: <strong>${esc(p.sources[i])} → ${esc(p.hospitals[j])}</strong></p><div class="math-box">Δ<sub>${i+1},${j+1}</sub> = ${fmt(p.cost[i][j])} − (${fmt(h.u[i])} + (${fmt(h.v[j])})) = <strong>${fmt(rc)}</strong><br>θ = min(allowable loop steps) = <strong>${fmt(h.theta)}</strong><br>Z = ${fmt(h.costBefore)} + ${fmt(h.theta)} × (${fmt(h.direction*rc)}) = <strong>${fmt(h.costAfter)} EGP</strong></div><p>${h.flip?'Bound flip: the entering arc reaches its opposite bound without replacing a basic arc.':`Leaving lane: ${esc(p.sources[h.leaving[0]])} → ${esc(p.hospitals[h.leaving[1]])}.`}</p><p class="tiny">Plus/minus marks refer to allocation changes at loop corners, not a physical vehicle journey.</p></div>`;
      right=`<section class="panel"><div class="panel-head"><div><h2>Potential values</h2><p>uᵢ + vⱼ = cᵢⱼ on basic arcs</p></div></div><div class="panel-content"><div class="chip-row">${[...h.u.map((v,i)=>['u'+(i+1),v]),...h.v.map((v,j)=>['v'+(j+1),v])].map(([name,v])=>`<span class="potential-chip">${name} = <strong>${fmt(v)}</strong></span>`).join('')}</div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>LOOP CORNER</th><th>SIGN</th><th>BEFORE</th><th>STEP LIMIT</th><th>AFTER</th></tr></thead><tbody>${h.loop.map(({cell:[i,j],sign})=>`<tr><td>${esc(p.sources[i].split(' ')[0])} → ${esc(p.hospitals[j].split(' ')[0])}</td><td class="${sign>0?'positive':'negative'}"><strong>${sign>0?'+':'−'}</strong></td><td>${fmt(h.before[i][j])}</td><td>${fmt(h.limits.find(e=>e.cell[0]===i&&e.cell[1]===j).limit)}</td><td><strong>${fmt(h.after[i][j])}</strong></td></tr>`).join('')}</tbody></table></div><div class="panel-note">Minus cells are limited by current flow. Plus cells are limited by remaining lane capacity.</div></section>`;
    } else if(!isConstruction&&!history.length){
      details=`<div class="calculation"><h3>This initial plan is already optimal</h3><p>${state.method} needs zero improving MODI pivots for this case. The final certificate still checks every cell.</p><button class="button small section-gap" data-phase="construct">Explore its construction</button></div>`;
      right=`<section class="panel"><div class="empty-state">${I('shield')}<h2>Zero pivots. Full proof.</h2><p>The starting allocation passes the bounded reduced-cost conditions. Choose LCM or NWC to inspect any improvements they need.</p></div></section>`;
    } else {details='<div class="calculation"><h3>Ready to step through</h3><p>Use Next or Play to inspect the first operation.</p></div>';right='<section class="panel"><div class="empty-state"><h2>The next step appears here</h2><p>Penalties or MODI potentials will be shown alongside the shipment table.</p></div></section>';}
    return header('The method, made visible','Inspect real allocations, penalty recalculations, potentials, and bounded MODI loops.')+`<section class="panel"><div class="studio-toolbar"><div class="segmented" aria-label="Select method">${['NWC','LCM','VAM'].map(name=>`<button class="${state.method===name?'active':''}" data-method="${name}">${name}</button>`).join('')}</div><div class="segmented" aria-label="Select algorithm phase"><button class="${isConstruction?'active':''}" data-phase="construct">Construction</button><button class="${!isConstruction?'active':''}" data-phase="modi">MODI improvement</button></div><span class="badge green">Final: ${fmt(b.cost)} EGP</span></div>${b.preparation.length?`<div class="panel-note">${b.preparation.length} cycle-removal operation(s) prepare a bounded basis before MODI pivots. Prepared objective: ${fmt(b.normalizedCost)} EGP. This is separate from the pivot counter.</div>`:''}</section><div class="studio-grid section-gap"><section class="panel studio-matrix"><div class="panel-head"><div><h2>${isConstruction?'Initial allocation construction':'Closed-loop allocation update'}</h2><p>Displayed quantities are after the selected step.</p></div><span class="badge neutral">${fmt(prevCost)} → ${fmt(nextCost)} EGP</span></div>${matrixTable(p,x,{loop,selected:chosen})}<div class="step-controls"><button class="icon-button" data-action="step-prev" aria-label="Previous step" ${state.step===0?'disabled':''}>${I('chevron').replace('class="icon"','class="icon" style="transform:rotate(180deg)"')}</button><button class="icon-button" data-action="play" aria-label="${state.playing?'Pause':'Play steps'}" ${!history.length?'disabled':''}>${I(state.playing?'pause':'play')}</button><input type="range" min="0" max="${history.length}" value="${state.step}" data-step-range aria-label="Algorithm step" ${!history.length?'disabled':''}><button class="icon-button" data-action="step-next" aria-label="Next step" ${state.step===history.length?'disabled':''}>${I('chevron')}</button><span class="step-count">${state.step} / ${history.length}</span></div>${details}</section>${right}</div><div class="panel section-gap"><div class="panel-head"><div><h2>Method summary for this scenario</h2><p>Same constraints, different feasible starts.</p></div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>METHOD</th><th>INITIAL EGP</th><th>FINAL EGP</th><th>SAVING EGP</th><th>MODI PIVOTS</th><th>GUARD EVENTS</th></tr></thead><tbody>${r.comparison.map(c=>`<tr><td><strong>${c.method}</strong></td><td>${fmt(c.initial)}</td><td class="emphasis">${fmt(c.final)}</td><td>${fmt(c.saving)}</td><td>${c.pivots}</td><td>${c.guards}</td></tr>`).join('')}</tbody></table></div></div>`;
  }

  function auditView(){
    const r=state.run,p=r?.problem;
    const intro=header('A plan you can prove','Inspect the mathematical model, every constraint, and the final optimality certificate.');
    if(!r?.feasible)return intro+alerts()+`<section class="panel"><div class="empty-state"><h2>Feasibility comes first</h2><p>No optimality certificate is issued for an infeasible network.</p><button class="button primary" data-action="edit-data">${I('edit')}Review case inputs</button></div></section>`;
    const checks=S.audit(p,r.final.x),cert=r.certificate,occupied=S.shipments(p,r.final.x).length,basic=r.final.basis.size;
    return intro+alerts()+`<div class="audit-grid"><article class="panel audit-tile">${I('shield')}<div><strong>${checks.filter(c=>c.passed).length} / ${checks.length} constraints pass</strong><p>Supply, demand, bounds, and whole-unit allocations.</p></div></article><article class="panel audit-tile">${I('check')}<div><strong>${fmt(cert.gap,6)} EGP duality gap</strong><p>Primal ${fmt(r.final.cost)} = dual ${fmt(cert.dual)}.</p></div></article><article class="panel audit-tile">${I('steps')}<div><strong>${basic} basic · ${occupied} occupied</strong><p>A positive upper-bound cell can be nonbasic.</p></div></article></div><div class="wide-grid section-gap"><section class="panel"><div class="panel-head"><div><h2>The transportation model</h2><p>xᵢⱼ is the number of units allocated from bank i to hospital j.</p></div><span class="badge blue">MINIMIZE</span></div><div class="panel-content"><div class="model-formula">min Z = ∑ᵢ ∑ⱼ cᵢⱼ xᵢⱼ</div><ul class="model-list"><li><span>Every source's available stock is accounted for</span><strong>∑ⱼ xᵢⱼ = sᵢ</strong></li><li><span>Every destination's request is accounted for</span><strong>∑ᵢ xᵢⱼ = dⱼ</strong></li><li><span>Nonnegative allocations</span><strong>xᵢⱼ ≥ 0</strong></li><li><span>B1 → H4 is prohibited, including its low tariff</span><strong>x₁₄ = 0</strong></li><li><span>B3 → H4 cold-box capacity</span><strong>x₃₄ ≤ ${fmt(p.upper[2][3])}</strong></li>${state.config.vehicleFailure?'<li><span>B2 → H5 service unavailable in this scenario</span><strong>x₂₅ = 0</strong></li>':''}${state.config.disconnected?'<li><span>All real H4 services unavailable</span><strong>xᵢ₄ = 0</strong></li>':''}</ul><div class="note-box">The supplied case represents one compatible blood product in one delivery round. Supply and demand are balanced with accounting nodes when needed. Whole units follow from integer network data; the implementation also checks them. Balance is a data condition, not an additional shipment constraint.</div></div></section><section class="panel"><div class="panel-head"><div><h2>Case assumptions & inputs</h2><p>${isOriginalData()?'Original synthetic teaching dataset':'Custom values applied to the teaching case'}</p></div><button class="button small" data-action="edit-data">${I('edit')}Edit inputs</button></div><div class="panel-content"><div class="note-box" style="margin-top:0">The B1 → H4 service is assumed unqualified for the selected cold-chain protocol. The B3 → H4 cold box carries at most ${fmt(state.config.capacity)} units per round. These are declared case assumptions.</div><ul class="model-list"><li><span>Real bank supply</span><strong>${fmt(p.supply.slice(0,p.realRows).reduce((a,b)=>a+b,0))} units</strong></li><li><span>Real hospital demand</span><strong>${fmt(r.metrics.realDemand)} units</strong></li><li><span>Balancing treatment</span><strong>${p.dummyKind==='shortage'?'Dummy source':p.dummyKind==='surplus'?'Dummy destination':'Already balanced'}</strong></li><li><span>Shortage policy</span><strong>${state.config.priority==='uniform'?'500 EGP / unit':'Weighted penalties'}</strong></li></ul><p class="chart-caption">Weighted shortage penalties for H1–H6: 800, 600, 600, 750, 650, 500 EGP/unit. These are hypothetical policy weights, not clinical valuations. Retained inventory has zero accounting cost.</p><div class="note-box">No time-window, shelf-life, fleet-routing, or blood-type substitution constraints are claimed. They need additional data and a larger model.</div></div></section></div><div class="bottom-grid section-gap"><section class="panel"><div class="panel-head"><div><h2>Primal feasibility checks</h2><p>Equalities include the balancing node, if present.</p></div><span class="badge green">ALL PASS</span></div><div class="table-wrap"><table class="data-table"><thead><tr><th>CHECK</th><th>ACTUAL</th><th>TARGET</th><th>RESULT</th></tr></thead><tbody>${checks.map(c=>`<tr><td>${esc(c.label)}</td><td>${fmt(c.actual,6)}</td><td>${c.label==='Nonnegative shipments'?'≥ ':''}${fmt(c.target)}</td><td><span class="passed">${I('check')}Pass</span></td></tr>`).join('')}</tbody></table></div></section><section class="panel"><div class="panel-head"><div><h2>Bounded reduced-cost certificate</h2><p>Δᵢⱼ = cᵢⱼ − uᵢ − vⱼ · final VAM → MODI plan</p></div><span class="badge green">${cert.rows.length} CELLS</span></div><div class="scroll-table"><table class="data-table"><thead><tr><th>LANE</th><th>STATUS</th><th>FLOW</th><th>Δ</th><th>RULE</th></tr></thead><tbody>${cert.rows.map(c=>`<tr><td>${esc(p.sources[c.i].split(' ')[0])} → ${esc(p.hospitals[c.j].split(' ')[0])}</td><td><strong>${c.status}</strong></td><td>${fmt(c.x)}</td><td class="${c.status==='U'&&c.delta<0?'positive':''}">${fmt(c.delta)}</td><td>${c.status==='F'?'Excluded':c.status==='B'?'Δ = 0':c.status==='L'?'Δ ≥ 0':'Δ ≤ 0'} ${I('check')}</td></tr>`).join('')}</tbody></table></div><div class="panel-note">B = basic; L = nonbasic at zero; U = nonbasic at capacity; F = prohibited. A negative Δ on a U cell is valid: increasing its flow is unavailable.</div></section></div><section class="panel section-gap"><div class="panel-head"><div><h2>Applied cost matrix</h2><p>EGP per unit; a low cost never overrides a prohibited lane.</p></div><button class="button small" data-action="export-json">${I('download')}Export case JSON</button></div><div class="table-wrap"><table class="data-table"><thead><tr><th>SOURCE / STOCK</th>${p.hospitals.map((h,j)=>`<th>${esc(h.split(' ')[0])} · ${fmt(p.demand[j])}</th>`).join('')}</tr></thead><tbody>${p.cost.map((row,i)=>`<tr><td><strong>${esc(p.sources[i])} · ${fmt(p.supply[i])}</strong></td>${row.map((v,j)=>`<td class="${p.upper[i][j]===0?'negative':''}">${fmt(v)}${p.upper[i][j]===0?' · prohibited':''}</td>`).join('')}</tr>`).join('')}</tbody></table></div><div class="panel-note">Current certificates are computed in this browser. The JavaScript engine was cross-checked against the Python notebook engine and its independent linear-programming benchmark across the supplied cases and random feasible tables.</div></section>`;
  }

  function shipmentRows(r){
    return S.shipments(r.problem,r.final.x).map(q=>`<tr><td>${esc(q.source)}</td><td>${esc(q.hospital)}</td><td>${fmt(q.units)}</td><td>${fmt(q.unitCost)}</td><td>${fmt(q.cost)}</td><td><span class="badge ${q.type==='Delivered blood'?'green':'amber'}">${esc(q.type)}</span></td></tr>`).join('');
  }
  function memo(r){
    const m=r.metrics,initial=r.comparison.map(c=>`${c.method}: ${fmt(c.initial)} EGP`).join('; ');
    return `For ${presetFor(state.config)?.label||'the custom scenario'}, HemoLink allocates ${fmt(m.delivered)} real units against ${fmt(m.realDemand)} requested units (${fmt(m.coverage)}% coverage). Physical transport costs ${fmt(m.transport)} EGP. The full objective is ${fmt(m.objective)} EGP, including ${fmt(m.penalty)} EGP in hypothetical shortage penalties. ${m.unmet?`${fmt(m.unmet)} units remain unmet and are recorded by a dummy source.`:'No requested units remain unmet.'} ${m.retained?`${fmt(m.retained)} units remain in inventory and are recorded by a dummy destination.`:''} The B1–H4 prohibited lane carries zero flow; B3–H4 carries ${fmt(r.final.x[2][3])} units within its ${fmt(r.problem.upper[2][3])}-unit limit. Initial objectives were ${initial}. Bounded MODI reaches the same optimum from all three starts, with a zero primal–dual gap. All figures come from the stated synthetic, single-product, single-round case.`;
  }
  function reportView(){
    const r=state.run;
    const intro=header('Ready for your presentation','Export the case, save the shipment ledger, or print a concise report.');
    const tools=`<div class="chip-row no-print" style="margin:0 0 22px"><button class="button primary" data-action="print">${I('printer')}Print / Save PDF</button><button class="button" data-action="export-json">${I('download')}Export case JSON</button><button class="button" data-action="import-json">${I('upload')}Import case JSON</button><a class="button" href="assets/HemoLink_Complete_Project.ipynb" download>${I('report')}Notebook</a><a class="button" href="assets/HemoLink_Offline.zip" download>${I('download')}Offline kit</a></div>`;
    if(!r?.feasible)return intro+alerts()+tools+`<article class="report-document"><div class="report-brand"><div><div class="eyebrow">HEMOLINK / CASE REPORT</div><h2>Infeasible route network</h2></div><span class="badge red">NO SHIPMENT PLAN</span></div><p>Maximum assignable flow is ${fmt(r?.check.maxFlow)} against ${fmt(r?.check.required)} balanced units. An optimum is not reported. Restore a qualified route or enough capacity before interpreting cost.</p><div class="report-source">Synthetic teaching case · Single product · One delivery round</div></article>`;
    const p=r.problem,m=r.metrics;
    return intro+tools+`<article class="report-document"><div class="report-brand"><div><div class="eyebrow">OPERATIONS RESEARCH / TRANSPORTATION</div><h2>HemoLink</h2><p>${esc(p.name)} · Blood distribution plan</p></div><span class="badge green">${I('shield')}CERTIFIED</span></div><div class="report-stats"><div class="report-stat"><label>TRANSPORT COST</label><strong>${fmt(m.transport)} <small>EGP</small></strong></div><div class="report-stat"><label>FULL OBJECTIVE</label><strong>${fmt(m.objective)} <small>EGP</small></strong></div><div class="report-stat"><label>REAL DEMAND COVERAGE</label><strong>${fmt(m.coverage)}%</strong></div></div><h3>Decision memo</h3><div class="memo">${esc(memo(r))}</div><h3>Method comparison</h3><div class="table-wrap"><table class="data-table"><thead><tr><th>METHOD</th><th>INITIAL EGP</th><th>FINAL EGP</th><th>SAVING</th><th>MODI PIVOTS</th></tr></thead><tbody>${r.comparison.map(c=>`<tr><td><strong>${c.method}</strong></td><td>${fmt(c.initial)}</td><td>${fmt(c.final)}</td><td>${fmt(c.saving)}</td><td>${c.pivots}</td></tr>`).join('')}</tbody></table></div><h3>Final shipment ledger</h3><div class="table-wrap"><table class="data-table"><thead><tr><th>FROM</th><th>TO</th><th>UNITS</th><th>EGP / UNIT</th><th>EGP</th><th>MEANING</th></tr></thead><tbody>${shipmentRows(r)}</tbody></table></div><h3>Model checks</h3><p>Supply and demand equalities, nonnegativity, prohibited services, and finite lane capacities all pass. Final primal objective = ${fmt(r.final.cost)} EGP; dual bound = ${fmt(r.certificate.dual)} EGP; gap = ${fmt(r.certificate.gap,6)} EGP. Whole-unit allocations are verified. Initial methods use deterministic tie-breaking and a residual-feasibility guard; bounded MODI handles upper-bound arcs.</p><p>Shortage penalty: ${fmt(m.penalty)} EGP. Unmet requests: ${fmt(m.unmet)} units. Retained stock: ${fmt(m.retained)} units. Accounting-node allocations are separate from physical deliveries.</p><div class="report-source">Provided values are synthetic teaching data, not observations from real hospitals. One compatible blood product and one delivery round are assumed. All computations run locally in your browser. The accompanying notebook contains the mathematics, calculations, and independent LP validation.</div></article>`;
  }

  function openGuide(){
    const d=$('#guide-dialog');d.innerHTML=`<div class="dialog-head"><div><h2 id="guide-title">How to use HemoLink</h2><p>دليل سريع للاستخدام والعرض قدام الدكتورة</p></div><button class="icon-button" data-action="close-guide" aria-label="Close usage guide">${I('close')}</button></div><div class="dialog-body arabic-guide" lang="ar">${[
      ['ابدأ من Overview','هتلاقي التكلفة، والوحدات اللي اتنقلت فعلًا، ونسبة تغطية الطلب، والطريق المحدود بالسعة. اضغط على أي خط في الشبكة أو خلية في المصفوفة عشان تشوف تفاصيله.'],
      ['جرّب تغيير شرط','اختار سيناريو جاهز من Scenario laboratory، أو حرّك المؤشرات واضغط Optimize plan لتطبيق التغيير. الخط B1 → H4 ممنوع مهما كانت تكلفته قليلة. السعة بتتطبق على B3 → H4.'],
      ['اشرح الخوارزميات خطوة بخطوة','من Method studio اختار NWC أو LCM أو VAM، وبعدها Construction أو MODI improvement. استخدم Next أو Play. في VAM هتشوف حساب الـ penalty، وفي MODI هتشوف u وv والـ loop وحساب θ. في الحالة الأساسية VAM بيبدأ بالحل الأمثل، فمش محتاج تحسين.'],
      ['اعمل مقارنة تقنع','من Scenario lab قارن الحالات، وشوف منحنى التكلفة مع السعة. عند حالة Stock +20 هتلاحظ إن البداية بـ LCM أحسن من VAM؛ VAM مش مضمون يكون الأفضل كل مرة. الحل النهائي بعد التحسين بيتساوى.'],
      ['راجع القيود وعدّل الداتا','من Model & audit شوف معادلات النموذج وكل فحوصات الحل. Edit inputs بيسمح بتعديل التكاليف والمعروض والمطلوب. Save & optimize بيحسب من جديد. ممكن تحفظ الحالة JSON وتستوردها بعدين.'],
      ['جهّز التسليم والعرض','من Report & exports صدّر CSV أو اطبع التقرير واختر Save as PDF من نافذة الطباعة. Presentation mode بيخفي القائمة لعرض أكبر، وEsc بيرجّعها. Offline dashboard بينزّل نسخة تفتحها بعد فك الضغط والضغط مرتين على index.html، من غير تثبيت برامج.']
    ].map(([title,text],i)=>`<div class="guide-step"><span class="guide-number">${i+1}</span><div><h3>${title}</h3><p>${text}</p></div></div>`).join('')}<div class="guide-warning">الداتا الأساسية افتراضية للتعليم. الـ Dummy source بيسجّل طلب غير مغطّى، مش دم اتنقل للمستشفى. والـ Dummy destination بيسجّل مخزون متبقّي. راقب التغطية والـ penalty مع التكلفة، خصوصًا في سيناريو الطوارئ.</div></div>`;d.showModal();
  }
  function openEditor(){
    const d=$('#data-dialog'),p=state.data;
    d.innerHTML=`<div class="dialog-head"><div><h2 id="data-title">Edit case inputs</h2><p>4 banks × 6 hospitals · Synthetic base values before scenario adjustments</p></div><button class="icon-button" data-action="close-data" aria-label="Close input editor">${I('close')}</button></div><form id="case-form" class="dialog-body"><div class="edit-title">Unit transport costs · EGP</div><div class="table-wrap"><table class="edit-table"><thead><tr><th></th>${p.hospitals.map(h=>`<th>${esc(h.split(' ')[0])}</th>`).join('')}</tr></thead><tbody>${p.cost.map((row,i)=>`<tr><th>${esc(p.sources[i].split(' ')[0])}</th>${row.map((v,j)=>`<td><input type="number" required min="0" max="1000000" step="0.1" value="${v}" name="c-${i}-${j}" aria-label="Cost ${esc(p.sources[i])} to ${esc(p.hospitals[j])}"></td>`).join('')}</tr>`).join('')}</tbody></table></div><div class="edit-margin-grid"><div><h3 class="edit-title">Bank supply · whole units</h3>${p.supply.map((v,i)=>`<label>${esc(p.sources[i])}<input type="number" required min="0" max="100000" step="1" value="${v}" name="s-${i}"></label>`).join('')}</div><div><h3 class="edit-title">Hospital demand · whole units</h3>${p.demand.map((v,j)=>`<label>${esc(p.hospitals[j])}<input type="number" required min="0" max="100000" step="1" value="${v}" name="d-${j}"></label>`).join('')}</div></div><div class="note-box">The prohibited B1 → H4 lane stays closed, including if you lower its cost. B3 → H4 capacity and scenario adjustments are applied after these base inputs. Unequal totals are balanced automatically. Labels and product assumptions remain fixed.</div><p class="dialog-error" id="data-error" role="alert"></p><div class="dialog-footer"><button type="button" class="button" data-action="reset-data">Restore supplied data</button><button type="submit" class="button primary">${I('trend')}Save & optimize</button></div></form>`;d.showModal();
  }
  function validateConfig(config){
    const c={...S.DEFAULT,...config};
    for(const k of ['capacity','surgeH1','surgeH4','shift','extraSupply'])if(!Number.isInteger(c[k])||c[k]<0||c[k]>100000)throw Error('Scenario quantities must be whole numbers from 0 to 100,000.');
    for(const [k,max] of Object.entries({capacity:35,costPct:60,surgeH1:45,surgeH4:30,shift:20,extraSupply:60}))if(!Number.isFinite(c[k])||c[k]<0||c[k]>max)throw Error('Scenario settings exceed the dashboard control range for '+k+'.');
    for(const k of ['vehicleFailure','disconnected'])if(typeof c[k]!=='boolean')throw Error('Route flags must be true or false.');
    if(!['weighted','uniform'].includes(c.priority))throw Error('Choose a supported shortage policy.');
    return Object.fromEntries(Object.keys(S.DEFAULT).map(k=>[k,c[k]]));
  }
  function prepareInput(data){
    if(!Array.isArray(data?.cost)||data.cost.length!==4||!data.cost.every(r=>Array.isArray(r)&&r.length===6)||!Array.isArray(data.supply)||data.supply.length!==4||!Array.isArray(data.demand)||data.demand.length!==6)throw Error('The case needs a 4 × 6 cost matrix, 4 supply values, and 6 demand values.');
    const p=S.clone(S.BASE);p.cost=data.cost.map(row=>row.slice());p.supply=data.supply.slice();p.demand=data.demand.slice();
    if(p.cost.flat().some(v=>v>1000000))throw Error('Unit costs cannot exceed 1,000,000 EGP.');
    return S.validate(p);
  }
  function saveEditor(form){
    if(!form.reportValidity())return;
    try{
      const values=new FormData(form),p=S.clone(S.BASE);
      p.cost=p.cost.map((row,i)=>row.map((_,j)=>Number(values.get(`c-${i}-${j}`))));
      p.supply=p.supply.map((_,i)=>Number(values.get(`s-${i}`)));p.demand=p.demand.map((_,j)=>Number(values.get(`d-${j}`)));
      const clean=prepareInput(p);S.build(state.config,clean);state.data=clean;scenarioCache=null;$('#data-dialog').close();apply();
    }catch(e){$('#data-error').textContent=e.message;}
  }
  function download(text,name,type='text/plain;charset=utf-8'){
    const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function csv(rows){return '\uFEFF'+rows.map(row=>row.map(value=>'"'+String(value??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');}
  function exportCsv(){
    const r=state.run;if(!r?.feasible)return;
    download(csv([['From','To','Units','Unit cost EGP','Total EGP','Allocation meaning'],...S.shipments(r.problem,r.final.x).map(q=>[q.source,q.hospital,q.units,q.unitCost,q.cost,q.type])]),'HemoLink_Shipments.csv','text/csv;charset=utf-8');toast('Shipment ledger downloaded.');
  }
  function exportScenarios(){
    download(csv([['Scenario','Feasible','Transport EGP','Penalty EGP','Objective EGP','Coverage %','Unmet units','Retained units'],...analyses().map(p=>[p.label,p.run.feasible,...(p.run.feasible?[p.run.metrics.transport,p.run.metrics.penalty,p.run.metrics.objective,p.run.metrics.coverage,p.run.metrics.unmet,p.run.metrics.retained]:['','','','','',''])])]),'HemoLink_Scenario_Comparison.csv','text/csv;charset=utf-8');toast('Scenario comparisons downloaded.');
  }
  function exportJson(){download(JSON.stringify({schema:'hemolink-case/v1',data:{cost:state.data.cost,supply:state.data.supply,demand:state.data.demand},config:state.config},null,2),'HemoLink_Case.json','application/json');toast('Case file downloaded.');}
  async function importJson(file){
    if(!file)return;
    try{
      if(file.size>500000)throw Error('Choose a HemoLink JSON file smaller than 500 KB.');
      const obj=JSON.parse(await file.text());if(obj.schema!=='hemolink-case/v1')throw Error('Choose a file exported from HemoLink.');
      const data=prepareInput(obj.data),config=validateConfig(obj.config);S.build(config,data);
      state.data=data;scenarioCache=null;apply(config,false);toast(state.run?.feasible?'Case imported and optimized.':'Case imported. Its network is infeasible.');
    }catch(e){toast('Import failed: '+e.message);}
    $('#import-file').value='';
  }
  function render(){
    document.body.classList.toggle('presentation',state.presentation);
    const views={overview,scenarios:scenariosView,methods:methodsView,audit:auditView,report:reportView};
    try{$('#app').innerHTML=shell(views[state.view]());}catch(e){stop();$('#app').innerHTML=shell(header('Review the current inputs','The dashboard could not display this case.')+`<div class="alert">${I('warning')}<div><h3>${esc(e.message)}</h3><p>Restore the supplied data to continue.</p><button class="button" data-action="reset-data">Restore supplied data</button></div></div>`);}
  }
  function navigate(view){
    if(!navItems.some(n=>n[0]===view))return;stop();state.view=view;render();try{history.replaceState(null,'','#'+view);}catch{}window.scrollTo({top:0,behavior:'instant'});
  }
  function togglePlay(){
    if(state.playing){stop();render();return;}
    const sn=studioSnapshot();if(!sn?.history.length)return;
    if(state.step>=sn.history.length)state.step=0;
    state.playing=true;render();timer=setInterval(()=>{state.step++;if(state.step>=studioSnapshot().history.length)stop();render();},1000);
  }
  function markDirty(){
    const note=$('[data-dirty]');if(note)note.classList.toggle('hidden',!dirty());
    document.querySelectorAll('.preset-button').forEach(b=>b.classList.toggle('active',presetFor(state.draft)?.id===b.dataset.preset));
  }
  document.addEventListener('click',event=>{
    if(event.target.closest('a[href="assets/HemoLink_Offline.zip"]')&&location.protocol==='file:'){event.preventDefault();toast('You are already using the offline dashboard. Keep the original ZIP to share it.');return;}
    const el=event.target.closest('[data-view],[data-action],[data-preset],[data-route],[data-method],[data-phase]');if(!el||el.disabled)return;
    if(el.dataset.view){event.preventDefault();navigate(el.dataset.view);return;}
    if(el.dataset.preset){const p=S.PRESETS.find(p=>p.id===el.dataset.preset);if(p)apply({...S.DEFAULT,...p.config});return;}
    if(el.dataset.route){state.selected=el.dataset.route.split(',').map(Number);render();return;}
    if(el.dataset.method){stop();state.method=el.dataset.method;state.step=1;render();return;}
    if(el.dataset.phase){stop();state.phase=el.dataset.phase;state.step=1;render();return;}
    switch(el.dataset.action){
      case 'optimize':apply();break;
      case 'reset-config':apply({...S.DEFAULT});break;
      case 'guide':openGuide();break;
      case 'close-guide':$('#guide-dialog').close();break;
      case 'edit-data':openEditor();break;
      case 'close-data':$('#data-dialog').close();break;
      case 'reset-data':state.data=S.clone(S.BASE);scenarioCache=null;if($('#data-dialog').open)$('#data-dialog').close();apply({...S.DEFAULT});break;
      case 'export-csv':exportCsv();break;
      case 'export-scenarios':exportScenarios();break;
      case 'export-json':exportJson();break;
      case 'import-json':$('#import-file').click();break;
      case 'print':if(state.view!=='report')navigate('report');requestAnimationFrame(()=>window.print());break;
      case 'presentation':state.presentation=!state.presentation;render();toast(state.presentation?'Presentation mode · press Esc to exit.':'Workspace controls restored.');break;
      case 'mobile-nav':$('#sidebar').classList.toggle('open');el.setAttribute('aria-expanded',$('#sidebar').classList.contains('open'));break;
      case 'step-prev':stop();state.step=Math.max(0,state.step-1);render();break;
      case 'step-next':stop();state.step=Math.min(studioSnapshot().history.length,state.step+1);render();break;
      case 'play':togglePlay();break;
    }
  });
  document.addEventListener('input',event=>{
    const el=event.target;
    if(el.dataset.range){state.draft[el.dataset.range]=Number(el.value);const output=document.querySelector(`[data-output="${el.dataset.range}"]`);if(output)output.textContent=fmt(Number(el.value))+(el.dataset.range==='costPct'?'%':'');markDirty();}
  });
  document.addEventListener('change',event=>{
    const el=event.target;
    if(el.dataset.check){state.draft[el.dataset.check]=el.checked;markDirty();}
    if(el.hasAttribute('data-step-range')){stop();state.step=Number(el.value);render();}
    if(el.id==='import-file')importJson(el.files[0]);
    if(el.id==='shortage-policy'){state.draft.priority=el.value;markDirty();}
  });
  document.addEventListener('submit',event=>{if(event.target.id==='case-form'){event.preventDefault();saveEditor(event.target);}});
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&state.presentation&&!document.querySelector('dialog[open]')){state.presentation=false;render();}
    if((event.key==='Enter'||event.key===' ')&&event.target.matches('g[data-route]')){event.preventDefault();state.selected=event.target.dataset.route.split(',').map(Number);render();}
  });
  window.addEventListener('hashchange',()=>navigate(location.hash.slice(1)));
  const first=location.hash.slice(1);if(navItems.some(n=>n[0]===first))state.view=first;
  try{state.config=validateConfig(state.config);}catch{state.config={...S.DEFAULT};}
  apply(state.config,false);
})();
