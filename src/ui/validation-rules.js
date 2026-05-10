export const ValidationPatterns = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/,
  url: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_+.~#?&//=]*)$/,
  zip: /^\d{5}(-\d{4})?$/,
  alpha: /^[a-zA-Z]+$/,
  alphanumeric: /^[a-zA-Z0-9]+$/,
  numeric: /^[0-9]+$/,
  xss: /<script[^>]*>|javascript:|on\w+\s*=|<iframe|<object|<embed/gi
};

export const ValidationRules = {
  required(value) {
    return value !== null && value !== undefined && value !== '' ? null : 'This field is required';
  },
  
  minLength(value, min) {
    return (!value || value.length >= min) ? null : `Minimum length is ${min} characters`;
  },
  
  maxLength(value, max) {
    return (!value || value.length <= max) ? null : `Maximum length is ${max} characters`;
  },
  
  min(value, min) {
    const num = Number(value);
    return (!value || !isNaN(num) && num >= min) ? null : `Minimum value is ${min}`;
  },
  
  max(value, max) {
    const num = Number(value);
    return (!value || !isNaN(num) && num <= max) ? null : `Maximum value is ${max}`;
  },
  
  pattern(value, patternName) {
    const pattern = ValidationPatterns[patternName];
    if (!pattern) return `Unknown pattern: ${patternName}`;
    return (!value || pattern.test(value)) ? null : `Invalid format for ${patternName}`;
  },
  
  email(value) {
    return (!value || ValidationPatterns.email.test(value)) ? null : 'Invalid email address';
  },
  
  url(value) {
    return (!value || ValidationPatterns.url.test(value)) ? null : 'Invalid URL';
  },
  
  phone(value) {
    return (!value || ValidationPatterns.phone.test(value)) ? null : 'Invalid phone number';
  },
  
  noXSS(value) {
    return (!value || !ValidationPatterns.xss.test(value)) ? null : 'Invalid characters detected';
  },
  
  match(value, matchFieldId) {
    const matchField = document.getElementById(matchFieldId);
    const matchValue = matchField ? matchField.value : '';
    return (!value || value === matchValue) ? null : 'Values do not match';
  },
  
  fileSize(file, maxSizeBytes) {
    return (!file || file.size <= maxSizeBytes) ? null : `File size must be under ${Math.round(maxSizeBytes / 1024 / 1024)}MB`;
  },
  
  fileType(file, allowedTypes) {
    if (!file) return null;
    const ext = file.name.split('.').pop()?.toLowerCase();
    const allowed = allowedTypes.split(',').map(t => t.trim().toLowerCase());
    return allowed.includes(ext) ? null : `Only ${allowedTypes} files allowed`;
  }
};
