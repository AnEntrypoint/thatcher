import { getHyperFormulaService, createHyperFormulaService } from '@/lib/hyperformula-service.js';
import { createLogger } from '@/lib/logger.js';

const logger = createLogger('[FormulaAPI]');

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function errorResponse(message, status = 400) {
  return jsonResponse({ error: message }, status);
}

async function ensureService() {
  let service = getHyperFormulaService();
  if (!service) {
    service = await createHyperFormulaService();
  }
  return service;
}

export async function GET(request) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === '/api/formula/sheets') {
    const service = await ensureService();
    return jsonResponse({ sheets: service.listSheets(), stats: service.getStats() });
  }

  if (path.startsWith('/api/formula/sheet/')) {
    const sheetName = decodeURIComponent(path.split('/api/formula/sheet/')[1]);
    const service = await ensureService();
    const info = service.getSheetInfo(sheetName);
    if (!info) return errorResponse(`Sheet "${sheetName}" not found`, 404);

    return jsonResponse({
      ...info,
      values: service.getSheetValues(sheetName),
    });
  }

  return errorResponse('Not found', 404);
}

export async function POST(request) {
  const url = new URL(request.url);
  const path = url.pathname;

  try {
    const body = await request.json();

    if (path === '/api/formula/evaluate') {
      const service = await ensureService();

      if (body.formula) {
        const { result, duration } = service.evaluateFormula(body.formula);
        return jsonResponse({ formula: body.formula, result, durationMs: Math.round(duration * 100) / 100 });
      }

      if (body.sheet && body.cell && body.value !== undefined) {
        service.setCellContents(body.sheet, body.cell, body.value);
        return jsonResponse({ success: true, sheet: body.sheet, cell: body.cell });
      }

      return errorResponse('Missing formula or sheet/cell/value', 400);
    }

    if (path === '/api/formula/sheet') {
      const service = await ensureService();

      if (body.action === 'create') {
        const { name, sheetId } = service.createSheet(body.name, body.data);
        return jsonResponse({ name, sheetId }, 201);
      }

      if (body.action === 'remove') {
        service.removeSheet(body.name);
        return jsonResponse({ success: true });
      }

      if (body.action === 'rename') {
        service.renameSheet(body.oldName, body.newName);
        return jsonResponse({ success: true });
      }

      if (body.action === 'setContent') {
        service.setSheetContent(body.name, body.data);
        return jsonResponse({ success: true });
      }

      return errorResponse('Unknown action. Use: create, remove, rename, setContent', 400);
    }

    if (path === '/api/formula/validate') {
      const service = await ensureService();

      if (!body.formula) {
        return errorResponse('Missing formula', 400);
      }

      const result = service.validateFormula(body.formula);
      return jsonResponse(result);
    }

    if (path === '/api/formula/cell') {
      const service = await ensureService();

      if (!body.sheet || !body.cell) {
        return errorResponse('Missing sheet or cell', 400);
      }

      const value = service.getCellValue(body.sheet, body.cell);
      const formula = service.getCellFormula(body.sheet, body.cell);

      return jsonResponse({ sheet: body.sheet, cell: body.cell, value, formula });
    }

    if (path === '/api/formula/dependencies') {
      const service = await ensureService();

      if (!body.sheet || !body.cell) {
        return errorResponse('Missing sheet or cell', 400);
      }

      const deps = service.getDependencies(body.sheet, body.cell);
      return jsonResponse({ sheet: body.sheet, cell: body.cell, dependencies: deps });
    }

    return errorResponse('Not found', 404);
  } catch (error) {
    logger.error('Formula API error', { error: error.message });
    return errorResponse(error.message, 500);
  }
}