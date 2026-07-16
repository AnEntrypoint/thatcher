export function reviewZoneNav(reviewId, active) {
  const links = [
    { href: `/review/${reviewId}`, label: 'Overview', key: 'overview' },
    { href: `/review/${reviewId}/pdf`, label: 'PDF', key: 'pdf' },
    { href: `/review/${reviewId}/highlights`, label: 'Highlights', key: 'highlights' },
    { href: `/review/${reviewId}/sections`, label: 'Sections', key: 'sections' },
    { href: `/review/${reviewId}/resolution`, label: 'Resolution', key: 'resolution' },
  ];
  return `<nav class="tab-bar" style="margin-bottom:1.25rem;overflow-x:auto;scrollbar-width:none">
    ${links.map(l => `<a href="${l.href}" class="tab-btn${l.key===active?' active':''}">${l.label}</a>`).join('')}
  </nav>`;
}
