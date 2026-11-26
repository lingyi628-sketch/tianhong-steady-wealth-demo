/* Optional bridge: include this on a cross-origin phone page you control.
   <script src="phone-bridge.js" data-parent-origin="https://your-user.github.io"></script> */
(() => {
  'use strict';
  const parentOrigin = document.currentScript?.dataset.parentOrigin || location.origin;
  let requested = [], tick;
  const schedule = () => { cancelAnimationFrame(tick); tick = requestAnimationFrame(send); };
  function send() {
    const bounds = requested.map(n => { try { const b = document.querySelector(n.target)?.getBoundingClientRect(); return b && b.height > 0 ? {id: n.id, top: b.top, height: b.height} : null; } catch (_) { return null; } }).filter(Boolean);
    parent.postMessage({type: 'demo:bounds', bounds}, parentOrigin);
  }
  window.addEventListener('message', event => {
    if (event.source !== parent || event.origin !== parentOrigin) return;
    if (event.data?.type === 'demo:observe' && Array.isArray(event.data.notes)) {
      requested = event.data.notes.filter(n => typeof n.id === 'string' && typeof n.target === 'string'); schedule();
    }
    if (event.data?.type === 'demo:jump' && typeof event.data.target === 'string' && requested.some(n => n.target === event.data.target)) {
      try { document.querySelector(event.data.target)?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'}); } catch (_) { /* invalid or unmounted anchor */ }
    }
  });
  document.addEventListener('scroll', schedule, {passive:true,capture:true}); document.addEventListener('load', schedule, true);
  window.addEventListener('resize', schedule);
  const observe = () => { new ResizeObserver(schedule).observe(document.body); new MutationObserver(schedule).observe(document.body,{subtree:true,childList:true,attributes:true,characterData:true}); document.fonts?.ready.then(schedule); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observe, {once:true}); else observe();
})();
