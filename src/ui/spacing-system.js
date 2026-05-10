export const SPACING = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
};

export function renderPageWrapper(content, opts = {}) {
  const padding = opts.padding || 'var(--page-gutter, 1rem)';
  return `<div style="padding:${padding};max-width:100%">${content}</div>`;
}

export function renderSection(content, opts = {}) {
  const marginBottom = opts.marginBottom || SPACING.lg;
  return `<div style="margin-bottom:${marginBottom}">${content}</div>`;
}

export function renderCard(content, opts = {}) {
  const padding = opts.padding !== undefined ? opts.padding : SPACING.md;
  const marginBottom = opts.marginBottom || SPACING.md;
  const className = opts.className ? ` ${opts.className}` : '';
  const id = opts.id ? ` id="${opts.id}"` : '';
  return `<div class="card-clean${className}"${id} style="margin-bottom:${marginBottom}"><div class="card-clean-body" style="padding:${padding}">${content}</div></div>`;
}

export function renderCardHeader(content, marginBottom = SPACING.md) {
  return `<h2 style="font-size:0.875rem;font-weight:600;margin-bottom:${marginBottom}">${content}</h2>`;
}

export function renderCardGrid(cols, gap = SPACING.md, marginBottom = SPACING.lg) {
  const colsStr = cols === 2 ? '1fr 1fr' : cols === 3 ? '1fr 1fr 1fr' : '1fr';
  return {
    wrap: (content) => `<div style="display:grid;grid-template-columns:${colsStr};gap:${gap};margin-bottom:${marginBottom}">${content}</div>`,
    col: (content) => `<div>${content}</div>`,
  };
}

export function renderTable(cols, rows, marginTop = SPACING.md) {
  return `<div class="table-wrap" style="margin-top:${marginTop}"><table class="data-table">
    <thead><tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead>
    <tbody>${rows || `<tr><td colspan="${cols.length}" style="text-align:center;padding:${SPACING.lg} 0;color:var(--color-text-muted)">No data</td></tr>`}</tbody>
  </table></div>`;
}

export function renderFlex(content, opts = {}) {
  const { gap = SPACING.md, direction = 'row', justify = 'flex-start', align = 'center', marginBottom = SPACING.md, className = '', wrap = 'nowrap' } = opts;
  const flexDirection = direction === 'col' ? 'column' : 'row';
  return `<div class="${className}" style="display:flex;flex-direction:${flexDirection};gap:${gap};justify-content:${justify};align-items:${align};margin-bottom:${marginBottom};flex-wrap:${wrap}">${content}</div>`;
}

export function renderTabBar(tabs, activeDef = null) {
  return `<nav class="tab-bar" style="margin-bottom:${SPACING.lg};overflow-x:auto;scrollbar-width:none">
    ${tabs.map(t => `<a href="${t.href}" class="tab-btn${t.key === activeDef ? ' active' : ''}">${t.label}</a>`).join('')}
  </nav>`;
}

export function renderInfoGrid(items) {
  return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:${SPACING.md}">
    ${items.map(([label, value]) => `<div class="info-card">
      <div class="info-label">${label}</div>
      <div class="info-value">${value}</div>
    </div>`).join('')}
  </div>`;
}

export function renderButton(label, opts = {}) {
  const { onclick, action, args, href, variant = 'ghost', size = 'sm', style = '', disabled = false } = opts;
  const variantMap = {
    primary: 'btn-primary-clean',
    ghost: 'btn-ghost-clean',
    danger: 'btn-danger-clean',
    outline: 'btn-ghost-clean',
    success: 'btn-primary-clean',
  };
  const btnClass = variantMap[variant] || 'btn-ghost-clean';
  const sizeStyle = size === 'sm' ? 'font-size:13px;padding:6px 14px' : '';
  const extraStyle = [sizeStyle, style].filter(Boolean).join(';');

  if (href) {
    return `<a href="${href}" class="${btnClass}" style="${extraStyle}">${label}</a>`;
  }

  if (action) {
    const argsAttr = args ? ` data-args='${JSON.stringify(args)}'` : '';
    return `<button data-action="${action}"${argsAttr} class="${btnClass}" ${disabled ? 'disabled' : ''} style="${extraStyle}">${label}</button>`;
  }

  return `<button onclick="${onclick}" class="${btnClass}" ${disabled ? 'disabled' : ''} style="${extraStyle}">${label}</button>`;
}

export function renderProgress(value, max = 100, variant = 'success', marginTop = SPACING.md) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return `<div style="margin-top:${typeof marginTop === 'string' ? marginTop : SPACING.md}">
    <div style="display:flex;justify-content:space-between;margin-bottom:${SPACING.sm};align-items:center">
      <span style="font-size:0.8rem;font-weight:600;color:var(--color-text-muted)">Progress</span>
      <span style="font-size:0.8rem;color:var(--color-text-light)">${pct}%</span>
    </div>
    <div class="resolution-bar">
      <div class="resolution-bar-segment resolution-bar-resolved" style="width:${pct}%"></div>
    </div>
  </div>`;
}

export function renderBadge(text, variant = 'success') {
  const map = { success: 'pill pill-success', danger: 'pill pill-danger', warning: 'pill pill-warning', info: 'pill pill-info', neutral: 'pill pill-neutral' };
  const cls = map[variant] || 'pill pill-neutral';
  return `<span class="${cls}">${text}</span>`;
}

export function renderEmptyState(message, marginTop = SPACING.lg) {
  return `<div style="text-align:center;padding:${SPACING.xl} ${SPACING.md};color:var(--color-text-muted);margin-top:${marginTop}">${message}</div>`;
}

export function renderStatsRow(stats) {
  return `<div class="stats-row">${stats.map(s => `<div class="stat-card">
    <div class="stat-card-value" style="${s.color ? `color:${s.color}` : ''}">${s.value}</div>
    <div class="stat-card-label">${s.label}</div>
    ${s.sub ? `<div class="stat-card-sub">${s.sub}</div>` : ''}
  </div>`).join('')}</div>`;
}

export function renderPageHeader(title, subtitle, actionsHtml = '') {
  return `<div class="page-header">
    <div>
      <h1 class="page-title">${title}</h1>
      ${subtitle ? `<p class="page-subtitle">${subtitle}</p>` : ''}
    </div>
    ${actionsHtml ? `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">${actionsHtml}</div>` : ''}
  </div>`;
}

export function renderResolutionBar(resolved, partial, total) {
  if (total === 0) return `<div style="font-size:13px;color:var(--color-text-light);font-style:italic">No highlights</div>`;
  const rPct = Math.round((resolved / total) * 100);
  const pPct = Math.round((partial / total) * 100);
  const uPct = Math.max(0, 100 - rPct - pPct);
  return `<div class="resolution-bar">
    <div class="resolution-bar-segment resolution-bar-resolved" style="width:${rPct}%"></div>
    <div class="resolution-bar-segment resolution-bar-partial" style="width:${pPct}%"></div>
    <div class="resolution-bar-segment resolution-bar-open" style="width:${uPct}%"></div>
  </div>
  <div class="resolution-legend">
    <span class="resolution-legend-resolved">${resolved} resolved</span>
    <span class="resolution-legend-partial">${partial} partial</span>
    <span class="resolution-legend-open">${total - resolved - partial} open</span>
  </div>`;
}

export function renderFilterBar(filters, activeKey = 'all') {
  return `<div class="review-filter-bar">${filters.map(f => {
    const actionAttr = f.action ? `data-action="${f.action}"${f.args ? ` data-args='${JSON.stringify(f.args)}'` : ''}` : (f.onclick ? `onclick="${f.onclick}"` : '');
    return `<button class="pill${f.key === activeKey ? ' pill-primary' : ' pill-neutral'}" data-thread-filter="${f.key}" ${actionAttr}>${f.label}${f.count !== undefined ? ` (${f.count})` : ''}</button>`;
  }).join('')}</div>`;
}
