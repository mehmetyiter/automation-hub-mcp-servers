import { config } from 'dotenv';

// Load environment variables
config();

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  maxConnections?: number;
}

export interface ServerConfig {
  port: number;
  host: string;
  enableCors: boolean;
  enableRateLimit: boolean;
  maxRequestsPerMinute: number;
}

export interface MonitoringConfig {
  enableSystemMetrics: boolean;
  enableDockerMetrics: boolean;
  enableKubernetesMetrics: boolean;
  systemMetricsInterval: number;
  defaultCheckInterval: number;
  maxIncidentHistory: number;
  dataRetentionDays: number;
}

export interface AlertingConfig {
  enableThrottling: boolean;
  defaultThrottleWindow: number;
  maxActiveAlerts: number;
  enableScheduling: boolean;
}

export interface NotificationConfig {
  enableEmail: boolean;
  enableSlack: boolean;
  enableSMS: boolean;
  enableWebhooks: boolean;
  enablePagerDuty: boolean;
  defaultFromEmail?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  smtpPass?: string;
  slackToken?: string;
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioFromNumber?: string;
}

export interface ApplicationConfig {
  database: DatabaseConfig;
  server: ServerConfig;
  monitoring: MonitoringConfig;
  alerting: AlertingConfig;
  notifications: NotificationConfig;
  environment: 'development' | 'staging' | 'production';
  logLevel: string;
}

function getEnvString(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (!value && !defaultValue) {
    throw new Error(`Environment variable ${key} is required`);
  }
  return value || defaultValue!;
}

function getEnvNumber(key: string, defaultValue?: number): number {
  const value = process.env[key];
  if (!value) {
    if (defaultValue === undefined) {
      throw new Error(`Environment variable ${key} is required`);
    }
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a valid number`);
  }
  return parsed;
}

function getEnvBoolean(key: string, defaultValue: boolean = false): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

export const appConfig: ApplicationConfig = {
  environment: (process.env.NODE_ENV as any) || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',

  database: {
    host: getEnvString('DB_HOST', 'localhost'),
    port: getEnvNumber('DB_PORT', 5432),
    database: getEnvString('DB_NAME', 'health_monitor'),
    username: getEnvString('DB_USERNAME', 'postgres'),
    password: getEnvString('DB_PASSWORD', 'password'),
    ssl: getEnvBoolean('DB_SSL', false),
    maxConnections: getEnvNumber('DB_MAX_CONNECTIONS', 20)
  },

  server: {
    port: getEnvNumber('PORT', 3009),
    host: getEnvString('HOST', '0.0.0.0'),
    enableCors: getEnvBoolean('ENABLE_CORS', true),
    enableRateLimit: getEnvBoolean('ENABLE_RATE_LIMIT', true),
    maxRequestsPerMinute: getEnvNumber('MAX_REQUESTS_PER_MINUTE', 100)
  },

  monitoring: {
    enableSystemMetrics: getEnvBoolean('ENABLE_SYSTEM_METRICS', true),
    enableDockerMetrics: getEnvBoolean('ENABLE_DOCKER_METRICS', false),
    enableKubernetesMetrics: getEnvBoolean('ENABLE_KUBERNETES_METRICS', false),
    systemMetricsInterval: getEnvNumber('SYSTEM_METRICS_INTERVAL', 30000),
    defaultCheckInterval: getEnvNumber('DEFAULT_CHECK_INTERVAL', 60000),
    maxIncidentHistory: getEnvNumber('MAX_INCIDENT_HISTORY', 1000),
    dataRetentionDays: getEnvNumber('DATA_RETENTION_DAYS', 30)
  },

  alerting: {
    enableThrottling: getEnvBoolean('ENABLE_ALERT_THROTTLING', true),
    defaultThrottleWindow: getEnvNumber('DEFAULT_THROTTLE_WINDOW', 900000), // 15 minutes
    maxActiveAlerts: getEnvNumber('MAX_ACTIVE_ALERTS', 1000),
    enableScheduling: getEnvBoolean('ENABLE_ALERT_SCHEDULING', true)
  },

  notifications: {
    enableEmail: getEnvBoolean('ENABLE_EMAIL_NOTIFICATIONS', false),
    enableSlack: getEnvBoolean('ENABLE_SLACK_NOTIFICATIONS', false),
    enableSMS: getEnvBoolean('ENABLE_SMS_NOTIFICATIONS', false),
    enableWebhooks: getEnvBoolean('ENABLE_WEBHOOK_NOTIFICATIONS', true),
    enablePagerDuty: getEnvBoolean('ENABLE_PAGERDUTY_NOTIFICATIONS', false),
    
    // Email configuration
    defaultFromEmail: process.env.DEFAULT_FROM_EMAIL,
    smtpHost: process.env.SMTP_HOST,
    smtpPort: getEnvNumber('SMTP_PORT', 587),
    smtpSecure: getEnvBoolean('SMTP_SECURE', false),
    smtpUser: process.env.SMTP_USER,
    smtpPass: process.env.SMTP_PASS,
    
    // Slack configuration
    slackToken: process.env.SLACK_TOKEN,
    
    // Twilio configuration
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
    twilioFromNumber: process.env.TWILIO_FROM_NUMBER
  }
};

export function validateConfig(): void {
  const errors: string[] = [];

  // Validate database configuration
  if (!appConfig.database.host) errors.push('Database host is required');
  if (!appConfig.database.database) errors.push('Database name is required');
  if (!appConfig.database.username) errors.push('Database username is required');

  // Validate notification configurations
  if (appConfig.notifications.enableEmail) {
    if (!appConfig.notifications.smtpHost) errors.push('SMTP host is required for email notifications');
    if (!appConfig.notifications.smtpUser) errors.push('SMTP user is required for email notifications');
    if (!appConfig.notifications.smtpPass) errors.push('SMTP password is required for email notifications');
    if (!appConfig.notifications.defaultFromEmail) errors.push('Default from email is required for email notifications');
  }

  if (appConfig.notifications.enableSlack) {
    if (!appConfig.notifications.slackToken) errors.push('Slack token is required for Slack notifications');
  }

  if (appConfig.notifications.enableSMS) {
    if (!appConfig.notifications.twilioAccountSid) errors.push('Twilio Account SID is required for SMS notifications');
    if (!appConfig.notifications.twilioAuthToken) errors.push('Twilio Auth Token is required for SMS notifications');
    if (!appConfig.notifications.twilioFromNumber) errors.push('Twilio from number is required for SMS notifications');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}

export default appConfig;