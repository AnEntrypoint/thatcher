import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
      if (!plugin.entityName) { console.warn(`[plugins] ${file} missing entityName, skipped`); continue; }
      configEngine.registerPlugin(plugin.entityName, plugin);
      loaded.push(file);
    } catch (e) {
      console.error(`[plugins] Failed to load ${file}:`, e.message);
    }
  }
  if (loaded.length) console.log(`[plugins] Loaded: ${loaded.join(', ')}`);
  return loaded;
}
