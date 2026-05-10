import fs from 'fs';
import path from 'path';

export function resolveParamRoute(baseDir, segments) {
  if (!fs.existsSync(baseDir)) return null;
  if (segments.length === 0) {
    const r = path.join(baseDir, 'route.js');
    return fs.existsSync(r) ? r : null;
  }
  const [seg, ...rest] = segments;
  const entries = fs.readdirSync(baseDir, { withFileTypes: true }).filter(e => e.isDirectory());
  for (const entry of entries) {
    const name = entry.name;
    if (name === seg || name.startsWith('[')) {
      const found = resolveParamRoute(path.join(baseDir, name), rest);
      if (found) return found;
    }
  }
  return null;
}

export function resolveSpecificParams(routeFile, pathParts) {
  const result = {};
  const routeRelative = routeFile.replace(/.*src\/app\/api\//, '').replace(/\/route\.js$/, '');
  const routeSegments = routeRelative.split('/');
  const urlSegments = pathParts.slice(0);
  for (let i = 0; i < routeSegments.length && i < urlSegments.length; i++) {
    const seg = routeSegments[i];
    if (seg.startsWith('[') && seg.endsWith(']')) {
      const paramName = seg.replace(/^\[\.\.\./, '').replace(/[\[\]]/g, '');
      result[paramName] = urlSegments[i];
    }
  }
  return result;
}

function singularize(name) {
  if (name.endsWith('ies')) return name.slice(0, -3) + 'y';
  if (name.endsWith('ses') || name.endsWith('xes') || name.endsWith('zes')) return name.slice(0, -2);
  if (name.endsWith('s') && !name.endsWith('ss')) return name.slice(0, -1);
  return name;
}

export function buildNestedRoutePath(baseDir, domain, parentEntity, childParts) {
  if (childParts.length === 0) return null;

  function buildSegments(parentParam, childParamFn) {
    const segs = [domain, parentEntity, parentParam];
    for (let i = 0; i < childParts.length; i++) {
      if (i % 2 === 0) segs.push(childParts[i]);
      else segs.push(childParamFn(i));
    }
    return path.join(baseDir, 'src/app/api', ...segs, 'route.js');
  }

  const variants = [
    () => buildSegments('[id]', (i) => `[${childParts[i - 1]}Id]`),
    () => buildSegments('[id]', (i) => `[${singularize(childParts[i - 1])}Id]`),
    () => buildSegments(`[${parentEntity}Id]`, (i) => `[${childParts[i - 1]}Id]`),
    () => buildSegments(`[${parentEntity}Id]`, (i) => `[${singularize(childParts[i - 1])}Id]`),
    () => buildSegments('[id]', () => `[${childParts[0]}Id]`),
    () => buildSegments('[id]', () => `[${singularize(childParts[0])}Id]`),
  ];

  for (const variant of variants) {
    const candidate = variant();
    if (fs.existsSync(candidate)) return candidate;
  }
  return variants[0]();
}

const DOMAINS = ['friday', 'mwr'];

export function resolveRoute(__dirname, pathname, url) {
  const pathParts = pathname.slice(5).split('/').filter(Boolean);
  const firstPart = pathParts[0];
  const isDomain = DOMAINS.includes(firstPart);
  let routeFile = null;
  let params = {};

  if (isDomain) {
    const domain = firstPart;
    const domainParts = pathParts.slice(1);

    const specificCheck = path.join(__dirname, `src/app/api/${domain}/${domainParts.join('/')}/route.js`);
    if (fs.existsSync(specificCheck)) {
      routeFile = specificCheck;
      params = resolveSpecificParams(specificCheck, pathParts);
    }

    if (!routeFile && domainParts.length >= 3) {
      const parentEntity = domainParts[0];
      const childParts = domainParts.slice(2);
      const parentId = domainParts[1];
      const childEntity = childParts[0];
      const childId = childParts[1] || null;

      const nestedSpecific = buildNestedRoutePath(__dirname, domain, parentEntity, childParts);
      if (nestedSpecific && fs.existsSync(nestedSpecific)) {
        routeFile = nestedSpecific;
        params = resolveSpecificParams(nestedSpecific, pathParts);
      }

      if (!routeFile) {
        routeFile = path.join(__dirname, 'src/app/api/[entity]/[[...path]]/route.js');
        url.searchParams.set('domain', domain);
        params = { entity: childEntity, path: childId ? [childId] : [], parentEntity, parentId };
      }
    }

    if (!routeFile && domainParts.length >= 1) {
      const entity = domainParts[0];
      const entityPath = domainParts.slice(1);
      routeFile = path.join(__dirname, 'src/app/api/[entity]/[[...path]]/route.js');
      url.searchParams.set('domain', domain);
      params = { entity, path: entityPath };
    }
  }

  if (!routeFile && firstPart) {
    const exactRoute = path.join(__dirname, `src/app/api/${pathParts.join('/')}/route.js`);
    if (fs.existsSync(exactRoute)) {
      routeFile = exactRoute;
      params = resolveSpecificParams(exactRoute, pathParts);
    }
  }

  if (!routeFile && firstPart) {
    const paramRouteFile = resolveParamRoute(path.join(__dirname, 'src/app/api', firstPart), pathParts.slice(1));
    if (paramRouteFile) {
      routeFile = paramRouteFile;
      params = resolveSpecificParams(paramRouteFile, pathParts);
    }
  }

  if (!routeFile) {
    routeFile = path.join(__dirname, 'src/app/api/[entity]/[[...path]]/route.js');
    params = { entity: firstPart, path: pathParts.slice(1) };
  }

  return { routeFile, params, isDomain, firstPart, pathParts };
}
