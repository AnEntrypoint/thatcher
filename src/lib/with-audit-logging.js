import { logCreate, logUpdate, logDelete, logAuthzFailure, logPerformance, logError } from '@/lib/audit-logger-enhanced';

const extractEntityInfo = (request, params = {}) => {
  const url = new URL(request.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const entityType = parts[parts.length - 2] || 'unknown';
  const entityId = params.id || params.engagementId || params.reviewId || params.highlightId || params.permissionId || parts[parts.length - 1];
  return { entityType, entityId };
};

export const withAuditLogging = (handler, options = {}) => {
  return async (request, context = {}) => {
    const startTime = Date.now();
    const method = request.method;
    const { entityType: defaultEntityType, entityId: defaultEntityId } = extractEntityInfo(request, context.params || {});
    const entityType = options.entityType || defaultEntityType;
    let response;
    let userId = null;
    let entityId = defaultEntityId;

    try {
      response = await handler(request, context);
      const endTime = Date.now();
      const durationMs = endTime - startTime;

      if (response.userId) userId = response.userId;
      if (response.user && response.user.id) userId = response.user.id;

      const body = response instanceof Response ? await response.clone().json().catch(() => ({})) : response;
      if (body.user && body.user.id) userId = body.user.id;

      if (method === 'POST' && response.status >= 200 && response.status < 300) {
        const createdId = body.id || body.data?.id || entityId;
        logCreate(entityType, createdId, userId, body.data || body);
      }

      if (method === 'PATCH' && response.status >= 200 && response.status < 300) {
        logUpdate(entityType, entityId, userId, null, body.data || body);
      }

      if (method === 'DELETE' && response.status >= 200 && response.status < 300) {
        logDelete(entityType, entityId, userId, null);
      }

      if (durationMs > 500) {
        logPerformance(`${method} ${entityType}`, entityType, durationMs, userId);
      }

      if (response.status === 403) {
        logAuthzFailure(userId, entityType, entityId, 'unknown', { method, path: request.url });
      }

      return response;
    } catch (error) {
      logError(error, { entityType, entityId, userId, method, path: request.url });
      throw error;
    }
  };
};

export const auditCreate = (entityType, entityId, userId, afterState) => logCreate(entityType, entityId, userId, afterState);
export const auditUpdate = (entityType, entityId, userId, beforeState, afterState) => logUpdate(entityType, entityId, userId, beforeState, afterState);
export const auditDelete = (entityType, entityId, userId, beforeState) => logDelete(entityType, entityId, userId, beforeState);
