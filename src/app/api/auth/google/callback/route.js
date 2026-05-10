import { google, createSession } from '@/engine.server';
import { getBy, create } from '@/engine';
import { Google } from 'arctic';
import { GOOGLE_APIS } from '@/config/constants';
import { config } from '@/config';
import { getConfigEngine } from '@/lib/config-generator-engine';
import { globalManager } from '@/lib/hot-reload/mutex';
import { NextResponse } from '@/lib/next-polyfills';
import {
  validateOAuthProvider,
  getOAuthCookie,
  deleteOAuthCookie,
  buildOAuthErrorResponse,
  validateOAuthState,
} from '@/lib/auth-route-helpers';

export async function GET(request) {
  const protocol = request.headers['x-forwarded-proto'] || 'http';
  const host = request.headers['x-forwarded-host'] || request.headers.host || 'localhost:3000';
  const redirectUri = `${protocol}://${host}/api/auth/google/callback`;

  const dynamicGoogle = new Google(
    config.auth.google.clientId,
    config.auth.google.clientSecret,
    redirectUri
  );

  const { valid, error } = validateOAuthProvider(dynamicGoogle);
  if (!valid) {
    return buildOAuthErrorResponse(error, request);
  }

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const stateKey = url.searchParams.get('state');  // Google returns the key we sent

  const storedData = await getOAuthCookie(stateKey);
  const state = storedData?.state;
  const codeVerifier = storedData?.codeVerifier;

  const stateValidation = validateOAuthState(code, stateKey, state, codeVerifier);
  if (!stateValidation.valid) {
    console.error('[OAuth Callback] State validation failed:', stateValidation.error);
    return buildOAuthErrorResponse(stateValidation.error, request);
  }

  try {
    const tokens = await dynamicGoogle.validateAuthorizationCode(code, codeVerifier);
    const accessToken = tokens.accessToken;

    const googleResponse = await fetch(GOOGLE_APIS.oauth2, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!googleResponse.ok) {
      throw new Error('Failed to fetch user info');
    }

    const googleUser = await googleResponse.json();

    const user = await globalManager.lock('oauth-user-create', async () => {
      let existing = getBy('user', 'email', googleUser.email);
      if (existing) return existing;

      const engine = await getConfigEngine();
      const roles = engine.getRoles();
      const defaultRole = Object.keys(roles)[0] || 'clerk';

      return create('user', {
        email: googleUser.email,
        name: googleUser.name,
        avatar: googleUser.picture,
        type: 'auditor',
        role: defaultRole,
        status: 'active',
      });
    });

    const { sessionCookie } = await createSession(user.id);

    await deleteOAuthCookie(stateKey);

    const redirectUrl = new URL('/', request.url);
    const response = NextResponse.redirect(redirectUrl);

    const cookieValue = `${sessionCookie.value}; Path=${sessionCookie.attributes.path || '/'}; HttpOnly${sessionCookie.attributes.secure ? '; Secure' : ''}; SameSite=${sessionCookie.attributes.sameSite || 'Lax'}`;
    response.headers.set('Set-Cookie', `${sessionCookie.name}=${cookieValue}`);

    return response;
  } catch (error) {
    console.error('Google OAuth error:', error);
    return buildOAuthErrorResponse('oauth_failed', request);
  }
}
