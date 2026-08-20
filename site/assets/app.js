(function(){
  'use strict';

  const MANIFEST_URL = 'services.json';
  const META_TTL_MS = 15 * 60 * 1000;
  const RAW_BASE = 'https://raw.githubusercontent.com';
  const API_BASE = 'https://api.github.com/repos';

  function escapePath(path){
    return path.split('/').map(encodeURIComponent).join('/');
  }

  function rawUrl(owner, service, type){
    return `${RAW_BASE}/${encodeURIComponent(owner)}/${encodeURIComponent(service.repo)}/main/${escapePath(service.files[type])}`;
  }

  function repoUrl(owner, service){
    return `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(service.repo)}`;
  }

  async function fetchWithTimeout(url, options, timeoutMs){
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try{
      return await fetch(url, Object.assign({}, options || {}, {signal:controller.signal}));
    }finally{
      clearTimeout(timer);
    }
  }

  async function fetchText(url){
    const response = await fetchWithTimeout(url, {cache:'no-cache'}, 12000);
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.text();
  }

  async function loadManifest(){
    const response = await fetchWithTimeout(MANIFEST_URL, {cache:'no-cache'}, 8000);
    if(!response.ok) throw new Error(`Не удалось загрузить services.json: HTTP ${response.status}`);
    return response.json();
  }

  function dataLines(text){
    return String(text || '').split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('#'));
  }

  function countCidr(text){
    return dataLines(text).filter(line => /^[0-9]{1,3}(?:\.[0-9]{1,3}){3}(?:\/\d{1,2})?$/.test(line)).length;
  }

  function countRouterOS(text){
    return String(text || '').split(/\r?\n/).filter(line => /^\s*add\s+/i.test(line)).length;
  }

  function countDns(text){
    return dataLines(text).length;
  }

  function parseGeneratedDate(text){
    const match = String(text || '').match(/^#\s*Gen\S*\s+(\d{2})\.(\d{2})\.(\d{4})/mi);
    if(!match) return null;
    const iso = `${match[3]}-${match[2]}-${match[1]}T00:00:00Z`;
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatDate(value){
    if(!value) return 'Дата недоступна';
    const date = value instanceof Date ? value : new Date(value);
    if(Number.isNaN(date.getTime())) return 'Дата недоступна';
    return new Intl.DateTimeFormat('ru-RU', {
      day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit'
    }).format(date);
  }

  function cacheKey(owner, repo){
    return `service-lists:repo-meta:${owner}/${repo}`;
  }

  function readMetaCache(owner, repo){
    try{
      const raw = localStorage.getItem(cacheKey(owner, repo));
      if(!raw) return null;
      const cached = JSON.parse(raw);
      if(!cached || Date.now() - cached.savedAt > META_TTL_MS) return null;
      return cached.data;
    }catch(_){ return null; }
  }

  function writeMetaCache(owner, repo, data){
    try{ localStorage.setItem(cacheKey(owner, repo), JSON.stringify({savedAt:Date.now(), data:data})); }catch(_){}
  }

  async function fetchRepoMeta(owner, service){
    const cached = readMetaCache(owner, service.repo);
    if(cached) return cached;
    const response = await fetchWithTimeout(`${API_BASE}/${encodeURIComponent(owner)}/${encodeURIComponent(service.repo)}`, {
      headers:{'Accept':'application/vnd.github+json'}
    }, 8000);
    if(!response.ok) throw new Error(`GitHub API HTTP ${response.status}`);
    const data = await response.json();
    const meta = {pushed_at:data.pushed_at || null, html_url:data.html_url || repoUrl(owner, service)};
    writeMetaCache(owner, service.repo, meta);
    return meta;
  }

  async function loadServiceData(owner, service){
    const types = ['cidr','routeros','dns'];
    const settled = await Promise.allSettled(types.map(type => fetchText(rawUrl(owner, service, type))));
    const files = {};
    const errors = {};
    settled.forEach((result, index) => {
      const type = types[index];
      if(result.status === 'fulfilled') files[type] = result.value;
      else errors[type] = result.reason;
    });
    const stats = {
      cidr: files.cidr !== undefined ? countCidr(files.cidr) : null,
      routeros: files.routeros !== undefined ? countRouterOS(files.routeros) : null,
      dns: files.dns !== undefined ? countDns(files.dns) : null
    };
    let fallbackDate = null;
    for(const type of ['cidr','routeros']){
      const date = parseGeneratedDate(files[type]);
      if(date && (!fallbackDate || date > fallbackDate)) fallbackDate = date;
    }
    let meta = null;
    try{ meta = await fetchRepoMeta(owner, service); }catch(_){}
    return {files, errors, stats, meta, fallbackDate};
  }

  function setText(element, value){
    if(element) element.textContent = value;
  }

  function displayCount(value){
    return value === null || value === undefined ? '—' : String(value);
  }

  function serviceHref(key){
    return `service.html?service=${encodeURIComponent(key)}`;
  }

  function githubIcon(){
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 .7A11.5 11.5 0 0 0 8.36 23.1c.58.1.79-.25.79-.56v-2.18c-3.22.7-3.9-1.37-3.9-1.37-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.71.08-.71 1.17.08 1.78 1.2 1.78 1.2 1.04 1.78 2.72 1.27 3.38.97.1-.75.41-1.27.74-1.56-2.57-.29-5.27-1.29-5.27-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.47.11-3.05 0 0 .97-.31 3.16 1.18A10.9 10.9 0 0 1 12 6.15c.98 0 1.96.13 2.88.39 2.19-1.49 3.15-1.18 3.15-1.18.63 1.58.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.71 5.39-5.29 5.68.42.36.79 1.06.79 2.14v3.22c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .7Z"/></svg>';
  }

  function renderCard(owner, service){
    const article = document.createElement('article');
    article.className = 'service-card';
    article.innerHTML = `
      <div class="service-top">
        <div>
          <a class="service-name" href="${serviceHref(service.key)}"></a>
          <div class="repo-note mono"></div>
        </div>
        <span class="status" data-role="status">Загрузка</span>
      </div>
      <div class="stats">
        <div class="stat"><strong data-role="cidr"><span class="skeleton"></span></strong><span>CIDR</span></div>
        <div class="stat"><strong data-role="routeros"><span class="skeleton"></span></strong><span>RouterOS</span></div>
        <div class="stat"><strong data-role="dns"><span class="skeleton"></span></strong><span>DNS</span></div>
      </div>
      <div class="service-meta">
        <span data-role="updated">Получаем дату…</span>
        <a data-role="repo" target="_blank" rel="noopener noreferrer">GitHub</a>
      </div>`;
    article.querySelector('.service-name').textContent = service.name;
    article.querySelector('.repo-note').textContent = `${owner}/${service.repo}`;
    article.querySelector('[data-role="repo"]').href = repoUrl(owner, service);
    return article;
  }

  async function initIndex(manifest){
    const grid = document.querySelector('[data-service-grid]');
    if(!grid) return;
    const cards = new Map();
    manifest.services.forEach(service => {
      const card = renderCard(manifest.owner, service);
      cards.set(service.key, card);
      grid.appendChild(card);
    });
    await Promise.all(manifest.services.map(async service => {
      const card = cards.get(service.key);
      const data = await loadServiceData(manifest.owner, service);
      setText(card.querySelector('[data-role="cidr"]'), displayCount(data.stats.cidr));
      setText(card.querySelector('[data-role="routeros"]'), displayCount(data.stats.routeros));
      setText(card.querySelector('[data-role="dns"]'), displayCount(data.stats.dns));
      const missing = Object.keys(data.errors).length;
      const status = card.querySelector('[data-role="status"]');
      status.className = `status ${missing === 0 ? 'ok' : missing < 3 ? 'warn' : 'bad'}`;
      status.textContent = missing === 0 ? 'Доступно' : missing < 3 ? 'Частично' : 'Недоступно';
      const updated = data.meta && data.meta.pushed_at ? new Date(data.meta.pushed_at) : data.fallbackDate;
      setText(card.querySelector('[data-role="updated"]'), `Обновлено: ${formatDate(updated)}`);
    }));
  }

  function downloadText(filename, text){
    const blob = new Blob([text], {type:'text/plain;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function initService(manifest){
    const root = document.querySelector('[data-service-page]');
    if(!root) return;
    const params = new URLSearchParams(location.search);
    const key = params.get('service');
    const service = manifest.services.find(item => item.key === key) || manifest.services[0];
    if(!service){
      root.innerHTML = '<div class="notice">Сервисы не настроены.</div>';
      return;
    }
    if(key !== service.key){
      const url = new URL(location.href);
      url.searchParams.set('service', service.key);
      history.replaceState(null, '', url);
    }
    document.title = `${service.name} · Service Lists`;
    setText(document.querySelector('[data-service-name]'), service.name);
    setText(document.querySelector('[data-service-repo]'), `${manifest.owner}/${service.repo}`);
    const repo = document.querySelector('[data-repo-link]');
    if(repo) repo.href = repoUrl(manifest.owner, service);

    const data = await loadServiceData(manifest.owner, service);
    setText(document.querySelector('[data-stat-cidr]'), displayCount(data.stats.cidr));
    setText(document.querySelector('[data-stat-routeros]'), displayCount(data.stats.routeros));
    setText(document.querySelector('[data-stat-dns]'), displayCount(data.stats.dns));
    const updated = data.meta && data.meta.pushed_at ? new Date(data.meta.pushed_at) : data.fallbackDate;
    setText(document.querySelector('[data-updated]'), formatDate(updated));

    const labels = {cidr:'CIDR', routeros:'RouterOS', dns:'DNS'};
    const fileTargets = {};
    ['cidr','routeros','dns'].forEach(type => {
      const panel = document.querySelector(`[data-panel="${type}"]`);
      if(!panel) return;
      const code = panel.querySelector('pre');
      const filename = panel.querySelector('[data-file-name]');
      const download = panel.querySelector('[data-download]');
      const raw = panel.querySelector('[data-raw]');
      setText(filename, service.files[type]);
      raw.href = rawUrl(manifest.owner, service, type);
      if(data.files[type] !== undefined){
        code.textContent = data.files[type];
        fileTargets[type] = data.files[type];
        download.disabled = false;
        download.addEventListener('click', () => downloadText(service.files[type], fileTargets[type]));
      }else{
        code.textContent = `${labels[type]}: файл временно недоступен.`;
        download.disabled = true;
      }
    });

    const missing = Object.keys(data.errors);
    const warning = document.querySelector('[data-warning]');
    if(warning && missing.length){
      warning.hidden = false;
      warning.textContent = `Не удалось загрузить: ${missing.map(type => labels[type]).join(', ')}. Остальные данные доступны.`;
    }
  }

  function initTabs(){
    document.addEventListener('click', event => {
      const button = event.target.closest('[data-tab]');
      if(!button) return;
      const target = button.dataset.tab;
      document.querySelectorAll('[data-tab]').forEach(tab => tab.classList.toggle('active', tab === button));
      document.querySelectorAll('[data-panel]').forEach(panel => { panel.hidden = panel.dataset.panel !== target; });
    });
  }

  async function main(){
    initTabs();
    try{
      const manifest = await loadManifest();
      await Promise.all([initIndex(manifest), initService(manifest)]);
    }catch(error){
      const target = document.querySelector('[data-fatal]');
      if(target){ target.hidden = false; target.textContent = `Не удалось загрузить данные Service Lists: ${error.message}`; }
      console.error(error);
    }
  }

  document.addEventListener('DOMContentLoaded', main);
})();
