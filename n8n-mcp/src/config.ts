import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';

dotenvConfig();

const ConfigSchema = z.object({
  n8n: z.object({
    baseUrl: z.string().url().describe('n8n instance base URL'),
    apiKey: z.string().min(1).describe('n8n API key'),
  }),
  server: z.object({
    logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  }),
});

const configData = {
  n8n: {
    baseUrl: process.env.N8N_BASE_URL || 'http://localhost:5678',
    apiKey: process.env.N8N_API_KEY || '',
  },
  server: {
    logLevel: (process.env.LOG_LEVEL as any) || 'info',
  },
};

export const config = ConfigSchema.parse(configData);