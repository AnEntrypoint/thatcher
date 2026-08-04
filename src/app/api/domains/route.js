import { createLogger } from '@/lib/logger.js';
import { getDomainLoader } from '@/lib/domain-loader';

const log = createLogger('[DomainsAPI]');
import { ok } from '@/lib/response-formatter';
import { withErrorHandler } from '@/lib/errors';
import { getConfigEngine } from '@/lib/config-generator-engine';

export const GET = withErrorHandler(async (_request) => {
  await getConfigEngine();
  const domainLoader = getDomainLoader();
  const validDomains = domainLoader.getValidDomains();

  const domains = validDomains.map(domainName => {
    try {
      return domainLoader.getDomainInfo(domainName);
    } catch (error) {
      log.error(`error loading domain ${domainName}:`, { message: error.message });
      return null;
    }
  }).filter(Boolean);

  return ok({ domains });
}, 'Domains:List');
