import { NextResponse } from '@/lib/next-polyfills';
import { google } from '@/engine.server';
import { Google } from 'arctic';
import { generateState, generateCodeVerifier } from 'arctic';
import { globalManager } from '@/lib/hot-reload/mutex';
import { config } from '@/config';
import { validateOAuthProvider, setOAuthCookie, buildOAuthErrorResponse } from '@/lib/auth-route-helpers';

export async function GET(request) {
  const url = new URL(request.url);
  const isCheck = url.searchParams.get('check') === '1';

  if (isCheck) {
    const { valid } = validateOAuthProvider(google);
    return new Response(JSON.stringify({ configured: valid }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

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
    return buildOAuthErrorResponse(error);
  }

  return globalManager.lock('oauth-state-init', async () => {
    const state = generateState();
    const codeVerifier = generateCodeVerifier();

    const stateKey = await setOAuthCookie('google_oauth_state', { state, codeVerifier });

    const url = await dynamicGoogle.createAuthorizationURL(stateKey, codeVerifier, {
      scopes: ['profile', 'email'],
    });

    return NextResponse.redirect(url);
  });
}

export async function HEAD(request) {
  try {
    const { valid } = validateOAuthProvider(google);
    return new Response(null, { status: valid ? 200 : 503 });
  } catch (error) {
    console.error('[OAuth HEAD] Error:', error);
    return new Response(null, { status: 500 });
  }
}
