import { EventEmitter } from 'events';
import { Pool } from 'pg';
import { Logger } from '../utils/logger';

interface UserBehaviorBaseline {
  userId: string;
  behaviorType: string;
  baselineData: {
    loginTimes: {
      hourlyDistribution: number[];
      weekdayDistribution: number[];
      averageSessionDuration: number;
      stdDevSessionDuration: number;
    };
    accessPatterns: {
      commonEndpoints: Map<string, number>;
      averageRequestRate: number;
      stdDevRequestRate: number;
      commonIpAddresses: Map<string, number>;
      geographicLocations: Map<string, number>;
    };
    dataUsage: {
      averageDataVolume: number;
      stdDevDataVolume: number;
      peakUsageHours: number[];
      commonOperations: Map<string, number>;
    };
    errorPatterns: {
      averageErrorRate: number;
      commonErrors: Map<string, number>;
      failedAuthAttempts: number;
    };
  };
  confidenceLevel: number;
  sampleSize: number;
  lastUpdated: Date;
  validUntil: Date;
}

interface AnomalyDetection {
  id: string;
  userId: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  score: number;
  description: string;
  deviations: Deviation[];
  metadata: Record<string, any>;
  timestamp: Date;
}

interface Deviation {
  metric: string;
  expected: number;
  actual: number;
  deviation: number;
  zScore: number;
}

interface AnomalyRule {
  type: string;
  threshold: number;
  sensitivity: number;
  minSampleSize: number;
  metrics: string[];
}

export class AnomalyDetector extends EventEmitter {
  private db: Pool;
  private logger: Logger;
  private sensitivity: number = 0.7;
  private baselines: Map<string, UserBehaviorBaseline> = new Map();
  private anomalyRules: Map<string, AnomalyRule> = new Map();
  private learningMode: boolean = true;
  private minBaselineSampleSize: number = 100;
  private baselineUpdateInterval: NodeJS.Timeout | null = null;

  constructor(db: Pool, logger: Logger) {
    super();
    this.db = db;
    this.logger = logger;

    this.initializeAnomalyRules();
    this.loadBaselines();
    this.startBaselineUpdates();
  }

  private initializeAnomalyRules(): void {
    const rules: AnomalyRule[] = [
      {
        type: 'login_time_anomaly',
        threshold: 3.0, // 3 standard deviations
        sensitivity: 0.8,
        minSampleSize: 50,
        metrics: ['login_hour', 'login_day']
      },
      {
        type: 'access_pattern_anomaly',
        threshold: 2.5,
        sensitivity: 0.7,
        minSampleSize: 100,
        metrics: ['request_rate', 'endpoint_access', 'data_volume']
      },
      {
        type: 'geographic_anomaly',
        threshold: 2.0,
        sensitivity: 0.9,
        minSampleSize: 20,
        metrics: ['location_change', 'new_location']
      },
      {
        type: 'error_rate_anomaly',
        threshold: 2.5,
        sensitivity: 0.6,
        minSampleSize: 50,
        metrics: ['error_rate', 'failed_auth_attempts']
      },
      {
        type: 'data_exfiltration_anomaly',
        threshold: 3.0,
        sensitivity: 0.9,
        minSampleSize: 100,
        metrics: ['data_download_volume', 'export_operations']
      }
    ];

    for (const rule of rules) {
      this.anomalyRules.set(rule.type, rule);
    }
  }

  private async loadBaselines(): Promise<void> {
    const query = `
      SELECT * FROM user_behavior_baselines
      WHERE valid_until > NOW()
    `;

    const result = await this.db.query(query);

    this.baselines.clear();
    for (const row of result.rows) {
      const baseline: UserBehaviorBaseline = {
        userId: row.user_id,
        behaviorType: row.behavior_type,
        baselineData: row.baseline_data,
        confidenceLevel: row.confidence_level,
        sampleSize: row.sample_size,
        lastUpdated: row.last_updated,
        validUntil: row.valid_until
      };

      const key = `${baseline.userId}:${baseline.behaviorType}`;
      this.baselines.set(key, baseline);
    }

    this.logger.info(`Loaded ${this.baselines.size} user behavior baselines`);
  }

  private startBaselineUpdates(): void {
    // Update baselines periodically
    this.baselineUpdateInterval = setInterval(() => {
      this.updateBaselines();
    }, 3600000); // Every hour
  }

  async analyzeEvent(event: any): Promise<void> {
    if (!event.userId) return;

    // Skip analysis in learning mode for new users
    const userBaseline = await this.getUserBaseline(event.userId);
    if (!userBaseline && this.learningMode) {
      await this.collectBehaviorData(event);
      return;
    }

    const anomalies: AnomalyDetection[] = [];

    // Analyze login time anomalies
    if (event.eventType === 'authentication_success') {
      const loginAnomaly = await this.analyzeLoginTimeAnomaly(event, userBaseline);
      if (loginAnomaly) anomalies.push(loginAnomaly);
    }

    // Analyze access pattern anomalies
    const accessAnomaly = await this.analyzeAccessPatternAnomaly(event, userBaseline);
    if (accessAnomaly) anomalies.push(accessAnomaly);

    // Analyze geographic anomalies
    if (event.sourceIp || event.geolocation) {
      const geoAnomaly = await this.analyzeGeographicAnomaly(event, userBaseline);
      if (geoAnomaly) anomalies.push(geoAnomaly);
    }

    // Analyze error rate anomalies
    if (event.eventType.includes('error') || event.eventType.includes('failed')) {
      const errorAnomaly = await this.analyzeErrorRateAnomaly(event, userBaseline);
      if (errorAnomaly) anomalies.push(errorAnomaly);
    }

    // Analyze data volume anomalies
    if (event.dataVolume || event.eventType.includes('export')) {
      const dataAnomaly = await this.analyzeDataVolumeAnomaly(event, userBaseline);
      if (dataAnomaly) anomalies.push(dataAnomaly);
    }

    // Emit anomalies
    for (const anomaly of anomalies) {
      this.emit('anomaly-detected', anomaly);
      await this.storeAnomaly(anomaly);
    }

    // Update baseline with new data
    await this.updateUserBehavior(event);
  }

  private async analyzeLoginTimeAnomaly(event: any, baseline: UserBehaviorBaseline | null): Promise<AnomalyDetection | null> {
    if (!baseline?.baselineData?.loginTimes) return null;

    const eventTime = new Date(event.timestamp);
    const hour = eventTime.getHours();
    const dayOfWeek = eventTime.getDay();

    const deviations: Deviation[] = [];

    // Check hourly distribution
    const expectedHourlyProb = baseline.baselineData.loginTimes.hourlyDistribution[hour] || 0;
    const avgHourlyProb = 1 / 24;
    
    if (expectedHourlyProb < avgHourlyProb * 0.1) {
      // Unusual login hour
      deviations.push({
        metric: 'login_hour',
        expected: avgHourlyProb,
        actual: expectedHourlyProb,
        deviation: Math.abs(expectedHourlyProb - avgHourlyProb),
        zScore: this.calculateZScore(expectedHourlyProb, avgHourlyProb, avgHourlyProb * 0.5)
      });
    }

    // Check day of week distribution
    const expectedDayProb = baseline.baselineData.loginTimes.weekdayDistribution[dayOfWeek] || 0;
    const avgDayProb = 1 / 7;

    if (expectedDayProb < avgDayProb * 0.2) {
      // Unusual login day
      deviations.push({
        metric: 'login_day',
        expected: avgDayProb,
        actual: expectedDayProb,
        deviation: Math.abs(expectedDayProb - avgDayProb),
        zScore: this.calculateZScore(expectedDayProb, avgDayProb, avgDayProb * 0.5)
      });
    }

    if (deviations.length === 0) return null;

    const rule = this.anomalyRules.get('login_time_anomaly')!;
    const maxZScore = Math.max(...deviations.map(d => d.zScore));

    if (maxZScore < rule.threshold) return null;

    return {
      id: this.generateAnomalyId(),
      userId: event.userId,
      type: 'login_time_anomaly',
      severity: this.calculateSeverity(maxZScore, rule.threshold),
      score: maxZScore,
      description: `Unusual login time detected: ${eventTime.toLocaleString()}`,
      deviations,
      metadata: {
        hour,
        dayOfWeek,
        timestamp: event.timestamp
      },
      timestamp: new Date()
    };
  }

  private async analyzeAccessPatternAnomaly(event: any, baseline: UserBehaviorBaseline | null): Promise<AnomalyDetection | null> {
    if (!baseline?.baselineData?.accessPatterns) return null;

    const deviations: Deviation[] = [];
    const patterns = baseline.baselineData.accessPatterns;

    // Check request rate
    const currentRate = await this.getCurrentRequestRate(event.userId);
    if (currentRate > patterns.averageRequestRate + (3 * patterns.stdDevRequestRate)) {
      deviations.push({
        metric: 'request_rate',
        expected: patterns.averageRequestRate,
        actual: currentRate,
        deviation: currentRate - patterns.averageRequestRate,
        zScore: this.calculateZScore(currentRate, patterns.averageRequestRate, patterns.stdDevRequestRate)
      });
    }

    // Check endpoint access
    if (event.requestPath) {
      const endpointAccess = patterns.commonEndpoints.get(event.requestPath) || 0;
      const totalAccesses = Array.from(patterns.commonEndpoints.values()).reduce((a, b) => a + b, 0);
      const expectedProb = endpointAccess / totalAccesses;

      if (expectedProb < 0.001) {
        // Rare endpoint access
        deviations.push({
          metric: 'endpoint_access',
          expected: 0.01,
          actual: expectedProb,
          deviation: 0.01 - expectedProb,
          zScore: 3.5 // High score for rare endpoints
        });
      }
    }

    if (deviations.length === 0) return null;

    const rule = this.anomalyRules.get('access_pattern_anomaly')!;
    const maxZScore = Math.max(...deviations.map(d => d.zScore));

    if (maxZScore < rule.threshold) return null;

    return {
      id: this.generateAnomalyId(),
      userId: event.userId,
      type: 'access_pattern_anomaly',
      severity: this.calculateSeverity(maxZScore, rule.threshold),
      score: maxZScore,
      description: 'Unusual access pattern detected',
      deviations,
      metadata: {
        requestPath: event.requestPath,
        currentRate
      },
      timestamp: new Date()
    };
  }

  private async analyzeGeographicAnomaly(event: any, baseline: UserBehaviorBaseline | null): Promise<AnomalyDetection | null> {
    if (!event.geolocation) return null;

    const deviations: Deviation[] = [];

    // Check if location is new
    if (baseline?.baselineData?.accessPatterns?.geographicLocations) {
      const locationKey = `${event.geolocation.country}:${event.geolocation.city}`;
      const locationCount = baseline.baselineData.accessPatterns.geographicLocations.get(locationKey) || 0;

      if (locationCount === 0) {
        // New location
        deviations.push({
          metric: 'new_location',
          expected: 0,
          actual: 1,
          deviation: 1,
          zScore: 4.0 // High score for new locations
        });
      }
    }

    // Check for impossible travel
    const lastLocation = await this.getLastUserLocation(event.userId, event.timestamp);
    if (lastLocation && lastLocation.geolocation) {
      const distance = this.calculateDistance(
        lastLocation.geolocation.latitude,
        lastLocation.geolocation.longitude,
        event.geolocation.latitude,
        event.geolocation.longitude
      );

      const timeDiff = (new Date(event.timestamp).getTime() - new Date(lastLocation.timestamp).getTime()) / 3600000;
      const maxPossibleDistance = timeDiff * 1000; // 1000 km/h max travel speed

      if (distance > maxPossibleDistance) {
        deviations.push({
          metric: 'impossible_travel',
          expected: maxPossibleDistance,
          actual: distance,
          deviation: distance - maxPossibleDistance,
          zScore: 5.0 // Very high score for impossible travel
        });
      }
    }

    if (deviations.length === 0) return null;

    const rule = this.anomalyRules.get('geographic_anomaly')!;
    const maxZScore = Math.max(...deviations.map(d => d.zScore));

    if (maxZScore < rule.threshold) return null;

    return {
      id: this.generateAnomalyId(),
      userId: event.userId,
      type: 'geographic_anomaly',
      severity: this.calculateSeverity(maxZScore, rule.threshold),
      score: maxZScore,
      description: `Unusual geographic activity from ${event.geolocation.country}`,
      deviations,
      metadata: {
        location: event.geolocation,
        sourceIp: event.sourceIp
      },
      timestamp: new Date()
    };
  }

  private async analyzeErrorRateAnomaly(event: any, baseline: UserBehaviorBaseline | null): Promise<AnomalyDetection | null> {
    if (!baseline?.baselineData?.errorPatterns) return null;

    const deviations: Deviation[] = [];
    const currentErrorRate = await this.getCurrentErrorRate(event.userId);

    if (currentErrorRate > baseline.baselineData.errorPatterns.averageErrorRate * 3) {
      deviations.push({
        metric: 'error_rate',
        expected: baseline.baselineData.errorPatterns.averageErrorRate,
        actual: currentErrorRate,
        deviation: currentErrorRate - baseline.baselineData.errorPatterns.averageErrorRate,
        zScore: this.calculateZScore(
          currentErrorRate,
          baseline.baselineData.errorPatterns.averageErrorRate,
          baseline.baselineData.errorPatterns.averageErrorRate * 0.5
        )
      });
    }

    if (event.eventType === 'authentication_failed') {
      const recentFailures = await this.getRecentAuthFailures(event.userId);
      if (recentFailures > 5) {
        deviations.push({
          metric: 'failed_auth_attempts',
          expected: 0,
          actual: recentFailures,
          deviation: recentFailures,
          zScore: recentFailures / 2 // High score for multiple failures
        });
      }
    }

    if (deviations.length === 0) return null;

    const rule = this.anomalyRules.get('error_rate_anomaly')!;
    const maxZScore = Math.max(...deviations.map(d => d.zScore));

    if (maxZScore < rule.threshold) return null;

    return {
      id: this.generateAnomalyId(),
      userId: event.userId,
      type: 'error_rate_anomaly',
      severity: this.calculateSeverity(maxZScore, rule.threshold),
      score: maxZScore,
      description: 'Abnormal error rate detected',
      deviations,
      metadata: {
        errorType: event.eventType,
        currentErrorRate
      },
      timestamp: new Date()
    };
  }

  private async analyzeDataVolumeAnomaly(event: any, baseline: UserBehaviorBaseline | null): Promise<AnomalyDetection | null> {
    if (!baseline?.baselineData?.dataUsage) return null;

    const deviations: Deviation[] = [];
    const dataVolume = event.dataVolume || 0;

    if (dataVolume > baseline.baselineData.dataUsage.averageDataVolume + 
        (3 * baseline.baselineData.dataUsage.stdDevDataVolume)) {
      deviations.push({
        metric: 'data_volume',
        expected: baseline.baselineData.dataUsage.averageDataVolume,
        actual: dataVolume,
        deviation: dataVolume - baseline.baselineData.dataUsage.averageDataVolume,
        zScore: this.calculateZScore(
          dataVolume,
          baseline.baselineData.dataUsage.averageDataVolume,
          baseline.baselineData.dataUsage.stdDevDataVolume
        )
      });
    }

    // Check for export operations
    if (event.eventType.includes('export') || event.eventType.includes('download')) {
      const exportCount = await this.getRecentExportCount(event.userId);
      if (exportCount > 10) {
        deviations.push({
          metric: 'export_operations',
          expected: 2,
          actual: exportCount,
          deviation: exportCount - 2,
          zScore: exportCount / 3
        });
      }
    }

    if (deviations.length === 0) return null;

    const rule = this.anomalyRules.get('data_exfiltration_anomaly')!;
    const maxZScore = Math.max(...deviations.map(d => d.zScore));

    if (maxZScore < rule.threshold) return null;

    return {
      id: this.generateAnomalyId(),
      userId: event.userId,
      type: 'data_exfiltration_anomaly',
      severity: this.calculateSeverity(maxZScore, rule.threshold),
      score: maxZScore,
      description: 'Unusual data access volume detected',
      deviations,
      metadata: {
        dataVolume,
        operation: event.eventType
      },
      timestamp: new Date()
    };
  }

  private calculateZScore(value: number, mean: number, stdDev: number): number {
    if (stdDev === 0) return 0;
    return Math.abs(value - mean) / stdDev;
  }

  private calculateSeverity(score: number, threshold: number): 'low' | 'medium' | 'high' | 'critical' {
    const ratio = score / threshold;
    if (ratio > 3) return 'critical';
    if (ratio > 2) return 'high';
    if (ratio > 1.5) return 'medium';
    return 'low';
  }

  private async getUserBaseline(userId: string): Promise<UserBehaviorBaseline | null> {
    const key = `${userId}:general`;
    
    if (this.baselines.has(key)) {
      return this.baselines.get(key)!;
    }

    // Load from database
    const query = `
      SELECT * FROM user_behavior_baselines
      WHERE user_id = $1 AND behavior_type = 'general'
        AND valid_until > NOW()
    `;

    const result = await this.db.query(query, [userId]);
    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    const baseline: UserBehaviorBaseline = {
      userId: row.user_id,
      behaviorType: row.behavior_type,
      baselineData: row.baseline_data,
      confidenceLevel: row.confidence_level,
      sampleSize: row.sample_size,
      lastUpdated: row.last_updated,
      validUntil: row.valid_until
    };

    this.baselines.set(key, baseline);
    return baseline;
  }

  private async getCurrentRequestRate(userId: string): Promise<number> {
    const query = `
      SELECT COUNT(*) as count
      FROM security_events_enhanced
      WHERE user_id = $1
        AND created_at > NOW() - INTERVAL '5 minutes'
    `;

    const result = await this.db.query(query, [userId]);
    return result.rows[0].count / 5; // Per minute
  }

  private async getCurrentErrorRate(userId: string): Promise<number> {
    const query = `
      SELECT 
        COUNT(CASE WHEN event_type LIKE '%error%' OR event_type LIKE '%failed%' THEN 1 END) as errors,
        COUNT(*) as total
      FROM security_events_enhanced
      WHERE user_id = $1
        AND created_at > NOW() - INTERVAL '1 hour'
    `;

    const result = await this.db.query(query, [userId]);
    const { errors, total } = result.rows[0];
    return total > 0 ? errors / total : 0;
  }

  private async getRecentAuthFailures(userId: string): Promise<number> {
    const query = `
      SELECT COUNT(*) as count
      FROM security_events_enhanced
      WHERE user_id = $1
        AND event_type = 'authentication_failed'
        AND created_at > NOW() - INTERVAL '15 minutes'
    `;

    const result = await this.db.query(query, [userId]);
    return result.rows[0].count;
  }

  private async getRecentExportCount(userId: string): Promise<number> {
    const query = `
      SELECT COUNT(*) as count
      FROM security_events_enhanced
      WHERE user_id = $1
        AND (event_type LIKE '%export%' OR event_type LIKE '%download%')
        AND created_at > NOW() - INTERVAL '1 hour'
    `;

    const result = await this.db.query(query, [userId]);
    return result.rows[0].count;
  }

  private async getLastUserLocation(userId: string, beforeTimestamp: Date): Promise<any> {
    const query = `
      SELECT geolocation, created_at as timestamp
      FROM security_events_enhanced
      WHERE user_id = $1
        AND geolocation IS NOT NULL
        AND created_at < $2
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const result = await this.db.query(query, [userId, beforeTimestamp]);
    return result.rows[0] || null;
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  private async collectBehaviorData(event: any): Promise<void> {
    // Collect data for baseline building
    // This would be implemented to gradually build user behavior profiles
  }

  private async updateUserBehavior(event: any): Promise<void> {
    // Update baseline with new behavior data
    // This would be implemented to continuously refine baselines
  }

  private async updateBaselines(): Promise<void> {
    try {
      const query = `
        SELECT DISTINCT user_id
        FROM security_events_enhanced
        WHERE created_at > NOW() - INTERVAL '30 days'
        GROUP BY user_id
        HAVING COUNT(*) > $1
      `;

      const result = await this.db.query(query, [this.minBaselineSampleSize]);

      for (const row of result.rows) {
        await this.buildUserBaseline(row.user_id);
      }

      this.logger.info('Updated user behavior baselines');
    } catch (error) {
      this.logger.error('Failed to update baselines', { error });
    }
  }

  private async buildUserBaseline(userId: string): Promise<void> {
    // This would implement the actual baseline building logic
    // For now, it's a placeholder
  }

  private async storeAnomaly(anomaly: AnomalyDetection): Promise<void> {
    // Store anomaly in database for analysis
    const query = `
      INSERT INTO security_events_enhanced (
        id, user_id, event_type, event_category, severity,
        title, description, risk_score, confidence_score,
        metadata, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `;

    await this.db.query(query, [
      anomaly.id,
      anomaly.userId,
      `anomaly_${anomaly.type}`,
      'policy_violation',
      anomaly.severity,
      `Anomaly Detected: ${anomaly.type}`,
      anomaly.description,
      anomaly.score * 20, // Convert to 0-100 scale
      this.sensitivity,
      JSON.stringify(anomaly.metadata),
      anomaly.timestamp
    ]);
  }

  private generateAnomalyId(): string {
    return `ANM-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  setSensitivity(sensitivity: number): void {
    this.sensitivity = Math.max(0, Math.min(1, sensitivity));
    this.logger.info(`Anomaly detection sensitivity set to ${this.sensitivity}`);
  }

  async stop(): Promise<void> {
    if (this.baselineUpdateInterval) {
      clearInterval(this.baselineUpdateInterval);
    }
  }
}