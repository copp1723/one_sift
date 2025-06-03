import { config as dotenvConfig } from 'dotenv';

dotenvConfig();

export const config = {
  // Database
  DATABASE_URL: process.env.DATABASE_URL!,
  
  // Redis
  REDIS_URL: process.env.REDIS_URL!,
  
  // API
  PORT: parseInt(process.env.PORT || '3000', 10),
  API_URL: process.env.API_URL || `http://localhost:${process.env.PORT || '3000'}`,
  API_KEY_SECRET: process.env.API_KEY_SECRET!,
  
  // Mailgun
  MAILGUN_API_KEY: process.env.MAILGUN_API_KEY!,
  MAILGUN_DOMAIN: process.env.MAILGUN_DOMAIN!,
  MAILGUN_WEBHOOK_SIGNING_KEY: process.env.MAILGUN_WEBHOOK_SIGNING_KEY!,
  
  // OpenAI
  OPENAI_API_KEY: process.env.OPENAI_API_KEY!,
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
  
  // System
  NODE_ENV: process.env.NODE_ENV || 'development',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000']
};
