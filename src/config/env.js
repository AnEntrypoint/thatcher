/**
 * Environment configuration
 * Provides typed access to environment variables with defaults
 */

/**
 * Get environment variable with optional default
 */
function getEnv(key, defaultValue = null) {
  const val = process.env[key];
  if (val === undefined || val === null) return defaultValue;
  return val;
}

/**
 * Get boolean from env
 */
function getEnvBool(key, defaultValue = false) {
  const val = getEnv(key);
  if (val === null) return defaultValue;
  return val === 'true' || val === '1';
}

/**
 * Get number from env
 */
function getEnvInt(key, defaultValue = 0) {
  const val = getEnv(key);
  if (val === null) return defaultValue;
  const num = parseInt(val, 10);
  return isNaN(num) ? defaultValue : num;
}

/**
 * Configuration object builder
 */
export function buildConfig(overrides = {}) {
  const config = {
    db: {
      path: overrides.databasePath || getEnv('DATABASE_PATH', './data/app.db'),
      ...overrides.db,
    },

    auth: {
      google: {
        clientId: getEnv('GOOGLE_CLIENT_ID'),
        clientSecret: getEnv('GOOGLE_CLIENT_SECRET'),
        redirectUri: getEnv('GOOGLE_REDIRECT_URI') || 'http://localhost:3000/api/auth/google/callback',
        serviceAccountPath: getEnv('GOOGLE_SERVICE_ACCOUNT_PATH', './config/service-account.json'),
        ...overrides.auth?.google,
      },
      session: {
        secure: getEnv('NODE_ENV') === 'production',
        expires: false,
        cookieName: getEnv('SESSION_COOKIE_NAME', 'thatcher_session'),
        maxAge: getEnvInt('SESSION_MAX_AGE', 60 * 60 * 24 * 30), // 30 days
        ...overrides.auth?.session,
      },
      ...overrides.auth,
    },

    drive: {
      serviceAccountPath: getEnv('GOOGLE_SERVICE_ACCOUNT_PATH', './config/service-account.json'),
      rootFolderId: getEnv('GOOGLE_DRIVE_FOLDER_ID'),
      cache: {
        enabled: true,
        ttl: 3600,
        bucket: getEnv('CACHE_BUCKET', 'thatcher_cache'),
        ...overrides.drive?.cache,
      },
      ...overrides.drive,
    },

    email: {
      provider: getEnv('EMAIL_PROVIDER', 'nodemailer'),
      from: getEnv('EMAIL_FROM', 'noreply@example.com'),
      smtp: {
        host: getEnv('EMAIL_HOST', 'smtp.gmail.com'),
        port: getEnvInt('EMAIL_PORT', 587),
        user: getEnv('EMAIL_USER'),
        password: getEnv('EMAIL_PASSWORD'),
        ...overrides.email?.smtp,
      },
      limits: {
        daily: getEnvInt('EMAIL_DAILY_LIMIT', 500),
        ratePerMinute: getEnvInt('EMAIL_RATE_PER_MINUTE', 10),
        ...overrides.email?.limits,
      },
      ...overrides.email,
    },

    app: {
      url: getEnv('APP_URL', 'http://localhost:3000'),
      env: getEnv('NODE_ENV', 'development'),
      debug: getEnvBool('DEBUG', false),
      name: getEnv('APP_NAME', 'Thatcher App'),
      ...overrides.app,
    },

    server: {
      port: getEnvInt('PORT', 3000),
      host: getEnv('HOST', '0.0.0.0'),
      ...overrides.server,
    },
  };

  return config;
}

/**
 * Check if Google OAuth is configured
 */
export function hasGoogleAuth(config) {
  const cfg = config?.auth?.google || buildConfig().auth.google;
  return !!(cfg.clientId && cfg.clientSecret);
}

/**
 * Check if Drive integration is configured
 */
export function hasDriveConfig(config) {
  const cfg = config?.drive || buildConfig().drive;
  return !!cfg.rootFolderId;
}

/**
 * Check if email sending is configured
 */
export function hasEmailConfig(config) {
  const cfg = config?.email || buildConfig().email;
  return !!(cfg.smtp.user && cfg.smtp.password);
}

/**
 * Validate environment configuration
 * Returns array of warnings (non-fatal)
 */
export function validateEnv(config = buildConfig()) {
  const warnings = [];

  if (!getEnv('DATABASE_PATH')) {
    warnings.push('DATABASE_PATH not set, using default ./data/app.db');
  }

  if (config.app.env === 'production') {
    if (!config.email.smtp.user) warnings.push('EMAIL_USER not set - email sending disabled');
    if (!config.email.smtp.password) warnings.push('EMAIL_PASSWORD not set - email sending disabled');
    if (!config.app.url) warnings.push('APP_URL not set - links in emails will use localhost');
  }

  if (!hasGoogleAuth(config)) {
    warnings.push('Google OAuth not configured - auth will be email/password only');
  }

  return warnings;
}

export default {
  buildConfig,
  hasGoogleAuth,
  hasDriveConfig,
  hasEmailConfig,
  validateEnv,
};
