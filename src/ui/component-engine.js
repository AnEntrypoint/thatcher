import { getConfigEngineSync } from '@/lib/config-generator-engine';

function getComponentDefs() {
  try {
    const engine = getConfigEngineSync();
    const config = engine.getConfig();
    return config?.components || {};
  } catch {
    return {};
  }
}

let componentDefs = getComponentDefs();

export function renderComponent(componentId, props = {}) {
  const def = componentDefs[componentId];
  if (!def) throw new Error(`Component not found: ${componentId}`);

  const errors = validateComponentProps(componentId, props);
  if (errors.length > 0) throw new Error(`Invalid props for ${componentId}: ${errors.join(', ')}`);

  let html = def.template;
  Object.entries(props).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    if (value && typeof value === 'object') {
      if (Array.isArray(value)) {
        html = html.replace(regex, value.map(v => renderItem(v, key)).join(''));
      } else {
        html = html.replace(regex, JSON.stringify(value));
      }
    } else {
      html = html.replace(regex, String(value ?? ''));
    }
  });

  html = html.replace(/{{[^}]+}}/g, '');

  const cssClass = def.class ? ` class="${def.class}"` : '';
  const element = def.element || 'div';

  return `<${element}${cssClass}>${html}</${element}>`;
}

function renderItem(item, key) {
  if (typeof item === 'string') return item;
  if (typeof item === 'object' && item.name && item.color) {
    return `<span class="avatar-item" style="background:${item.color}">${item.name.charAt(0)}</span>`;
  }
  return String(item);
}

export function getComponentConfig(componentId) {
  const def = componentDefs[componentId];
  if (!def) throw new Error(`Component not found: ${componentId}`);
  return { ...def };
}

export function validateComponentProps(componentId, props = {}) {
  const def = componentDefs[componentId];
  if (!def) throw new Error(`Component not found: ${componentId}`);

  const errors = [];
  const propDefs = def.properties || [];

  propDefs.forEach(propDef => {
    if (propDef.required && !(propDef.name in props)) {
      errors.push(`Missing required property: ${propDef.name}`);
    }

    if (propDef.name in props && propDef.type) {
      const value = props[propDef.name];
      const actualType = Array.isArray(value) ? 'list' : typeof value;

      if (propDef.type !== 'function' && actualType !== propDef.type) {
        errors.push(`Invalid type for ${propDef.name}: expected ${propDef.type}, got ${actualType}`);
      }

      if (propDef.type === 'number' && typeof value === 'number') {
        if ('min' in propDef && value < propDef.min) {
          errors.push(`${propDef.name} below minimum: ${propDef.min}`);
        }
        if ('max' in propDef && value > propDef.max) {
          errors.push(`${propDef.name} exceeds maximum: ${propDef.max}`);
        }
      }

      if (propDef.type === 'enum' && propDef.options) {
        if (!propDef.options.includes(value)) {
          errors.push(`${propDef.name} not in allowed options: ${propDef.options.join(',')}`);
        }
      }
    }
  });

  return errors;
}

export function getAvailableComponents() {
  return Object.keys(componentDefs).map(id => ({
    id,
    ...componentDefs[id]
  }));
}
