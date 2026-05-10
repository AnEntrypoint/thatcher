import { getDomainLoader } from '@/lib/domain-loader';
import { ok } from '@/lib/response-formatter';
import { withErrorHandler } from '@/lib/with-error-handler';
import { getConfigEngine } from '@/lib/config-generator-engine';

export const GET = withErrorHandler(async (request) => {
  await getConfigEngine();
  const domainLoader = getDomainLoader();
  const validDomains = domainLoader.getValidDomains();

  const domains = validDomains.map(domainName => {
    try {
      return domainLoader.getDomainInfo(domainName);
    } catch (error) {
      console.error(`[Domains API] Error loading domain ${domainName}:`, error.message);
      return null;
    }
  }).filter(Boolean);

  return ok({ domains });
}, 'Domains:List');
