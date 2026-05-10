const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr', 'circle', 'path', 'line', 'rect'
])

function escapeHtml(str) {
  if (str === null || str === undefined) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderAttr(key, value) {
  if (value === null || value === undefined || value === false) return ''
  if (typeof value === 'function') return ''
  if (key === 'children' || key === 'innerHTML') return ''
  if (key === 'className') key = 'class'
  if (value === true) return ` ${key}`
  if (key === 'style' && typeof value === 'object') {
    const css = Object.entries(value)
      .map(([k, v]) => `${k.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}:${v}`)
      .join(';')
    return ` style="${escapeHtml(css)}"`
  }
  return ` ${key}="${escapeHtml(String(value))}"`
}

function renderChildren(children) {
  if (children === null || children === undefined || children === false) return ''
  if (typeof children === 'string' || typeof children === 'number') return String(children)
  if (Array.isArray(children)) return children.map(renderChildren).join('')
  return String(children)
}

export function h(type, props, ...children) {
  if (typeof type === 'function') {
    const merged = { ...props }
    const kids = children.length === 1 ? children[0] : children.length > 0 ? children : undefined
    if (kids !== undefined) merged.children = kids
    return type(merged)
  }

  const attrs = props ? Object.entries(props).map(([k, v]) => renderAttr(k, v)).join('') : ''
  const tag = type

  if (VOID_ELEMENTS.has(tag)) {
    return `<${tag}${attrs} />`
  }

  const inner = props?.innerHTML
    ? props.innerHTML
    : renderChildren(children.length > 0 ? children : props?.children)

  return `<${tag}${attrs}>${inner}</${tag}>`
}

export function Fragment({ children }) {
  return renderChildren(children)
}
