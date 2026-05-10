import { getUser } from '@/engine.server';
import { getSpec } from '@/config/spec-helpers';
import { API_ENDPOINTS } from '@/config';
import { can } from '@/services/permission.service';
import { list, get, create, update, remove, listWithPagination, search } from '@/lib/query-engine';
import { validateEntity, validateUpdate, hasErrors } from '@/lib/validate';
import { broadcastUpdate } from '@/lib/realtime-server';
import { UnauthorizedError, PermissionError, NotFoundError, ValidationError, AppError } from '@/lib/error-handler';
import { ok, created, paginated } from '@/lib/response-formatter';
import { QueryAdapter } from '@/lib/query-string-adapter';
import { withErrorHandler } from '@/lib/with-error-handler';
import { HTTP } from '@/config/constants';

const createHandler = (entity, action) => async (request, { params, searchParams }) => {
  const user = await getUser();
  if (!user) throw UnauthorizedError('Authentication required');

  const spec = getSpec(entity);
  if (!spec) throw NotFoundError('entity', entity);
  if (!can(user, spec, action)) throw PermissionError(`Cannot ${action} ${entity}`);

  const { id } = params;
  const { q, page, pageSize } = QueryAdapter.fromSearchParams(searchParams, spec);

  if (action === 'list') {
    if (q) {
      const items = search(entity, q);
      return ok({ items });
    }
    const { items, pagination } = listWithPagination(entity, {}, page, pageSize);
    return paginated(items, pagination);
  }

  if (action === 'get') {
    if (!id) throw new AppError('ID required', 'BAD_REQUEST', HTTP.BAD_REQUEST);
    const item = get(entity, id);
    if (!item) throw NotFoundError(entity, id);
    return ok(item);
  }

  if (action === 'create') {
    const data = await request.json();
    const errors = await validateEntity(spec, data);
    if (hasErrors(errors)) throw new ValidationError('Validation failed', errors);

    const result = create(entity, data, user);
    broadcastUpdate(API_ENDPOINTS.entity(entity), 'create', result);
    return created(result);
  }

  if (action === 'update') {
    if (!id) throw new AppError('ID required', 'BAD_REQUEST', HTTP.BAD_REQUEST);
    const prev = get(entity, id);
    if (!prev) throw NotFoundError(entity, id);

    const data = await request.json();
    const errors = await validateUpdate(spec, id, data);
    if (hasErrors(errors)) throw new ValidationError('Validation failed', errors);

    update(entity, id, data, user);
    const result = get(entity, id);
    broadcastUpdate(API_ENDPOINTS.entityId(entity, id), 'update', result);
    return ok(result);
  }

  if (action === 'delete') {
    if (!id) throw new AppError('ID required', 'BAD_REQUEST', HTTP.BAD_REQUEST);
    if (!get(entity, id)) throw NotFoundError(entity, id);

    remove(entity, id);
    broadcastUpdate(API_ENDPOINTS.entityId(entity, id), 'delete', { id });
    return ok({ success: true });
  }

  throw new AppError('Unknown action', 'BAD_REQUEST', HTTP.BAD_REQUEST);
};

export const createApiHandler = (entity, action) =>
  withErrorHandler(
    (request, { params, searchParams }) => createHandler(entity, action)(request, { params, searchParams }),
    `API:${entity}:${action}`
  );
