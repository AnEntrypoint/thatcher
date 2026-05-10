import { NextResponse } from '@/lib/next-polyfills';
import {
  detectXSS,
  detectSQLInjection,
  sanitizeDeep,
  validateBusinessRules,
  rateLimitCheck,
  validateCSRFToken
} from '@/lib/validation';
import { validateEntity, validateUpdate, hasErrors } from '@/lib/validate';

export async function validateRequest(request, options = {}) {
  const { requireCSRF = true, rateLimit = { max: 100, window: 60000 }, entityName = null } = options;
  
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  const sessionId = request.headers.get('cookie')?.match(/session=([^;]+)/)?.[1] || ip;
  
  if (rateLimit) {
    const rateLimitResult = rateLimitCheck(ip, rateLimit.max, rateLimit.window);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded', resetAt: rateLimitResult.resetAt },
        { status: 429, headers: { 'Retry-After': Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000).toString() } }
      );
    }
  }
  
  if (requireCSRF && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
    const csrfToken = request.headers.get('x-csrf-token');
    const csrfCheck = validateCSRFToken(csrfToken, sessionId);
    if (!csrfCheck.valid) {
      return NextResponse.json(
        { success: false, error: csrfCheck.reason },
        { status: 403 }
      );
    }
  }
  
  return null;
}

export async function validateRequestBody(request, entityName, isUpdate = false, recordId = null) {
  let body;
  try {
    body = await request.json();
  } catch (err) {
    return {
      valid: false,
      response: NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    };
  }
  
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === 'string') {
      const xssCheck = detectXSS(value);
      if (!xssCheck.safe) {
        return {
          valid: false,
          response: NextResponse.json(
            { success: false, error: `XSS attempt detected in field '${key}'`, reason: xssCheck.reason },
            { status: 400 }
          )
        };
      }
      
      const sqlCheck = detectSQLInjection(value);
      if (!sqlCheck.safe) {
        return {
          valid: false,
          response: NextResponse.json(
            { success: false, error: `SQL injection attempt detected in field '${key}'`, reason: sqlCheck.reason },
            { status: 400 }
          )
        };
      }
    }
  }
  
  const sanitizedBody = sanitizeDeep(body);
  
  const validationErrors = isUpdate
    ? await validateUpdate(entityName, recordId, sanitizedBody)
    : await validateEntity(entityName, sanitizedBody);
  
  if (hasErrors(validationErrors)) {
    return {
      valid: false,
      response: NextResponse.json(
        { success: false, error: 'Validation failed', errors: validationErrors },
        { status: 400 }
      )
    };
  }
  
  const businessErrors = validateBusinessRules(entityName, sanitizedBody, isUpdate ? { id: recordId } : null);
  if (Object.keys(businessErrors).length > 0) {
    return {
      valid: false,
      response: NextResponse.json(
        { success: false, error: 'Business rule validation failed', errors: businessErrors },
        { status: 400 }
      )
    };
  }
  
  return { valid: true, body: sanitizedBody };
}

export function withValidation(handler, options = {}) {
  return async (request, context) => {
    const validationError = await validateRequest(request, options);
    if (validationError) return validationError;
    
    return handler(request, context);
  };
}

export function withBodyValidation(handler, entityName, isUpdate = false) {
  return async (request, context) => {
    const validationError = await validateRequest(request);
    if (validationError) return validationError;
    
    const recordId = isUpdate ? context?.params?.id : null;
    const bodyValidation = await validateRequestBody(request, entityName, isUpdate, recordId);
    
    if (!bodyValidation.valid) return bodyValidation.response;
    
    return handler(request, { ...context, validatedBody: bodyValidation.body });
  };
}
