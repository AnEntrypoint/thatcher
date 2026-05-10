/**
 * Google Auth Adapter - Factory for Google OAuth2 clients
 * Provides JWT and OAuth2 clients for Google APIs
 */

import { google } from 'googleapis';
import { buildConfig } from '../config/env.js';
import fs from 'fs';
import path from 'path';

let _oauth2Client = null;
let _jwtClient = null;

/**
 * Initialize Google auth clients
 * @param {object} [config] - Optional config override
 */
export function initGoogleAuth(config = null) {
  const cfg = config || buildConfig();
  const scopes = [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/gmail.send',
  ];

  // OAuth2 client for web flow
  _oauth2Client = new google.auth.OAuth2(
    cfg.auth.google.clientId,
    cfg.auth.google.clientSecret,
    cfg.auth.google.redirectUri
  );

  // JWT client for service account (server-to-server)
  const serviceAccountPath = cfg.auth.google.serviceAccountPath || './config/service-account.json';
  if (fs.existsSync(serviceAccountPath)) {
    try {
      const key = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));
      _jwtClient = new google.auth.JWT({
        email: key.client_email,
        key: key.private_key,
        scopes: [
          'https://www.googleapis.com/auth/drive',
          'https://www.googleapis.com/auth/gmail.send',
        ],
      });
    } catch (err) {
      console.warn('[GoogleAuth] Failed to load service account:', err.message);
    }
  }

  return { oauth2: _oauth2Client, jwt: _jwtClient };
}

/**
 * Get OAuth2 client
 * @returns {OAuth2Client|null}
 */
export function getOAuth2Client() {
  if (!_oauth2Client) initGoogleAuth();
  return _oauth2Client;
}

/**
 * Get JWT client (service account)
 * @returns {JWT|null}
 */
export function getJWTClient() {
  if (!_jwtClient) initGoogleAuth();
  return _jwtClient;
}

/**
 * Generate OAuth2 authorization URL
 * @param {object} options - state, access_type, prompt, etc.
 * @returns {string}
 */
export function generateAuthUrl(options = {}) {
  const client = getOAuth2Client();
  if (!client) throw new Error('Google OAuth not configured');

  const defaultScopes = [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
  ];

  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: defaultScopes,
    ...options,
  });
}

/**
 * Exchange code for tokens
 * @param {string} code
 * @returns {Promise<object>} tokens
 */
export async function exchangeCode(code) {
  const client = getOAuth2Client();
  if (!client) throw new Error('Google OAuth not configured');

  const { tokens } = await client.getToken(code);
  return tokens;
}

/**
 * Get user info from Google
 * @param {string} accessToken
 * @returns {Promise<object>}
 */
export async function getUserInfo(accessToken) {
  const oauth2 = google.oauth2({ version: 'v2', auth: `Bearer ${accessToken}` });
  const res = await oauth2.userinfo.get();
  return res.data;
}

/**
 * Verify ID token
 * @param {string} idToken
 * @returns {Promise<object>}
 */
export async function verifyIdToken(idToken) {
  const client = getOAuth2Client();
  if (!client) throw new Error('Google OAuth not configured');

  const ticket = await client.verifyIdToken({
    idToken,
    audience: null, // validate against any client ID (for multi-tenant)
  });
  return ticket.getPayload();
}

/**
 * Create OAuth2 client with refresh token
 * @param {string} refreshToken
 * @returns {OAuth2Client}
 */
export function createClientWithRefresh(refreshToken) {
  const client = new google.auth.OAuth2(
    buildConfig().auth.google.clientId,
    buildConfig().auth.google.clientSecret,
    buildConfig().auth.google.redirectUri
  );
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}
