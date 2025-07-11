import { Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';

interface LoggingRequest extends Request {
  user?: { id: string };
  apiKey?: { id: string };
  startTime?: number;
  requestId?: string;
}

export interface LoggingConfig {
  logToDatabase?: boolean;
  logToConsole?: boolean;
  includeBody?: boolean;
  includeHeaders?: boolean;
  excludePaths?: string[];
  sensitiveHeaders?: string[];
}

export class LoggingMiddleware {
  private db: Pool;
  
  constructor(db: Pool) {
    this.db = db;
  }

  createLogger = (config: LoggingConfig = {}) => {
    const defaultConfig: LoggingConfig = {
      logToDatabase: true,
      logToConsole: process.env.NODE_ENV === 'development',
      includeBody: false,
      includeHeaders: false,
      excludePaths: ['/health', '/metrics', '/favicon.ico'],
      sensitiveHeaders: ['authorization', 'x-api-key', 'cookie']
    };

    const finalConfig = { ...defaultConfig, ...config };

    return async (req: LoggingRequest, res: Response, next: NextFunction) => {
      // Skip excluded paths
      if (finalConfig.excludePaths?.some(path => req.path.startsWith(path))) {
        return next();
      }

      // Generate request ID and start timer
      req.requestId = this.generateRequestId();
      req.startTime = Date.now();

      // Set request ID header for tracing
      res.setHeader('X-Request-ID', req.requestId);

      // Override res.json to capture response
      const originalJson = res.json;
      let responseBody: any;
      
      res.json = function(body: any) {
        responseBody = body;
        return originalJson.call(this, body);
      };

      // Log request if console logging is enabled
      if (finalConfig.logToConsole) {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${req.ip}`);
      }

      // Wait for response to complete
      res.on('finish', async () => {
        const responseTime = Date.now() - req.startTime!;
        
        try {
          await this.logRequest(req, res, responseTime, responseBody, finalConfig);
        } catch (error) {
          console.error('Failed to log request:', error);
        }
      });

      next();
    };
  };

  private async logRequest(
    req: LoggingRequest, 
    res: Response, 
    responseTime: number, 
    responseBody: any, 
    config: LoggingConfig
  ) {
    const logData = {
      requestId: req.requestId!,
      method: req.method,
      endpoint: req.path,
      statusCode: res.statusCode,
      responseTime,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      userId: req.user?.id,
      apiKeyId: req.apiKey?.id,
      requestSize: this.getRequestSize(req),
      responseSize: this.getResponseSize(responseBody),
      errorMessage: res.statusCode >= 400 ? this.extractErrorMessage(responseBody) : null,
      timestamp: new Date()
    };

    // Log to console if enabled
    if (config.logToConsole) {
      const logLevel = res.statusCode >= 500 ? 'ERROR' : res.statusCode >= 400 ? 'WARN' : 'INFO';
      console.log(`[${logData.timestamp.toISOString()}] ${logLevel} ${logData.method} ${logData.endpoint} ${logData.statusCode} ${responseTime}ms`);
      
      if (logData.errorMessage) {
        console.error('Error details:', logData.errorMessage);
      }
    }

    // Log to database if enabled
    if (config.logToDatabase) {
      try {
        await this.db.query(`
          INSERT INTO api_usage_logs (
            api_key_id, user_id, endpoint, method, status_code, 
            response_time_ms, request_size_bytes, response_size_bytes,
            ip_address, user_agent, request_id, error_message, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `, [
          logData.apiKeyId,
          logData.userId,
          logData.endpoint,
          logData.method,
          logData.statusCode,
          logData.responseTime,
          logData.requestSize,
          logData.responseSize,
          logData.ipAddress,
          logData.userAgent,
          logData.requestId,
          logData.errorMessage,
          logData.timestamp
        ]);
      } catch (dbError) {
        console.error('Failed to log to database:', dbError);
      }
    }
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getRequestSize(req: Request): number {
    const contentLength = req.headers['content-length'];
    if (contentLength) {
      return parseInt(contentLength, 10);
    }
    
    // Estimate size if content-length is not available
    if (req.body) {
      return Buffer.byteLength(JSON.stringify(req.body), 'utf8');
    }
    
    return 0;
  }

  private getResponseSize(responseBody: any): number {
    if (!responseBody) return 0;
    
    if (typeof responseBody === 'string') {
      return Buffer.byteLength(responseBody, 'utf8');
    }
    
    try {
      return Buffer.byteLength(JSON.stringify(responseBody), 'utf8');
    } catch {
      return 0;
    }
  }

  private extractErrorMessage(responseBody: any): string | null {
    if (!responseBody) return null;
    
    if (typeof responseBody === 'string') {
      return responseBody;
    }
    
    if (typeof responseBody === 'object') {
      return responseBody.error?.message || responseBody.message || null;
    }
    
    return null;
  }

  // Request timing middleware
  static timing = (req: LoggingRequest, res: Response, next: NextFunction) => {
    req.startTime = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - req.startTime!;
      res.setHeader('X-Response-Time', `${duration}ms`);
    });
    
    next();
  };

  // Error logging middleware
  static errorLogger = (error: any, req: LoggingRequest, res: Response, next: NextFunction) => {
    const errorLog = {
      requestId: req.requestId,
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      user: req.user?.id,
      apiKey: req.apiKey?.id
    };

    console.error('Request Error:', JSON.stringify(errorLog, null, 2));
    
    next(error);
  };
}