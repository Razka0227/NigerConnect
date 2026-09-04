import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT || 4000),
  host: process.env.HOST || '0.0.0.0',
  env: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'nigerconnect_dev_secret_change_me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '30d',
  // In dev the OTP is printed in the console + returned (dev only).
  otpAlwaysCode: process.env.OTP_ALWAYS_CODE || '123456',
  otpTtlMs: Number(process.env.OTP_TTL_MS || 5 * 60 * 1000),
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:4200')
    .split(',').map((s) => s.trim()).filter(Boolean),
  maxBodyBytes: Number(process.env.MAX_BODY_BYTES || 100_000), // ~100KB default
  cacheTtl: {
    news: Number(process.env.CACHE_NEWS_MS || 5 * 60 * 1000),
    ads: Number(process.env.CACHE_ADS_MS || 2 * 60 * 1000),
  },
};

export const isProd = () => config.env === 'production';
