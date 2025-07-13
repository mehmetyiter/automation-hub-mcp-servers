import winston from 'winston';
import path from 'path';

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf((info) => {
    const { timestamp, level, message, stack, ...meta } = info;
    
    let log = `${timestamp} [${level.toUpperCase()}]`;
    
    if (typeof message === 'string') {
      log += ` ${message}`;
    } else if (typeof message === 'object') {
      log += ` ${JSON.stringify(message)}`;
    }
    
    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    
    // Add stack trace for errors
    if (stack) {
      log += `\n${stack}`;
    }
    
    return log;
  })
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss.SSS'
  }),
  winston.format.printf((info) => {
    const { timestamp, level, message, stack, ...meta } = info;
    
    let log = `${timestamp} ${level}`;
    
    if (typeof message === 'string') {
      log += ` ${message}`;
    } else if (typeof message === 'object') {
      log += ` ${JSON.stringify(message, null, 2)}`;
    }
    
    // Add metadata if present (excluding common fields)
    const filteredMeta = { ...meta };
    delete filteredMeta.timestamp;
    delete filteredMeta.level;
    delete filteredMeta.message;
    
    if (Object.keys(filteredMeta).length > 0) {
      log += ` ${JSON.stringify(filteredMeta, null, 2)}`;
    }
    
    // Add stack trace for errors
    if (stack) {
      log += `\n${stack}`;
    }
    
    return log;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: {
    service: 'error-tracking-system',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'production' ? logFormat : consoleFormat,
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
    }),
    
    // File transports for production
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: logFormat
    }),
    
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: logFormat
    })
  ],
  
  // Handle exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'exceptions.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ],
  
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'rejections.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

// Add request ID and correlation ID support
export const addRequestId = (requestId: string) => {
  return logger.child({ requestId });
};

export const addCorrelationId = (correlationId: string) => {
  return logger.child({ correlationId });
};

// Helper functions for structured logging
export const logError = (message: string, error: Error, meta?: Record<string, any>) => {
  logger.error(message, {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    },
    ...meta
  });
};

export const logRequest = (method: string, url: string, statusCode: number, responseTime: number, meta?: Record<string, any>) => {
  logger.info('HTTP Request', {
    method,
    url,
    statusCode,
    responseTime,
    ...meta
  });
};

export const logPerformance = (operation: string, duration: number, meta?: Record<string, any>) => {
  logger.info('Performance', {
    operation,
    duration,
    ...meta
  });
};

export const logAlert = (level: string, message: string, meta?: Record<string, any>) => {
  const logLevel = level === 'critical' || level === 'fatal' ? 'error' : 
                   level === 'warning' ? 'warn' : 'info';
  
  logger[logLevel](`ALERT: ${message}`, {
    alertLevel: level,
    ...meta
  });
};

// Log levels for different components
export const createComponentLogger = (component: string) => {
  return logger.child({ component });
};

// Structured error logging with context
export const logWithContext = (level: string, message: string, context: Record<string, any>) => {
  logger.log(level, message, context);
};

// Create logs directory if it doesn't exist
import fs from 'fs';
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

export { logger };
export default logger;