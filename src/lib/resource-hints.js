export function generateResourceHints(pathname) {
  const hints = [];
  
  hints.push({ rel: 'preload', href: '/ui/client.js', as: 'script' });
  hints.push({ rel: 'preload', href: '/ui/styles.css', as: 'style' });
  hints.push({ rel: 'preload', href: '/lib/webjsx/runtime.js', as: 'script' });
  
  hints.push({ rel: 'dns-prefetch', href: '//fonts.googleapis.com' });
  
  if (pathname === '/' || pathname === '/login') {
    hints.push({ rel: 'prefetch', href: '/api/friday/engagement' });
  }
  
  if (pathname.includes('/engagement')) {
    hints.push({ rel: 'prefetch', href: '/api/friday/rfi' });
    hints.push({ rel: 'prefetch', href: '/api/mwr/review' });
  }
  
  return hints;
}

export function renderResourceHints(hints) {
  return hints.map(h => {
    const attrs = Object.entries(h)
      .map(([k, v]) => `${k}="${v}"`)
      .join(' ');
    return `<link ${attrs}>`;
  }).join('\n  ');
}
