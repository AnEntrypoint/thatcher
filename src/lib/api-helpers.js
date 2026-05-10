
import { NextResponse } from '@/lib/next-polyfills';
import { getSpec } from '@/config/spec-helpers';
import { migrate } from '@/engine';
import { getUser } from '@/engine.server';
import { can } from '@/services/permission.service';
import { logger } from '@/lib/logger';
import { HTTP } from '@/config/constants';
import { ERROR_MESSAGES } from '@/config';

let dbInit = false;
export function ensureDb() {
  if (!dbInit) {
    migrate();
    dbInit = true;
  } else {
  }
}

const withMetadata = (data, status = HTTP.OK, type = 'success') => ({
  status,
  type,
  timestamp: new Date().toISOString(),
  data,
  ...(!data.error && { success: true }),
});

export const ok = (data) => NextResponse.json(withMetadata(data, HTTP.OK, 'success'));
export const created = (data) => NextResponse.json(withMetadata(data, HTTP.CREATED, 'created'), { status: HTTP.CREATED });
export const notFound = (entity = 'Resource') => NextResponse.json(withMetadata({ error: ERROR_MESSAGES.notFound(entity) }, HTTP.NOT_FOUND, 'error'), { status: HTTP.NOT_FOUND });
export const badRequest = (reason = 'invalid data') => NextResponse.json(withMetadata({ error: ERROR_MESSAGES.invalidRequest(reason) }, HTTP.BAD_REQUEST, 'error'), { status: HTTP.BAD_REQUEST });
export const unauthorized = (action = 'perform this action') => NextResponse.json(withMetadata({ error: ERROR_MESSAGES.permission.denied }, HTTP.FORBIDDEN, 'error'), { status: HTTP.FORBIDDEN });
export const serverError = (msg = null) => NextResponse.json(withMetadata({ error: msg || ERROR_MESSAGES.operationFailed('server operation') }, HTTP.INTERNAL_ERROR, 'error'), { status: HTTP.INTERNAL_ERROR });

export async function withEntityAccess(entity, action, handler) {
  ensureDb();
  try {
    let spec;
    try { spec = getSpec(entity); } catch { return notFound(entity); }
    const user = await getUser();
    if (!can(user, spec, action)) return unauthorized(action);
    return await handler(spec, user);
  } catch (e) {
    logger.apiError(action, entity, e);
    return serverError(e.message);
  }
}

export async function parseParams(params) {
  const { entity, path = [] } = await params;
  const [id, childKey] = path;
  return { entity, id, childKey, path };
}
