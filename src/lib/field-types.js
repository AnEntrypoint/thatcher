const TRUNCATE = { text: 50, textarea: 100, json: 80 };
const INDICATORS = { text: '...', multiline: '... (see more)', json: '... (see more)' };
const DATE_FORMATS = {
  short: { month: 'short', day: 'numeric', year: 'numeric' },
  long: { month: 'long', day: 'numeric', year: 'numeric' },
  time: { hour: '2-digit', minute: '2-digit' },
  datetime: { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' },
  iso: 'iso',
};

const SECONDS_TO_MS = 1000;

export function secondsToDate(seconds) {
  return seconds ? new Date(seconds * SECONDS_TO_MS) : null;
}

export function dateToSeconds(date) {
  return date ? Math.floor(date.getTime() / SECONDS_TO_MS) : null;
}

export function formatDate(value, format = 'short') {
  if (!value) return null;
  const date = typeof value === 'number' ? secondsToDate(value) : new Date(value);
  if (isNaN(date.getTime())) return null;
  if (format === 'iso') return date.toISOString().split('T')[0];
  const opts = DATE_FORMATS[format] || DATE_FORMATS.short;
  return date.toLocaleDateString(undefined, opts);
}

export function parseDate(dateString) {
  if (!dateString) return null;
  return dateToSeconds(new Date(dateString));
}

function truncateText(text, limit = TRUNCATE.text, indicator = INDICATORS.text) {
  if (!text) return '';
  const str = String(text);
  return str.length > limit ? str.substring(0, limit) + indicator : str;
}

function truncateJson(val) {
  const str = typeof val === 'string' ? val : JSON.stringify(val);
  return str.length > TRUNCATE.json ? str.substring(0, TRUNCATE.json) + INDICATORS.json : str;
}

function truncateTextarea(text) {
  return truncateText(text, TRUNCATE.textarea, INDICATORS.multiline);
}

function createSimpleType(sqlType, overrides = {}) {
  return { sqlType, coerce: (val) => val, format: (val) => val, isValid: () => true, ...overrides };
}

function createNumberType(sqlType, coerceFn, formatFn) {
  return { sqlType, coerce: coerceFn, format: formatFn, isValid: () => true };
}

function createDateType(sqlType, formatType) {
  return {
    sqlType,
    coerce: (val) => (!val || typeof val !== 'string' ? val : dateToSeconds(new Date(val))),
    format: (val) => formatDate(val, formatType),
    isValid: (val) => !isNaN(new Date(val).getTime()),
  };
}

export const fieldRegistry = {
  text: createSimpleType('TEXT', { format: (val) => String(val ?? '') }),
  email: createSimpleType('TEXT', {
    format: (val) => String(val ?? ''),
    isValid: (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
  }),
  textarea: createSimpleType('TEXT', { format: (val) => truncateTextarea(String(val ?? '')) }),
  int: createNumberType('INTEGER', (val) => {
    if (val === undefined || val === '' || val === null) return null;
    const num = parseInt(val, 10);
    if (isNaN(num)) throw new Error(`Invalid integer: ${val}`);
    return num;
  }, (val) => String(val ?? '')),
  number: createNumberType('REAL', (val) => {
    if (val === undefined || val === '' || val === null) return null;
    const num = parseFloat(val);
    if (isNaN(num)) throw new Error(`Invalid number: ${val}`);
    return num;
  }, (val) => String(val ?? '')),
  decimal: createNumberType('REAL', (val) => {
    if (val === undefined || val === '' || val === null) return null;
    const num = parseFloat(val);
    if (isNaN(num)) throw new Error(`Invalid decimal: ${val}`);
    return num;
  }, (val) => (typeof val === 'number' ? val.toFixed(2) : val)),
  bool: createSimpleType('INTEGER', {
    coerce: (val) => (val === true || val === 'true' || val === 'on' || val === 1 ? 1 : 0),
    format: (val) => (val ? 'Yes' : 'No'),
  }),
  date: createDateType('INTEGER', 'locale'),
  timestamp: createDateType('INTEGER', 'datetime'),
  enum: {
    sqlType: 'TEXT',
    coerce: (val) => val,
    format: (val, field, spec) => {
      if (!field.options || !spec || val === null || val === undefined) return String(val);
      const opt = spec.options?.[field.options]?.find(o => String(o.value) === String(val));
      return opt ? { label: opt.label, color: opt.color || 'gray' } : String(val);
    },
    isValid: () => true,
  },
  ref: {
    sqlType: 'TEXT',
    coerce: (val) => val,
    format: (val, field, spec, row) => {
      if (!field.display) return val;
      if (field.display === 'avatars' && Array.isArray(val)) return { type: 'avatars', users: val };
      return row?.[`${field.key}_display`] || val;
    },
    isValid: () => true,
  },
  json: createSimpleType('TEXT', {
    coerce: (val) => {
      if (val === undefined || val === '' || val === null) return null;
      return typeof val === 'string' ? val : JSON.stringify(val);
    },
    format: (val) => truncateJson(val),
  }),
  image: createSimpleType('TEXT'),
  id: createSimpleType('TEXT PRIMARY KEY'),
};

export function getFieldHandler(type) {
  return fieldRegistry[type] || fieldRegistry.text;
}

export function coerceFieldValue(value, type) {
  return getFieldHandler(type).coerce(value);
}

export function formatFieldValue(value, field, spec, row) {
  if (value === null || value === undefined || value === '') return null;
  return getFieldHandler(field.type).format(value, field, spec, row);
}

export function validateFieldValue(value, field) {
  return getFieldHandler(field.type).isValid(value, field);
}

export function getEnumOption(spec, optionsKey, value) {
  return spec.options?.[optionsKey]?.find(o => String(o.value) === String(value));
}

export function getEnumOptions(spec, optionsKey) {
  return spec.options?.[optionsKey] || [];
}

export { TRUNCATE as FIELD_TRUNCATE, INDICATORS as TRUNCATION_INDICATORS, DATE_FORMATS };
