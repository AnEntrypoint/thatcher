import { getConfigEngineSync } from '@/lib/config-generator-engine';

const requireStr = (val, label) => { if (!val || typeof val !== 'string') throw new Error(`[DomainLoader] ${label} must be a non-empty string`); };

export class DomainLoader {
  constructor(engine) {
    if (!engine?.getEntitiesForDomain) throw new Error('[DomainLoader] requires ConfigGeneratorEngine instance');
    this.engine = engine;
    this.validDomains = Object.keys(engine.getDomains());
    if (!this.validDomains.length) this.validDomains = ['friday', 'mwr'];
    this.defaultDomain = this.validDomains[0];
  }

  _domain(name) {
    requireStr(name, 'domainName');
    const d = name.toLowerCase();
    if (!this.validDomains.includes(d)) throw new Error(`[DomainLoader] Invalid domain: ${name}. Valid: ${this.validDomains.join(', ')}`);
    return d;
  }

  getEntitiesForDomain(domain) { return [...this.engine.getEntitiesForDomain(this._domain(domain))]; }

  getSpecsForDomain(domain) {
    return this.getEntitiesForDomain(domain).reduce((acc, name) => {
      try { acc.push(this.engine.generateEntitySpec(name)); } catch (e) { console.error(`[DomainLoader] spec failed for ${name}:`, e.message); }
      return acc;
    }, []);
  }

  getFeaturesForDomain(domain) {
    const domainCfg = this.engine.getConfig().domains?.[this._domain(domain)];
    if (!domainCfg) return [];
    return Object.keys(domainCfg.features || {}).filter(k => domainCfg.features[k] === true);
  }

  isEntityInDomain(entity, domain) {
    requireStr(entity, 'entityName');
    try { return this.getEntitiesForDomain(domain).map(e => e.toLowerCase()).includes(entity.toLowerCase()); }
    catch { return false; }
  }

  isFeatureInDomain(feature, domain) {
    requireStr(feature, 'featureName');
    try { return this.getFeaturesForDomain(domain).map(f => f.toLowerCase()).includes(feature.toLowerCase()); }
    catch { return false; }
  }

  filterDataByDomain(data, domain, entity) {
    if (!data) return data;
    requireStr(domain, 'domainName'); requireStr(entity, 'entityName');
    const d = this._domain(domain);
    if (!this.isEntityInDomain(entity, d)) throw new Error(`[DomainLoader] Entity ${entity} not in domain ${domain}`);
    return Array.isArray(data) ? data.map(item => ({ ...item })) : { ...data };
  }

  getDomainInfo(domain) {
    const d = this._domain(domain);
    const config = this.engine.getConfig();
    const dc = config.domains?.[d];
    if (!dc) throw new Error(`[DomainLoader] Domain ${domain} not found in config`);
    return { name: d, label: dc.label || d, description: dc.description || '', enabled: dc.enabled !== false, primary_color: dc.primary_color || '#3B82F6', icon: dc.icon || 'Circle', features: this.getFeaturesForDomain(d), entities: this.getEntitiesForDomain(d) };
  }

  getCurrentDomain(request) {
    if (!request) return this.defaultDomain;
    try {
      const param = new URL(request.url).searchParams.get('domain')?.toLowerCase();
      return param && this.validDomains.includes(param) ? param : this.defaultDomain;
    } catch { return this.defaultDomain; }
  }

  getApiBasePathForDomain(domain) { return `/api/${this._domain(domain)}`; }
  getValidDomains() { return [...this.validDomains]; }
  getDefaultDomain() { return this.defaultDomain; }
}

let globalDomainLoader = null;
export function getDomainLoader() {
  if (!globalDomainLoader) globalDomainLoader = new DomainLoader(getConfigEngineSync());
  return globalDomainLoader;
}
export function resetDomainLoader() { globalDomainLoader = null; }
