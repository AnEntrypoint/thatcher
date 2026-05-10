import { getSpec, getNavItems } from '@/config/spec-helpers';
import { get, getChildren } from '@/engine';
import { can } from '@/services/permission.service';
import { withPageAuth } from '@/lib/auth-middleware';
import { notFound } from '@/lib/next-polyfills';
import { loadFormOptions } from '@/lib/utils';

export { withPageAuth as requireEntityAccess };

export async function getEntityData(entityName, id, options = {}) {
  const { user, spec } = await withPageAuth(entityName, 'view', options);
  const data = get(entityName, id);
  if (!data) notFound();
  const children = spec.children ? Object.fromEntries(Object.entries(spec.children).map(([k, def]) => [k, getChildren(entityName, id, def)])) : {};
  return { user, spec, data, children };
}

export async function getFormContext(entityName, id = null, action = 'create') {
  const { user, spec } = await withPageAuth(entityName, action, { redirectTo: id ? `/${entityName}/${id}` : `/${entityName}` });
  const data = id ? get(entityName, id) : {};
  if (id && !data) notFound();
  const options = await loadFormOptions(spec);
  return { user, spec, data, options };
}

export const getPageProps = (user, spec) => ({ user, nav: getNavItems(), canCreate: can(user, spec, 'create'), canEdit: can(user, spec, 'edit'), canDelete: can(user, spec, 'delete') });

const createMeta = (fn) => (...args) => { try { return fn(...args); } catch { return { title: 'Not Found' }; } };

export const listMetadata = createMeta((entity) => ({ title: getSpec(entity).labelPlural }));
export const detailMetadata = createMeta((entity, id) => { const spec = getSpec(entity), data = get(entity, id); return { title: data?.name || data?.email || spec.label }; });
export const newMetadata = createMeta((entity) => ({ title: `New ${getSpec(entity).label}` }));
export const editMetadata = createMeta((entity, id) => { const spec = getSpec(entity), data = get(entity, id); return { title: `Edit ${data?.name || spec.label}` }; });
