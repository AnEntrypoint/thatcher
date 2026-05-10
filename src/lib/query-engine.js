/**
 * Query Engine - Read operations
 * Adapted from moonlanding/src/lib/query-engine.js
 */

import { getDatabase } from './database-core.js';
import { getSpec } from '../config/spec-helpers.js';
import { RECORD_STATUS } from '../config/constants.js';

const db = getDatabase();
const logger = createLogger('[QueryEngine]');

/**
 * Execute a query with error handling
 * @param {string} sql
 * @param {Array} params
 * @param {object} context
 * @returns {Array}
 */
function execQuery(sql, params = [], context = {}) {
  try {
    return db.prepare(sql).all(...params);
  } catch (e) {
    logger.error(`${context.operation || 'Query'} ${context.entity || ''}`, { sql, error: e.message });
    throw new Error(`Database query failed: ${e.message}`);
  }
}

/**
 * Execute a single-row query
 * @param {string} sql
 * @param {Array} params
 * @param {object} context
 * @returns {object|null}
 */
function execGet(sql, params = [], context = {}) {
  try {
    return db.prepare(sql).get(...params);
  } catch (e) {
    logger.error(`${context.operation || 'Get'} ${context.entity || ''}`, { sql, error: e.message });
    throw new Error(`Database get failed: ${e.message}`);
  }
}

/**
 * Get table name for entity (users vs user)
 * @param {object} spec
 * @returns {string}
 */
function tableName(spec) {
  return spec.name === 'user' ? 'users' : spec.name;
}

/**
 * Build SELECT query with joins, where, sorting, pagination
 * @param {object} spec - Entity specification
 * @param {object} where - Where conditions
 * @param {object} options - Query options
 * @returns {{sql: string, params: Array}}
 */
function buildSpecQuery(spec, where = {}, options = {}) {
  const tbl = tableName(spec);
  const table = `"${tbl}"`;
  const selects = [`${table}.*`];
  const joins = [];

  // Add computed fields
  if (spec.computed) {
    Object.entries(spec.computed).forEach(([k, c]) => {
      selects.push(`${c.sql} as "${k}"`);
    });
  }

  // Add joins for ref fields with display
  Object.entries(spec.fields || {}).forEach(([k, f]) => {
    if (f.type === 'ref' && f.display) {
      const refTbl = f.ref === 'user' ? 'users' : f.ref;
      const alias = `"${refTbl}_${k}"`;
      joins.push(`LEFT JOIN "${refTbl}" ${alias} ON ${table}."${k}" = ${alias}.id`);

      const displayField = f.display.split('.')[1] || 'name';
      selects.push(`${alias}."${displayField}" as "${k}_display"`);
    }
  });

  const wc = [];
  const p = [];

  // Where conditions
  Object.entries(where).forEach(([k, v]) => {
    if (v !== undefined && v !== null) {
      wc.push(`${table}."${k}" = ?`);
      p.push(v);
    }
  });

  // Exclude soft-deleted by default
  if (spec.fields?.status && !where.status && !options.includeDeleted) {
    wc.push(`${table}."status" != '${RECORD_STATUS.DELETED}'`);
  }
  if (spec.fields?.archived && !where.archived && !options.includeArchived) {
    wc.push(`${table}."archived" = 0`);
  }

  let sql = `SELECT ${selects.join(', ')} FROM ${table}`;
  if (joins.length) {
    sql += ' ' + joins.join(' ');
  }
  if (wc.length) {
    sql += ` WHERE ` + wc.join(` AND `);
  }

  // Sorting
  const sort = options.sort || spec.list?.defaultSort;
  if (sort && sort.field && spec.fields?.[sort.field]) {
    const dir = (sort.dir || 'ASC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    sql += ` ORDER BY ${table}."${sort.field}" ${dir}`;
  }

  // Limit/offset
  if (options.limit) {
    sql += ` LIMIT ${parseInt(options.limit, 10)}`;
    if (options.offset) {
      sql += ` OFFSET ${parseInt(options.offset, 10)}`;
    }
  }

  return { sql, params: p };
}

/**
 * Get total count for entity (optionally with where)
 * @param {string} entity
 * @param {object} where
 * @param {object} options
 * @returns {number}
 */
export function count(entity, where = {}, options = {}) {
  const spec = getSpec(entity);
  const tbl = tableName(spec);
  const table = `"${tbl}"`;
  const wc = [];
  const p = [];

  Object.entries(where).forEach(([k, v]) => {
    if (v !== undefined && v !== null) {
      wc.push(`${table}."${k}" = ?`);
      p.push(v);
    }
  });

  if (spec.fields?.status && !where.status && !options.includeDeleted) {
    wc.push(`${table}."status" != '${RECORD_STATUS.DELETED}'`);
  }

  const whereClause = wc.length ? `WHERE ${wc.join(' AND ')}` : '';
  const sql = `SELECT COUNT(*) as cnt FROM ${table} ${whereClause}`;

  const result = execGet(sql, p, { entity, operation: 'Count' });
  return result?.cnt || 0;
}

/**
 * List all records (with optional where)
 * @param {string} entity
 * @param {object} where
 * @param {object} options
 * @returns {Array}
 */
export function list(entity, where = {}, options = {}) {
  const spec = getSpec(entity);
  const { sql, params } = buildSpecQuery(spec, where, options);
  return execQuery(sql, params, { entity, operation: 'List' });
}

/**
 * List with pagination
 * @param {string} entity
 * @param {object} where
 * @param {number} page
 * @param {number|null} pageSize
 * @returns {{items: Array, pagination: object}}
 */
export async function listWithPagination(entity, where = {}, page = 1, pageSize = null) {
  const spec = getSpec(entity);
  const tbl = tableName(spec);

  const paginationCfg = getPaginationConfig(spec);
  const defaultPageSize = spec.list?.pageSize || paginationCfg.default_page_size;
  const finalPageSize = pageSize || defaultPageSize;
  const finalPage = Math.max(1, page);

  const offset = (finalPage - 1) * finalPageSize;

  const { sql, params } = buildSpecQuery(spec, where, {
    ...options,
    limit: finalPageSize,
    offset,
  });

  const items = execQuery(sql, params, { entity, operation: 'ListWithPagination' });

  const total = count(entity, where, options);

  return {
    items,
    pagination: {
      page: finalPage,
      pageSize: finalPageSize,
      total,
      totalPages: Math.ceil(total / finalPageSize),
    },
  };
}

/**
 * Get single record by ID
 * @param {string} entity
 * @param {string|number} id
 * @returns {object|null}
 */
export function get(entity, id) {
  const spec = getSpec(entity);
  const tbl = tableName(spec);
  const sql = `SELECT * FROM "${tbl}" WHERE id = ?`;
  return execGet(sql, [id], { entity, operation: 'Get' });
}

/**
 * Get single record by field value
 * @param {string} entity
 * @param {string} field
 * @param {any} value
 * @returns {object|null}
 */
export function getBy(entity, field, value) {
  const spec = getSpec(entity);
  const tbl = tableName(spec);
  const sql = `SELECT * FROM "${tbl}" WHERE "${field}" = ? LIMIT 1`;
  return execGet(sql, [value], { entity, operation: 'GetBy' });
}

/**
 * Search using FTS
 * @param {string} entity
 * @param {string} query
 * @param {object} where
 * @param {object} options
 * @returns {Array}
 */
export function search(entity, query, where = {}, options = {}) {
  const spec = getSpec(entity);
  const tbl = tableName(spec);
  const ftsTable = `${tbl}_fts`;

  // Check if FTS table exists
  const ftsExists = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name=?
  `).get(ftsTable);

  if (!ftsExists) {
    // Fallback to simple LIKE search
    const { sql, params } = buildSpecQuery(spec, where, options);
    const baseSql = sql.replace('SELECT *', `SELECT *`);
    const searchTerm = `%${query}%`;
    const searchFields = Object.keys(spec.fields || {}).filter(
      f => ['text', 'textarea', 'email'].includes(spec.fields[f].type)
    );

    if (searchFields.length > 0) {
      const conditions = searchFields.map(f => `"${f}" LIKE ?`).join(' OR ');
      const whereAnd = sql.includes('WHERE') ? ' AND ' : ' WHERE ';
      const fullSql = baseSql + whereAnd + `(${conditions})`;
      const searchParams = [...params, ...searchFields.map(() => searchTerm)];
      return execQuery(fullSql, searchParams, { entity, operation: 'SearchFallback' });
    }

    return [];
  }

  // Use FTS
  const ftsResults = db.prepare(`
    SELECT rowid as id FROM ${ftsTable}
    WHERE ${ftsTable} MATCH ?
  `).all(query);

  if (!ftsResults.length) return [];

  const ids = ftsResults.map(r => r.id);
  const idPlaceholders = ids.map(() => '?').join(',');
  const { sql, params } = buildSpecQuery(spec, { ...where, id: { $in: ids } }, options);
  const finalSql = sql.replace('WHERE', `WHERE "${tbl}"."id" IN (${idPlaceholders}) AND `);

  return execQuery(finalSql, [...ids, ...params], { entity, operation: 'Search' });
}

/**
 * Search with pagination
 * @param {string} entity
 * @param {string} query
 * @param {object} where
 * @param {number} page
 * @param {number} pageSize
 * @returns {{items: Array, pagination: object}}
 */
export async function searchWithPagination(entity, query, where = {}, page = 1, pageSize = null) {
  const spec = getSpec(entity);
  const paginationCfg = getPaginationConfig(spec);
  const defaultPageSize = spec.list?.pageSize || paginationCfg.default_page_size;
  const finalPageSize = pageSize || defaultPageSize;
  const finalPage = Math.max(1, page);

  const items = search(entity, query, where, {
    limit: finalPageSize,
    offset: (finalPage - 1) * finalPageSize,
  });

  // For total count, we'd need a separate FTS count query - simplified here
  const total = items.length; // Approximate

  return {
    items,
    pagination: {
      page: finalPage,
      pageSize: finalPageSize,
      total,
      totalPages: Math.ceil(total / finalPageSize),
    },
  };
}

/**
 * Get children of a parent entity
 * @param {string} parentEntity
 * @param {string|number} parentId
 * @param {object} childDef
 * @returns {Array}
 */
export function getChildren(parentEntity, parentId, childDef) {
  const childSpec = getSpec(childDef.entity);
  const childTbl = tableName(childSpec);
  const fk = childDef.fk || `${parentEntity}_id`;

  const sql = `SELECT * FROM "${childTbl}" WHERE "${fk}" = ? AND status != 'deleted'`;
  return execQuery(sql, [parentId], { entity: childDef.entity, operation: 'GetChildren' });
}

/**
 * Get pagination config from system settings
 * @param {object} spec - Entity spec
 * @returns {{default_page_size: number, max_page_size: number}}
 */
function getPaginationConfig(spec) {
  // Try to get from config engine, fallback to defaults
  try {
    // Will be provided by caller or fetched from global config
    return {
      default_page_size: spec.list?.pageSize || 50,
      max_page_size: 500,
    };
  } catch {
    return { default_page_size: 50, max_page_size: 500 };
  }
}

/**
 * Simple logger
 */
function createLogger(prefix) {
  return {
    error: (msg, meta = {}) => {
      console.error(`${prefix} ${msg}`, meta);
    },
    warn: (msg, meta = {}) => {
      console.warn(`${prefix} ${msg}`, meta);
    },
    info: (msg, meta = {}) => {
      console.info(`${prefix} ${msg}`, meta);
    },
  };
}

/**
 * Run in transaction
 * @param {Function} callback
 * @returns {Promise<any>}
 */
export async function withTransaction(callback) {
  const dbInstance = getDatabase();
  try {
    dbInstance.prepare('BEGIN').run();
    const result = await callback();
    dbInstance.prepare('COMMIT').run();
    return result;
  } catch (e) {
    dbInstance.prepare('ROLLBACK').run();
    throw e;
  }
}
