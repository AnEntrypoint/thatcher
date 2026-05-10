import { h } from '@/ui/webjsx.js'
import { getNavItems, getAdminItems, isPartner, isClerk } from '@/ui/permissions-ui.js'
import { TOAST_SCRIPT } from '@/ui/render-helpers.js'
import { FETCH_JSON_SCRIPT } from '@/ui/fetch-json.js'
import { aria, role, skipLink, liveRegion } from '@/lib/accessibility'

export function generateHtml(title, bodyContent, scripts = [], pathname = '/') {
  const scriptTags = scripts.map(s =>
    typeof s === 'string' ? `<script>${s.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--')}</script>` : `<script type="module" src="${s.src}"></script>`
  ).join('\n')

  const swRegistration = `
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js').catch(() => {});
    });
  }`

  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8">
    <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
  <link href="/ui/rippleui.css" rel="stylesheet"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
  <meta name="theme-color" content="#04141f">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <title>${title}</title>
  <link rel="preload" href="/ui/client.js" as="script" crossorigin>
  <link rel="preload" href="/ui/styles2.css" as="style">
  <link href="/ui/styles2.css" rel="stylesheet"/>
  <style>
    .skip-link{position:absolute;left:-9999px;z-index:999;padding:0.5rem 1rem;background:#000;color:#fff;text-decoration:none}
    .skip-link:focus{left:0;top:0}
    *:focus-visible{outline:2px solid #3b82f6;outline-offset:2px;border-radius:2px}
    .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border-width:0}
  </style>
</head>
<body>
  ${skipLink('#main-content', 'Skip to main content')}
  ${skipLink('#main-nav', 'Skip to navigation')}
  ${liveRegion('announcements', 'polite')}
  ${liveRegion('alerts', 'assertive')}
  <div id="app">${bodyContent}</div>
  <div id="ds-online-status" role="status" aria-live="polite">Offline</div>
  <button id="flexup-fab" type="button" aria-label="Open FlexUp chat" data-action="toggleFlexup" style="display:none">FX</button>
  <div id="flexup-dock" role="dialog" aria-label="FlexUp chat">
    <div class="fx-header">FlexUp Assistant</div>
    <div class="fx-body" id="flexup-body"><div class="fx-msg bot">Ask anything about this review.</div></div>
    <div class="fx-input-row"><input class="fx-input" id="flexup-input" placeholder="Ask a question..." aria-label="Question"/><button class="fx-send" data-action="sendFlexup">Send</button></div>
  </div>
  <script>
    (function(){var el=document.getElementById('ds-online-status');var prev=navigator.onLine;function up(){if(!el)return;var on=navigator.onLine;el.classList.toggle('offline',!on);el.textContent=on?'Online':'Offline';el.style.display=on?'none':'inline-block';if(on!==prev){if(window.showToast)window.showToast(on?'Back online':'You are offline',on?'success':'warning');prev=on}}window.addEventListener('online',up);window.addEventListener('offline',up);up();
    if(/^\\/review\\//.test(location.pathname)){var fab=document.getElementById('flexup-fab');if(fab)fab.style.display='inline-block'}
    window.toggleFlexup=function(){var d=document.getElementById('flexup-dock');if(d)d.classList.toggle('open')};
    window.sendFlexup=async function(){var i=document.getElementById('flexup-input'),b=document.getElementById('flexup-body');if(!i||!b||!i.value.trim())return;var q=i.value.trim();var u=document.createElement('div');u.className='fx-msg user';u.textContent=q;b.appendChild(u);i.value='';var pid=location.pathname.match(/\\/review\\/([^/]+)/);try{var res=await fetch('/api/mwr/ml-ask?review_id='+(pid&&pid[1]||'')+'&q='+encodeURIComponent(q));var data=await res.json();var bot=document.createElement('div');bot.className='fx-msg bot';bot.textContent=(data&&(data.answer||data.message||data.error))||'(no response)';b.appendChild(bot);b.scrollTop=b.scrollHeight}catch(e){var er=document.createElement('div');er.className='fx-msg bot';er.textContent='Error: '+e.message;b.appendChild(er)}};
    })();
  </script>
  <script type="importmap">
  { "imports": { "webjsx": "/lib/webjsx/index.js", "webjsx/jsx-runtime": "/lib/webjsx/jsx-runtime.js" } }
  </script>
  <script>${FETCH_JSON_SCRIPT}</script>
  <script src="/ui/event-delegation.js"></script>
  <script type="module" src="/ui/client.js"></script>
  ${scriptTags}
  <script>${swRegistration}</script>
</body>
</html>`
}

export function breadcrumb(items) {
  if (!items?.length) return ''
  return `<nav ${aria.label('Breadcrumb')} class="breadcrumb-clean">${items.map((item, i) =>
    i === items.length - 1
      ? `<span ${aria.current('page')}>${item.label}</span>`
      : `<a href="${item.href}">${item.label}</a><span class="breadcrumb-sep" aria-hidden="true">/</span>`
  ).join('')}</nav>`
}

export function nav(user, pathname = '') {
  const logoSvg = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>`
  const hamburgerSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`

  const isActive = (href) => pathname && (pathname === href || (href !== '/' && pathname.startsWith(href)))
  const linkClass = (href) => isActive(href) ? 'nav-link-active' : 'nav-link'

  const engLink = !isClerk(user) ? `<a href="/engagements" class="${linkClass('/engagements')}">Engagements</a>` : ''
  const clientLink = !isClerk(user) ? `<a href="/client" class="${linkClass('/client')}">Clients</a>` : ''
  const settingsLink = isPartner(user) ? `<a href="/admin/settings" class="${linkClass('/admin/settings')}">Settings</a>` : ''
  const reviewLink = `<a href="/review" class="${linkClass('/review')}">My Review</a>`

  const avatarInitial = user?.name?.charAt(0)?.toUpperCase() || 'U'
  const avatarColors = ['#1565c0','#2e7d32','#6a1b9a','#c62828','#e65100','#00695c']
  const avatarBg = avatarColors[(user?.name?.charCodeAt(0) || 0) % avatarColors.length]

  return `<nav id="main-nav" class="main-nav" ${role.navigation} ${aria.label('Main navigation')}>
  <div class="main-nav-brand">
    <a href="/" class="main-nav-brand-link" ${aria.label('Home')}>
      ${logoSvg}
      <span class="main-nav-brand-text">Moonlanding</span>
    </a>
  </div>
  <div class="nav-links-desktop" style="align-items:center;gap:1.25rem;flex-shrink:0">
    ${engLink}${clientLink}${settingsLink}${reviewLink}
  </div>
  <div class="main-nav-actions">
    <button id="theme-toggle" type="button" data-action="toggleTheme" aria-label="Toggle dark mode" title="Toggle theme" style="background:none;border:none;color:#ced4da;cursor:pointer;padding:6px;border-radius:4px;display:flex;align-items:center;min-width:32px;min-height:32px">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
    </button>
    <a href="/notifications" id="notif-bell" aria-label="Notifications" title="Notifications" style="position:relative;color:#ced4da;display:flex;align-items:center;padding:6px;border-radius:4px;text-decoration:none">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
      <span id="notif-count" style="display:none;position:absolute;top:2px;right:2px;background:#ef4444;color:#fff;border-radius:9999px;font-size:10px;font-weight:700;min-width:16px;height:16px;line-height:16px;text-align:center;padding:0 3px"></span>
    </a>
    <div class="nav-avatar" style="background:${avatarBg}" id="user-avatar" data-action="toggleUserMenu" data-pass-event title="${user?.name || 'User'}" aria-label="User menu" role="button" tabindex="0">
      ${avatarInitial}
    </div>
    <button class="nav-hamburger" data-action="toggleMobileNav" aria-label="Toggle navigation menu" aria-expanded="false" aria-controls="mobile-nav-drawer" style="background:none;border:none;color:#ced4da;cursor:pointer;padding:8px;border-radius:4px;align-items:center;justify-content:center;min-width:44px;min-height:44px">
      ${hamburgerSvg}
    </button>
  </div>
  <div id="user-dropdown" class="user-dropdown" ${role.menu}>
    <div class="user-dropdown-header">
      <div class="user-dropdown-name">${user?.name || ''}</div>
      <div class="user-dropdown-email">${user?.email || ''}</div>
      <div class="user-dropdown-role" style="text-transform:capitalize">${user?.role || ''}</div>
    </div>
    <a href="/api/auth/logout" class="user-dropdown-item">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
      Sign out
    </a>
  </div>
</nav>
<div id="mobile-nav-drawer" style="display:none;position:fixed;inset:0;z-index:200;pointer-events:none" aria-hidden="true">
  <div data-action="closeMobileNav" style="position:absolute;inset:0;background:rgba(0,0,0,0.5);pointer-events:auto"></div>
  <div style="position:absolute;left:0;top:0;bottom:0;width:280px;max-width:80vw;background:#04141f;padding:0;display:flex;flex-direction:column;transform:translateX(-100%);transition:transform 0.25s ease" id="mobile-nav-panel">
    <div class="mobile-nav-header-bar">
      <span class="mobile-nav-header-title">Moonlanding</span>
      <button data-action="closeMobileNav" class="mobile-nav-close-btn" aria-label="Close menu">&times;</button>
    </div>
    <nav style="flex:1;padding:0.5rem 0;overflow-y:auto">
      <a href="/" class="mobile-nav-link">Dashboard</a>
      ${!isClerk(user) ? `<a href="/engagements" class="mobile-nav-link">Engagements</a>` : ''}
      ${!isClerk(user) ? `<a href="/client" class="mobile-nav-link">Clients</a>` : ''}
      <a href="/review" class="mobile-nav-link">My Review</a>
      ${isPartner(user) ? `<a href="/admin/settings" class="mobile-nav-link">Settings</a>` : ''}
    </nav>
    <div class="mobile-nav-footer">
      <div class="mobile-nav-user-name">${user?.name || ''}</div>
      <div class="mobile-nav-user-email">${user?.email || ''}</div>
      <a href="/api/auth/logout" class="mobile-nav-logout">Sign out</a>
    </div>
  </div>
</div>
<div id="idle-warning-dialog" class="confirm-overlay" style="display:none" ${role.alertdialog} ${aria.labelledBy('idle-dialog-title')} ${aria.describedBy('idle-dialog-msg')} ${aria.hidden('true')}>
  <div class="confirm-dialog">
    <h2 id="idle-dialog-title" class="confirm-title">Session Expiring</h2>
    <div id="idle-dialog-msg" class="confirm-message">Your session will expire due to inactivity. You will be logged out in <span id="idle-countdown" ${aria.live('polite')}>5:00</span>.</div>
    <div class="confirm-actions"><button type="button" data-action="stayLoggedIn" class="btn btn-primary" ${aria.label('Stay logged in and reset timeout')}>Stay Logged In</button></div>
  </div>
</div>
<script>
window.loadingBtn=function(btn,loading,label){if(!btn)return;btn.disabled=loading;btn.style.opacity=loading?'0.7':'1';if(loading){btn._orig=btn.innerHTML;btn.innerHTML='<span class="btn-spinner"></span>'+(label||'Loading...');}else{btn.innerHTML=btn._orig||label||btn.innerHTML;btn.disabled=false}}
window.showToast=window.showToast||function(m,t){var c=document.getElementById('toast-container');if(!c){c=document.createElement('div');c.id='toast-container';c.className='toast-container';document.body.appendChild(c)}var d=document.createElement('div');d.className='toast toast-'+(t||'info');d.textContent=m;c.appendChild(d);setTimeout(function(){d.style.opacity='0';setTimeout(function(){d.remove()},300)},3000)}
window.toggleTheme=function(){var cur=document.documentElement.getAttribute('data-theme')||'light';var next=cur==='dark'?'light':'dark';document.documentElement.setAttribute('data-theme',next);try{localStorage.setItem('moonlanding-theme',next)}catch(_){}}
;(function(){try{var saved=localStorage.getItem('moonlanding-theme');if(saved){document.documentElement.setAttribute('data-theme',saved)}else if(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.setAttribute('data-theme','dark')}}catch(_){}})();
function toggleUserMenu(e){e.stopPropagation();var d=document.getElementById('user-dropdown');var visible=d.style.display==='block';d.style.display=visible?'none':'block'}
document.addEventListener('click',function(e){var d=document.getElementById('user-dropdown');if(d&&!d.contains(e.target)&&e.target.id!=='user-avatar'){d.style.display='none'}})
function toggleMobileNav(){var btn=document.querySelector('.nav-hamburger');var open=btn.getAttribute('aria-expanded')==='true';btn.setAttribute('aria-expanded',String(!open));var drawer=document.getElementById('mobile-nav-drawer');var panel=document.getElementById('mobile-nav-panel');drawer.style.display=open?'none':'block';drawer.setAttribute('aria-hidden',String(open));panel.style.transform=open?'translateX(-100%)':'translateX(0)'}
function closeMobileNav(){var btn=document.querySelector('.nav-hamburger');if(btn)btn.setAttribute('aria-expanded','false');var drawer=document.getElementById('mobile-nav-drawer');var panel=document.getElementById('mobile-nav-panel');if(drawer){drawer.style.display='none';drawer.setAttribute('aria-hidden','true');if(panel)panel.style.transform='translateX(-100%)'}}
document.addEventListener('keydown',function(e){if(e.key==='Escape')closeMobileNav()})
;(function(){var WARN_MS=25*60*1000,LOGOUT_MS=30*60*1000,last=Date.now(),warnTimer=null,logoutTimer=null,countdownId=null;
function reset(){last=Date.now();hideWarning();clearTimers();schedule()}
function schedule(){warnTimer=setTimeout(showWarning,WARN_MS);logoutTimer=setTimeout(doLogout,LOGOUT_MS)}
function clearTimers(){if(warnTimer){clearTimeout(warnTimer);warnTimer=null}if(logoutTimer){clearTimeout(logoutTimer);logoutTimer=null}if(countdownId){clearInterval(countdownId);countdownId=null}}
function showWarning(){var dlg=document.getElementById('idle-warning-dialog');if(dlg)dlg.style.display='flex';var remaining=LOGOUT_MS-(Date.now()-last);countdownId=setInterval(function(){remaining-=1000;if(remaining<=0){clearInterval(countdownId);doLogout();return}var m=Math.floor(remaining/60000),s=Math.floor((remaining%60000)/1000);var el=document.getElementById('idle-countdown');if(el)el.textContent=m+':'+(s<10?'0':'')+s},1000)}
function hideWarning(){var dlg=document.getElementById('idle-warning-dialog');if(dlg)dlg.style.display='none'}
function doLogout(){clearTimers();window.location.href='/api/auth/logout'}
window.stayLoggedIn=function(){fetch('/api/auth/me',{credentials:'same-origin'}).catch(function(){});reset()};
['mousemove','keypress','click','scroll','touchstart'].forEach(function(evt){document.addEventListener(evt,function(){var now=Date.now();if(now-last>60000){last=now;clearTimers();schedule()}else{last=now}},true)});
schedule()})();
</script>`
}

const NOTIF_SCRIPT = `(function(){function loadNotifCount(){fetch('/api/notifications?unread=1',{credentials:'same-origin'}).then(function(r){return r.json()}).then(function(d){var n=(d.data||[]).length;var el=document.getElementById('notif-count');if(!el)return;if(n>0){el.textContent=n>99?'99+':n;el.style.display='block'}else{el.style.display='none'}}).catch(function(){})}loadNotifCount();setInterval(loadNotifCount,60000)})();`;

export function page(user, title, bc, content, scripts = []) {
  const authData = user ? JSON.stringify({ id: user.id, name: user.name, email: user.email, role: user.role }) : 'null'
  const authScript = `window.__AUTH__=${authData};`
  const body = `<div class="min-h-screen">${nav(user)}<main id="main-content" ${role.main} class="page-shell">${breadcrumb(bc)}${content}</main></div>`
  return generateHtml(title, body, [authScript, NOTIF_SCRIPT, ...scripts])
}

export function fullPage(user, title, content, scripts = []) {
  const authData = user ? JSON.stringify({ id: user.id, name: user.name, email: user.email, role: user.role }) : 'null'
  const authScript = `window.__AUTH__=${authData};`
  const body = `<div class="min-h-screen flex flex-col">${nav(user)}<main id="main-content" ${role.main} class="page-shell-flush flex-1 flex flex-col">${content}</main></div>`
  return generateHtml(title, body, [authScript, ...scripts])
}

export function statCards(cards) {
  return `<div class="stats shadow w-full mb-6 flex-wrap">` +
    cards.map(c => `<div class="stat"><div class="stat-title">${c.label}</div><div class="stat-value text-2xl${c.textClass || ''}">${c.value}</div>${c.sub ? `<div class="stat-desc">${c.sub}</div>` : ''}</div>`).join('') +
    `</div>`
}

export function confirmDialog(entityName) {
  return `<div id="confirm-dialog" class="confirm-overlay" style="display:none" ${role.alertdialog} ${aria.labelledBy('confirm-title')} ${aria.describedBy('confirm-msg')} ${aria.hidden('true')}>
    <div class="confirm-dialog"><h2 id="confirm-title" class="confirm-title">Confirm Delete</h2>
    <div id="confirm-msg" class="confirm-message">Are you sure you want to delete this item? This action cannot be undone.</div>
    <div class="confirm-actions"><button type="button" data-action="cancelDelete" class="btn btn-ghost" ${aria.label('Cancel deletion')}>Cancel</button>
    <button type="button" id="confirm-delete-btn" data-action="executeDelete" class="btn btn-error" ${aria.label('Confirm deletion')}>Delete</button></div></div></div>`
}

export function dataTable(headers, rows, emptyMsg) {
  return `<div class="card-clean"><div class="table-wrap" ${role.region} ${aria.label('Data table')}><table class="data-table"><thead><tr>${headers}</tr></thead><tbody id="table-body">${rows || `<tr><td colspan="100" class="text-center py-8 text-base-content/50">${emptyMsg}</td></tr>`}</tbody></table></div></div>`
}
