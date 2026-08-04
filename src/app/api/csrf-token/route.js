import { generateToken } from '@/lib/csrf-protection';
import { ok } from '@/lib/response-formatter';
import { withErrorHandler } from '@/lib/errors';

export const GET = withErrorHandler(async (_request) => {
  const token = generateToken();
  return ok({ csrfToken: token });
}, 'CSRF:GetToken');
