export function isValidEmail(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, reason: 'Email is required' };
  }

  const trimmed = email.trim().toLowerCase();
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!EMAIL_REGEX.test(trimmed)) {
    return { valid: false, reason: 'Invalid email format' };
  }

  const domain = trimmed.split('@')[1];
  if (!domain || domain.length < 3 || !domain.includes('.')) {
    return { valid: false, reason: 'Invalid email domain' };
  }

  // Disposable email domains
  const DISPOSABLE_DOMAINS = new Set([
    'mailinator.com', 'guerrillamail.com', 'tempmail.com',
    'throwaway.email', 'yopmail.com', '10minutemail.com',
  ]);

  if (DISPOSABLE_DOMAINS.has(domain)) {
    return { valid: false, reason: 'Disposable email addresses are not allowed' };
  }

  return { valid: true, email: trimmed, domain };
}

export function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function isWithinYears(timestamp, minYearsAgo = 10, maxYearsAhead = 5) {
  const now = Date.now() / 1000;
  const secondsInYear = 365.25 * 24 * 60 * 60;
  return (
    timestamp > now - (minYearsAgo * secondsInYear) &&
    timestamp < now + (maxYearsAhead * secondsInYear)
  );
}

export function isBeforeDate(date1, date2) {
  return date1 < date2;
}

export function slugify(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getMissingFields(data, requiredFields) {
  return requiredFields.filter(field => {
    const val = data[field];
    return val === undefined || val === null || val === '';
  });
}
