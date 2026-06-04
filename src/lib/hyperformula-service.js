/**
 * HyperFormula Compute Engine - Spreadsheet formula evaluation for Thatcher
 * Provides calculated fields, business rules, and data transformations
 */

import { HyperFormula } from 'hyperformula';
import { createLogger } from './logger.js';

const logger = createLogger('[HyperFormula]');

const _sheets = new Map();
const _evaluationLog = [];
const MAX_LOG_SIZE = 1000;

export class HyperFormulaService {
  constructor(options = {}) {
    this.options = {
      licenseKey: options.licenseKey || 'gpl-v3',
      maxRows: options.maxRows || 100000,
      maxColumns: options.maxColumns || 1000,
      useColumnIndex: options.useColumnIndex !== false,
      useStats: options.useStats !== false,
      ...options,
    };
    this._instance = null;
    this._customFunctions = new Map();
    this._sheetMeta = new Map();
  }

  async init() {
    if (this._instance) return this;

    this._instance = HyperFormula.buildEmpty({
      licenseKey: this.options.licenseKey,
      maxRows: this.options.maxRows,
      maxColumns: this.options.maxColumns,
      useColumnIndex: this.options.useColumnIndex,
      useStats: this.options.useStats,
    });

    this._registerCustomFunctions();

    if (globalThis.__debug__) {
      globalThis.__debug__.expose('formula', {
        sheets: () => this.listSheets(),
        sheet: (name) => this.getSheetInfo(name),
        instance: () => this._instance,
        stats: () => this.getStats(),
        log: () => [..._evaluationLog],
        customFunctions: () => Array.from(this._customFunctions.keys()),
      }, 'HyperFormula Service');
    }

    logger.info('HyperFormula initialized');
    return this;
  }

  _registerCustomFunctions() {
    const thatcherFunctions = [
      { name: 'DB_LOOKUP', parameters: 4 },
      { name: 'DB_COUNT', parameters: 4 },
      { name: 'DB_SUM', parameters: 4 },
      { name: 'DB_FILTER', parameters: 3 },
      { name: 'WORKFLOW_STATE', parameters: 1 },
      { name: 'USER_ROLE', parameters: 0 },
      { name: 'NOW_TS', parameters: 0 },
      { name: 'UUID', parameters: 0 },
    ];

    for (const fn of thatcherFunctions) {
      this._customFunctions.set(fn.name, fn);
    }
  }

  createSheet(name, data = []) {
    if (!this._instance) throw new Error('HyperFormula not initialized');

    this._instance.addSheet(name);
    const sheetId = this._instance.getSheetId(name);

    if (data.length > 0) {
      this._instance.setSheetContent(sheetId, data);
    }

    this._sheetMeta.set(name, {
      id: sheetId,
      created: Date.now(),
      rowCount: data.length,
      colCount: data.length > 0 ? Math.max(...data.map(r => r.length)) : 0,
    });

    logger.info('Sheet created', { name, sheetId });
    return { name, sheetId };
  }

  removeSheet(name) {
    const meta = this._sheetMeta.get(name);
    if (!meta) throw new Error(`Sheet "${name}" not found`);

    this._instance.removeSheet(meta.id);
    this._sheetMeta.delete(name);
    logger.info('Sheet removed', { name });
  }

  renameSheet(oldName, newName) {
    const meta = this._sheetMeta.get(oldName);
    if (!meta) throw new Error(`Sheet "${oldName}" not found`);

    this._instance.renameSheet(meta.id, newName);
    this._sheetMeta.delete(oldName);
    this._sheetMeta.set(newName, { ...meta, name: newName });
  }

  setCellContents(name, cellAddress, value) {
    const meta = this._sheetMeta.get(name);
    if (!meta) throw new Error(`Sheet "${name}" not found`);

    const start = performance.now();
    this._instance.setCellContents({ sheet: meta.id, ...cellAddress }, value);
    const duration = performance.now() - start;

    this._logEvaluation('setCellContents', { sheet: name, cell: cellAddress, value, duration });
  }

  getCellValue(name, cellAddress) {
    const meta = this._sheetMeta.get(name);
    if (!meta) throw new Error(`Sheet "${name}" not found`);

    const start = performance.now();
    const value = this._instance.getCellValue({ sheet: meta.id, ...cellAddress });
    const duration = performance.now() - start;

    this._logEvaluation('getCellValue', { sheet: name, cell: cellAddress, value, duration });
    return value;
  }

  getSheetValues(name) {
    const meta = this._sheetMeta.get(name);
    if (!meta) throw new Error(`Sheet "${name}" not found`);

    const start = performance.now();
    const values = this._instance.getSheetValues(meta.id);
    const duration = performance.now() - start;

    this._logEvaluation('getSheetValues', { sheet: name, rowCount: values.length, duration });
    return values;
  }

  getRangeValues(name, startRow, startCol, endRow, endCol) {
    const meta = this._sheetMeta.get(name);
    if (!meta) throw new Error(`Sheet "${name}" not found`);

    const start = performance.now();
    const values = this._instance.getRangeValue({
      sheet: meta.id,
      startRow,
      startCol,
      endRow,
      endCol,
    });
    const duration = performance.now() - start;

    this._logEvaluation('getRangeValues', { sheet: name, range: { startRow, startCol, endRow, endCol }, duration });
    return values;
  }

  setSheetContent(name, data) {
    const meta = this._sheetMeta.get(name);
    if (!meta) throw new Error(`Sheet "${name}" not found`);

    const start = performance.now();
    this._instance.setSheetContent(meta.id, data);
    const duration = performance.now() - start;

    this._sheetMeta.set(name, {
      ...meta,
      rowCount: data.length,
      colCount: data.length > 0 ? Math.max(...data.map(r => r.length)) : 0,
    });

    this._logEvaluation('setSheetContent', { sheet: name, rowCount: data.length, duration });
  }

  evaluateFormula(formula) {
    const start = performance.now();

    const tempSheet = this.createSheet(`_temp_${Date.now()}`);
    try {
      this.setCellContents(tempSheet.name, { row: 0, col: 0 }, [[formula]]);
      const result = this.getCellValue(tempSheet.name, { row: 0, col: 0 });
      const duration = performance.now() - start;

      this._logEvaluation('evaluateFormula', { formula, result, duration });
      return { result, duration };
    } finally {
      this.removeSheet(tempSheet.name);
    }
  }

  validateFormula(formula) {
    try {
      const ast = HyperFormula.buildFromArray([[formula]], { licenseKey: 'gpl-v3' });
      const errors = ast.getAllFormulas().filter(f => f?.error);
      return { valid: errors.length === 0, errors };
    } catch (e) {
      return { valid: false, errors: [e.message] };
    }
  }

  getCellFormula(name, cellAddress) {
    const meta = this._sheetMeta.get(name);
    if (!meta) throw new Error(`Sheet "${name}" not found`);

    return this._instance.getCellFormula({ sheet: meta.id, ...cellAddress });
  }

  getDependencies(name, cellAddress) {
    const meta = this._sheetMeta.get(name);
    if (!meta) throw new Error(`Sheet "${name}" not found`);

    return this._instance.dependencies.getDependencies({ sheet: meta.id, ...cellAddress });
  }

  undo() {
    return this._instance.undo();
  }

  redo() {
    return this._instance.redo();
  }

  listSheets() {
    return Array.from(this._sheetMeta.entries()).map(([name, meta]) => ({
      name,
      ...meta,
    }));
  }

  getSheetInfo(name) {
    const meta = this._sheetMeta.get(name);
    if (!meta) return null;

    const dimensions = this._instance.getSheetDimensions(meta.id);
    return {
      ...meta,
      dimensions,
      filledRange: this._instance.getFilledRange(meta.id),
    };
  }

  getStats() {
    return {
      sheetCount: this._sheetMeta.size,
      customFunctions: this._customFunctions.size,
      evaluationLogSize: _evaluationLog.length,
      version: HyperFormula.version,
    };
  }

  _logEvaluation(operation, details) {
    _evaluationLog.push({
      operation,
      timestamp: Date.now(),
      ...details,
    });

    while (_evaluationLog.length > MAX_LOG_SIZE) {
      _evaluationLog.shift();
    }
  }

  getInstance() {
    return this._instance;
  }

  async close() {
    if (this._instance) {
      this._instance.destroy();
      this._instance = null;
    }
    this._sheetMeta.clear();
    _evaluationLog.length = 0;
  }
}

let _hfService = null;

export async function createHyperFormulaService(options = {}) {
  if (!_hfService) {
    _hfService = new HyperFormulaService(options);
    await _hfService.init();
  }
  return _hfService;
}

export function getHyperFormulaService() {
  return _hfService;
}

export function getHyperFormulaInstance() {
  return _hfService?._instance;
}

export default HyperFormulaService;