export function validateURL(url) {
  if (!url || typeof url !== 'string') return { valid: false, reason: 'URL required' };
  
  try {
    const parsed = new URL(url);
    const ALLOWED_PROTOCOLS = ['http:', 'https:'];
    if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
      return { valid: false, reason: `Protocol ${parsed.protocol} not allowed` };
    }
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      return { valid: false, reason: 'localhost URLs not allowed' };
    }
    return { valid: true, url: url };
  } catch (err) {
    return { valid: false, reason: 'Invalid URL format' };
  }
}

export function validatePhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') return { valid: false, reason: 'Phone number required' };
  const cleaned = phone.replace(/[^0-9+]/g, '');
  if (cleaned.length < 10 || cleaned.length > 15) {
    return { valid: false, reason: 'Invalid phone number length' };
  }
  return { valid: true, phone: cleaned };
}

export function validatePostalCode(postal, country = 'US') {
  if (!postal || typeof postal !== 'string') return { valid: false, reason: 'Postal code required' };
  const patterns = {
    US: /^\d{5}(-\d{4})?$/,
    CA: /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i,
    UK: /^[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}$/i
  };
  const pattern = patterns[country] || patterns.US;
  if (!pattern.test(postal)) {
    return { valid: false, reason: `Invalid ${country} postal code format` };
  }
  return { valid: true, postal };
}

export function validateCreditCard(number) {
  if (!number || typeof number !== 'string') return { valid: false, reason: 'Card number required' };
  const cleaned = number.replace(/\D/g, '');
  if (cleaned.length < 13 || cleaned.length > 19) {
    return { valid: false, reason: 'Invalid card number length' };
  }
  let sum = 0;
  let isEven = false;
  for (let i = cleaned.length - 1; i >= 0; i--) {
    let digit = parseInt(cleaned[i]);
    if (isEven) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    isEven = !isEven;
  }
  if (sum % 10 !== 0) {
    return { valid: false, reason: 'Invalid card number (failed Luhn check)' };
  }
  return { valid: true, card: cleaned };
}

export function validatePassword(password, options = {}) {
  const { minLength = 8, requireUppercase = true, requireLowercase = true, requireNumber = true, requireSpecial = true } = options;
  const errors = [];
  
  if (!password || typeof password !== 'string') {
    return { valid: false, errors: ['Password required'] };
  }
  
  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters`);
  }
  
  if (requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain uppercase letter');
  }
  
  if (requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain lowercase letter');
  }
  
  if (requireNumber && !/\d/.test(password)) {
    errors.push('Password must contain number');
  }
  
  if (requireSpecial && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain special character');
  }
  
  return { valid: errors.length === 0, errors };
}

export function validateIPAddress(ip) {
  if (!ip || typeof ip !== 'string') return { valid: false, reason: 'IP address required' };
  const ipv4Pattern = /^(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)$/;
  const ipv6Pattern = /^([0-9a-f]{1,4}:){7}[0-9a-f]{1,4}$/i;
  
  if (!ipv4Pattern.test(ip) && !ipv6Pattern.test(ip)) {
    return { valid: false, reason: 'Invalid IP address format' };
  }
  
  return { valid: true, ip };
}
