const $=s=>document.querySelector(s);const LOGO=$('.logo').src;
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const pd=s=>new Date(s+'T00:00:00');
const br=s=>s?s.split('-').reverse().join('/'):'';
const fmt=v=>(+v||0).toLocaleString('pt-BR',{maximumFractionDigits:1});
const sum=(a,f)=>a.reduce((t,x)=>t+(+f(x)||0),0);
const uid=()=>Math.random().toString(36).slice(2,10);
const TODAY=iso(new Date());
const diff=(a,b)=>Math.round((pd(a)-pd(b))/864e5);
let S={pedidos:[],cfg:{pin:0,des:1,pal:2,ute:0,auto:0}},DB=null,draft=[],view='prod',day=TODAY;
const open=new Set();

function add(s,n){n=+n||0;if(!n)return s;const d=pd(s),st=n>0?1:-1;let k=Math.abs(n);while(k>0){d.setDate(d.getDate()+st);if(!+S.cfg.ute||d.getDay()%6)k--}return iso(d)}
function m2(dim){const p=String(dim||'').replace(/,/g,'.').split(/x/i).map(parseFloat);return p.length>=2&&p[0]&&p[1]?p[0]*p[1]/1e4:0}
function kgPeca(dim){const p=String(dim||'').replace(/,/g,'.').split(/x/i).map(parseFloat);return p.length>=3&&p.slice(0,3).every(v=>v>0)?Math.round(p[0]/100*p[1]/100*p[2]/100*(+S.cfg.dens||2300)*100)/100:0}
const flat=()=>S.pedidos.flatMap(p=>p.itens.map(i=>({...i,p})));

/* ---------- reprogramação ---------- */
const pendentes=()=>flat().filter(i=>i.data&&i.data<TODAY&&(+i.real||0)<+i.qtd);
const pn=()=>sum(pendentes(),i=>i.qtd-(+i.real||0));
function reprog(){
  const nd=add(add(TODAY,-1),1);let n=0;
  S.pedidos.forEach(p=>{let ch=false;
    p.itens.slice().forEach(it=>{const r=+it.real||0;
      if(it.data&&it.data<TODAY&&r<+it.qtd){n+=it.qtd-r;ch=true;const orig=it.origem||it.data;
        if(r>0){p.itens.push({...it,id:uid(),qtd:it.qtd-r,real:0,data:nd,origem:orig});it.qtd=r}
        else{it.origem=orig;it.data=nd}}});
    if(ch)savePed(p)});
  if(n)render();return n
}
let aptDest='',aptMsg='';
const destPad=()=>(aptDest&&aptDest!==day)?aptDest:add(day,1);
function moveFalta(nd,itemId){
  let n=0;
  S.pedidos.forEach(p=>{let ch=false;
    p.itens.slice().forEach(it=>{const r=+it.real||0;
      if(it.data===day&&(!itemId||it.id===itemId)&&r<+it.qtd){n+=it.qtd-r;ch=true;const orig=it.origem||it.data;
        if(r>0){p.itens.push({...it,id:uid(),qtd:it.qtd-r,real:0,data:nd,origem:orig});it.qtd=r}
        else{it.origem=orig;it.data=nd}}});
    if(ch)savePed(p)});
  aptMsg=n?fmt(n)+' peça(s) reprogramada(s) para '+br(nd)+'.':'Nada faltando neste dia.';
  render();return n
}
let autoRan=false;
function maybeAuto(){if(!autoRan&&(+S.cfg.auto||+S.cfg.autoProg)){autoRan=true;if(+S.cfg.auto)reprog();if(+S.cfg.autoProg)aplicar(true)}}

/* ---------- formas e empenho ---------- */
const nk=s=>String(s||'').toLowerCase().replace(/\s/g,'').replace(/,/g,'.');
const fm=(f,i)=>nk(f.dim)===nk(i.dimensao)&&(!f.linha||nk(f.linha)===nk(i.linha));
function empenho(i,D,its){
  const fs=(S.cfg.formas||[]).filter(f=>fm(f,i)),tot=sum(fs,f=>f.qtd);
  const us=its.filter(j=>j.id!==i.id&&j.data&&j.data<=D&&D<add(j.data,Math.max(+S.cfg.des||0,1))&&fs.some(f=>fm(f,j))).map(j=>({n:j.p.numero,c:j.p.cliente,q:+j.qtd}));
  return{tot,us,livres:tot-sum(us,u=>u.q),nome:fs.length>0}
}
const lu=us=>us.length?us.map(u=>'Pedido '+esc(u.n)+' – '+esc(u.c)+' ('+u.q+')').join('<br>'):'Nenhum pedido';
let okFn=null;
function modal(h,ok){okFn=ok;$('#mbox').innerHTML=h+'<p class="bar" style="margin:14px 0 0"><button class="b p" id="mok">Confirmar e adicionar</button><button class="b" id="mno">Cancelar</button></p>';$('#modal').hidden=false}
function confirmaFormas(it){
  if(!it.data){draft.push(it);['#i-qtd','#i-kg'].forEach(x=>$(x).value='');renderDraft();return}
  const nd=Math.max(1,Math.min(60,+$('#i-rep').value||1)),ped={numero:$('#f-num').value.trim()||'novo',cliente:$('#f-cli').value.trim()||'este pedido'};
  const c=[];let d=it.data;for(let k=0;k<nd;k++){c.push({...it,id:uid(),data:d,p:ped});d=add(d,1)}
  const base=flat().concat(draft.map(j=>({...j,p:ped}))),rows=c.map(i=>({i,e:empenho(i,i.data,base)}));
  const ruim=rows.some(r=>r.e.livres<r.i.qtd);
  let h='<h3>Formas '+esc(it.dimensao)+(it.linha?' · '+esc(it.linha):'')+'</h3>';
  h+=rows[0].e.nome?'<div class="tw"><table><thead><tr><th>Dia</th><th class="n">Total</th><th>Já empenhadas em</th><th class="n">Livres</th><th class="n">Preciso</th><th class="n">Sobram</th></tr></thead><tbody>'+rows.map(({i,e})=>'<tr><td>'+br(i.data)+'</td><td class="n">'+e.tot+'</td><td>'+lu(e.us)+'</td><td class="n">'+e.livres+'</td><td class="n">'+i.qtd+'</td><td class="n" style="font-weight:700;color:var('+(e.livres-i.qtd<0?'--bad':'--ok')+')">'+(e.livres-i.qtd)+'</td></tr>').join('')+'</tbody></table></div>'+(ruim?'<p class="err">Faltam formas livres em algum dia. Você pode confirmar mesmo assim ou cancelar e ajustar quantidade ou data.</p>':''):'<p>Não há formas cadastradas para esta dimensão. Cadastre na aba <b>Formas</b> para controlar o empenho.</p>';
  modal(h,()=>{c.forEach(i=>{delete i.p;draft.push(i)});['#i-qtd','#i-kg'].forEach(x=>$(x).value='');$('#i-rep').value=1;renderDraft()})
}
function renderFormas(){
  const fs=S.cfg.formas||[],its=flat();
  $('#fo-lista').innerHTML=fs.length?'<table><thead><tr><th>Dimensão</th><th>Linha</th><th>Total de formas</th><th>Empenhadas em '+br(day)+'</th><th class="n">Livres</th><th></th></tr></thead><tbody>'+fs.map(f=>{const e=empenho({id:'-',dimensao:f.dim,linha:f.linha},day,its);return'<tr><td>'+esc(f.dim)+'</td><td>'+esc(f.linha||'todas')+'</td><td><input type="number" min="0" style="width:90px" data-f="'+f.id+'" value="'+f.qtd+'"></td><td>'+lu(e.us)+'</td><td class="n" style="font-weight:700;color:var('+(e.livres<0?'--bad':'--ok')+')">'+e.livres+'</td><td><button class="b d" data-fd="'+f.id+'">Remover</button></td></tr>'}).join('')+'</tbody></table>':'<div class="empty">Nenhuma forma cadastrada ainda.</div>'
}

/* ---------- programar por m² ---------- */
function diasPlano(){const ex=new Map((S.cfg.plano||[]).map(x=>[x.d,+x.m])),pad=+S.cfg.metaPad||0;if(pad>0)for(let k=1;k<=(+S.cfg.horiz||14);k++){const dd=pd(TODAY);dd.setDate(dd.getDate()+k);const s=iso(dd);if(dd.getDay()%6&&!ex.has(s))ex.set(s,pad)}return[...ex].map(([d,m])=>({d,m})).sort((a,b)=>a.d.localeCompare(b.d))}
function plano(so){so=so===undefined?!!+S.cfg.plSo:so;
  const out=diasPlano().filter(x=>+x.m>0).map(d=>({d:d.d,m:+d.m,u:0,l:[]})),fx=flat().filter(i=>!((+i.real||0)<+i.qtd&&(!so||!i.data))),hy=[];
  const pend=flat().filter(i=>(+i.real||0)<+i.qtd&&(!so||!i.data)).map(i=>({it:i,p:i.p,rest:i.qtd-(+i.real||0)})).sort((a,b)=>a.p.prazo.localeCompare(b.p.prazo)||String(a.p.numero).localeCompare(String(b.p.numero)));
  pend.forEach(x=>{const u=m2(x.it.dimensao)||0.01;
    for(const o of out){if(!x.rest)break;let n=Math.min(x.rest,Math.floor((o.m-o.u)/u+1e-9));if(n<1&&!o.l.length&&o.m>0)n=1;const e=empenho(x.it,o.d,fx.concat(hy));if(e.nome)n=Math.min(n,Math.max(0,e.livres));
      if(n>0){o.l.push({x,n});hy.push({...x.it,id:'h'+hy.length,qtd:n,data:o.d});o.u+=n*u;x.rest-=n}}});
  return{out,sobra:pend.filter(x=>x.rest>0)}
}
let planMsg='';
function renderPlan(){
  const dias=diasPlano(),exs=new Set((S.cfg.plano||[]).map(x=>x.d));
  $('#pl-dias').innerHTML=dias.length?dias.map(x=>'<span class="badge ok" style="margin:0 6px 6px 0">'+br(x.d)+' · '+fmt(x.m)+' m²'+(exs.has(x.d)?' <button class="b" style="padding:0 6px" data-pd="'+x.d+'" aria-label="Remover dia">×</button>':'')+'</span>').join(''):'<span class="note">Nenhum dia informado ainda.</span>';
  $('#pl-so').checked=!!+S.cfg.plSo;$('#pl-pad').value=S.cfg.metaPad||'';$('#pl-hor').value=S.cfg.horiz||14;$('#pl-auto').checked=!!+S.cfg.autoProg;if(!dias.length){$('#pl-prev').innerHTML='';return}
  const {out,sobra}=plano(),fixed=flat().filter(i=>!((+i.real||0)<+i.qtd&&(!S.cfg.plSo||!i.data)));
  const hyp=out.flatMap(o=>o.l.map(({x,n})=>({...x.it,id:'h'+o.d+x.it.id,qtd:n,data:o.d})));
  let h='<p class="bar"><button class="b p" id="pl-apply">Aplicar programação nos pedidos</button><span class="mut">'+esc(planMsg)+'</span></p>';
  out.forEach(o=>{
    const rows=o.l.map(({x,n})=>{const e=empenho(hyp.find(y=>y.id==='h'+o.d+x.it.id),o.d,fixed.concat(hyp));
      const al=[add(o.d,S.cfg.pal)>x.p.prazo?'Passa do prazo':'',e.nome&&e.livres<n?'Faltam '+(n-e.livres)+' formas':''].filter(Boolean).join(' · ');return{x,n,al}});
    h+='<div class="sheet" style="margin-bottom:12px"><div class="ph"><h2>'+br(o.d)+' · '+pd(o.d).toLocaleDateString('pt-BR',{weekday:'long'})+'</h2><span>Meta '+fmt(o.m)+' m² · programado '+fmt(o.u)+' m²</span></div>'+(rows.length?'<div class="tw">'+table([T('Nº',r=>r.x.p.numero),T('Cliente',r=>r.x.p.cliente),T('Prazo',r=>br(r.x.p.prazo)),T('Linha',r=>r.x.it.linha),T('Formato',r=>r.x.it.formato),T('Dimensão',r=>r.x.it.dimensao),T('Cor',r=>r.x.it.cor),T('Qtd',r=>r.n,{n:1,s:1}),T('M²',r=>r.n*(m2(r.x.it.dimensao)||0),{n:1,s:1}),T('Alerta',r=>r.al)],rows,true)+'</div>':'<div class="empty">Nenhuma peça pendente coube neste dia.</div>')+'</div>'});
  if(sobra.length)h+='<h3 class="sub">Não coube nos dias informados ou faltaram formas (mantém a data atual)</h3><div class="sheet tw">'+table([T('Nº',r=>r.p.numero),T('Cliente',r=>r.p.cliente),T('Prazo',r=>br(r.p.prazo)),T('Formato',r=>r.it.formato),T('Dimensão',r=>r.it.dimensao),T('Falta',r=>r.rest,{n:1,s:1})],sobra,false)+'</div>';
  $('#pl-prev').innerHTML=h
}
function aplicar(so){
  const {out}=plano(so),m=new Map();let n=0;
  out.forEach(o=>o.l.forEach(({x,n:q})=>{const k=x.it.id;if(!m.has(k))m.set(k,{p:x.p.id,id:k,al:[]});m.get(k).al.push({d:o.d,n:q});n++}));
  const ch=new Set();
  m.forEach(g=>{const p=S.pedidos.find(q=>q.id===g.p),ix=p.itens.findIndex(q=>q.id===g.id),it=p.itens[ix],r=+it.real||0,orig=it.origem||it.data,parts=[];
    if(r>0)parts.push({...it,qtd:r});
    g.al.forEach(a=>parts.push({...it,id:uid(),qtd:a.n,real:0,data:a.d,origem:a.d!==it.data?orig:it.origem}));
    const rest=it.qtd-r-sum(g.al,a=>a.n);if(rest>0)parts.push({...it,id:uid(),qtd:rest,real:0});
    p.itens.splice(ix,1,...parts);ch.add(p)});
  ch.forEach(p=>savePed(p));planMsg=n?'Programação aplicada em '+n+' lançamento(s).':'Nada novo para programar.';render()
}
const inp=(p,i,f,dl,ty)=>'<input data-a="'+f+'" data-p="'+p.id+'" data-i="'+i.id+'" value="'+esc(i[f]==null?'':i[f])+'"'+(dl?' list="'+dl+'"':'')+(ty?' type="number" min="0" step="any"':'')+' style="width:'+(f==='qtd'||f==='kg'?'72px':f==='dimensao'?'104px':'124px')+'">';
const sel=(p,i)=>'<select data-a="pintura" data-p="'+p.id+'" data-i="'+i.id+'" style="width:auto">'+['Desmoldante','DRC'].map(o=>'<option'+(i.pintura===o?' selected':'')+'>'+o+'</option>').join('')+'</select>';

/* ---------- importar planilha ---------- */
const nz=s=>String(s==null?'':s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const str=v=>String(v==null?'':v).trim(),num=v=>+String(v==null?'':v).replace(',','.')||0;
function dt(v){
  let d=null;
  if(v instanceof Date&&!isNaN(v))d=new Date(v.getTime()+432e5);
  else if(typeof v==='number'&&v>20000)d=new Date(Math.round((v-25569)*864e5)+432e5);
  else{const m=String(v).match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);if(m)return(m[3].length===2?'20'+m[3]:m[3])+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0')}
  return d?d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0')+'-'+String(d.getUTCDate()).padStart(2,'0'):''
}
function lerAba(w,nome){
  const rows=XLSX.utils.sheet_to_json(w.Sheets[nome],{header:1,raw:true,defval:''});
  const hi=rows.findIndex(r=>{const k=r.map(nz);return k.includes('CLIENTE')&&k.includes('PLANEJADO')});
  if(hi<0)return{erro:'Não achei o cabeçalho (colunas CLIENTE e PLANEJADO) na aba “'+nome+'”. Escolha outra aba.'};
  const H=rows[hi].map(nz),col=n=>H.indexOf(n),body=rows.slice(hi+1);
  const c={num:H.findIndex(h=>h.includes('PEDIDO')&&!h.includes('PREVIS')&&!h.includes('ENTREGA')),cli:col('CLIENTE'),prazo:H.findIndex(h=>h.includes('PREVIS')),ent:H.findIndex(h=>h.includes('ENTRADA')),ex:H.findIndex(h=>h.startsWith('DATADAEXEC')),fo:col('FORMATO'),lin:col('LINHA'),cor:col('COR'),dim:col('DIMENSAO'),kg:col('KG'),pl:col('PLANEJADO'),re:col('REALIZADO')};
  const falta=Object.entries({num:'Nº PEDIDO',ex:'DATA DA EXECUÇÃO',fo:'FORMATO',lin:'LINHA',cor:'COR',dim:'DIMENSÃO'}).filter(([k])=>c[k]<0).map(x=>x[1]);
  if(falta.length)return{erro:'Colunas não encontradas: '+falta.join(', ')+'.'};
  const tc=H.map((h,i)=>h==='TIPO'?i:-1).filter(i=>i>=0).find(i=>body.some(r=>nz(r[i])==='ENCHIMENTO'));
  const kf=r=>str(r[c.num])+'|'+nz(r[c.dim])+'|'+nz(r[c.lin]),drc=new Set();
  if(tc!==undefined)body.forEach(r=>{if(nz(r[tc]).startsWith('DRC'))drc.add(kf(r))});
  const P=new Map();let n=0,ign=0;
  body.forEach(r=>{
    if(tc!==undefined&&nz(r[tc])!=='ENCHIMENTO')return;
    const cli=str(r[c.cli]),q=num(r[c.pl]),d=dt(r[c.ex]);
    if(!cli||q<=0){if(cli||q)ign++;return}
    let nu=str(r[c.num]);if(!nu||/vazio/i.test(nu))nu='S/N';
    const k=nu+'|'+nz(cli);let p=P.get(k);
    if(!p){p={id:uid(),numero:nu,cliente:cli,entrada:dt(r[c.ent])||TODAY,prazo:dt(r[c.prazo])||d||add(TODAY,30),itens:[]};P.set(k,p)}
    p.itens.push({id:uid(),formato:str(r[c.fo]),dimensao:str(r[c.dim]),linha:str(r[c.lin]),cor:str(r[c.cor]),qtd:q,data:d,pintura:drc.has(kf(r))?'DRC':'Desmoldante',kg:num(r[c.kg])||kgPeca(str(r[c.dim])),real:num(r[c.re])});n++
  });
  return{ped:[...P.values()],n,ign,tipo:tc!==undefined}
}
let imp=null;
function renderImp(){
  const r=imp&&imp.res;if(!r){$('#im-prev').innerHTML='';return}
  if(r.erro){$('#im-prev').innerHTML='<div class="panel err">'+esc(r.erro)+'</div>';return}
  const ex=p=>S.pedidos.some(x=>String(x.numero)===p.numero&&nz(x.cliente)===nz(p.cliente));
  $('#im-prev').innerHTML='<p class="bar"><b>'+r.ped.length+' pedidos · '+r.n+' lançamentos de peças</b>'+(r.ign?'<span class="mut">'+r.ign+' linha(s) ignorada(s) sem cliente, quantidade ou data</span>':'')+(r.tipo?'':'<span class="err">Coluna TIPO com ENCHIMENTO não encontrada: todas as linhas foram lidas.</span>')+'<span class="sp"></span><button class="b p" id="im-go">Importar agora</button></p>'+(imp.msg?'<p class="mut">'+esc(imp.msg)+'</p>':'')+'<div class="sheet tw">'+table([T('Nº',p=>p.numero),T('Cliente',p=>p.cliente),T('Prazo',p=>br(p.prazo)),T('Lançamentos',p=>p.itens.length,{n:1}),T('Peças',p=>sum(p.itens,i=>i.qtd),{n:1,s:1}),T('Situação',p=>ex(p)?'Já cadastrado':'Novo')],r.ped,true)+'</div>'
}
function lerArq(f){
  if(typeof XLSX==='undefined'){imp={res:{erro:'O leitor de Excel não carregou. Verifique a conexão com a internet.'}};return renderImp()}
  const fr=new FileReader();
  fr.onload=()=>{try{const w=XLSX.read(fr.result,{type:'array',cellDates:true}),nm=w.SheetNames;
    const ok=nm.find(x=>{const y=lerAba(w,x);return !y.erro&&y.ped.length})||nm[0];
    $('#im-aba').innerHTML=nm.map(x=>'<option'+(x===ok?' selected':'')+'>'+esc(x)+'</option>').join('');
    imp={w,msg:'',res:lerAba(w,ok)};renderImp()}catch(e){imp={res:{erro:'Não consegui ler o arquivo: '+e.message}};renderImp()}};
  fr.readAsArrayBuffer(f)
}
document.addEventListener('change',e=>{
  if(e.target.id==='im-file'&&e.target.files[0])lerArq(e.target.files[0]);
  if(e.target.id==='im-aba'&&imp&&imp.w){imp.res=lerAba(imp.w,e.target.value);imp.msg='';renderImp()}
});
document.addEventListener('click',e=>{
  if(e.target.id!=='im-go'||!imp||!imp.res||!imp.res.ped)return;
  let a=0,s=0,k=0;
  imp.res.ped.forEach(p=>{const x=S.pedidos.find(y=>String(y.numero)===p.numero&&nz(y.cliente)===nz(p.cliente));
    if(!x){S.pedidos.push(p);savePed(p);a++}
    else if($('#im-sub').checked){x.itens=p.itens;x.prazo=p.prazo;x.entrada=p.entrada;savePed(x);s++}else k++});
  imp.msg='Importado: '+a+' novo(s), '+s+' substituído(s), '+k+' já existente(s) ignorado(s).';if(+S.cfg.autoProg)aplicar(true);render()
});

/* ---------- armazenamento ---------- */
function loadLocal(){try{const r=localStorage.getItem('pcp-v1');if(r){const o=JSON.parse(r);S.pedidos=o.pedidos||[];S.cfg={...S.cfg,...o.cfg}}}catch(e){}}
function saveLocal(){try{localStorage.setItem('pcp-v1',JSON.stringify(S))}catch(e){}}
let inflight=0,lastDocs=null,pend=false;
const clone=o=>JSON.parse(JSON.stringify(o));
function sync(t,bad){const e=$('#sync');if(!e)return;e.textContent=t;e.className='sync noprint'+(bad?' bad':'')}
function wr(pr){inflight++;sync('Salvando…');pr.then(()=>sync('Salvo no banco de dados')).catch(e=>{sync('Erro ao salvar'+(e&&e.code?' ('+e.code+')':'')+'. Os dados foram guardados neste navegador.',1);saveLocal()}).finally(()=>{inflight--;applyDocs()})}
function applyDocs(){if(inflight>0||!lastDocs)return;S.pedidos=lastDocs;lastDocs=null;maybeAuto();softRender()}
function softRender(){const a=document.activeElement;if(a&&/INPUT|SELECT|TEXTAREA/.test(a.tagName)&&a.closest('main')){pend=true;return}render()}
function savePed(p){if(DB)wr(DB.collection('pedidos').doc(p.id).set(clone(p)));else saveLocal()}
function delPed(id){S.pedidos=S.pedidos.filter(x=>x.id!==id);if(DB)wr(DB.collection('pedidos').doc(id).delete());else saveLocal()}
function saveCfg(){if(DB)wr(DB.doc('config/main').set(clone(S.cfg)));else saveLocal()}
document.addEventListener('focusout',()=>{if(!pend)return;setTimeout(()=>{const a=document.activeElement;if(!(a&&/INPUT|SELECT|TEXTAREA/.test(a.tagName)&&a.closest('main'))){pend=false;render()}},60)});

/* ---------- situação do pedido ---------- */
function status(p){
  const tot=sum(p.itens,i=>i.qtd),done=sum(p.itens,i=>Math.min(+i.real||0,+i.qtd));
  const pct=tot?Math.round(done/tot*100):0;
  if(tot>0&&done>=tot)return{k:'ok',t:'Concluído',d:'Tudo produzido.',pct,done:true};
  const pend=p.itens.filter(i=>(+i.real||0)<+i.qtd),late=pend.filter(i=>i.data&&i.data<TODAY);
  const proj=pend.map(i=>add((!i.data||i.data<TODAY)?TODAY:i.data,S.cfg.pal)).sort().pop();
  const delta=diff(proj,p.prazo);let k='ok',t='Em dia',d='Previsão de término '+br(proj)+' (prazo '+br(p.prazo)+').';
  if(delta>0){k='bad';t='Atrasado';d='Previsão de término '+br(proj)+' passa '+delta+' dia(s) do prazo '+br(p.prazo)+'.'}
  else if(late.length){k='warn';t='Atenção';d=late.length+' peça(s) com data de produção vencida. Lance o realizado ou reprograme.'}
  else if(delta>=-1){k='warn';t='Atenção';d='Folga de '+(-delta)+' dia(s) até o prazo '+br(p.prazo)+'.'}
  const sd=pend.filter(i=>!i.data).length;if(sd){d+=' '+sd+' peça(s) sem data de produção (use a aba Programar).';if(sd===pend.length&&k==='ok'){k='warn';t='A programar'}}return{k,t,d,pct,done:false,falta:tot-done}
}

/* ---------- abas do dia ---------- */
const T=(l,f,o)=>({l,f,...o});
const V={
 prod:{t:'Planejamento da produção · Enchimento',sel:i=>i.data===day,cols:[
  T('Nº',r=>r.p.numero),T('Prazo',r=>br(r.p.prazo)),T('Linha',r=>r.linha),T('Cor',r=>r.cor),T('Formato',r=>r.formato),T('Dimensão',r=>r.dimensao),T('Cliente',r=>r.p.cliente),
  T('Planejado',r=>r.qtd,{n:1,s:1}),T('Realizado',r=>+r.real||0,{n:1,s:1,x:1,z:1}),T('KG plan.',r=>r.qtd*(+r.kg||0),{n:1,s:1}),T('KG real.',r=>(+r.real||0)*(+r.kg||0),{n:1,s:1,z:1}),T('M² plan.',r=>r.qtd*m2(r.dimensao),{n:1,s:1}),T('M² real.',r=>(+r.real||0)*m2(r.dimensao),{n:1,s:1,z:1})]},
 desf:{t:'Planejamento da desforma',sel:i=>i.data&&add(i.data,S.cfg.des)===day,cols:[
  T('Nº',r=>r.p.numero),T('Enchido em',r=>br(r.data)),T('Linha',r=>r.linha),T('Cor',r=>r.cor),T('Formato',r=>r.formato),T('Dimensão',r=>r.dimensao),T('Cliente',r=>r.p.cliente),
  T('Planejado',r=>r.qtd,{n:1,s:1}),T('Realizado',()=>'',{x:1})]},
 pal:{t:'Planejamento da paletização e expedição',sel:i=>i.data&&add(i.data,S.cfg.pal)===day,cols:[T('Nº',r=>r.p.numero),T('Prazo',r=>br(r.p.prazo)),T('Linha',r=>r.linha),T('Cor',r=>r.cor),T('Formato',r=>r.formato),T('Dimensão',r=>r.dimensao),T('Cliente',r=>r.p.cliente),T('Peças',r=>r.qtd,{n:1,s:1}),T('Paletizado',()=>'',{x:1}),T('KG',r=>r.qtd*(+r.kg||0),{n:1,s:1})]},
 pint:{t:'Planejamento pintura · Limpar e pintar formas',sel:i=>i.data&&add(i.data,S.cfg.pin)===day,cols:[
  T('Nº',r=>r.p.numero),T('Formato',r=>r.formato),T('Dimensão',r=>r.dimensao),T('Linha',r=>r.linha),T('Cor',r=>r.cor),T('Pintar com',r=>r.pintura),T('Cliente',r=>r.p.cliente),
  T('Formas',r=>r.qtd,{n:1,s:1}),T('Feito',()=>'',{x:1})]}
};
function table(cols,rows,foot){
  let h='<table><thead><tr>'+cols.map(c=>'<th class="'+(c.n?'n':'')+'">'+c.l+'</th>').join('')+'</tr></thead><tbody>';
  h+=rows.map(r=>'<tr>'+cols.map(c=>{const v=c.f(r);return'<td class="'+(c.n?'n ':'')+(c.x?'x':'')+'">'+(c.n?(c.z&&!(+v)?'':fmt(v)):esc(v))+'</td>'}).join('')+'</tr>').join('')+'</tbody>';
  if(foot)h+='<tfoot><tr>'+cols.map((c,i)=>'<td class="'+(c.n?'n':'')+'">'+(i===0?'Total geral':c.s?(c.z&&!sum(rows,c.f)?'':fmt(sum(rows,c.f))):'')+'</td>').join('')+'</tr></tfoot>';
  return h+'</table>'
}
function renderDay(k){
  const v=V[k],rows=flat().filter(v.sel).sort((a,b)=>(a.linha+a.formato).localeCompare(b.linha+b.formato));
  const wd=pd(day).toLocaleDateString('pt-BR',{weekday:'long'});
  let h='<div class="sheet"><div class="ph"><span style="display:flex;align-items:center;gap:14px"><img class="plogo" src="'+LOGO+'" alt="Preall"><h2>'+v.t+'</h2></span><span>'+br(day)+' · '+wd+'</span></div>';
  h+=rows.length?'<div class="tw">'+table(v.cols,rows,true)+'</div>':'<div class="empty">Nada programado para este dia. Cadastre pedidos em “Novo pedido” ou escolha outra data.</div>';
  h+='</div>';
  if(k==='prod'){
    const at=flat().filter(i=>i.data&&i.data<day&&i.data<=TODAY&&(+i.real||0)<+i.qtd).map(i=>({...i,qtd:i.qtd-(+i.real||0)}));
    if(at.length)h+='<h3 class="sub">Pendências de dias anteriores <button class="b p noprint" data-rp="1">Reprogramar para hoje</button></h3><div class="sheet tw">'+table([T('Nº',r=>r.p.numero),T('Era para',r=>br(r.data)),T('Linha',r=>r.linha),T('Cor',r=>r.cor),T('Formato',r=>r.formato),T('Dimensão',r=>r.dimensao),T('Cliente',r=>r.p.cliente),T('Falta',r=>r.qtd,{n:1,s:1}),T('Realizado',()=>'',{x:1})],at,false)+'</div>'
  }
  $('#v-'+k).innerHTML=h
}

/* ---------- pedidos ---------- */
function renderPeds(){
  const L=S.pedidos.map(p=>({p,s:status(p)}));
  const c=k=>L.filter(x=>x.s.k===k&&!x.s.done).length;
  $('#stats').innerHTML='<div class="stat bad"><b>'+c('bad')+'</b>Atrasados</div><div class="stat warn"><b>'+c('warn')+'</b>Atenção</div><div class="stat ok"><b>'+c('ok')+'</b>Em dia</div><div class="stat"><b>'+L.filter(x=>x.s.done).length+'</b>Concluídos</div>'+(pn()?'<button class="b p noprint" data-rp="1" style="align-self:center">Reprogramar '+fmt(pn())+' peça(s) pendente(s) para hoje</button>':'');
  const f=$('#fil').value,q=$('#busca').value.trim().toLowerCase();
  const vis=L.filter(x=>(!f||(f==='done'?x.s.done:x.s.k===f&&!x.s.done))&&(!q||(x.p.numero+' '+x.p.cliente).toLowerCase().includes(q))).sort((a,b)=>a.s.done-b.s.done||a.p.prazo.localeCompare(b.p.prazo));
  if(!vis.length){$('#lista').innerHTML='<div class="panel empty">'+(S.pedidos.length?'Nenhum pedido neste filtro.':'Nenhum pedido cadastrado ainda. Use “Novo pedido” ou <button class="b" id="demo">carregar um exemplo</button>.')+'</div>';return}
  $('#lista').innerHTML=vis.map(({p,s})=>{
    const rows=p.itens.slice().sort((a,b)=>a.data.localeCompare(b.data)).map(i=>'<tr><td>'+inp(p,i,'linha','dl-lin')+(i.origem?'<br><span class="mut">reprogramado de '+br(i.origem)+'</span>':'')+'</td><td>'+inp(p,i,'formato','dl-for')+'</td><td>'+inp(p,i,'dimensao')+'</td><td>'+inp(p,i,'cor','dl-cor')+'</td><td>'+inp(p,i,'qtd','','number')+'</td><td>'+sel(p,i)+'</td><td>'+inp(p,i,'kg','','number')+'</td><td><input type="date" data-a="data" data-p="'+p.id+'" data-i="'+i.id+'" value="'+i.data+'" aria-label="Data de produção"></td><td><input type="number" min="0" data-a="real" data-p="'+p.id+'" data-i="'+i.id+'" value="'+(+i.real||0)+'" aria-label="Realizado"></td><td style="white-space:nowrap"><button class="b" data-a="dupi" data-p="'+p.id+'" data-i="'+i.id+'">Duplicar</button> <button class="b d" data-a="deli" data-p="'+p.id+'" data-i="'+i.id+'">Remover</button></td></tr>').join('');
    return '<details class="card '+s.k+'" data-id="'+p.id+'" '+(open.has(p.id)?'open':'')+'><summary><span class="num">'+esc(p.numero)+'</span><span><span class="cli">'+esc(p.cliente)+'</span><br><span class="mut">Prazo '+br(p.prazo)+' · entrada '+br(p.entrada)+'</span></span><span><span class="badge '+s.k+'">'+s.t+'</span></span><span><span class="mut">'+s.pct+'% produzido</span><div class="prog"><i style="width:'+s.pct+'%"></i></div></span></summary><div class="body"><p class="mut">'+s.d+'</p><div class="grid" style="margin-bottom:10px"><div><label>Nº do pedido</label><input data-a="p:numero" data-p="'+p.id+'" value="'+esc(p.numero)+'"></div><div><label>Cliente</label><input data-a="p:cliente" data-p="'+p.id+'" value="'+esc(p.cliente)+'"></div><div><label>Prazo de entrega</label><input type="date" data-a="p:prazo" data-p="'+p.id+'" value="'+p.prazo+'"></div></div><div class="tw"><table><thead><tr><th>Linha</th><th>Formato</th><th>Dimensão</th><th>Cor</th><th>Qtd</th><th>Pintar com</th><th>Kg/pç</th><th>Data de produção</th><th>Realizado</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div><p style="margin:10px 0 0"><button class="b" data-a="cpp" data-p="'+p.id+'">Copiar pedido (sem datas)</button> <button class="b d" data-a="delp" data-p="'+p.id+'">Excluir pedido</button></p></div></details>'
  }).join('')
}

/* ---------- cadastro ---------- */
function renderDraft(){
  $('#draft').innerHTML=draft.length?table([T('Linha',r=>r.linha),T('Formato',r=>r.formato),T('Dimensão',r=>r.dimensao),T('Cor',r=>r.cor),T('Produzir em',r=>br(r.data)||'A programar'),T('Pintar com',r=>r.pintura),T('Qtd',r=>r.qtd,{n:1,s:1}),T('',r=>'')],draft,true).replace(/<td class=""><\/td><\/tr>/g,m=>m):'<div class="empty" style="padding:8px 0">Nenhuma peça adicionada ainda.</div>';
  const o=(id,k)=>{$(id).innerHTML=[...new Set(['Piso','Rodapé','Régua','Degrau','Tijolinho','Chapéu de muro'].concat(k==='formato'?[]:[]).concat(S.pedidos.flatMap(p=>p.itens.map(i=>i[k]))))].map(v=>'<option value="'+esc(v)+'">').join('')};
  o('#dl-for','formato');
  $('#dl-lin').innerHTML=[...new Set(['Santorini','Mykonos','Olímpia','Atenas','Creta','Zeus','Rhodes'].concat(S.pedidos.flatMap(p=>p.itens.map(i=>i.linha))))].map(v=>'<option value="'+esc(v)+'">').join('');
  $('#dl-cor').innerHTML=[...new Set(['Branco','Amarelo','Cinza','Nativa','Palha','Fendhi','Grafite'].concat(S.pedidos.flatMap(p=>p.itens.map(i=>i.cor))))].map(v=>'<option value="'+esc(v)+'">').join('')
}
function addItem(){
  const g=id=>$(id).value.trim(),it={id:uid(),formato:g('#i-for'),dimensao:g('#i-dim'),linha:g('#i-lin'),cor:g('#i-cor'),qtd:+g('#i-qtd'),data:g('#i-data'),pintura:g('#i-pin'),kg:+g('#i-kg')||kgPeca(g('#i-dim')),real:0};
  if(!it.formato||!it.dimensao||!it.linha||!it.cor||!(it.qtd>0)){$('#err').textContent='Preencha formato, dimensão, linha, cor e quantidade.';return}
  $('#err').textContent='';confirmaFormas(it)
}
function salvar(){
  const num=$('#f-num').value.trim(),cli=$('#f-cli').value.trim(),prazo=$('#f-prazo').value;
  if(!num||!cli||!prazo||!draft.length){$('#err').textContent='Informe nº do pedido, cliente, prazo e ao menos uma peça.';return}
  let p=S.pedidos.find(x=>String(x.numero)===num);
  if(p){p.cliente=cli;p.prazo=prazo;p.itens=p.itens.concat(draft)}else{p={id:uid(),numero:num,cliente:cli,entrada:TODAY,prazo,itens:draft.slice()};S.pedidos.push(p)}
  savePed(p);open.add(p.id);draft=[];['#f-num','#f-cli','#f-prazo','#i-for','#i-dim','#i-lin','#i-cor','#i-qtd','#i-data','#i-kg'].forEach(i=>$(i).value='');$('#i-rep').value=1;$('#i-kg').dataset.m='';$('#err').textContent='';if(+S.cfg.autoProg)aplicar(true);show('peds')
}
function demo(){
  const mk=(n,c,pz,its)=>({id:uid(),numero:n,cliente:c,entrada:TODAY,prazo:pz,itens:its.map(x=>({id:uid(),real:0,kg:x[6]||0,pintura:'Desmoldante',formato:x[0],dimensao:x[1],linha:x[2],cor:x[3],qtd:x[4],data:x[5]}))});
  [mk('7710','FELIPE CARVALHARES POSSAS','2026-12-11',[['Chapéu de muro s/pingadeira','100x32x2,5','Creta','Cinza',24,TODAY,18.4]]),mk('7770','MARINA CAMPELO MARCAL LANZA FRANCA','2026-12-11',[['Rodapé','100x15x2,5','Zeus','Nativa',6,add(TODAY,1),8.63],['Piso','100x100x2,3','Zeus','Nativa',29,add(TODAY,2),52.9]])].forEach(p=>{S.pedidos.push(p);savePed(p)});render()
}

/* ---------- navegação e eventos ---------- */
function show(v){aptMsg='';if(window.Auth&&Auth.user&&!Auth.allowed(v))v='hoje';view=v;document.querySelectorAll('.view').forEach(e=>e.classList.toggle('on',e.id==='v-'+v));document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('on',b.dataset.v===v));$('#datebar').style.display=(V[v]||v==='formas'||v==='apt')?'':'none';render()}
function render(){
  const a=document.activeElement,k=a&&a.dataset&&(a.dataset.a||a.dataset.ap||a.dataset.f)?{...a.dataset}:(a&&a.id?{id:a.id}:null);
  _render();
  if(k){const q=k.id?'#'+k.id:k.ap?'[data-ap="'+k.ap+'"]':k.f?'[data-f="'+k.f+'"]':'[data-a="'+k.a+'"][data-p="'+k.p+'"]'+(k.i?'[data-i="'+k.i+'"]':'');const e=document.querySelector(q);if(e&&e!==document.activeElement){try{e.focus()}catch(_){}}}
}
function _render(){
  $('#dia').value=day;
  if(V[view])renderDay(view);
  if(view==='peds')renderPeds();
  if(view==='novo')renderDraft();if(view==='formas')renderFormas();if(view==='plan')renderPlan();if(view==='imp')renderImp();if(view==='hoje')renderHoje();if(view==='apt')renderApt();
  if(view==='usr'&&window.Auth)Auth.renderUsers();
  if(view==='cfg'){$('#c-pin').value=S.cfg.pin;$('#c-des').value=S.cfg.des;$('#c-pal').value=S.cfg.pal;$('#c-ute').value=+S.cfg.ute?'1':'0';$('#c-aut').value=+S.cfg.auto?'1':'0';$('#c-den').value=S.cfg.dens||2300;$('#stor').textContent=DB?'Os pedidos ficam salvos no banco de dados da página e aparecem para todos que abrirem este link.':'Os pedidos estão salvos só neste navegador. Abra a página publicada, com login, para guardar no banco compartilhado.'}
}
$('#nav').onclick=e=>{if(e.target.dataset.v)show(e.target.dataset.v)};
$('#dia').onchange=e=>{if(e.target.value){day=e.target.value;render()}};
$('#prev').onclick=()=>{aptMsg='';day=add(day,-1);render()};$('#next').onclick=()=>{aptMsg='';day=add(day,1);render()};$('#hoje').onclick=()=>{aptMsg='';day=TODAY;render()};
$('#print').onclick=()=>{try{window.print()}catch(e){}};
$('#addi').onclick=addItem;$('#salvar').onclick=salvar;$('#limpar').onclick=()=>{draft=[];renderDraft()};
$('#fil').onchange=renderPeds;$('#busca').oninput=renderPeds;
['pin','des','pal'].forEach(k=>$('#c-'+k).onchange=e=>{S.cfg[k]=+e.target.value||0;saveCfg();render()});
$('#c-ute').onchange=e=>{S.cfg.ute=+e.target.value;saveCfg();render()};
$('#c-aut').onchange=e=>{S.cfg.auto=+e.target.value;saveCfg();maybeAuto();render()};
$('#c-den').onchange=e=>{S.cfg.dens=+e.target.value||2300;saveCfg();render()};
document.addEventListener('input',e=>{const t=e.target;if(t.id==='i-dim'){const k=kgPeca(t.value);if(!$('#i-kg').dataset.m)$('#i-kg').value=k||''}if(t.id==='i-kg')t.dataset.m=t.value?'1':''});
document.addEventListener('click',e=>{if(e.target.id!=='rekg')return;let n=0;S.pedidos.forEach(p=>{let ch=false;p.itens.forEach(i=>{const k=kgPeca(i.dimensao);if(k&&i.kg!==k){i.kg=k;ch=true;n++}});if(ch)savePed(p)});e.target.textContent='Pesos recalculados em '+n+' peça(s)';render()});
document.addEventListener('click',e=>{const t=e.target,d=t.dataset||{};
  if(d.rp&&(!window.Auth||Auth.canEdit()))reprog();
  if((d.rpd||d.rpi)&&(!window.Auth||Auth.canEdit())){
    const nd=($('#apt-dest')||{}).value||destPad();
    if(nd<=day){aptMsg='Escolha uma data depois de '+br(day)+'.';render();return}
    if(d.rpd&&!d.sure){t.dataset.sure=1;t.textContent='Confirmar: mover o que faltou para '+br(nd);return}
    moveFalta(nd,d.rpi||null)}
  if(t.id==='mno')$('#modal').hidden=true;
  if(t.id==='mok'){$('#modal').hidden=true;okFn&&okFn()}
  if(d.fd){S.cfg.formas=(S.cfg.formas||[]).filter(f=>f.id!==d.fd);saveCfg();render()}
  if(d.pd){S.cfg.plano=(S.cfg.plano||[]).filter(x=>x.d!==d.pd);saveCfg();render()}
  if(t.id==='pl-apply')aplicar();
  if(t.id==='pl-lim'){S.cfg.plano=[];saveCfg();render()}
  if(t.id==='pl-add'){const dd=$('#pl-d').value,m=+$('#pl-m').value;if(dd&&$('#pl-m').value!==''&&m>=0){const L=(S.cfg.plano||[]).filter(x=>x.d!==dd);L.push({d:dd,m});S.cfg.plano=L;saveCfg();$('#pl-m').value='';render()}}
  if(t.id==='fo-add'){const dim=$('#fo-dim').value.trim(),lin=$('#fo-lin').value.trim(),q=+$('#fo-qtd').value;if(dim&&$('#fo-qtd').value!==''&&q>=0){const L=S.cfg.formas||[],f=L.find(x=>nk(x.dim)===nk(dim)&&nk(x.linha)===nk(lin));if(f)f.qtd=q;else L.push({id:uid(),dim,linha:lin,qtd:q});S.cfg.formas=L;saveCfg();['#fo-dim','#fo-lin','#fo-qtd'].forEach(x=>$(x).value='');render()}}
});
document.addEventListener('change',e=>{const f=e.target.dataset&&e.target.dataset.f;if(f){const x=(S.cfg.formas||[]).find(y=>y.id===f);if(x){x.qtd=Math.max(0,+e.target.value||0);saveCfg();setTimeout(render,0)}}});
$('#pl-d').value=add(TODAY,1);
document.addEventListener('change',e=>{if(e.target.id==='apt-dest'){aptDest=e.target.value;aptSum();const b=document.querySelector('[data-rpd]');if(b){b.dataset.sure='';b.textContent='Reprogramar o que faltou do dia'}}});
document.addEventListener('input',e=>{const t=e.target,id=t.dataset&&t.dataset.ap;if(!id)return;const p=S.pedidos.find(x=>x.id===t.dataset.p),it=p&&p.itens.find(x=>x.id===id);if(it){it.real=Math.max(0,+t.value||0);savePed(p);aptSum()}});
document.addEventListener('change',e=>{const t=e.target;if(t.id==='pl-so'){S.cfg.plSo=t.checked?1:0;saveCfg();render()}if(t.id==='pl-pad'){S.cfg.metaPad=+t.value||0;saveCfg();render()}if(t.id==='pl-hor'){S.cfg.horiz=Math.max(1,Math.min(60,+t.value||14));saveCfg();render()}if(t.id==='pl-auto'){S.cfg.autoProg=t.checked?1:0;saveCfg();if(t.checked)aplicar(true);render()}
  const id=t.dataset&&t.dataset.ap;if(id){const p=S.pedidos.find(x=>x.id===t.dataset.p),it=p&&p.itens.find(x=>x.id===id);if(it){it.real=Math.max(0,+t.value||0);savePed(p);aptSum()}}});
document.addEventListener('click',e=>{const t=e.target,d=t.dataset||{};
  if(d.tudo){const inp=document.querySelector('[data-ap="'+d.tudo+'"]');inp.value=flat().find(x=>x.id===d.tudo).qtd;inp.dispatchEvent(new Event('change',{bubbles:true}))}
  if(d.fecha){if(!d.sure){t.dataset.sure=1;t.textContent='Confirmar: marcar tudo como feito';return}S.pedidos.forEach(p=>{let ch=false;p.itens.forEach(i=>{if(i.data===day&&(+i.real||0)<+i.qtd){i.real=i.qtd;ch=true}});if(ch)savePed(p)});render()}
  if(d.go)show(d.go);if(d.open){open.add(d.open);show('peds')}});
function renderApt(){
  const L=flat().filter(i=>i.data===day).sort((a,b)=>(a.linha+a.formato).localeCompare(b.linha+b.formato));
  $('#v-apt').innerHTML='<div class="bar"><b id="apt-sum"></b><span class="sp"></span><button class="b p" data-fecha="1">Fechar o dia: marcar tudo como feito</button></div><div class="bar" style="margin-top:8px"><label for="apt-dest" style="margin:0"><b>Reprogramar o que faltou para:</b></label><input type="date" id="apt-dest" value="'+destPad()+'" min="'+add(day,1)+'" style="width:auto"><button class="b" data-rpd="1">Reprogramar o que faltou do dia</button></div>'+(aptMsg?'<p class="note" role="status" style="font-weight:600;color:var(--ok)">'+aptMsg+'</p>':'')+'<div class="stats" id="apt-tot" style="margin-top:10px"></div>'+(L.length?L.map(i=>'<div class="apt" data-card="'+i.id+'"><div><span class="num">'+esc(i.p.numero)+'</span> <b>'+esc(i.p.cliente)+'</b><br><span class="mut">'+esc(i.linha)+' · '+esc(i.cor)+' · '+esc(i.formato)+' '+esc(i.dimensao)+' · planejado <b>'+fmt(i.qtd)+'</b></span><div class="apt-n mut" style="margin-top:4px"></div><button class="b rpi" data-rpi="'+i.id+'" style="margin-top:6px" hidden></button></div><input type="number" inputmode="numeric" min="0" data-ap="'+i.id+'" data-p="'+i.p.id+'" value="'+(+i.real||0)+'" aria-label="Realizado"><button class="b" data-tudo="'+i.id+'">Tudo</button></div>').join(''):'<div class="panel empty">Nada programado para este dia.</div>');
  aptSum()
}
const kgI=(i,q)=>q*(+i.kg||0),m2I=(i,q)=>q*m2(i.dimensao);
const aptNums=i=>{const r=+i.real||0;return 'KG: planejado <b>'+fmt(kgI(i,i.qtd))+'</b> · realizado <b>'+fmt(kgI(i,r))+'</b><br>M²: planejado <b>'+fmt(m2I(i,i.qtd))+'</b> · realizado <b>'+fmt(m2I(i,r))+'</b>'};
function aptSum(){const L=flat().filter(i=>i.data===day),e=$('#apt-sum');if(e)e.textContent=fmt(sum(L,i=>Math.min(+i.real||0,+i.qtd)))+' de '+fmt(sum(L,i=>i.qtd))+' peças feitas em '+br(day);
  document.querySelectorAll('.apt').forEach(el=>{const i=L.find(x=>x.id===el.dataset.card);if(i){const r=+i.real||0;el.className='apt'+(r>=i.qtd?' done':r>0?' part':'');const n=el.querySelector('.apt-n');if(n)n.innerHTML=aptNums(i);const b=el.querySelector('.rpi');if(b){b.hidden=!(r>0&&r<i.qtd);b.textContent='Reprogramar '+fmt(i.qtd-r)+' que faltou p/ '+br(destPad())}}});
  const t=$('#apt-tot');if(t){const c=(n,a,b)=>'<div class="stat"><b>'+fmt(b)+' <small>/ '+fmt(a)+'</small></b>'+n+'<span class="mut"> · realizado / planejado</span></div>';
  t.innerHTML=c('Peças',sum(L,i=>i.qtd),sum(L,i=>+i.real||0))+c('KG',sum(L,i=>kgI(i,i.qtd)),sum(L,i=>kgI(i,+i.real||0)))+c('M²',sum(L,i=>m2I(i,i.qtd)),sum(L,i=>m2I(i,+i.real||0)))}}
function renderHoje(){
  const its=flat(),hj=its.filter(i=>i.data===TODAY),ex=(S.cfg.plano||[]).find(x=>x.d===TODAY),meta=ex?+ex.m:(pd(TODAY).getDay()%6?+S.cfg.metaPad||0:0);
  const m=sum(hj,i=>i.qtd*m2(i.dimensao)),pl=sum(hj,i=>i.qtd),fe=sum(hj,i=>Math.min(+i.real||0,+i.qtd)),sd=sum(its.filter(i=>!i.data&&(+i.real||0)<+i.qtd),i=>i.qtd-(+i.real||0)),pv=pn();
  const L=S.pedidos.map(p=>({p,s:status(p)})).filter(x=>!x.s.done),at=L.filter(x=>x.s.k==='bad'),aw=L.filter(x=>x.s.k==='warn'),fa=[];
  (S.cfg.formas||[]).forEach(f=>[TODAY,add(TODAY,1)].forEach(D=>{const e=empenho({id:'-',dimensao:f.dim,linha:f.linha},D,its);if(e.livres<0)fa.push('Faltam '+(-e.livres)+' formas '+f.dim+(f.linha?' '+f.linha:'')+' em '+br(D))}));
  const kgP=sum(hj,i=>i.qtd*(+i.kg||0)),kgR=sum(hj,i=>(+i.real||0)*(+i.kg||0)),m2R=sum(hj,i=>(+i.real||0)*m2(i.dimensao));
  const card=(n,t,k,x)=>'<div class="stat '+(k||'')+'"><b>'+n+'</b>'+t+(x||'')+'</div>';
  $('#v-hoje').innerHTML='<h2 style="font-size:26px;margin-bottom:10px">Hoje · '+br(TODAY)+' · '+pd(TODAY).toLocaleDateString('pt-BR',{weekday:'long'})+'</h2><div class="big">'+card(fmt(m)+(meta?' / '+fmt(meta):'')+' m²','Programado'+(meta?' / meta de hoje':' hoje'),meta&&m>meta?'warn':'')+card(fmt(fe)+' / '+fmt(pl),'Peças feitas hoje','ok')+card(fmt(kgR)+' kg · '+fmt(m2R)+' m²','Realizado hoje (planejado: '+fmt(kgP)+' kg · '+fmt(m)+' m²)','ok')+card(fmt(pv),'Peças pendentes (vencidas)',pv?'bad':'ok',pv?'<br><button class="b p" data-rp="1" style="margin-top:6px">Reprogramar para hoje</button>':'')+card(fmt(sd),'Peças sem data',sd?'warn':'ok',sd?'<br><button class="b" data-go="plan" style="margin-top:6px">Ir para Programar</button>':'')+card(at.length,'Pedidos atrasados',at.length?'bad':'ok')+card(aw.length,'Pedidos em atenção',aw.length?'warn':'ok')+'</div>'
  +'<p class="bar"><button class="b p" data-go="apt">Apontar a produção de hoje</button><button class="b" data-go="prod">Listas do dia</button><button class="b" data-go="novo">Novo pedido</button></p>'
  +'<div class="panel"><h3>Pedidos que precisam de atenção</h3>'+(at.length+aw.length?'<div class="tw"><table><tbody>'+at.concat(aw).sort((a,b)=>a.p.prazo.localeCompare(b.p.prazo)).slice(0,10).map(({p,s})=>'<tr><td><b>'+esc(p.numero)+'</b></td><td>'+esc(p.cliente)+'</td><td>'+br(p.prazo)+'</td><td><span class="badge '+s.k+'">'+s.t+'</span></td><td>'+esc(s.d)+'</td><td><button class="b" data-open="'+p.id+'">Abrir</button></td></tr>').join('')+'</tbody></table></div>':'<p class="mut" style="margin:0">Nenhum pedido em risco.</p>')+'</div>'
  +'<div class="panel"><h3>Formas</h3>'+(fa.length?fa.map(x=>'<p class="err" style="margin:2px 0">'+esc(x)+'</p>').join(''):'<p class="mut" style="margin:0">Sem falta de formas para hoje e amanhã.</p>')+'</div>'
}
$('#lista').addEventListener('toggle',e=>{const id=e.target.dataset&&e.target.dataset.id;if(id)e.target.open?open.add(id):open.delete(id)},true);
$('#lista').addEventListener('change',e=>{const t=e.target,a=t.dataset.a;if(!a)return;const p=S.pedidos.find(x=>x.id===t.dataset.p);if(!p)return;if(a.startsWith('p:')){p[a.slice(2)]=t.value;savePed(p);return setTimeout(render,0)}const it=p.itens.find(x=>x.id===t.dataset.i);if(!it)return;if(a!=='real'&&a!=='data'){it[a]=['qtd','kg'].includes(a)?(+t.value||0):t.value.trim();if(a==='dimensao'){const k=kgPeca(it.dimensao);if(k)it.kg=k}savePed(p);return setTimeout(render,0)}
  if(a==='real')it.real=Math.max(0,+t.value||0);if(a==='data')it.data=t.value;savePed(p);setTimeout(render,0)});
$('#lista').addEventListener('click',e=>{const t=e.target;if(t.id==='demo')return demo();const a=t.dataset.a;if(a==='dupi'||a==='cpp'){const p=S.pedidos.find(x=>x.id===t.dataset.p);if(!p)return;
    if(a==='dupi'){const ix=p.itens.findIndex(x=>x.id===t.dataset.i);p.itens.splice(ix+1,0,{...p.itens[ix],id:uid(),real:0,origem:''});savePed(p)}
    else{const q={...JSON.parse(JSON.stringify(p)),id:uid(),numero:p.numero+' (cópia)',entrada:TODAY,itens:p.itens.map(i=>({...i,id:uid(),real:0,data:'',origem:''}))};S.pedidos.push(q);savePed(q);open.add(q.id)}
    return render()}
  if(!a||(a!=='deli'&&a!=='delp'))return;
  if(!t.dataset.sure){t.dataset.sure=1;t.textContent='Confirmar exclusão';return}
  const p=S.pedidos.find(x=>x.id===t.dataset.p);if(!p)return;
  if(a==='delp')delPed(p.id);else{p.itens=p.itens.filter(x=>x.id!==t.dataset.i);if(p.itens.length)savePed(p);else delPed(p.id)}render()});
$('#i-data').value='';

/* ---------- início ---------- */
loadLocal();maybeAuto();show('hoje');
(async()=>{try{
  if(!window.claude||!claude.use){sync('Modo local: dados salvos só neste navegador');return}
  const d=await Promise.race([claude.use('db'),new Promise(r=>setTimeout(()=>r(null),10000))]);
  if(!d){sync('Modo local: dados salvos só neste navegador');return}
  const local=S.pedidos.slice();let first=true;
  d.doc('config/main').onSnapshot(s=>{if(s.exists&&!inflight){S.cfg={...S.cfg,...clone(s.data())};maybeAuto();softRender()}},()=>{});
  d.collection('pedidos').onSnapshot(s=>{
    if(first){first=false;DB=d;sync('Conectado ao banco de dados');if(!s.docs.length&&local.length){local.forEach(p=>wr(d.collection('pedidos').doc(p.id).set(clone(p))));return}}
    lastDocs=s.docs.map(x=>clone(x.data()));applyDocs()},e=>{DB=null;sync('Banco de dados indisponível'+(e&&e.code?' ('+e.code+')':'')+'. Modo local.',1)});
}catch(e){sync('Modo local: dados salvos só neste navegador')}})();
