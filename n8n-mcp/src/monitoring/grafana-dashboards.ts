export interface GrafanaDashboard {
  uid: string;
  title: string;
  tags: string[];
  timezone: string;
  refresh: string;
  schemaVersion: number;
  version: number;
  panels: GrafanaPanel[];
  templating?: {
    list: GrafanaVariable[];
  };
  annotations?: {
    list: GrafanaAnnotation[];
  };
  time?: {
    from: string;
    to: string;
  };
}

export interface GrafanaPanel {
  id: number;
  title: string;
  type: string;
  gridPos: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  datasource: {
    type: string;
    uid: string;
  };
  targets: GrafanaTarget[];
  options?: any;
  fieldConfig?: any;
}

export interface GrafanaTarget {
  expr: string;
  legendFormat?: string;
  refId: string;
  interval?: string;
}

export interface GrafanaVariable {
  name: string;
  type: string;
  label?: string;
  query?: string;
  datasource?: {
    type: string;
    uid: string;
  };
  refresh?: number;
  regex?: string;
  sort?: number;
  multi?: boolean;
  includeAll?: boolean;
}

export interface GrafanaAnnotation {
  name: string;
  datasource: {
    type: string;
    uid: string;
  };
  enable: boolean;
  iconColor: string;
  query: string;
}

export class GrafanaDashboardGenerator {
  private datasourceUid = '${datasource}';
  private prefix = 'credential_mgmt_';

  generateCredentialManagementDashboard(): GrafanaDashboard {
    return {
      uid: 'credential-management',
      title: 'Credential Management System',
      tags: ['credentials', 'security', 'api', 'monitoring'],
      timezone: 'browser',
      refresh: '10s',
      schemaVersion: 38,
      version: 1,
      templating: {
        list: this.generateVariables()
      },
      annotations: {
        list: this.generateAnnotations()
      },
      time: {
        from: 'now-6h',
        to: 'now'
      },
      panels: [
        ...this.generateOverviewPanels(),
        ...this.generateCredentialPanels(),
        ...this.generateApiUsagePanels(),
        ...this.generateCostPanels(),
        ...this.generateSecurityPanels(),
        ...this.generatePerformancePanels(),
        ...this.generateSystemHealthPanels()
      ]
    };
  }

  private generateVariables(): GrafanaVariable[] {
    return [
      {
        name: 'datasource',
        type: 'datasource',
        label: 'Data Source',
        query: 'prometheus',
        refresh: 1,
        regex: '',
        multi: false
      },
      {
        name: 'provider',
        type: 'query',
        label: 'Provider',
        query: `label_values(${this.prefix}active_credentials, provider)`,
        datasource: {
          type: 'prometheus',
          uid: this.datasourceUid
        },
        refresh: 2,
        sort: 1,
        multi: true,
        includeAll: true
      },
      {
        name: 'user_id',
        type: 'query',
        label: 'User ID',
        query: `label_values(${this.prefix}budget_utilization_percent, user_id)`,
        datasource: {
          type: 'prometheus',
          uid: this.datasourceUid
        },
        refresh: 2,
        sort: 1,
        multi: true,
        includeAll: true
      }
    ];
  }

  private generateAnnotations(): GrafanaAnnotation[] {
    return [
      {
        name: 'Security Events',
        datasource: {
          type: 'prometheus',
          uid: this.datasourceUid
        },
        enable: true,
        iconColor: 'red',
        query: `${this.prefix}security_events_total{severity="critical"}`
      },
      {
        name: 'Failovers',
        datasource: {
          type: 'prometheus',
          uid: this.datasourceUid
        },
        enable: true,
        iconColor: 'orange',
        query: `${this.prefix}circuit_breaker_status > 0`
      }
    ];
  }

  private generateOverviewPanels(): GrafanaPanel[] {
    let panelId = 1;
    return [
      // Row: Overview
      {
        id: panelId++,
        title: 'System Overview',
        type: 'row',
        gridPos: { x: 0, y: 0, w: 24, h: 1 },
        datasource: { type: 'prometheus', uid: this.datasourceUid },
        targets: []
      },
      // Active Credentials
      {
        id: panelId++,
        title: 'Active Credentials',
        type: 'stat',
        gridPos: { x: 0, y: 1, w: 6, h: 4 },
        datasource: { type: 'prometheus', uid: this.datasourceUid },
        targets: [{
          expr: `sum(${this.prefix}active_credentials{provider=~"$provider"})`,
          refId: 'A'
        }],
        options: {
          reduceOptions: {
            values: false,
            calcs: ['lastNotNull']
          },
          text: {
            titleSize: 16,
            valueSize: 32
          },
          colorMode: 'value',
          graphMode: 'area',
          justifyMode: 'auto'
        },
        fieldConfig: {
          defaults: {
            thresholds: {
              mode: 'absolute',
              steps: [
                { color: 'green', value: null },
                { color: 'yellow', value: 100 },
                { color: 'red', value: 500 }
              ]
            },
            unit: 'short'
          }
        }
      },
      // API Request Rate
      {
        id: panelId++,
        title: 'API Request Rate',
        type: 'stat',
        gridPos: { x: 6, y: 1, w: 6, h: 4 },
        datasource: { type: 'prometheus', uid: this.datasourceUid },
        targets: [{
          expr: `sum(rate(${this.prefix}api_requests_total[5m]))`,
          refId: 'A'
        }],
        options: {
          reduceOptions: {
            values: false,
            calcs: ['lastNotNull']
          },
          text: {
            titleSize: 16,
            valueSize: 32
          },
          colorMode: 'value',
          graphMode: 'area',
          justifyMode: 'auto'
        },
        fieldConfig: {
          defaults: {
            thresholds: {
              mode: 'absolute',
              steps: [
                { color: 'green', value: null },
                { color: 'yellow', value: 10 },
                { color: 'red', value: 50 }
              ]
            },
            unit: 'reqps'
          }
        }
      },
      // Estimated Monthly Cost
      {
        id: panelId++,
        title: 'Estimated Monthly Cost',
        type: 'stat',
        gridPos: { x: 12, y: 1, w: 6, h: 4 },
        datasource: { type: 'prometheus', uid: this.datasourceUid },
        targets: [{
          expr: `sum(${this.prefix}estimated_cost_dollars{period="monthly"})`,
          refId: 'A'
        }],
        options: {
          reduceOptions: {
            values: false,
            calcs: ['lastNotNull']
          },
          text: {
            titleSize: 16,
            valueSize: 32
          },
          colorMode: 'value',
          graphMode: 'area',
          justifyMode: 'auto'
        },
        fieldConfig: {
          defaults: {
            thresholds: {
              mode: 'absolute',
              steps: [
                { color: 'green', value: null },
                { color: 'yellow', value: 500 },
                { color: 'red', value: 1000 }
              ]
            },
            unit: 'currencyUSD',
            decimals: 2
          }
        }
      },
      // System Health
      {
        id: panelId++,
        title: 'System Health',
        type: 'stat',
        gridPos: { x: 18, y: 1, w: 6, h: 4 },
        datasource: { type: 'prometheus', uid: this.datasourceUid },
        targets: [{
          expr: `min(${this.prefix}service_health) * 100`,
          refId: 'A'
        }],
        options: {
          reduceOptions: {
            values: false,
            calcs: ['lastNotNull']
          },
          text: {
            titleSize: 16,
            valueSize: 32
          },
          colorMode: 'background',
          graphMode: 'none',
          justifyMode: 'auto'
        },
        fieldConfig: {
          defaults: {
            thresholds: {
              mode: 'absolute',
              steps: [
                { color: 'red', value: null },
                { color: 'yellow', value: 80 },
                { color: 'green', value: 95 }
              ]
            },
            unit: 'percent',
            min: 0,
            max: 100
          }
        }
      }
    ];
  }

  private generateCredentialPanels(): GrafanaPanel[] {
    let panelId = 20;
    return [
      // Row: Credential Management
      {
        id: panelId++,
        title: 'Credential Management',
        type: 'row',
        gridPos: { x: 0, y: 5, w: 24, h: 1 },
        datasource: { type: 'prometheus', uid: this.datasourceUid },
        targets: []
      },
      // Credential Operations
      {
        id: panelId++,
        title: 'Credential Operations',
        type: 'timeseries',
        gridPos: { x: 0, y: 6, w: 12, h: 8 },
        datasource: { type: 'prometheus', uid: this.datasourceUid },
        targets: [
          {
            expr: `sum by (operation) (rate(${this.prefix}credential_operations_total{provider=~"$provider"}[5m]))`,
            legendFormat: '{{operation}}',
            refId: 'A'
          }
        ],
        fieldConfig: {
          defaults: {
            custom: {
              drawStyle: 'line',
              lineInterpolation: 'smooth',
              lineWidth: 2,
              fillOpacity: 10,
              gradientMode: 'opacity',
              spanNulls: false,
              showPoints: 'never',
              pointSize: 5,
              stacking: {
                mode: 'none',
                group: 'A'
              },
              axisPlacement: 'auto',
              axisLabel: '',
              scaleDistribution: {
                type: 'linear'
              }
            },
            unit: 'ops',
            thresholds: {
              mode: 'absolute',
              steps: [
                { color: 'green', value: null }
              ]
            }
          }
        }
      },
      // Credential Validation Success Rate
      {
        id: panelId++,
        title: 'Credential Validation Success Rate',
        type: 'timeseries',
        gridPos: { x: 12, y: 6, w: 12, h: 8 },
        datasource: { type: 'prometheus', uid: this.datasourceUid },
        targets: [
          {
            expr: `
              sum by (provider) (
                rate(${this.prefix}credential_validations_total{result="valid", provider=~"$provider"}[5m])
              ) / 
              sum by (provider) (
                rate(${this.prefix}credential_validations_total{provider=~"$provider"}[5m])
              ) * 100
            `,
            legendFormat: '{{provider}}',
            refId: 'A'
          }
        ],
        fieldConfig: {
          defaults: {
            custom: {
              drawStyle: 'line',
              lineInterpolation: 'smooth',
              lineWidth: 2,
              fillOpacity: 10,
              gradientMode: 'opacity',
              spanNulls: false,
              showPoints: 'never'
            },
            unit: 'percent',
            min: 0,
            max: 100,
            thresholds: {
              mode: 'absolute',
              steps: [
                { color: 'red', value: null },
                { color: 'yellow', value: 80 },
                { color: 'green', value: 95 }
              ]
            }
          }
        }
      }
    ];
  }

  private generateApiUsagePanels(): GrafanaPanel[] {
    let panelId = 40;
    return [
      // Row: API Usage
      {
        id: panelId++,
        title: 'API Usage',
        type: 'row',
        gridPos: { x: 0, y: 14, w: 24, h: 1 },
        datasource: { type: 'prometheus', uid: this.datasourceUid },
        targets: []
      },
      // API Request Rate by Provider
      {
        id: panelId++,
        title: 'API Request Rate by Provider',
        type: 'timeseries',
        gridPos: { x: 0, y: 15, w: 12, h: 8 },
        datasource: { type: 'prometheus', uid: this.datasourceUid },
        targets: [
          {
            expr: `sum by (provider) (rate(${this.prefix}api_requests_total{provider=~"$provider"}[5m]))`,
            legendFormat: '{{provider}}',
            refId: 'A'
          }
        ],
        fieldConfig: {
          defaults: {
            custom: {
              drawStyle: 'line',
              lineInterpolation: 'smooth',
              lineWidth: 2,
              fillOpacity: 10,
              gradientMode: 'opacity',
              spanNulls: false,
              showPoints: 'never',
              stacking: {
                mode: 'normal',
                group: 'A'
              }
            },
            unit: 'reqps'
          }
        }
      },
      // API Response Time (P95)
      {
        id: panelId++,
        title: 'API Response Time (P95)',
        type: 'timeseries',
        gridPos: { x: 12, y: 15, w: 12, h: 8 },
        datasource: { type: 'prometheus', uid: this.datasourceUid },
        targets: [
          {
            expr: `histogram_quantile(0.95, sum by (provider, le) (rate(${this.prefix}api_request_duration_seconds_bucket{provider=~"$provider"}[5m])))`,
            legendFormat: '{{provider}}',
            refId: 'A'
          }
        ],
        fieldConfig: {
          defaults: {
            custom: {
              drawStyle: 'line',
              lineInterpolation: 'smooth',
              lineWidth: 2,
              fillOpacity: 10,
              gradientMode: 'opacity',
              spanNulls: false,
              showPoints: 'never'
            },
            unit: 's',
            thresholds: {
              mode: 'absolute',
              steps: [
                { color: 'green', value: null },
                { color: 'yellow', value: 1 },
                { color: 'red', value: 2 }
              ]
            }
          }
        }
      }
    ];
  }

  private generateCostPanels(): GrafanaPanel[] {
    let panelId = 60;
    return [
      // Row: Cost Management
      {
        id: panelId++,
        title: 'Cost Management',
        type: 'row',
        gridPos: { x: 0, y: 23, w: 24, h: 1 },
        datasource: { type: 'prometheus', uid: this.datasourceUid },
        targets: []
      },
      // Cost by Provider
      {
        id: panelId++,
        title: 'Cost by Provider',
        type: 'piechart',
        gridPos: { x: 0, y: 24, w: 8, h: 8 },
        datasource: { type: 'prometheus', uid: this.datasourceUid },
        targets: [
          {
            expr: `sum by (provider) (${this.prefix}cost_by_provider_dollars{period="daily", provider=~"$provider"})`,
            legendFormat: '{{provider}}',
            refId: 'A'
          }
        ],
        options: {
          pieType: 'donut',
          displayLabels: ['name', 'value', 'percent'],
          legendDisplayMode: 'list',
          legendPlacement: 'right',
          legendValues: ['value', 'percent']
        },
        fieldConfig: {
          defaults: {
            unit: 'currencyUSD',
            decimals: 2
          }
        }
      },
      // Budget Utilization
      {
        id: panelId++,
        title: 'Budget Utilization',
        type: 'gauge',
        gridPos: { x: 8, y: 24, w: 8, h: 8 },
        datasource: { type: 'prometheus', uid: this.datasourceUid },
        targets: [
          {
            expr: `avg(${this.prefix}budget_utilization_percent{user_id=~"$user_id"})`,
            refId: 'A'
          }
        ],
        options: {
          orientation: 'auto',
          showThresholdLabels: false,
          showThresholdMarkers: true,
          text: {
            titleSize: 16,
            valueSize: 32
          }
        },
        fieldConfig: {
          defaults: {
            unit: 'percent',
            min: 0,
            max: 100,
            thresholds: {
              mode: 'absolute',
              steps: [
                { color: 'green', value: null },
                { color: 'yellow', value: 70 },
                { color: 'red', value: 90 }
              ]
            }
          }
        }
      },
      // Cost Optimization Savings
      {
        id: panelId++,
        title: 'Cost Optimization Savings',
        type: 'stat',
        gridPos: { x: 16, y: 24, w: 8, h: 8 },
        datasource: { type: 'prometheus', uid: this.datasourceUid },
        targets: [
          {
            expr: `sum(${this.prefix}cost_optimization_savings_dollars{period="monthly"})`,
            refId: 'A'
          }
        ],
        options: {
          reduceOptions: {
            values: false,
            calcs: ['lastNotNull']
          },
          text: {
            titleSize: 16,
            valueSize: 32
          },
          colorMode: 'value',
          graphMode: 'area',
          justifyMode: 'auto'
        },
        fieldConfig: {
          defaults: {
            unit: 'currencyUSD',
            decimals: 2,
            thresholds: {
              mode: 'absolute',
              steps: [
                { color: 'red', value: null },
                { color: 'yellow', value: 10 },
                { color: 'green', value: 100 }
              ]
            }
          }
        }
      }
    ];
  }

  private generateSecurityPanels(): GrafanaPanel[] {
    let panelId = 80;
    return [
      // Row: Security
      {
        id: panelId++,
        title: 'Security',
        type: 'row',
        gridPos: { x: 0, y: 32, w: 24, h: 1 },
        datasource: { type: 'prometheus', uid: this.datasourceUid },
        targets: []
      },
      // Security Events by Severity
      {
        id: panelId++,
        title: 'Security Events by Severity',
        type: 'timeseries',
        gridPos: { x: 0, y: 33, w: 12, h: 8 },
        datasource: { type: 'prometheus', uid: this.datasourceUid },
        targets: [
          {
            expr: `sum by (severity) (rate(${this.prefix}security_events_total[5m]))`,
            legendFormat: '{{severity}}',
            refId: 'A'
          }
        ],
        fieldConfig: {
          defaults: {
            custom: {
              drawStyle: 'bars',
              lineInterpolation: 'smooth',
              barAlignment: -1,
              lineWidth: 1,
              fillOpacity: 80,
              gradientMode: 'opacity',
              spanNulls: false,
              showPoints: 'never',
              stacking: {
                mode: 'normal',
                group: 'A'
              }
            },
            unit: 'events/sec',
            thresholds: {
              mode: 'absolute',
              steps: [
                { color: 'green', value: null },
                { color: 'yellow', value: 0.1 },
                { color: 'red', value: 1 }
              ]
            }
          },
          overrides: [
            {
              matcher: { id: 'byName', options: 'critical' },
              properties: [
                { id: 'color', value: { mode: 'fixed', fixedColor: 'red' } }
              ]
            },
            {
              matcher: { id: 'byName', options: 'high' },
              properties: [
                { id: 'color', value: { mode: 'fixed', fixedColor: 'orange' } }
              ]
            },
            {
              matcher: { id: 'byName', options: 'medium' },
              properties: [
                { id: 'color', value: { mode: 'fixed', fixedColor: 'yellow' } }
              ]
            },
            {
              matcher: { id: 'byName', options: 'low' },
              properties: [
                { id: 'color', value: { mode: 'fixed', fixedColor: 'green' } }
              ]
            }
          ]
        }
      },
      // Authentication Success Rate
      {
        id: panelId++,
        title: 'Authentication Success Rate',
        type: 'gauge',
        gridPos: { x: 12, y: 33, w: 6, h: 8 },
        datasource: { type: 'prometheus', uid: this.datasourceUid },
        targets: [
          {
            expr: `
              sum(rate(${this.prefix}authentication_attempts_total{result="success"}[5m])) /
              sum(rate(${this.prefix}authentication_attempts_total[5m])) * 100
            `,
            refId: 'A'
          }
        ],
        options: {
          orientation: 'auto',
          showThresholdLabels: false,
          showThresholdMarkers: true,
          text: {
            titleSize: 16,
            valueSize: 32
          }
        },
        fieldConfig: {
          defaults: {
            unit: 'percent',
            min: 0,
            max: 100,
            thresholds: {
              mode: 'absolute',
              steps: [
                { color: 'red', value: null },
                { color: 'yellow', value: 90 },
                { color: 'green', value: 98 }
              ]
            }
          }
        }
      },
      // Blocked Requests
      {
        id: panelId++,
        title: 'Blocked Requests',
        type: 'stat',
        gridPos: { x: 18, y: 33, w: 6, h: 8 },
        datasource: { type: 'prometheus', uid: this.datasourceUid },
        targets: [
          {
            expr: `sum(rate(${this.prefix}blocked_requests_total[5m])) * 3600`,
            refId: 'A'
          }
        ],
        options: {
          reduceOptions: {
            values: false,
            calcs: ['lastNotNull']
          },
          text: {
            titleSize: 16,
            valueSize: 32
          },
          colorMode: 'background',
          graphMode: 'area',
          justifyMode: 'auto'
        },
        fieldConfig: {
          defaults: {
            unit: 'short',
            thresholds: {
              mode: 'absolute',
              steps: [
                { color: 'green', value: null },
                { color: 'yellow', value: 10 },
                { color: 'red', value: 100 }
              ]
            }
          }
        }
      }
    ];
  }

  private generatePerformancePanels(): GrafanaPanel[] {
    let panelId = 100;
    return [
      // Row: Performance
      {
        id: panelId++,
        title: 'Performance',
        type: 'row',
        gridPos: { x: 0, y: 41, w: 24, h: 1 },
        datasource: { type: 'prometheus', uid: this.datasourceUid },
        targets: []
      },
      // Database Query Performance
      {
        id: panelId++,
        title: 'Database Query Performance',
        type: 'heatmap',
        gridPos: { x: 0, y: 42, w: 12, h: 8 },
        datasource: { type: 'prometheus', uid: this.datasourceUid },
        targets: [
          {
            expr: `sum by (le) (rate(${this.prefix}database_query_duration_seconds_bucket[5m]))`,
            refId: 'A',
            interval: '30s'
          }
        ],
        options: {
          calculate: false,
          cellGap: 1,
          cellValues: {
            decimals: 0
          },
          color: {
            mode: 'scheme',
            scheme: 'Spectral',
            steps: 64
          },
          yAxis: {
            axisLabel: 'Duration',
            decimals: 3,
            unit: 's'
          }
        }
      },
      // Cache Hit Rate
      {
        id: panelId++,
        title: 'Cache Hit Rate',
        type: 'timeseries',
        gridPos: { x: 12, y: 42, w: 12, h: 8 },
        datasource: { type: 'prometheus', uid: this.datasourceUid },
        targets: [
          {
            expr: `${this.prefix}cache_hit_rate`,
            legendFormat: '{{cache_type}}',
            refId: 'A'
          }
        ],
        fieldConfig: {
          defaults: {
            custom: {
              drawStyle: 'line',
              lineInterpolation: 'smooth',
              lineWidth: 2,
              fillOpacity: 10,
              gradientMode: 'opacity',
              spanNulls: false,
              showPoints: 'never'
            },
            unit: 'percent',
            min: 0,
            max: 100,
            thresholds: {
              mode: 'absolute',
              steps: [
                { color: 'red', value: null },
                { color: 'yellow', value: 60 },
                { color: 'green', value: 80 }
              ]
            }
          }
        }
      }
    ];
  }

  private generateSystemHealthPanels(): GrafanaPanel[] {
    let panelId = 120;
    return [
      // Row: System Health
      {
        id: panelId++,
        title: 'System Health',
        type: 'row',
        gridPos: { x: 0, y: 50, w: 24, h: 1 },
        datasource: { type: 'prometheus', uid: this.datasourceUid },
        targets: []
      },
      // Service Health Status
      {
        id: panelId++,
        title: 'Service Health Status',
        type: 'state-timeline',
        gridPos: { x: 0, y: 51, w: 24, h: 6 },
        datasource: { type: 'prometheus', uid: this.datasourceUid },
        targets: [
          {
            expr: `${this.prefix}service_health`,
            legendFormat: '{{service}} - {{component}}',
            refId: 'A'
          }
        ],
        options: {
          showLegend: true,
          legendDisplayMode: 'list',
          legendPlacement: 'right',
          mergeValues: false,
          rowHeight: 0.9,
          colWidth: 0.9
        },
        fieldConfig: {
          defaults: {
            custom: {
              fillOpacity: 70,
              lineWidth: 0
            },
            thresholds: {
              mode: 'absolute',
              steps: [
                { color: 'red', value: null },
                { color: 'green', value: 1 }
              ]
            },
            mappings: [
              { type: 'value', value: '0', text: 'Unhealthy', color: 'red' },
              { type: 'value', value: '1', text: 'Healthy', color: 'green' }
            ]
          }
        }
      },
      // Circuit Breaker Status
      {
        id: panelId++,
        title: 'Circuit Breaker Status',
        type: 'table',
        gridPos: { x: 0, y: 57, w: 12, h: 8 },
        datasource: { type: 'prometheus', uid: this.datasourceUid },
        targets: [
          {
            expr: `${this.prefix}circuit_breaker_status`,
            refId: 'A',
            interval: ''
          }
        ],
        options: {
          showHeader: true,
          cellHeight: 'sm',
          footer: {
            show: false
          }
        },
        fieldConfig: {
          defaults: {
            custom: {
              align: 'center',
              displayMode: 'color-background-solid',
              filterable: true
            },
            thresholds: {
              mode: 'absolute',
              steps: [
                { color: 'green', value: null },
                { color: 'yellow', value: 1 },
                { color: 'red', value: 2 }
              ]
            },
            mappings: [
              { type: 'value', value: '0', text: 'Closed', color: 'green' },
              { type: 'value', value: '1', text: 'Open', color: 'red' },
              { type: 'value', value: '2', text: 'Half-Open', color: 'yellow' }
            ]
          },
          overrides: [
            {
              matcher: { id: 'byName', options: 'service' },
              properties: [
                { id: 'custom.width', value: 200 }
              ]
            }
          ]
        }
      },
      // Resource Usage
      {
        id: panelId++,
        title: 'Resource Usage',
        type: 'timeseries',
        gridPos: { x: 12, y: 57, w: 12, h: 8 },
        datasource: { type: 'prometheus', uid: this.datasourceUid },
        targets: [
          {
            expr: `${this.prefix}memory_usage_bytes / 1024 / 1024 / 1024`,
            legendFormat: 'Memory (GB)',
            refId: 'A'
          },
          {
            expr: `${this.prefix}cpu_usage_percent`,
            legendFormat: 'CPU (%)',
            refId: 'B'
          }
        ],
        fieldConfig: {
          defaults: {
            custom: {
              drawStyle: 'line',
              lineInterpolation: 'smooth',
              lineWidth: 2,
              fillOpacity: 10,
              gradientMode: 'opacity',
              spanNulls: false,
              showPoints: 'never',
              axisPlacement: 'left'
            }
          },
          overrides: [
            {
              matcher: { id: 'byName', options: 'Memory (GB)' },
              properties: [
                { id: 'unit', value: 'decgbytes' },
                { id: 'custom.axisPlacement', value: 'left' }
              ]
            },
            {
              matcher: { id: 'byName', options: 'CPU (%)' },
              properties: [
                { id: 'unit', value: 'percent' },
                { id: 'custom.axisPlacement', value: 'right' }
              ]
            }
          ]
        }
      }
    ];
  }

  exportDashboard(dashboard: GrafanaDashboard): string {
    return JSON.stringify(dashboard, null, 2);
  }

  generateProvisioningConfig(dashboards: GrafanaDashboard[]): string {
    const config = {
      apiVersion: 1,
      providers: [
        {
          name: 'Credential Management Dashboards',
          orgId: 1,
          folder: 'Credential Management',
          type: 'file',
          disableDeletion: false,
          updateIntervalSeconds: 10,
          allowUiUpdates: true,
          options: {
            path: '/var/lib/grafana/dashboards'
          }
        }
      ]
    };
    return JSON.stringify(config, null, 2);
  }
}

// Export convenience function
export function createGrafanaDashboardGenerator(): GrafanaDashboardGenerator {
  return new GrafanaDashboardGenerator();
}

// Export example usage
export const exampleGrafanaSetup = `
# Grafana Setup Instructions

## 1. Install Grafana
docker run -d \\
  -p 3000:3000 \\
  --name grafana \\
  -e "GF_SECURITY_ADMIN_PASSWORD=admin" \\
  -e "GF_INSTALL_PLUGINS=grafana-piechart-panel" \\
  -v grafana-storage:/var/lib/grafana \\
  grafana/grafana:latest

## 2. Configure Prometheus Data Source
1. Navigate to http://localhost:3000
2. Login with admin/admin
3. Go to Configuration > Data Sources
4. Add Prometheus data source
5. Set URL to http://localhost:9090
6. Save & Test

## 3. Import Dashboard
1. Go to Dashboards > Import
2. Upload the generated JSON file
3. Select Prometheus data source
4. Click Import

## 4. Configure Alerts (Optional)
1. Go to Alerting > Alert Rules
2. Create alerts based on key metrics:
   - High error rate
   - Low cache hit rate
   - Budget exceeded
   - Security events
   - Service health degraded
`;