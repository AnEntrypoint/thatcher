'use server';

import { create, update, remove } from '@/engine';
import { requireUser, check } from '@/engine.server';
import { getSpec } from '@/config/spec-helpers';
import { revalidatePath } from '@/lib/next-polyfills';

export async function serverCreateEntity(entityName, data) {
  const user = await requireUser();
  const spec = getSpec(entityName);
  await check(user, spec, 'create');
  const result = create(entityName, data, user);
  revalidatePath(`/${entityName}`);
  return result;
}

export async function serverUpdateEntity(entityName, id, data) {
  const user = await requireUser();
  const spec = getSpec(entityName);
  await check(user, spec, 'edit');
  const result = update(entityName, id, data, user);
  revalidatePath(`/${entityName}/${id}`);
  revalidatePath(`/${entityName}`);
  return result;
}

export async function serverDeleteEntity(entityName, id) {
  const user = await requireUser();
  const spec = getSpec(entityName);
  await check(user, spec, 'delete');
  const result = remove(entityName, id);
  revalidatePath(`/${entityName}`);
  return result;
}
