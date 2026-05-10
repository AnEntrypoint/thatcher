export function minifyJS(code) {
  return code
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s+/gm, '')
    .replace(/\s+$/gm, '')
    .replace(/\n+/g, '\n')
    .replace(/\s*([{}()\[\];:,=<>!+\-*\/&|?])\s*/g, '$1')
    .trim();
}

export function minifyCSS(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}:;,>~+])\s*/g, '$1')
    .replace(/;}/g, '}')
    .trim();
}
