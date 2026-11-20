/* ====== Login e contas — PCP Preall ======
   Somente o administrador cria, redefine e remove contas.
   Obs.: sem servidor, as contas ficam salvas neste navegador. */
(function(){
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* SHA-256 em JS puro (funciona também abrindo o arquivo direto, sem https) */
function sha256(str){
  const K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const b=unescape(encodeURIComponent(str)),l=b.length,w=[];
  for(let i=0;i<l;i++)w[i>>2]|=b.charCodeAt(i)<<(24-(i%4)*8);
  w[l>>2]|=0x80<<(24-(l%4)*8);w[(((l+8)>>6)+1)*16-1]=l*8;
  let h=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const r=(x,n)=>(x>>>n)|(x<<(32-n));
  for(let o=0;o<w.length;o+=16){
    const t=new Array(64);
    for(let i=0;i<64;i++){
      if(i<16)t[i]=w[o+i]|0;
      else{const a=t[i-15],c=t[i-2];t[i]=(t[i-16]+(r(a,7)^r(a,18)^(a>>>3))+t[i-7]+(r(c,17)^r(c,19)^(c>>>10)))|0}
    }
    let [a,b2,c,d,e,f,g,hh]=h;
    for(let i=0;i<64;i++){
      const t1=(hh+(r(e,6)^r(e,11)^r(e,25))+((e&f)^(~e&g))+K[i]+t[i])|0;
      const t2=((r(a,2)^r(a,13)^r(a,22))+((a&b2)^(a&c)^(b2&c)))|0;
      hh=g;g=f;f=e;e=(d+t1)|0;d=c;c=b2;b2=a;a=(t1+t2)|0;
    }
    h=[(h[0]+a)|0,(h[1]+b2)|0,(h[2]+c)|0,(h[3]+d)|0,(h[4]+e)|0,(h[5]+f)|0,(h[6]+g)|0,(h[7]+hh)|0];
  }
  return h.map(x=>('00000000'+(x>>>0).toString(16)).slice(-8)).join('');
}
const ITER=20000;
function hashPw(pw,salt){let h=sha256(salt+':'+pw);for(let i=0;i<ITER;i++)h=sha256(h+':'+salt);return h}
const newSalt=()=>Array.from({length:4},()=>Math.random().toString(36).slice(2,10)).join('');
const norm=e=>String(e||'').trim().toLowerCase();

/* conta administradora (a senha não aparece aqui, só o hash) */
const ADMIN={email:'synthexgroup@gmai.com',salt:'pcp-preall-7f3a91c2',hash:'58342ec93090c05786cd45b404cd89e73d6cfcbb64a0374f36c9468473c2df2a',nome:'Administrador'};
const ADMIN_ALIAS=['synthexgroup@gmai.com','synthexgroup@gmail.com'];

const UK='pcp-users-v1',SK='pcp-session-v1',LK='pcp-lock-v1';
const loadUsers=()=>{try{return JSON.parse(localStorage.getItem(UK))||[]}catch(e){return[]}};
const saveUsers=u=>{try{localStorage.setItem(UK,JSON.stringify(u))}catch(e){}};
let me=null;
const VIEW_TABS=['hoje','prod','desf','pint','pal'];
const roleOf=u=>u.admin?'admin':(u.role==='view'?'view':'op');
const ROLE_NAME={admin:'Administrador',op:'Operador (acesso completo)',view:'Visualizador (só indicadores)'};
const canEdit=()=>!!me&&roleOf(me)!=='view';
const allowed=v=>!me||roleOf(me)!=='view'||VIEW_TABS.includes(v);

function setSession(u,keep){const v=JSON.stringify({email:u.email,t:Date.now()});try{(keep?localStorage:sessionStorage).setItem(SK,v)}catch(e){}}
function clearSession(){try{sessionStorage.removeItem(SK);localStorage.removeItem(SK)}catch(e){}}
function findUser(email){
  email=norm(email);
  if(ADMIN_ALIAS.includes(email))return{...ADMIN,admin:true};
  const u=loadUsers().find(x=>norm(x.email)===email);return u?{...u,admin:false}:null;
}
function restore(){
  let r=null;try{r=sessionStorage.getItem(SK)||localStorage.getItem(SK)}catch(e){}
  if(!r)return null;try{const s=JSON.parse(r);return findUser(s.email)}catch(e){return null}
}

/* bloqueio simples contra tentativas repetidas */
function lockLeft(){try{const l=JSON.parse(localStorage.getItem(LK)||'{}');return l.until>Date.now()?Math.ceil((l.until-Date.now())/1000):0}catch(e){return 0}}
function fail(){try{const l=JSON.parse(localStorage.getItem(LK)||'{}');l.n=(l.n||0)+1;if(l.n>=5){l.until=Date.now()+30000;l.n=0}localStorage.setItem(LK,JSON.stringify(l))}catch(e){}}
function okTry(){try{localStorage.removeItem(LK)}catch(e){}}

function lock(on){document.body.classList.toggle('locked',on);$('#auth').hidden=!on}
function enter(u){
  me=u;lock(false);
  const r=roleOf(u);
  $('#who').textContent=(u.nome||u.email)+(r==='admin'?' · admin':r==='view'?' · visualizador':'');
  document.body.classList.toggle('viewer',r==='view');
  document.querySelectorAll('#nav button').forEach(b=>{b.hidden=b.dataset.v==='usr'?r!=='admin':!allowed(b.dataset.v)});
  if(window.show)window.show(allowed(view)&&(view!=='usr'||r==='admin')?view:'hoje');
}
function logout(){clearSession();me=null;document.body.classList.remove('viewer');$('#a-pw').value='';$('#a-msg').textContent='';lock(true);if(window.show)window.show('hoje');setTimeout(()=>$('#a-em').focus(),0)}

function login(ev){
  ev.preventDefault();
  const msg=$('#a-msg'),left=lockLeft();
  if(left){msg.textContent='Muitas tentativas. Aguarde '+left+'s.';return}
  const u=findUser($('#a-em').value),pw=$('#a-pw').value;
  msg.textContent='Verificando…';
  setTimeout(()=>{
    if(u&&hashPw(pw,u.salt)===u.hash){okTry();setSession(u,$('#a-keep').checked);msg.textContent='';$('#a-pw').value='';enter(u)}
    else{fail();msg.textContent='E-mail ou senha incorretos.'}
  },20);
}

/* ---------- painel do admin ---------- */
function renderUsers(){
  if(!me||!me.admin)return;
  const us=loadUsers();
  $('#u-lista').innerHTML='<table><thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Criada em</th><th></th></tr></thead><tbody>'+
    '<tr><td>'+esc(ADMIN.nome)+'</td><td>'+esc(ADMIN.email)+'</td><td>'+ROLE_NAME.admin+'</td><td>—</td><td><small>Conta administradora</small></td></tr>'+
    us.map(u=>'<tr><td>'+esc(u.nome||'')+'</td><td>'+esc(u.email)+'</td><td>'+ROLE_NAME[u.role==='view'?'view':'op']+'</td><td>'+esc((u.criada||'').slice(0,10).split('-').reverse().join('/'))+'</td><td><button class="b" data-u="role" data-e="'+esc(u.email)+'">'+(u.role==='view'?'Tornar operador':'Tornar visualizador')+'</button> <button class="b" data-u="pw" data-e="'+esc(u.email)+'">Redefinir senha</button> <button class="b d" data-u="del" data-e="'+esc(u.email)+'">Excluir</button></td></tr>').join('')+
    '</tbody></table>'+(us.length?'':'<p class="note">Nenhuma conta de usuário criada ainda.</p>');
}
function msgU(t,bad){const e=$('#u-msg');e.textContent=t;e.className='note'+(bad?' err':'')}
function createUser(){
  if(!me||!me.admin)return;
  const nome=$('#u-nome').value.trim(),email=norm($('#u-email').value),pw=$('#u-pw').value;
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))return msgU('Digite um e-mail válido.',1);
  if(pw.length<6)return msgU('A senha precisa ter pelo menos 6 caracteres.',1);
  if(ADMIN_ALIAS.includes(email)||loadUsers().some(u=>norm(u.email)===email))return msgU('Já existe uma conta com este e-mail.',1);
  const salt=newSalt(),us=loadUsers();
  us.push({nome,email,role:$('#u-role').value==='view'?'view':'op',salt,hash:hashPw(pw,salt),criada:new Date().toISOString()});saveUsers(us);
  $('#u-nome').value=$('#u-email').value=$('#u-pw').value='';
  msgU('Conta criada para '+email+'. Passe a senha para a pessoa.');renderUsers();
}
function userClick(e){
  const t=e.target;if(!t.dataset.u||!me||!me.admin)return;
  const email=t.dataset.e;
  if(t.dataset.u==='del'){
    if(!t.dataset.sure){t.dataset.sure=1;t.textContent='Confirmar exclusão';return}
    saveUsers(loadUsers().filter(u=>norm(u.email)!==norm(email)));msgU('Conta excluída.');renderUsers();
  }else if(t.dataset.u==='role'){
    const us=loadUsers(),u=us.find(x=>norm(x.email)===norm(email));if(!u)return;
    u.role=u.role==='view'?'op':'view';saveUsers(us);msgU('Perfil de '+email+' alterado para '+ROLE_NAME[u.role]+'.');renderUsers();
  }else if(t.dataset.u==='pw'){
    const pw=prompt('Nova senha para '+email+' (mínimo 6 caracteres):');
    if(pw===null)return;if(pw.length<6)return msgU('A senha precisa ter pelo menos 6 caracteres.',1);
    const us=loadUsers(),u=us.find(x=>norm(x.email)===norm(email));if(!u)return;
    u.salt=newSalt();u.hash=hashPw(pw,u.salt);saveUsers(us);msgU('Senha de '+email+' redefinida.');
  }
}

window.Auth={renderUsers,canEdit,allowed,get user(){return me}};

document.addEventListener('DOMContentLoaded',()=>{
  $('#a-form').addEventListener('submit',login);
  $('#btn-out').addEventListener('click',logout);
  $('#u-criar').addEventListener('click',createUser);
  $('#u-lista').addEventListener('click',userClick);
  const u=restore();if(u)enter(u);else{lock(true);$('#a-em').focus()}
});
})();
