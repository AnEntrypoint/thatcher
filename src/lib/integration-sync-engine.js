import { list } from './busybase/store.js';
import { validateWebhookUrl } from './webhook-engine.js';
import { createLogger } from './logger.js';

const log = createLogger('[IntegrationSync]');
const REQUEST_TIMEOUT_MS = 15000;

// Records changed since the connection's last sync, read through the SAME
// {user}-scoped list() every interactive read path uses -- a sync job cannot
// reach records outside its owner's org just because it runs unattended.
export async function getRecordsChangedSince(entityName, sinceTs, user) {
  const records = await list(entityName, {}, { user });
  return records.filter(r => (r.updated_at || 0) > (sinceTs || 0));
}

function authHeader(connection) {
  if (connection.auth_type === 'oauth_token') return { Authorization: `Bearer ${connection.credential}` };
  return { 'X-Api-Key': connection.credential };
}

function mapRecordFields(record, mapping) {
  if (!mapping || typeof mapping !== 'object') return record;
  const mapped = {};
  for (const [localField, remoteField] of Object.entries(mapping)) {
    mapped[remoteField] = record[localField];
  }
  return mapped;
}

// connection.credential arrives here already decrypted (store.js decrypts on
// every list()/get()) -- this function only reads it into the auth header,
// never logs or persists it further.
export async function syncRecordToIntegration(connection, entityName, record) {
  const mappings = typeof connection.entity_mappings === 'string'
    ? JSON.parse(connection.entity_mappings || '{}')
    : (connection.entity_mappings || {});
  const entityMapping = mappings[entityName];
  if (!entityMapping) return { success: false, error: `No entity_mapping for "${entityName}"` };

  const targetUrl = `${connection.base_url.replace(/\/$/, '')}/api/sync/${entityMapping}`;
  // Same SSRF guard webhook-engine.js's dispatchWebhooks applies before any
  // outbound fetch -- reused verbatim, not reimplemented, so a connection
  // pointed at a private/loopback/link-local target is rejected here, before
  // any network call is made.
  const validation = await validateWebhookUrl(targetUrl);
  if (!validation.ok) {
    log.error(`integration_connection ${connection.id} target rejected: ${validation.error}`);
    return { success: false, error: validation.error };
  }

  const payload = mapRecordFields(record, mappings[`${entityName}_fields`] || mappings.fields);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader(connection) },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    return { success: res.ok, statusCode: res.status, error: res.ok ? null : `HTTP ${res.status}` };
  } catch (e) {
    return { success: false, statusCode: 0, error: e.message };
  } finally {
    clearTimeout(timeout);
  }
}

export async function syncConnection(connection, user) {
  const mappings = typeof connection.entity_mappings === 'string'
    ? JSON.parse(connection.entity_mappings || '{}')
    : (connection.entity_mappings || {});
  const entityNames = Object.keys(mappings).filter(k => !k.endsWith('_fields') && k !== 'fields');
  const results = [];
  for (const entityName of entityNames) {
    const changed = await getRecordsChangedSince(entityName, connection.last_synced_at, user);
    for (const record of changed) {
      results.push({ entity: entityName, id: record.id, ...(await syncRecordToIntegration(connection, entityName, record)) });
    }
  }
  return results;
}
