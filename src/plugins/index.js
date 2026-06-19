import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createLogger } from '../lib/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const log = createLogger('[Plugins]');

export async function loadPlugins(configEngine) {
  const pluginDir = __dirname;
  let files;
  try { files = fs.readdirSync(pluginDir).filter(f => f.endsWith('.plugin.js')); }
  catch { return []; }

  const loaded = [];
  for (const file of files) {
    try {
      const mod = await import(`file://${path.join(pluginDir, file)}?t=${Date.now()}`);
      const plugin = mod.default || mod;
      if (!plugin.entityName) { log.warn(`${file} missing entityName, skipped`); continue; }
      configEngine.registerPlugin(plugin.entityName, plugin);
      loaded.push(file);
    } catch (e) {
      log.error(`failed to load ${file}:`, { message: e.message });
    }
  }
  if (loaded.length) log.info(`loaded: ${loaded.join(', ')}`);
  return loaded;
}
