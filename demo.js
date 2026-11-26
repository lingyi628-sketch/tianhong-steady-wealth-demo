/* Configurable static iPhone demonstration shell. Keep business UI in phone/. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const frame = $('preview'), notes = $('notes'), rail = $('annotations'), viewport = $('notes-viewport');
  let config, view, innerDoc, observer, layoutObserver, noteObserver, removeScroll, bounds = [], tick, mounted = false;
  const escapeSelector = selector => { try { return innerDoc.querySelector(selector); } catch (_) { return null; } };
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const safeURL = value => { const u = new URL(value, location.href); const local = location.protocol === 'file:' && u.protocol === 'file:' && u.pathname.startsWith(new URL('.', location.href).pathname); if (!local && !['http:', 'https:'].includes(u.protocol)) throw Error('只支持 HTTP(S) 或本地相对资源地址。'); return u; };
  const error = message => { $('error').textContent = message; $('error').hidden = false; };
  function block(item) {
    const box = el('div', 'block block-' + item.type);
    if (item.type === 'text') {
      const text = Array.isArray(item.text) ? item.text : [item.text || ''];
      text.forEach(value => box.append(el('p', '', value)));
    } else if (item.type === 'table') {
      const wrap = el('div', 'block-table'), table = el('table'), head = el('thead'), row = el('tr'), body = el('tbody');
      (item.columns || []).forEach(value => { const n = el('th', '', value); n.scope = 'col'; row.append(n); });
      head.append(row); table.append(head, body);
      (item.rows || []).forEach(values => { const r = el('tr'); values.forEach((value, index) => r.append(el('td', index === item.highlightColumn ? 'highlight' : '', value == null ? '—' : String(value)))); body.append(r); });
      if (item.title) table.setAttribute('aria-label', item.title);
      wrap.append(table); box.append(wrap);
    } else if (item.type === 'image') {
      const a = el('a', 'image-link'), img = el('img', 'block-image');
      a.href = safeURL(item.src).href; a.target = '_blank'; a.rel = 'noopener';
      img.src = a.href; img.alt = item.alt || ''; img.loading = 'lazy';
      img.addEventListener('load', schedule); img.addEventListener('error', () => box.append(el('p', '', '图片暂时无法加载：' + item.src)));
      a.append(img); box.append(a);
    } else if (item.type === 'gallery') {
      const grid = el('div', 'gallery'); (item.items || []).forEach(image => grid.append(block({type: 'image', ...image}))); box.append(grid);
    } else if (item.type === 'embed') {
      const f = el('iframe', 'block-embed'); f.src = safeURL(item.src).href; f.title = item.title || '补充内容'; f.height = item.height || 240; f.loading = 'lazy'; box.append(f);
    } else if (item.type === 'links') {
      const list = el('ul', 'block-links'); (item.items || []).forEach(link => { const li = el('li'), a = el('a', '', link.label || link.href); a.href = safeURL(link.href).href; a.target = '_blank'; a.rel = 'noopener'; li.append(a); list.append(li); }); box.append(list);
    } else { box.append(el('p', '', '未支持的资料类型：' + item.type)); }
    if (item.caption) box.append(el('p', 'caption', item.caption));
    return box;
  }
  function renderMaterials() {
    $('materials').replaceChildren();
    const items = [...(config.materials || []), ...(view.materials || [])];
    for (const item of items) {
      const d = el('details', 'material'); d.open = item.open !== false;
      d.append(el('summary', '', item.title || '补充资料')); const b = el('div', 'material-body'); b.append(block(item)); d.append(b); $('materials').append(d);
    }
    $('materials').hidden = !items.length; $('review-layout').classList.toggle('no-materials', !items.length);
  }
  function renderNotes() {
    noteObserver?.disconnect(); notes.replaceChildren();
    for (const [index, note] of (view.notes || []).entries()) {
      const card = el('article', 'note'); card.dataset.noteId = note.id; card.hidden = true;
      const heading = el('div', 'note-heading'), number = el('span', 'note-number', String(index + 1).padStart(2, '0'));
      const button = el('button', '', note.title); button.type = 'button'; button.addEventListener('click', () => jump(note)); heading.append(number, button);
      const body = el('div', 'note-body'); if (note.body) body.append(el('p', '', note.body)); (note.blocks || []).forEach(item => body.append(block(item)));
      card.append(heading, body); notes.append(card);
    }
    const hasNotes = !!view.notes?.length; rail.hidden = !hasNotes; $('review-layout').classList.toggle('no-notes', !hasNotes);
    noteObserver = new ResizeObserver(schedule); [...notes.children].forEach(n => noteObserver.observe(n));
  }
  function jump(note) {
    if (innerDoc) {
      const target = escapeSelector(note.target); if (!target) return;
      target.scrollIntoView({block: 'start', behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'instant' : 'smooth'});
    } else { frame.contentWindow.postMessage({type: 'demo:jump', target: note.target}, safeURL(view.src).origin); }
  }
  function schedule() { cancelAnimationFrame(tick); tick = requestAnimationFrame(positionNotes); }
  function positionNotes() {
    if (!mounted || !frame.clientHeight) return;
    const phone = frame.getBoundingClientRect(), aside = rail.getBoundingClientRect(), scale = phone.height / frame.clientHeight;
    viewport.style.top = (phone.top - aside.top) + 'px'; viewport.style.height = phone.height + 'px';
    const anchors = innerDoc ? (view.notes || []).map(note => {
      const n = escapeSelector(note.target), b = n?.getBoundingClientRect(); return b && b.height > 0 ? {id: note.id, top: b.top, height: b.height} : null;
    }).filter(Boolean) : bounds;
    const entries = anchors.map(b => ({...b, top: b.top * scale, card: [...notes.children].find(n => n.dataset.noteId === b.id)})).filter(b => b.card).sort((a, b) => a.top - b.top);
    [...notes.children].forEach(n => { n.hidden = true; n.removeAttribute('data-continuing'); });
    const visible = entries.filter((entry, index) => entry.top < phone.height - 12 && (entries[index + 1]?.top ?? entry.top + entry.height * scale) > 24);
    let end = -12;
    for (const entry of visible) { entry.card.hidden = false; entry.anchor = Math.max(0, entry.top); entry.y = Math.max(entry.anchor, end + 12); entry.height = entry.card.offsetHeight; end = entry.y + entry.height; if (entry.top < 0) entry.card.setAttribute('data-continuing', ''); }
    if (end > phone.height && visible.reduce((sum, n) => sum + n.height + 12, -12) <= phone.height) {
      let next = phone.height + 12; [...visible].reverse().forEach(n => { n.y = Math.min(n.y, next - 12 - n.height); next = n.y; });
    }
    let bottom = 0;
    for (const entry of visible) { entry.y = Math.max(bottom, entry.y, 0); entry.card.style.top = entry.y + 'px'; bottom = entry.y + entry.height + 12; }
    const svg = $('note-lines'); svg.replaceChildren(); svg.style.height = Math.max(phone.height, bottom) + 'px';
    for (const entry of visible) {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'), circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      path.setAttribute('d', `M 1 ${entry.anchor + 1} H 8 L 18 ${entry.y + 1} H 25`); circle.setAttribute('cx', '1'); circle.setAttribute('cy', entry.anchor + 1); circle.setAttribute('r', '1.5'); svg.append(path, circle);
    }
  }
  function fit() {
    const [w, h] = $('size').value.split('x').map(Number), device = $('device');
    $('review-layout').style.setProperty('--device-column', (w + 36) + 'px');
    device.style.setProperty('--screen-width', w + 'px'); device.style.setProperty('--screen-height', h + 'px'); device.classList.toggle('classic', w === 375 && h === 667);
    const scale = Math.min(1, Math.max(.1, ($('stage').clientWidth - 12) / (w + 24)));
    device.style.transform = `scale(${scale})`; $('device-space').style.width = (w + 24) * scale + 'px'; $('device-space').style.height = device.offsetHeight * scale + 'px';
    $('viewport-label').textContent = `页面区域 ${w} × ${h} · ${Math.round(scale * 100)}% 显示`;
    saveURL(); schedule();
  }
  function saveURL() { const u = new URL(location.href); u.searchParams.set('view', view.id); u.searchParams.set('size', $('size').value); if (location.protocol !== 'file:') history.replaceState(null, '', u); }
  function detach() { observer?.disconnect(); layoutObserver?.disconnect(); removeScroll?.(); innerDoc = null; bounds = []; mounted = false; }
  function selectView(id) {
    detach(); view = config.views.find(v => v.id === id) || config.views[0];
    document.querySelectorAll('[data-view]').forEach(n => n.setAttribute('aria-pressed', String(n.dataset.view === view.id)));
    renderMaterials(); renderNotes(); $('note-status').hidden = true;
    const url = safeURL(view.src);
    const standalone = new URL(url);
    standalone.searchParams.delete('embedded');
    $('open-page').href = standalone.href;
    if (location.protocol === 'file:') {
      frame.srcdoc = window.localDemo.phoneHTML.replace('/*LOCAL_PREVIEW_QUERY*/', JSON.stringify(url.search));
    } else {
      frame.src = url.href;
    }
    fit();
  }
  frame.addEventListener('load', () => {
    detach();
    try {
      const doc = frame.contentDocument; if (!doc || !doc.body) throw Error('cross-origin'); innerDoc = doc; mounted = true;
      const onScroll = () => schedule(); doc.addEventListener('scroll', onScroll, {passive: true, capture: true}); frame.contentWindow.addEventListener('resize', onScroll);
      removeScroll = () => { doc.removeEventListener('scroll', onScroll, true); doc.defaultView?.removeEventListener('resize', onScroll); };
      observer = new MutationObserver(schedule); observer.observe(doc.body, {subtree: true, childList: true, attributes: true, characterData: true});
      layoutObserver = new ResizeObserver(schedule); [doc.body, ...(view.notes || []).map(n => escapeSelector(n.target)).filter(Boolean)].forEach(n => layoutObserver.observe(n));
      doc.addEventListener('load', schedule, true); const oldRemove = removeScroll; removeScroll = () => { oldRemove(); doc.removeEventListener('load', schedule, true); };
      doc.fonts?.ready.then(schedule); schedule();
    } catch (_) {
      $('note-status').hidden = !view.notes?.length; $('note-status').textContent = '等待页面批注桥接。跨域网页需接入 phone-bridge.js；仅打开网页不能自动读取它的内容位置。';
      frame.contentWindow.postMessage({type: 'demo:observe', notes: (view.notes || []).map(n => ({id: n.id, target: n.target}))}, safeURL(view.src).origin);
    }
  });
  window.addEventListener('message', event => {
    if (!view || event.source !== frame.contentWindow || event.origin !== safeURL(view.src).origin || event.data?.type !== 'demo:bounds') return;
    const ids = new Set((view.notes || []).map(n => n.id));
    if (!Array.isArray(event.data.bounds)) return;
    bounds = event.data.bounds.filter(n => ids.has(n.id) && Number.isFinite(n.top) && Number.isFinite(n.height) && n.height > 0);
    mounted = true; $('note-status').hidden = true; schedule();
  });
  async function start() {
    if (location.protocol === 'file:') {
      if (!window.localDemo) throw Error('本地演示配置缺失，请保留完整演示目录。');
      config = window.localDemo.config;
    } else {
      const response = await fetch('demo-config.json', {cache: 'no-cache'});
      if (!response.ok) throw Error('无法加载 demo-config.json。');
      config = await response.json();
    }
    if (!config.views?.length) throw Error('至少配置一个 views 页面。');
    $('demo-title').textContent = config.title || '页面演示'; document.title = config.title || '页面演示'; $('eyebrow').textContent = config.eyebrow || '移动页面 · 演示与评审';
    
    (config.sizes || [{value:'390x844',label:'iPhone 标准 · 390 × 844'}]).forEach(s => { const o = el('option', '', s.label); o.value = s.value; $('size').append(o); });
    const params = new URLSearchParams(location.search), requestedSize = params.get('size') || config.defaultSize;
    if ([...$('size').options].some(o => o.value === requestedSize)) $('size').value = requestedSize;
    $('size').addEventListener('change', fit); new ResizeObserver(fit).observe($('stage')); new ResizeObserver(schedule).observe(rail);
    window.addEventListener('scroll', schedule, {passive: true}); window.addEventListener('resize', schedule); document.fonts?.ready.then(schedule);
    selectView(params.get('view') || config.defaultView);
  }
  start().catch(e => error(e.message));
})();
