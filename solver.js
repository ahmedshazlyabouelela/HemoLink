(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.HemoSolver = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const EPS = 1e-7;
  const matrix = (m,n,value=0) => Array.from({length:m},()=>Array(n).fill(value));
  const copy = a => a.map(row=>row.slice());
  const sum = a => a.reduce((s,v)=>s+v,0);
  const key = (i,j) => i+','+j;
  const cell = k => k.split(',').map(Number);
  const compareCell = (a,b) => a[0]-b[0] || a[1]-b[1];
  const BASE = {
    name:'Base', sources:['B1 Central','B2 North','B3 East','B4 South'],
    hospitals:['H1 Trauma','H2 Maternity','H3 Oncology','H4 Surgery','H5 Pediatric','H6 Regional'],
    cost:[[4,6,9,1,12,10],[7,4,8,9,6,11],[9,8,5,3,7,6],[11,9,4,8,5,7]],
    supply:[45,55,50,40], demand:[30,35,40,25,30,30],
    upper:[[Infinity,Infinity,Infinity,0,Infinity,Infinity],
           [Infinity,Infinity,Infinity,Infinity,Infinity,Infinity],
           [Infinity,Infinity,Infinity,18,Infinity,Infinity],
           [Infinity,Infinity,Infinity,Infinity,Infinity,Infinity]],
    realRows:4,realCols:6,dummyKind:null
  };
  const DEFAULT = {capacity:18,costPct:0,surgeH1:0,surgeH4:0,shift:0,extraSupply:0,vehicleFailure:false,disconnected:false,priority:'weighted'};
  const PRESETS = [
    {id:'base',label:'Base plan',short:'Base',description:'190 units, one prohibited lane, capacity 18.',config:{}},
    {id:'a',label:'Fuel cost spike',short:'Cost +20%',description:'H4 tariffs rise by 20%.',config:{costPct:20}},
    {id:'b',label:'Demand shift',short:'Demand shift',description:'H2 +10 units, H5 -10 units.',config:{shift:10}},
    {id:'c',label:'Emergency surge',short:'Surge +25',description:'H1 +15 and H4 +10. Dummy source records unmet requests.',config:{surgeH1:15,surgeH4:10}},
    {id:'d',label:'Extra cold boxes',short:'Capacity 30',description:'Raise B3-H4 capacity from 18 to 30.',config:{capacity:30}},
    {id:'e',label:'Vehicle failure',short:'Lane closed',description:'B2-H5 service becomes unavailable.',config:{vehicleFailure:true}},
    {id:'f',label:'Surplus inventory',short:'Stock +20',description:'B4 stock +20. Dummy destination records retained inventory.',config:{extraSupply:20}},
    {id:'g',label:'Blocked hospital',short:'Infeasible demo',description:'Every H4 incoming lane is closed. Equal totals cannot ensure feasibility.',config:{disconnected:true}}
  ];
  function clone(p) {
    return {...p,cost:copy(p.cost),upper:copy(p.upper),supply:p.supply.slice(),demand:p.demand.slice(),sources:p.sources.slice(),hospitals:p.hospitals.slice()};
  }
  function validate(p) {
    const m=p.cost.length,n=p.cost[0]?.length;
    if(!m||!n||p.supply.length!==m||p.demand.length!==n||p.upper.length!==m) throw Error('Input dimensions do not match.');
    p.cost.forEach((row,i)=>{
      if(row.length!==n||p.upper[i].length!==n) throw Error('Matrix dimensions do not match.');
      row.forEach((c,j)=>{if(!Number.isFinite(c)||c<0) throw Error('Transport costs must be finite and nonnegative.');const u=p.upper[i][j];if(!(u>=0)||!(Number.isInteger(u)||u===Infinity)) throw Error('Lane capacities must be whole units or unlimited.');});
    });
    [...p.supply,...p.demand].forEach(v=>{if(!Number.isInteger(v)||v<0||v>100000) throw Error('Supply and demand must be whole units from 0 to 100,000.');});
    return p;
  }
  function balance(problem,penalties=[800,600,600,750,650,500]) {
    const p=clone(problem),gap=sum(p.supply)-sum(p.demand);
    if(!gap) return p;
    if(gap>0) {
      p.cost.forEach(row=>row.push(0));p.upper.forEach(row=>row.push(Infinity));
      p.demand.push(gap);p.hospitals.push('DUMMY Retained stock');p.dummyKind='surplus';
    } else {
      const penalty=typeof penalties==='number'?p.demand.map(()=>penalties):penalties.slice();
      p.cost.push(penalty);p.upper.push(p.demand.map(()=>Infinity));
      p.supply.push(-gap);p.sources.push('DUMMY Unmet demand');p.dummyKind='shortage';
    }
    return p;
  }
  function build(config={},data=BASE) {
    const c={...DEFAULT,...config},p=clone(data);p.name='HemoLink simulation';
    p.cost.forEach(row=>row[3]=Math.round(row[3]*(1+c.costPct/100)*10)/10);
    p.upper[0][3]=0;p.upper[2][3]=Number(c.capacity);
    p.supply[3]+=Number(c.extraSupply);p.demand[0]+=Number(c.surgeH1);p.demand[3]+=Number(c.surgeH4);
    p.demand[1]+=Number(c.shift);p.demand[4]-=Number(c.shift);
    if(c.vehicleFailure) p.upper[1][4]=0;
    if(c.disconnected) p.upper.forEach(row=>row[3]=0);
    validate(p);
    return balance(p,c.priority==='uniform'?500:[800,600,600,750,650,500]);
  }
  function objective(p,x) {let z=0;for(let i=0;i<x.length;i++)for(let j=0;j<x[0].length;j++)z+=p.cost[i][j]*x[i][j];return z;}
  function feasibility(s,d,u) {
    const m=s.length,n=d.length,N=m+n+2,start=m+n,end=start+1,total=sum(d);
    if(Math.abs(sum(s)-total)>EPS)return {feasible:false,reason:'Supply and demand totals differ.',required:total};
    const cap=matrix(N,N);
    s.forEach((v,i)=>cap[start][i]=v);d.forEach((v,j)=>cap[m+j][end]=v);
    for(let i=0;i<m;i++)for(let j=0;j<n;j++)cap[i][m+j]=Math.min(u[i][j],total);
    const residual=copy(cap);let value=0;
    while(true){
      const parent=Array(N).fill(-1),q=[start];parent[start]=start;
      for(let at=0;at<q.length&&parent[end]<0;at++){
        const a=q[at];for(let b=0;b<N;b++)if(residual[a][b]>EPS&&parent[b]<0){parent[b]=a;q.push(b);if(b===end)break;}
      }
      if(parent[end]<0)break;
      let quantity=Infinity;
      for(let b=end;b!==start;b=parent[b])quantity=Math.min(quantity,residual[parent[b]][b]);
      for(let b=end;b!==start;b=parent[b]){const a=parent[b];residual[a][b]-=quantity;residual[b][a]+=quantity;}
      value+=quantity;
    }
    const x=matrix(m,n);for(let i=0;i<m;i++)for(let j=0;j<n;j++)x[i][j]=cap[i][m+j]-residual[i][m+j];
    return {feasible:Math.abs(value-total)<EPS,maxFlow:value,required:total,x,
      reason:Math.abs(value-total)<EPS?'All requests can be assigned.':'A route or capacity cut prevents full coverage.',
      unmet:d.map((v,j)=>v-sum(x.map(row=>row[j])))};
  }
  function audit(p,x) {
    const checks=[];
    p.supply.forEach((v,i)=>checks.push({label:'Supply · '+p.sources[i],actual:sum(x[i]),target:v,passed:Math.abs(sum(x[i])-v)<EPS}));
    p.demand.forEach((v,j)=>{const a=sum(x.map(row=>row[j]));checks.push({label:'Demand · '+p.hospitals[j],actual:a,target:v,passed:Math.abs(a-v)<EPS});});
    const flat=x.flat();let prohibited=0,excess=0;
    for(let i=0;i<x.length;i++)for(let j=0;j<x[0].length;j++){
      if(p.upper[i][j]===0)prohibited+=x[i][j];
      if(Number.isFinite(p.upper[i][j]))excess=Math.max(excess,x[i][j]-p.upper[i][j]);
    }
    checks.push({label:'Nonnegative shipments',actual:Math.min(...flat),target:0,passed:Math.min(...flat)>=-EPS});
    checks.push({label:'Prohibited-lane flow',actual:prohibited,target:0,passed:Math.abs(prohibited)<EPS});
    checks.push({label:'Capacity excess',actual:excess,target:0,passed:excess<EPS});
    const integral=Math.max(...flat.map(v=>Math.abs(v-Math.round(v))));
    checks.push({label:'Whole blood units',actual:integral,target:0,passed:integral<EPS});
    return checks;
  }
  function assertFeasible(p,x){if(!audit(p,x).every(c=>c.passed))throw Error('A shipment constraint failed.');}
  function safeQuantity(s,d,u,i,j,proposed) {
    const after=q=>{const ss=s.slice(),dd=d.slice(),uu=copy(u);ss[i]-=q;dd[j]-=q;uu[i][j]-=q;return feasibility(ss,dd,uu).feasible;};
    if(after(proposed))return {quantity:proposed,guarded:false};
    const witness=feasibility(s,d,u);if(!witness.feasible)throw Error('Residual table is infeasible.');
    let lo=Math.round(witness.x[i][j]),hi=proposed-1;
    while(lo<hi){const mid=Math.floor((lo+hi+1)/2);if(after(mid))lo=mid;else hi=mid-1;}
    return {quantity:lo,guarded:true};
  }
  function select(p,s,d,u,blocked,method) {
    const cells=[];for(let i=0;i<s.length;i++)for(let j=0;j<d.length;j++)if(s[i]>EPS&&d[j]>EPS&&u[i][j]>EPS&&!blocked.has(key(i,j)))cells.push([i,j]);
    if(!cells.length)throw Error('No eligible lane remains.');
    const room=([i,j])=>Math.min(s[i],d[j],u[i][j]);
    if(method==='NWC')return {cell:cells[0],reason:'First northwest eligible cell',rp:[],cp:[]};
    const cheaper=(a,b)=>p.cost[a[0]][a[1]]-p.cost[b[0]][b[1]]||room(b)-room(a)||compareCell(a,b);
    if(method==='LCM')return {cell:cells.slice().sort(cheaper)[0],reason:'Lowest eligible unit cost',rp:[],cp:[]};
    const rp=[],cp=[],candidates=[];
    for(let axis=0;axis<2;axis++)for(let line=0;line<(axis===0?s.length:d.length);line++){
      const entries=cells.filter(e=>e[axis]===line);if(!entries.length)continue;
      const values=entries.map(([i,j])=>p.cost[i][j]).sort((a,b)=>a-b),penalty=values.length===1?Infinity:values[1]-values[0];
      const best=entries.slice().sort(cheaper)[0],label=axis===0?p.sources[line]:p.hospitals[line];
      const item={line:label,costs:values,smallest:values[0],second:values[1]??null,penalty};
      (axis===0?rp:cp).push(item);
      candidates.push({cell:best,penalty,cost:p.cost[best[0]][best[1]],room:room(best),axis,line,label});
    }
    candidates.sort((a,b)=>(a.penalty===b.penalty?0:(a.penalty>b.penalty?-1:1))||a.cost-b.cost||b.room-a.room||a.axis-b.axis||a.line-b.line);
    const best=candidates[0];return {cell:best.cell,reason:'Largest penalty · '+best.label,rp,cp};
  }
  function initial(p,method='VAM',guard=true) {
    const check=feasibility(p.supply,p.demand,p.upper);if(!check.feasible)throw Error(check.reason);
    const s=p.supply.slice(),d=p.demand.slice(),x=matrix(s.length,d.length),blocked=new Set(),history=[];
    while(sum(s)>EPS){
      if(history.length>4*s.length*d.length)throw Error('Construction iteration limit reached.');
      const remaining=p.upper.map((row,i)=>row.map((v,j)=>v-x[i][j]));
      const chosen=select(p,s,d,remaining,blocked,method),[i,j]=chosen.cell;
      const proposed=Math.round(Math.min(s[i],d[j],remaining[i][j]));
      const {quantity,guarded}=guard?safeQuantity(s,d,remaining,i,j,proposed):{quantity:proposed,guarded:false};
      const before=copy(x),sBefore=s.slice(),dBefore=d.slice();
      x[i][j]+=quantity;s[i]-=quantity;d[j]-=quantity;if(!quantity)blocked.add(key(i,j));
      history.push({...chosen,step:history.length+1,proposed,quantity,guarded,before,after:copy(x),sBefore,dBefore,sAfter:s.slice(),dAfter:d.slice(),cost:objective(p,x)});
    }
    assertFeasible(p,x);return {method,x,cost:objective(p,x),history,guardEvents:history.filter(h=>h.guarded).length};
  }
  class DSU {
    constructor(n){this.p=Array.from({length:n},(_,i)=>i);}
    find(a){while(this.p[a]!==a){this.p[a]=this.p[this.p[a]];a=this.p[a];}return a;}
    join(a,b){a=this.find(a);b=this.find(b);if(a===b)return false;this.p[b]=a;return true;}
  }
  function path(edges,m,n,start,end) {
    const adjacency=Array.from({length:m+n},()=>[]);
    [...edges].map(cell).sort(compareCell).forEach(([i,j])=>{adjacency[i].push([m+j,[i,j]]);adjacency[m+j].push([i,[i,j]]);});
    const parent=new Map([[start,null]]),queue=[start];
    for(let at=0;at<queue.length&&!parent.has(end);at++)for(const [b,e]of adjacency[queue[at]])if(!parent.has(b)){parent.set(b,[queue[at],e]);queue.push(b);}
    if(!parent.has(end))return null;
    const result=[];for(let b=end;b!==start;){const [a,e]=parent.get(b);result.push(e);b=a;}return result.reverse();
  }
  function snap(p,x){for(let i=0;i<x.length;i++)for(let j=0;j<x[0].length;j++){if(Math.abs(x[i][j])<EPS)x[i][j]=0;if(Number.isFinite(p.upper[i][j])&&Math.abs(x[i][j]-p.upper[i][j])<EPS)x[i][j]=p.upper[i][j];}}
  function prepare(p,input) {
    const x=copy(input),m=x.length,n=x[0].length,preparation=[];assertFeasible(p,x);
    for(let count=0;count<m*n+1;count++){
      const forest=new Set(),dsu=new DSU(m+n);let loop=null;
      outer:for(let i=0;i<m;i++)for(let j=0;j<n;j++)if(x[i][j]>EPS&&x[i][j]<p.upper[i][j]-EPS){
        if(dsu.join(i,m+j))forest.add(key(i,j));
        else {loop=[{cell:[i,j],sign:1},...path(forest,m,n,m+j,i).map((e,k)=>({cell:e,sign:k%2?1:-1}))];break outer;}
      }
      if(!loop)break;
      const slope=sum(loop.map(({cell:[i,j],sign})=>sign*p.cost[i][j]));if(slope>EPS)loop.forEach(e=>e.sign*=-1);
      const theta=Math.min(...loop.map(({cell:[i,j],sign})=>sign>0?p.upper[i][j]-x[i][j]:x[i][j]));
      const costBefore=objective(p,x);loop.forEach(({cell:[i,j],sign})=>x[i][j]+=sign*theta);snap(p,x);
      preparation.push({theta,loop,costBefore,costAfter:objective(p,x)});
      if(count===m*n)throw Error('Basis preparation did not finish.');
    }
    const dsu=new DSU(m+n),allowed=new DSU(m+n),basis=new Set();
    for(let i=0;i<m;i++)for(let j=0;j<n;j++)if(p.upper[i][j]>EPS)allowed.join(i,m+j);
    const rank=m+n-new Set(Array.from({length:m+n},(_,i)=>allowed.find(i))).size;
    for(let i=0;i<m;i++)for(let j=0;j<n;j++)if(x[i][j]>EPS&&x[i][j]<p.upper[i][j]-EPS){if(!dsu.join(i,m+j))throw Error('Interior cycle remains.');basis.add(key(i,j));}
    for(let i=0;i<m;i++)for(let j=0;j<n;j++)if(p.upper[i][j]>EPS&&dsu.join(i,m+j))basis.add(key(i,j));
    if(basis.size!==rank)throw Error('Basis rank is inconsistent.');
    return {x,basis,rank,preparation};
  }
  function potentials(p,basis) {
    const m=p.supply.length,n=p.demand.length,a=Array.from({length:m+n},()=>[]),v=Array(m+n).fill(null);
    [...basis].map(cell).sort(compareCell).forEach(([i,j])=>{a[i].push([m+j,p.cost[i][j]]);a[m+j].push([i,p.cost[i][j]]);});
    for(let root=0;root<m+n;root++)if(v[root]===null){v[root]=0;const q=[root];for(let at=0;at<q.length;at++)for(const [b,c]of a[q[at]])if(v[b]===null){v[b]=c-v[q[at]];q.push(b);}}
    const u=v.slice(0,m),vv=v.slice(m),delta=p.cost.map((row,i)=>row.map((c,j)=>c-u[i]-vv[j]));return {u,v:vv,delta};
  }
  function status(p,x,basis,i,j){if(p.upper[i][j]<=EPS)return 'F';if(basis.has(key(i,j)))return 'B';if(Number.isFinite(p.upper[i][j])&&Math.abs(x[i][j]-p.upper[i][j])<EPS)return 'U';if(Math.abs(x[i][j])<EPS)return 'L';throw Error('Nonbasic shipment is not at a bound.');}
  function modi(p,input) {
    const ready=prepare(p,input),{x,basis,rank,preparation}=ready,m=x.length,n=x[0].length,history=[],seen=new Set();let bland=false;
    const normalizedCost=objective(p,x);
    for(let iteration=0;iteration<=2000;iteration++){
      const {u,v,delta}=potentials(p,basis);
      const uppers=[];for(let i=0;i<m;i++)for(let j=0;j<n;j++)if(status(p,x,basis,i,j)==='U')uppers.push(key(i,j));
      const signature=[...basis].sort().join(';')+'|'+uppers.join(';');if(seen.has(signature))bland=true;seen.add(signature);
      const candidates=[];
      for(let i=0;i<m;i++)for(let j=0;j<n;j++){const st=status(p,x,basis,i,j),direction=st==='L'?1:st==='U'?-1:0,rc=direction*delta[i][j];if(direction&&rc< -EPS)candidates.push({cell:[i,j],direction,rc,status:st});}
      if(!candidates.length){assertFeasible(p,x);return {x,cost:objective(p,x),basis,rank,preparation,normalizedCost,history,u,v,delta,bland};}
      if(iteration===2000)throw Error('MODI iteration limit reached.');
      candidates.sort((a,b)=>(bland?0:a.rc-b.rc)||compareCell(a.cell,b.cell));
      const entering=candidates[0],[ei,ej]=entering.cell;
      const trail=path(basis,m,n,m+ej,ei);if(!trail)throw Error('No basis loop exists.');
      const loop=[{cell:entering.cell,sign:entering.direction},...trail.map((e,k)=>({cell:e,sign:k%2?entering.direction:-entering.direction}))];
      const limits=loop.map(({cell:[i,j],sign})=>({cell:[i,j],limit:sign>0?p.upper[i][j]-x[i][j]:x[i][j]}));
      const theta=Math.min(...limits.map(e=>e.limit)),leaving=limits.filter(e=>Math.abs(e.limit-theta)<EPS).map(e=>e.cell).sort(compareCell)[0];
      const before=copy(x),costBefore=objective(p,x),basisBefore=new Set(basis);
      loop.forEach(({cell:[i,j],sign})=>x[i][j]+=sign*theta);snap(p,x);
      const flip=key(...leaving)===key(ei,ej);if(!flip){basis.delete(key(...leaving));basis.add(key(ei,ej));}
      const costAfter=objective(p,x),predicted=theta*entering.rc;
      if(Math.abs(costAfter-costBefore-predicted)>1e-5||costAfter>costBefore+EPS)throw Error('MODI loop cost check failed.');
      assertFeasible(p,x);
      history.push({iteration:iteration+1,entering:entering.cell,enteringStatus:entering.status,direction:entering.direction,
        leaving,flip,theta,loop,limits,before,after:copy(x),costBefore,costAfter,predicted,u,v,delta,basisBefore});
    }
  }
  function certificate(p,result) {
    const {x,basis,delta,u,v}=result,rows=[];let dual=sum(u.map((a,i)=>a*p.supply[i]))+sum(v.map((a,j)=>a*p.demand[j]));
    for(let i=0;i<x.length;i++)for(let j=0;j<x[0].length;j++){
      const st=status(p,x,basis,i,j),rc=delta[i][j],passed=st==='F'||(st==='B'?Math.abs(rc)<EPS:st==='L'?rc>=-EPS:rc<=EPS);
      if(Number.isFinite(p.upper[i][j]))dual+=p.upper[i][j]*Math.min(rc,0);
      rows.push({i,j,status:st,delta:rc,x:x[i][j],upper:p.upper[i][j],passed});
    }
    const gap=objective(p,x)-dual;return {rows,dual,gap,passed:rows.every(r=>r.passed)&&Math.abs(gap)<1e-5&&audit(p,x).every(c=>c.passed)};
  }
  function metrics(p,x) {
    let delivered=0,unmet=0,retained=0,transport=0;
    for(let i=0;i<x.length;i++)for(let j=0;j<x[0].length;j++){
      if(i<p.realRows&&j<p.realCols){delivered+=x[i][j];transport+=x[i][j]*p.cost[i][j];}
      else if(i>=p.realRows&&j<p.realCols)unmet+=x[i][j];
      else if(j>=p.realCols&&i<p.realRows)retained+=x[i][j];
    }
    const realDemand=sum(p.demand.slice(0,p.realCols));return {delivered,unmet,retained,transport,penalty:objective(p,x)-transport,objective:objective(p,x),realDemand,coverage:realDemand?100*delivered/realDemand:100};
  }
  function solve(p,methods=['NWC','LCM','VAM']) {
    validate(p);const check=feasibility(p.supply,p.demand,p.upper);if(!check.feasible)return {feasible:false,problem:p,check};
    const starts={},optimized={},comparison=[];
    for(const method of methods){
      const a=initial(p,method),b=modi(p,a.x),cert=certificate(p,b);
      if(!cert.passed)throw Error('Optimality certificate did not pass.');
      starts[method]=a;optimized[method]=b;comparison.push({method,initial:a.cost,final:b.cost,saving:a.cost-b.cost,pivots:b.history.length,guards:a.guardEvents,preparation:b.preparation.length});
    }
    const final=optimized.VAM||optimized[methods[0]];
    return {feasible:true,problem:p,check,starts,optimized,comparison,final,certificate:certificate(p,final),metrics:metrics(p,final.x)};
  }
  function shipments(p,x) {
    const rows=[];for(let i=0;i<x.length;i++)for(let j=0;j<x[0].length;j++)if(x[i][j]>EPS)rows.push({i,j,source:p.sources[i],hospital:p.hospitals[j],units:x[i][j],unitCost:p.cost[i][j],cost:x[i][j]*p.cost[i][j],type:i>=p.realRows?'Unmet demand':j>=p.realCols?'Retained inventory':'Delivered blood'});return rows;
  }
  return {EPS,BASE,DEFAULT,PRESETS,clone,validate,balance,build,objective,feasibility,audit,initial,modi,certificate,metrics,solve,shipments,status,matrix,key,cell};
});
