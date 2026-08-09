// Minimal safe arithmetic expression evaluator for formula fields: tokenize
// -> recursive-descent parse -> evaluate, over a fixed grammar of + - * / ( )
// and bare field-name references only. Deliberately NOT eval/new Function/vm
// -- there is no code-injection surface because the parser only ever builds
// number/operator/identifier nodes and the evaluator only ever does
// arithmetic, never property access or function calls, regardless of what
// text the formula string contains.
const TOKEN_RE = /\s*(?:([0-9]+(?:\.[0-9]+)?)|([A-Za-z_][A-Za-z0-9_]*)|([+\-*/()]))/g;

function tokenize(formula) {
  const tokens = [];
  let idx = 0;
  while (idx < formula.length) {
    TOKEN_RE.lastIndex = idx;
    const m = TOKEN_RE.exec(formula);
    if (!m || m.index !== idx) {
      throw new Error(`Invalid character in formula at position ${idx}: "${formula[idx]}"`);
    }
    idx = TOKEN_RE.lastIndex;
    if (m[1] !== undefined) tokens.push({ type: 'number', value: Number(m[1]) });
    else if (m[2] !== undefined) tokens.push({ type: 'ident', value: m[2] });
    else if (m[3] !== undefined) tokens.push({ type: 'op', value: m[3] });
  }
  return tokens;
}

// Recursive-descent parser for: expr := term (('+' | '-') term)*
//                                term := factor (('*' | '/') factor)*
//                                factor := number | ident | '(' expr ')'
function parse(tokens) {
  let pos = 0;
  function peek() { return tokens[pos]; }
  function next() { return tokens[pos++]; }

  function parseFactor() {
    const t = peek();
    if (!t) throw new Error('Unexpected end of formula');
    if (t.type === 'number') { next(); return { type: 'number', value: t.value }; }
    if (t.type === 'ident') { next(); return { type: 'ident', value: t.value }; }
    if (t.type === 'op' && t.value === '(') {
      next();
      const node = parseExpr();
      const close = next();
      if (!close || close.type !== 'op' || close.value !== ')') throw new Error('Expected closing parenthesis');
      return node;
    }
    throw new Error(`Unexpected token: ${t.type === 'op' ? t.value : t.value}`);
  }

  function parseTerm() {
    let node = parseFactor();
    while (peek() && peek().type === 'op' && (peek().value === '*' || peek().value === '/')) {
      const opTok = next();
      node = { type: 'binop', op: opTok.value, left: node, right: parseFactor() };
    }
    return node;
  }

  function parseExpr() {
    let node = parseTerm();
    while (peek() && peek().type === 'op' && (peek().value === '+' || peek().value === '-')) {
      const opTok = next();
      node = { type: 'binop', op: opTok.value, left: node, right: parseTerm() };
    }
    return node;
  }

  const result = parseExpr();
  if (pos !== tokens.length) throw new Error(`Unexpected trailing tokens starting at "${tokens[pos].value}"`);
  return result;
}

// Every identifier the formula references must exist in allowedFieldNames
// (this entity's own spec.fields keys) -- checked up front so a formula
// naming an unknown/foreign field is rejected before evaluation is ever
// attempted, never silently treated as 0 or undefined.
function validateIdentifiers(node, allowedFieldNames) {
  if (node.type === 'ident') {
    if (!allowedFieldNames.has(node.value)) {
      throw new Error(`Formula references unknown field "${node.value}"`);
    }
    return;
  }
  if (node.type === 'binop') {
    validateIdentifiers(node.left, allowedFieldNames);
    validateIdentifiers(node.right, allowedFieldNames);
  }
}

function evaluateNode(node, record) {
  if (node.type === 'number') return node.value;
  if (node.type === 'ident') {
    const v = Number(record[node.value]);
    return Number.isFinite(v) ? v : 0;
  }
  if (node.type === 'binop') {
    const l = evaluateNode(node.left, record);
    const r = evaluateNode(node.right, record);
    if (node.op === '+') return l + r;
    if (node.op === '-') return l - r;
    if (node.op === '*') return l * r;
    if (node.op === '/') return r === 0 ? 0 : l / r;
  }
  throw new Error('Unreachable formula node');
}

// Parses AND validates a formula against a fixed set of allowed field names
// (this entity's own spec.fields keys), throwing on anything outside the
// arithmetic/identifier grammar or referencing an unknown field. Call once
// at spec-generation or first-use time to fail fast on a malformed formula
// definition, separately from per-record evaluation.
export function compileFormula(formula, allowedFieldNames) {
  const tokens = tokenize(formula);
  const ast = parse(tokens);
  validateIdentifiers(ast, allowedFieldNames);
  return ast;
}

export function evaluateFormula(formula, record, allowedFieldNames) {
  const ast = compileFormula(formula, allowedFieldNames);
  return evaluateNode(ast, record);
}
