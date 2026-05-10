import { generateToken } from '@/lib/csrf-protection';
import { ok } from '@/lib/response-formatter';
import { withErrorHandler } from '@/lib/with-error-handler';

export const GET = withErrorHandler(async (request) => {
  const token = generateToken();
  return ok({ csrfToken: token });
}, 'CSRF:GetToken');
