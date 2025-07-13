import { Redis } from 'ioredis';
import { DocumentNode, parse, print, buildSchema } from 'graphql';
import { LoggingService } from '../../src/observability/logging';
import { MetricsService } from '../../src/observability/metrics';

const logger = LoggingService.getInstance();
const metrics = MetricsService.getInstance();

export interface ServiceSchema {
  name: string;
  url: string;
  sdl: string;
  version: string;
  lastUpdated: Date;
  health: 'healthy' | 'unhealthy' | 'unknown';
  metadata?: Record<string, any>;
}

export interface SchemaComposition {
  id: string;
  supergraphSdl: string;
  services: ServiceSchema[];
  createdAt: Date;
  isValid: boolean;
  validationErrors?: string[];
  hash: string;
}

export interface SchemaRegistrationRequest {
  name: string;
  url: string;
  sdl: string;
  version?: string;
  metadata?: Record<string, any>;
}

export class SchemaRegistry {
  private redis: Redis;
  private schemas: Map<string, ServiceSchema> = new Map();
  private currentComposition: SchemaComposition | null = null;
  private pollInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      enableOfflineQueue: false,
      maxRetriesPerRequest: 3
    });

    this.loadSchemasFromRedis();
    this.startHealthMonitoring();
  }

  async registerSchema(request: SchemaRegistrationRequest): Promise<{
    success: boolean;
    composition?: SchemaComposition;
    errors?: string[];
  }> {
    try {
      logger.info('Registering schema', { 
        serviceName: request.name,
        version: request.version 
      });

      // Validate SDL
      const validationResult = this.validateSDL(request.sdl);
      if (!validationResult.valid) {
        return {
          success: false,
          errors: validationResult.errors
        };
      }

      // Create service schema
      const serviceSchema: ServiceSchema = {
        name: request.name,
        url: request.url,
        sdl: request.sdl,
        version: request.version || '1.0.0',
        lastUpdated: new Date(),
        health: 'unknown',
        metadata: request.metadata
      };

      // Store in memory and Redis
      this.schemas.set(request.name, serviceSchema);
      await this.persistSchema(serviceSchema);

      // Check service health
      const healthStatus = await this.checkServiceHealth(request.url);
      serviceSchema.health = healthStatus ? 'healthy' : 'unhealthy';
      await this.persistSchema(serviceSchema);

      // Recompose supergraph
      const composition = await this.composeSupergraph();
      
      if (composition.isValid) {
        this.currentComposition = composition;
        await this.persistComposition(composition);
        
        // Notify gateway of schema update
        await this.notifyGatewayUpdate(composition);
      }

      metrics.recordMetric('schemaRegistry', 'schemaRegistered', 1, {
        serviceName: request.name,
        success: composition.isValid.toString()
      });

      return {
        success: composition.isValid,
        composition: composition.isValid ? composition : undefined,
        errors: composition.isValid ? undefined : composition.validationErrors
      };

    } catch (error) {
      logger.error('Schema registration failed', { 
        serviceName: request.name, 
        error 
      });
      
      metrics.recordMetric('schemaRegistry', 'registrationFailed', 1, {
        serviceName: request.name
      });

      return {
        success: false,
        errors: [error.message]
      };
    }
  }

  async unregisterSchema(serviceName: string): Promise<boolean> {
    try {
      if (!this.schemas.has(serviceName)) {
        return false;
      }

      // Remove from memory and Redis
      this.schemas.delete(serviceName);
      await this.redis.del(`schema:${serviceName}`);

      // Recompose supergraph
      const composition = await this.composeSupergraph();
      
      if (composition.isValid) {
        this.currentComposition = composition;
        await this.persistComposition(composition);
        await this.notifyGatewayUpdate(composition);
      }

      logger.info('Schema unregistered', { serviceName });
      metrics.recordMetric('schemaRegistry', 'schemaUnregistered', 1, {
        serviceName
      });

      return true;
    } catch (error) {
      logger.error('Schema unregistration failed', { serviceName, error });
      return false;
    }
  }

  async getSchema(serviceName: string): Promise<ServiceSchema | null> {
    return this.schemas.get(serviceName) || null;
  }

  async getAllSchemas(): Promise<ServiceSchema[]> {
    return Array.from(this.schemas.values());
  }

  async getCurrentComposition(): Promise<SchemaComposition | null> {
    return this.currentComposition;
  }

  async updateServiceHealth(serviceName: string, healthy: boolean): Promise<void> {
    const schema = this.schemas.get(serviceName);
    if (schema) {
      schema.health = healthy ? 'healthy' : 'unhealthy';
      schema.lastUpdated = new Date();
      await this.persistSchema(schema);

      metrics.recordMetric('schemaRegistry', 'healthUpdated', 1, {
        serviceName,
        healthy: healthy.toString()
      });
    }
  }

  private validateSDL(sdl: string): { valid: boolean; errors?: string[] } {
    try {
      const document = parse(sdl);
      
      // Basic federation validation
      const errors: string[] = [];
      
      // Check for required federation directives
      const hasFederationDirectives = sdl.includes('@key') || 
                                     sdl.includes('@external') || 
                                     sdl.includes('@provides') || 
                                     sdl.includes('@requires');
      
      if (!hasFederationDirectives) {
        logger.warn('Schema does not contain federation directives', { sdl: sdl.substring(0, 200) });
      }

      // Validate schema can be built
      try {
        buildSchema(sdl);
      } catch (buildError) {
        errors.push(`Schema build error: ${buildError.message}`);
      }

      return {
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined
      };
    } catch (error) {
      return {
        valid: false,
        errors: [`SDL parsing error: ${error.message}`]
      };
    }
  }

  private async composeSupergraph(): Promise<SchemaComposition> {
    const services = Array.from(this.schemas.values())
      .filter(schema => schema.health === 'healthy');

    const compositionId = this.generateCompositionId(services);
    
    try {
      // Simplified composition - in production, use Apollo Federation
      const supergraphSdl = this.combineSchemas(services);
      
      const composition: SchemaComposition = {
        id: compositionId,
        supergraphSdl,
        services: [...services],
        createdAt: new Date(),
        isValid: true,
        hash: this.calculateHash(supergraphSdl)
      };

      logger.info('Supergraph composed successfully', {
        compositionId,
        serviceCount: services.length
      });

      return composition;
    } catch (error) {
      logger.error('Supergraph composition failed', { error });
      
      return {
        id: compositionId,
        supergraphSdl: '',
        services: [...services],
        createdAt: new Date(),
        isValid: false,
        validationErrors: [error.message],
        hash: ''
      };
    }
  }

  private combineSchemas(services: ServiceSchema[]): string {
    // This is a simplified implementation
    // In production, use @apollo/composition or similar
    
    const combinedTypes: string[] = [];
    const combinedQueries: string[] = [];
    const combinedMutations: string[] = [];
    const combinedSubscriptions: string[] = [];

    services.forEach(service => {
      const sdl = service.sdl;
      
      // Extract types (simplified)
      const typeMatches = sdl.match(/type\s+\w+[^{]*{[^}]*}/g) || [];
      combinedTypes.push(...typeMatches);
      
      // Extract Query fields
      const queryMatch = sdl.match(/type\s+Query\s*{([^}]*)}/);
      if (queryMatch) {
        const fields = queryMatch[1].trim();
        if (fields) {
          combinedQueries.push(fields);
        }
      }
      
      // Extract Mutation fields
      const mutationMatch = sdl.match(/type\s+Mutation\s*{([^}]*)}/);
      if (mutationMatch) {
        const fields = mutationMatch[1].trim();
        if (fields) {
          combinedMutations.push(fields);
        }
      }
    });

    // Build combined schema
    let combinedSdl = combinedTypes.join('\n\n');
    
    if (combinedQueries.length > 0) {
      combinedSdl += `\n\ntype Query {\n${combinedQueries.join('\n')}\n}`;
    }
    
    if (combinedMutations.length > 0) {
      combinedSdl += `\n\ntype Mutation {\n${combinedMutations.join('\n')}\n}`;
    }

    return combinedSdl;
  }

  private generateCompositionId(services: ServiceSchema[]): string {
    const serviceData = services
      .map(s => `${s.name}:${s.version}:${s.lastUpdated.getTime()}`)
      .sort()
      .join('|');
    
    return this.calculateHash(serviceData);
  }

  private calculateHash(content: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  private async persistSchema(schema: ServiceSchema): Promise<void> {
    await this.redis.setex(
      `schema:${schema.name}`,
      86400, // 24 hours TTL
      JSON.stringify(schema)
    );
  }

  private async persistComposition(composition: SchemaComposition): Promise<void> {
    await this.redis.setex(
      'current_composition',
      86400, // 24 hours TTL
      JSON.stringify(composition)
    );
  }

  private async loadSchemasFromRedis(): Promise<void> {
    try {
      const keys = await this.redis.keys('schema:*');
      
      for (const key of keys) {
        const data = await this.redis.get(key);
        if (data) {
          const schema: ServiceSchema = JSON.parse(data);
          this.schemas.set(schema.name, schema);
        }
      }

      // Load current composition
      const compositionData = await this.redis.get('current_composition');
      if (compositionData) {
        this.currentComposition = JSON.parse(compositionData);
      }

      logger.info('Schemas loaded from Redis', { 
        count: this.schemas.size 
      });
    } catch (error) {
      logger.error('Failed to load schemas from Redis', { error });
    }
  }

  private async checkServiceHealth(url: string): Promise<boolean> {
    try {
      const response = await fetch(`${url}/health`, {
        method: 'GET',
        timeout: 5000
      });
      
      return response.ok;
    } catch (error) {
      logger.warn('Service health check failed', { url, error: error.message });
      return false;
    }
  }

  private startHealthMonitoring(): void {
    this.pollInterval = setInterval(async () => {
      try {
        await this.checkAllServicesHealth();
      } catch (error) {
        logger.error('Health monitoring error', { error });
      }
    }, 30000); // Check every 30 seconds
  }

  private async checkAllServicesHealth(): Promise<void> {
    const healthChecks = Array.from(this.schemas.values()).map(async schema => {
      const healthy = await this.checkServiceHealth(schema.url);
      const previousHealth = schema.health;
      
      await this.updateServiceHealth(schema.name, healthy);
      
      // Log health changes
      if (previousHealth !== schema.health) {
        logger.info('Service health changed', {
          serviceName: schema.name,
          previousHealth,
          currentHealth: schema.health
        });
        
        // Recompose if health changed
        if (previousHealth === 'healthy' || schema.health === 'healthy') {
          const composition = await this.composeSupergraph();
          if (composition.isValid) {
            this.currentComposition = composition;
            await this.persistComposition(composition);
            await this.notifyGatewayUpdate(composition);
          }
        }
      }
    });

    await Promise.all(healthChecks);
  }

  private async notifyGatewayUpdate(composition: SchemaComposition): Promise<void> {
    try {
      // Publish to Redis pub/sub for gateway notification
      await this.redis.publish('schema_updates', JSON.stringify({
        type: 'composition_updated',
        compositionId: composition.id,
        timestamp: new Date().toISOString()
      }));

      logger.info('Gateway notified of schema update', {
        compositionId: composition.id
      });
    } catch (error) {
      logger.error('Failed to notify gateway', { error });
    }
  }

  async getSchemaVersions(serviceName: string): Promise<string[]> {
    try {
      const versions = await this.redis.lrange(`versions:${serviceName}`, 0, -1);
      return versions;
    } catch (error) {
      logger.error('Failed to get schema versions', { serviceName, error });
      return [];
    }
  }

  async rollbackSchema(serviceName: string, version: string): Promise<boolean> {
    try {
      const versionData = await this.redis.get(`schema:${serviceName}:${version}`);
      if (!versionData) {
        return false;
      }

      const schema: ServiceSchema = JSON.parse(versionData);
      schema.lastUpdated = new Date();
      
      // Update current schema
      this.schemas.set(serviceName, schema);
      await this.persistSchema(schema);

      // Recompose supergraph
      const composition = await this.composeSupergraph();
      if (composition.isValid) {
        this.currentComposition = composition;
        await this.persistComposition(composition);
        await this.notifyGatewayUpdate(composition);
      }

      logger.info('Schema rolled back', { serviceName, version });
      return true;
    } catch (error) {
      logger.error('Schema rollback failed', { serviceName, version, error });
      return false;
    }
  }

  async getCompositionHistory(limit: number = 10): Promise<SchemaComposition[]> {
    try {
      const keys = await this.redis.lrange('composition_history', 0, limit - 1);
      const compositions = [];

      for (const key of keys) {
        const data = await this.redis.get(key);
        if (data) {
          compositions.push(JSON.parse(data));
        }
      }

      return compositions;
    } catch (error) {
      logger.error('Failed to get composition history', { error });
      return [];
    }
  }

  async validateComposition(services: ServiceSchema[]): Promise<{
    valid: boolean;
    errors?: string[];
    warnings?: string[];
  }> {
    try {
      const errors: string[] = [];
      const warnings: string[] = [];

      // Check for service conflicts
      const serviceNames = new Set<string>();
      for (const service of services) {
        if (serviceNames.has(service.name)) {
          errors.push(`Duplicate service name: ${service.name}`);
        }
        serviceNames.add(service.name);
      }

      // Check for schema compatibility
      // This would include more sophisticated checks in production
      for (const service of services) {
        if (service.health !== 'healthy') {
          warnings.push(`Service ${service.name} is not healthy`);
        }
      }

      return {
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
        warnings: warnings.length > 0 ? warnings : undefined
      };
    } catch (error) {
      return {
        valid: false,
        errors: [error.message]
      };
    }
  }

  stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
    this.redis.disconnect();
  }
}