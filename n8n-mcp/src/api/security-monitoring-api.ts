import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { Logger } from '../utils/logger';
import { SecurityMonitoringService } from '../security/security-monitoring-service';
import { ThreatDetectionEngine } from '../security/threat-detection-engine';
import { IncidentResponseService } from '../security/incident-response-service';
import { ComplianceReportingService } from '../security/compliance-reporting-service';
import { SecurityAuditManager } from '../security/security-audit-manager';

export function createSecurityMonitoringAPI(
  db: Pool,
  logger: Logger,
  securityService: SecurityMonitoringService,
  threatEngine: ThreatDetectionEngine,
  incidentService: IncidentResponseService,
  complianceService: ComplianceReportingService,
  auditManager: SecurityAuditManager
): Router {
  const router = Router();

  // Middleware to log all security API access
  router.use(async (req: Request, res: Response, next) => {
    const startTime = Date.now();

    // Log the request
    await auditManager.logAudit({
      actorId: req.headers['x-user-id'] as string,
      actorType: 'user',
      action: `security_api_${req.method.toLowerCase()}`,
      resourceType: 'security_api',
      resourceId: req.path,
      details: {
        method: req.method,
        endpoint: req.path,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        requestBody: req.method !== 'GET' ? req.body : undefined
      },
      riskLevel: 'low',
      tags: ['api', 'security'],
      sessionId: req.headers['x-session-id'] as string
    });

    // Continue with request
    res.on('finish', async () => {
      const duration = Date.now() - startTime;

      // Log response
      if (res.statusCode >= 400) {
        await auditManager.logAudit({
          actorId: req.headers['x-user-id'] as string,
          actorType: 'user',
          action: 'security_api_error',
          resourceType: 'security_api',
          resourceId: req.path,
          details: {
            method: req.method,
            endpoint: req.path,
            responseStatus: res.statusCode,
            duration,
            error: res.statusMessage
          },
          riskLevel: res.statusCode >= 500 ? 'high' : 'medium',
          tags: ['api', 'security', 'error']
        });
      }
    });

    next();
  });

  // Security Dashboard
  router.get('/dashboard', async (req: Request, res: Response) => {
    try {
      const dashboard = await securityService.getSecurityDashboard();
      res.json({
        success: true,
        data: dashboard
      });
    } catch (error) {
      logger.error('Failed to get security dashboard', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve security dashboard'
      });
    }
  });

  // Security Events
  router.post('/events', async (req: Request, res: Response) => {
    try {
      const event = await securityService.processSecurityEvent(req.body);
      res.json({
        success: true,
        data: event
      });
    } catch (error) {
      logger.error('Failed to process security event', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to process security event'
      });
    }
  });

  router.get('/events', async (req: Request, res: Response) => {
    try {
      const { 
        userId, 
        severity, 
        status, 
        startDate, 
        endDate, 
        limit = 100, 
        offset = 0 
      } = req.query;

      let query = 'SELECT * FROM security_events_enhanced WHERE 1=1';
      const params: any[] = [];
      let paramCount = 0;

      if (userId) {
        query += ` AND user_id = $${++paramCount}`;
        params.push(userId);
      }

      if (severity) {
        query += ` AND severity = $${++paramCount}`;
        params.push(severity);
      }

      if (status) {
        query += ` AND status = $${++paramCount}`;
        params.push(status);
      }

      if (startDate) {
        query += ` AND created_at >= $${++paramCount}`;
        params.push(new Date(startDate as string));
      }

      if (endDate) {
        query += ` AND created_at <= $${++paramCount}`;
        params.push(new Date(endDate as string));
      }

      query += ` ORDER BY created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
      params.push(limit, offset);

      const result = await db.query(query, params);

      res.json({
        success: true,
        data: result.rows,
        pagination: {
          limit: Number(limit),
          offset: Number(offset),
          total: result.rowCount
        }
      });
    } catch (error) {
      logger.error('Failed to get security events', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve security events'
      });
    }
  });

  // Threat Detection
  router.get('/threats/rules', async (req: Request, res: Response) => {
    try {
      const query = 'SELECT * FROM threat_detection_rules ORDER BY severity DESC, name';
      const result = await db.query(query);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      logger.error('Failed to get threat rules', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve threat rules'
      });
    }
  });

  router.post('/threats/rules', async (req: Request, res: Response) => {
    try {
      const ruleId = await threatEngine.addRule(req.body);
      res.json({
        success: true,
        data: { id: ruleId }
      });
    } catch (error) {
      logger.error('Failed to add threat rule', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to add threat rule'
      });
    }
  });

  router.post('/threats/:ruleId/false-positive', async (req: Request, res: Response) => {
    try {
      const { ruleId } = req.params;
      const { eventId } = req.body;

      await threatEngine.reportFalsePositive(ruleId, eventId);

      res.json({
        success: true,
        message: 'False positive reported'
      });
    } catch (error) {
      logger.error('Failed to report false positive', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to report false positive'
      });
    }
  });

  // Incident Management
  router.get('/incidents', async (req: Request, res: Response) => {
    try {
      const { status } = req.query;
      
      let incidents;
      if (status) {
        incidents = await incidentService.getIncidentsByStatus(status as string);
      } else {
        const query = 'SELECT * FROM v_incident_summary ORDER BY created_at DESC LIMIT 100';
        const result = await db.query(query);
        incidents = result.rows;
      }

      res.json({
        success: true,
        data: incidents
      });
    } catch (error) {
      logger.error('Failed to get incidents', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve incidents'
      });
    }
  });

  router.post('/incidents', async (req: Request, res: Response) => {
    try {
      const incident = await incidentService.createIncident(req.body);
      res.json({
        success: true,
        data: incident
      });
    } catch (error) {
      logger.error('Failed to create incident', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to create incident'
      });
    }
  });

  router.put('/incidents/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const incident = await incidentService.updateIncident(id, req.body);
      res.json({
        success: true,
        data: incident
      });
    } catch (error) {
      logger.error('Failed to update incident', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to update incident'
      });
    }
  });

  router.post('/incidents/:id/assign', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { userId } = req.body;

      const incident = await incidentService.assignIncident(id, userId);
      res.json({
        success: true,
        data: incident
      });
    } catch (error) {
      logger.error('Failed to assign incident', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to assign incident'
      });
    }
  });

  router.post('/incidents/:id/escalate', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      await incidentService.escalateIncident(id, reason);
      res.json({
        success: true,
        message: 'Incident escalated'
      });
    } catch (error) {
      logger.error('Failed to escalate incident', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to escalate incident'
      });
    }
  });

  router.post('/incidents/:id/actions', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await incidentService.addResponseAction(id, req.body);
      res.json({
        success: true,
        message: 'Response action added'
      });
    } catch (error) {
      logger.error('Failed to add response action', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to add response action'
      });
    }
  });

  router.put('/incidents/:id/actions/:actionId', async (req: Request, res: Response) => {
    try {
      const { id, actionId } = req.params;
      await incidentService.updateResponseAction(id, actionId, req.body);
      res.json({
        success: true,
        message: 'Response action updated'
      });
    } catch (error) {
      logger.error('Failed to update response action', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to update response action'
      });
    }
  });

  router.get('/incidents/metrics', async (req: Request, res: Response) => {
    try {
      const { period = '30d' } = req.query;
      const metrics = await incidentService.getIncidentMetrics(period as string);
      res.json({
        success: true,
        data: metrics
      });
    } catch (error) {
      logger.error('Failed to get incident metrics', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve incident metrics'
      });
    }
  });

  // Compliance
  router.get('/compliance/status', async (req: Request, res: Response) => {
    try {
      const { framework } = req.query;
      const status = await complianceService.getComplianceStatus(framework as string);
      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      logger.error('Failed to get compliance status', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve compliance status'
      });
    }
  });

  router.post('/compliance/reports', async (req: Request, res: Response) => {
    try {
      const { framework, reportType, startDate, endDate } = req.body;
      
      const report = await complianceService.generateComplianceReport(
        framework,
        reportType,
        {
          start: new Date(startDate),
          end: new Date(endDate)
        }
      );

      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      logger.error('Failed to generate compliance report', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to generate compliance report'
      });
    }
  });

  router.get('/compliance/audit-trail', async (req: Request, res: Response) => {
    try {
      const { startDate, endDate, objectType, actorId, framework } = req.query;

      const filters: any = {};
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);
      if (objectType) filters.objectType = objectType;
      if (actorId) filters.actorId = actorId;
      if (framework) filters.framework = framework;

      const auditTrail = await complianceService.getAuditTrail(filters);

      res.json({
        success: true,
        data: auditTrail
      });
    } catch (error) {
      logger.error('Failed to get audit trail', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve audit trail'
      });
    }
  });

  // Security Audit
  router.get('/audit/logs', async (req: Request, res: Response) => {
    try {
      const query = {
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
        actorId: req.query.actorId as string,
        resourceType: req.query.resourceType as string,
        action: req.query.action as string,
        riskLevel: req.query.riskLevel as string,
        tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
        limit: Number(req.query.limit) || 100,
        offset: Number(req.query.offset) || 0
      };

      const logs = await auditManager.queryAudits(query);

      res.json({
        success: true,
        data: logs,
        pagination: {
          limit: query.limit,
          offset: query.offset
        }
      });
    } catch (error) {
      logger.error('Failed to get audit logs', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve audit logs'
      });
    }
  });

  router.get('/audit/export', async (req: Request, res: Response) => {
    try {
      const { format = 'json', ...queryParams } = req.query;

      const query = {
        startDate: queryParams.startDate ? new Date(queryParams.startDate as string) : undefined,
        endDate: queryParams.endDate ? new Date(queryParams.endDate as string) : undefined,
        actorId: queryParams.actorId as string,
        resourceType: queryParams.resourceType as string,
        action: queryParams.action as string,
        riskLevel: queryParams.riskLevel as string
      };

      const exportData = await auditManager.exportAuditLogs(query, format as 'json' | 'csv');

      res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=audit-logs.${format}`);
      res.send(exportData);
    } catch (error) {
      logger.error('Failed to export audit logs', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to export audit logs'
      });
    }
  });

  router.post('/audit/reports', async (req: Request, res: Response) => {
    try {
      const { startDate, endDate } = req.body;

      const report = await auditManager.generateAuditReport({
        start: new Date(startDate),
        end: new Date(endDate)
      });

      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      logger.error('Failed to generate audit report', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to generate audit report'
      });
    }
  });

  // Security Configuration
  router.get('/config', async (req: Request, res: Response) => {
    try {
      const query = 'SELECT config_key, config_value, config_type, description FROM security_configuration';
      const result = await db.query(query);

      const config: any = {};
      for (const row of result.rows) {
        config[row.config_key] = JSON.parse(row.config_value);
      }

      res.json({
        success: true,
        data: config
      });
    } catch (error) {
      logger.error('Failed to get security configuration', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve security configuration'
      });
    }
  });

  router.put('/config', async (req: Request, res: Response) => {
    try {
      await securityService.updateConfiguration(req.body);
      res.json({
        success: true,
        message: 'Configuration updated'
      });
    } catch (error) {
      logger.error('Failed to update security configuration', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to update security configuration'
      });
    }
  });

  // Security Metrics
  router.get('/metrics', async (req: Request, res: Response) => {
    try {
      const { period = '24h', metricType } = req.query;

      let query = `
        SELECT metric_type, metric_name, 
               SUM(metric_value) as total_value,
               AVG(metric_value) as avg_value,
               MAX(metric_value) as max_value,
               MIN(metric_value) as min_value,
               COUNT(*) as data_points
        FROM security_metrics
        WHERE period_start > NOW() - INTERVAL '${period}'
      `;

      const params: any[] = [];
      if (metricType) {
        query += ' AND metric_type = $1';
        params.push(metricType);
      }

      query += ' GROUP BY metric_type, metric_name ORDER BY metric_type, metric_name';

      const result = await db.query(query, params);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      logger.error('Failed to get security metrics', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve security metrics'
      });
    }
  });

  // Alerts
  router.get('/alerts', async (req: Request, res: Response) => {
    try {
      const { acknowledged, severity, limit = 50 } = req.query;

      let query = 'SELECT * FROM security_alerts WHERE 1=1';
      const params: any[] = [];
      let paramCount = 0;

      if (acknowledged !== undefined) {
        query += ` AND acknowledged_at IS ${acknowledged === 'true' ? 'NOT' : ''} NULL`;
      }

      if (severity) {
        query += ` AND severity = $${++paramCount}`;
        params.push(severity);
      }

      query += ` ORDER BY created_at DESC LIMIT $${++paramCount}`;
      params.push(limit);

      const result = await db.query(query, params);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      logger.error('Failed to get alerts', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve alerts'
      });
    }
  });

  router.put('/alerts/:id/acknowledge', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.headers['x-user-id'] as string;

      await db.query(
        'UPDATE security_alerts SET acknowledged_at = NOW(), acknowledged_by = $1 WHERE id = $2',
        [userId, id]
      );

      res.json({
        success: true,
        message: 'Alert acknowledged'
      });
    } catch (error) {
      logger.error('Failed to acknowledge alert', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to acknowledge alert'
      });
    }
  });

  return router;
}