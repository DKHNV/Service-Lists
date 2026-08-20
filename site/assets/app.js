(function(){
  'use strict';
  const MANIFEST_URL='services.json', META_TTL_MS=15*60*1000;
  const RAW_BASE='https://raw.githubusercontent.com', API_BASE='https://api.github.com/repos';

  const esc=s=>encodeURIComponent(s);
  const escapePath=p=>p.split('/').map(esc).join('/');
  const rawUrl=(owner,s,type)=>`${RAW_BASE}/${esc(owner)}/${esc(s.repo)}/main/${escapePath(s.files[type])}`;
  const repoUrl=(owner,s)=>`https://github.com/${esc(owner)}/${esc(s.repo)}`;

  async function fetchWithTimeout(url, options={}, timeoutMs=12000){
    const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{return await fetch(url,Object.assign({},options,{signal:controller.signal}));}
    finally{clearTimeout(timer);}
  }
  async function fetchText(url){
    const r=await fetchWithTimeout(url,{cache:'no-cache'});
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.text();
  }
  async function loadManifest(){
    const r=await fetchWithTimeout(MANIFEST_URL,{cache:'no-cache'},8000);
    if(!r.ok) throw new Error(`Не удалось загрузить services.json: HTTP ${r.status}`);
    return r.json();
  }
  const dataLines=t=>String(t||'').split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!x.startsWith('#'));
  const countCidr=t=>dataLines(t).filter(x=>/^[0-9]{1,3}(?:\.[0-9]{1,3}){3}(?:\/\d{1,2})?$/.test(x)).length;
  const countRouterOS=t=>String(t||'').split(/\r?\n/).filter(x=>/^\s*add\s+/i.test(x)).length;
  const countDns=t=>dataLines(t).length;

  function parseGeneratedDate(text){
    const m=String(text||'').match(/^#\s*Gen\S*\s+(\d{2})\.(\d{2})\.(\d{4})/mi);
    if(!m) return null;
    const d=new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00Z`);
    return Number.isNaN(d.getTime())?null:d;
  }
  function formatDate(v){
    if(!v) return 'Дата недоступна';
    const d=v instanceof Date?v:new Date(v);
    if(Number.isNaN(d.getTime())) return 'Дата недоступна';
    return new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(d);
  }
  const cacheKey=(o,r)=>`service-lists:repo-meta:${o}/${r}`;
  function readMetaCache(o,r){
    try{const raw=localStorage.getItem(cacheKey(o,r)); if(!raw)return null; const c=JSON.parse(raw); return c&&Date.now()-c.savedAt<=META_TTL_MS?c.data:null;}catch(_){return null;}
  }
  function writeMetaCache(o,r,data){try{localStorage.setItem(cacheKey(o,r),JSON.stringify({savedAt:Date.now(),data}));}catch(_){}}
  async function fetchRepoMeta(owner,service){
    const cached=readMetaCache(owner,service.repo); if(cached)return cached;
    const r=await fetchWithTimeout(`${API_BASE}/${esc(owner)}/${esc(service.repo)}`,{headers:{Accept:'application/vnd.github+json'}},8000);
    if(!r.ok) throw new Error(`GitHub API HTTP ${r.status}`);
    const d=await r.json(), meta={pushed_at:d.pushed_at||null,html_url:d.html_url||repoUrl(owner,service)};
    writeMetaCache(owner,service.repo,meta); return meta;
  }
  async function loadServiceData(owner,service){
    const types=['cidr','routeros','dns'];
    const settled=await Promise.allSettled(types.map(t=>fetchText(rawUrl(owner,service,t))));
    const files={},errors={};
    settled.forEach((r,i)=>r.status==='fulfilled'?files[types[i]]=r.value:errors[types[i]]=r.reason);
    const stats={
      cidr:files.cidr!==undefined?countCidr(files.cidr):null,
      routeros:files.routeros!==undefined?countRouterOS(files.routeros):null,
      dns:files.dns!==undefined?countDns(files.dns):null
    };
    let fallbackDate=null;
    ['cidr','routeros'].forEach(t=>{const d=parseGeneratedDate(files[t]); if(d&&(!fallbackDate||d>fallbackDate))fallbackDate=d;});
    let meta=null; try{meta=await fetchRepoMeta(owner,service);}catch(_){}
    return {files,errors,stats,meta,fallbackDate};
  }
  const setText=(el,v)=>{if(el)el.textContent=v;};
  const displayCount=v=>v==null?'—':String(v);
  const serviceHref=k=>`service.html?service=${esc(k)}`;

  function renderCard(owner,service){
    const a=document.createElement('article'); a.className='service-card';
    a.innerHTML=`<div class="service-top"><div><a class="service-name" href="${serviceHref(service.key)}"></a><p class="service-description"></p><div class="repo-note mono"></div></div><span class="status" data-role="status">Загрузка</span></div>
    <div class="stats"><div class="stat"><strong data-role="cidr"><span class="skeleton"></span></strong><span>CIDR</span></div><div class="stat"><strong data-role="routeros"><span class="skeleton"></span></strong><span>RouterOS</span></div><div class="stat"><strong data-role="dns"><span class="skeleton"></span></strong><span>DNS</span></div></div>
    <div class="service-meta"><span data-role="updated">Получаем дату…</span><a href="${serviceHref(service.key)}">Открыть сервис →</a></div>`;
    setText(a.querySelector('.service-name'),service.name);
    setText(a.querySelector('.service-description'),service.description||'');
    setText(a.querySelector('.repo-note'),`${owner}/${service.repo}`);
    return a;
  }

  async function initIndex(manifest){
    const grid=document.querySelector('[data-service-grid]'); if(!grid)return;
    setText(document.querySelector('[data-total-services]'),manifest.services.length);
    const cards=new Map(), totals={cidr:0,dns:0};
    manifest.services.forEach(s=>{const c=renderCard(manifest.owner,s); cards.set(s.key,c); grid.appendChild(c);});
    await Promise.all(manifest.services.map(async s=>{
      const c=cards.get(s.key), d=await loadServiceData(manifest.owner,s);
      setText(c.querySelector('[data-role="cidr"]'),displayCount(d.stats.cidr));
      setText(c.querySelector('[data-role="routeros"]'),displayCount(d.stats.routeros));
      setText(c.querySelector('[data-role="dns"]'),displayCount(d.stats.dns));
      if(Number.isFinite(d.stats.cidr)) totals.cidr+=d.stats.cidr;
      if(Number.isFinite(d.stats.dns)) totals.dns+=d.stats.dns;
      const missing=Object.keys(d.errors).length, st=c.querySelector('[data-role="status"]');
      st.className=`status ${missing===0?'ok':missing<3?'warn':'bad'}`;
      st.textContent=missing===0?'Доступно':missing<3?'Частично':'Недоступно';
      const updated=d.meta&&d.meta.pushed_at?new Date(d.meta.pushed_at):d.fallbackDate;
      setText(c.querySelector('[data-role="updated"]'),`Обновлено: ${formatDate(updated)}`);
    }));
    setText(document.querySelector('[data-total-cidr]'),totals.cidr);
    setText(document.querySelector('[data-total-dns]'),totals.dns);
  }

  function downloadText(filename,text){
    const blob=new Blob([text],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function copyText(button,text){
    try{
      await navigator.clipboard.writeText(text);
      const old=button.textContent; button.textContent='Скопировано'; button.classList.add('success');
      setTimeout(()=>{button.textContent=old;button.classList.remove('success');},1600);
    }catch(_){
      const area=document.createElement('textarea'); area.value=text; area.setAttribute('readonly',''); area.style.position='fixed'; area.style.opacity='0';
      document.body.appendChild(area); area.select(); document.execCommand('copy'); area.remove();
      const old=button.textContent; button.textContent='Скопировано'; setTimeout(()=>button.textContent=old,1600);
    }
  }

  async function initService(manifest){
    const root=document.querySelector('[data-service-page]'); if(!root)return;
    const params=new URLSearchParams(location.search), key=params.get('service');
    const service=manifest.services.find(x=>x.key===key)||manifest.services[0]; if(!service)return;
    document.title=`${service.name} · Service Lists`;
    setText(document.querySelector('[data-service-name]'),service.name);
    setText(document.querySelector('[data-service-description]'),service.description||'');
    setText(document.querySelector('[data-service-repo]'),`${manifest.owner}/${service.repo}`);
    const repo=document.querySelector('[data-repo-link]'); if(repo)repo.href=repoUrl(manifest.owner,service);

    const data=await loadServiceData(manifest.owner,service);
    ['cidr','routeros','dns'].forEach(type=>{
      setText(document.querySelector(`[data-stat-${type}]`),displayCount(data.stats[type]));
      setText(document.querySelector(`[data-tab-count="${type}"]`),displayCount(data.stats[type]));
    });
    const updated=data.meta&&data.meta.pushed_at?new Date(data.meta.pushed_at):data.fallbackDate;
    setText(document.querySelector('[data-updated]'),formatDate(updated));

    const labels={cidr:'CIDR',routeros:'RouterOS',dns:'DNS'};
    ['cidr','routeros','dns'].forEach(type=>{
      const panel=document.querySelector(`[data-panel="${type}"]`); if(!panel)return;
      const code=panel.querySelector('pre'), filename=panel.querySelector('[data-file-name]');
      const download=panel.querySelector('[data-download]'), copy=panel.querySelector('[data-copy]'), raw=panel.querySelector('[data-raw]');
      setText(filename,service.files[type]); raw.href=rawUrl(manifest.owner,service,type);
      if(data.files[type]!==undefined){
        code.textContent=data.files[type]; download.disabled=false; copy.disabled=false;
        download.addEventListener('click',()=>downloadText(service.files[type],data.files[type]));
        copy.addEventListener('click',()=>copyText(copy,data.files[type]));
      }else{code.textContent=`${labels[type]}: файл временно недоступен.`;}
    });
    const missing=Object.keys(data.errors), warning=document.querySelector('[data-warning]');
    if(warning&&missing.length){warning.hidden=false;warning.textContent=`Не удалось загрузить: ${missing.map(t=>labels[t]).join(', ')}. Остальные данные доступны.`;}
  }

  function initTabs(){
    document.addEventListener('click',e=>{
      const b=e.target.closest('[data-tab]'); if(!b)return; const target=b.dataset.tab;
      document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));
      document.querySelectorAll('[data-panel]').forEach(p=>p.hidden=p.dataset.panel!==target);
      document.querySelectorAll('[data-help]').forEach(h=>h.hidden=h.dataset.help!==target);
    });
  }
  async function main(){
    initTabs();
    try{const manifest=await loadManifest(); await Promise.all([initIndex(manifest),initService(manifest)]);}
    catch(error){const t=document.querySelector('[data-fatal]'); if(t){t.hidden=false;t.textContent=`Не удалось загрузить данные Service Lists: ${error.message}`;} console.error(error);}
  }
  document.addEventListener('DOMContentLoaded',main);
})();