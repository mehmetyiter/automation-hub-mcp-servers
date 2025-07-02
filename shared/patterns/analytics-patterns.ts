import { WorkflowPattern } from './index';

export const analyticsPatterns: WorkflowPattern[] = [
  {
    id: 'subscription-analytics',
    name: 'Subscription Analytics Dashboard',
    description: 'Comprehensive subscription metrics including MRR, ARR, churn, LTV, cohort analysis, and investor reporting',
    keywords: ['subscription', 'analytics', 'mrr', 'arr', 'churn', 'ltv', 'cohort', 'retention', 'saas', 'metrics', 'investor', 'report'],
    category: 'analytics',
    difficulty: 'complex',
    requiredServices: ['database', 'analytics', 'reporting', 'email'],
    examples: [
      'Build subscription analytics that calculates MRR/ARR and tracks churn',
      'Create SaaS metrics dashboard with cohort retention',
      'Generate investor reports with subscription metrics'
    ],
    tags: ['saas', 'metrics', 'reporting', 'business-intelligence'],
    platforms: {
      n8n: {
        nodes: [
          {
            id: 'schedule',
            name: 'Daily Analytics Run',
            type: 'n8n-nodes-base.scheduleTrigger',
            position: [250, 300],
            parameters: {
              rule: {
                interval: [
                  {
                    field: 'cronExpression',
                    expression: '0 2 * * *' // Run at 2 AM daily
                  }
                ]
              }
            }
          },
          {
            id: 'get_subscriptions',
            name: 'Get Active Subscriptions',
            type: 'n8n-nodes-base.postgres',
            position: [450, 200],
            parameters: {
              operation: 'executeQuery',
              query: `
                SELECT 
                  s.id,
                  s.customer_id,
                  s.plan_id,
                  s.status,
                  s.started_at,
                  s.canceled_at,
                  s.monthly_amount,
                  p.name as plan_name,
                  c.email,
                  c.created_at as customer_since
                FROM subscriptions s
                JOIN plans p ON s.plan_id = p.id
                JOIN customers c ON s.customer_id = c.id
                WHERE s.status IN ('active', 'canceled')
                  AND DATE(s.started_at) <= CURRENT_DATE
              `
            }
          },
          {
            id: 'calculate_mrr',
            name: 'Calculate MRR/ARR',
            type: 'n8n-nodes-base.code',
            position: [650, 200],
            parameters: {
              jsCode: `
                const subscriptions = items[0].json;
                const currentDate = new Date();
                
                // Calculate MRR
                let totalMRR = 0;
                let newMRR = 0;
                let churnedMRR = 0;
                let expansionMRR = 0;
                
                const activeSubscriptions = subscriptions.filter(s => s.status === 'active');
                const churnedThisMonth = subscriptions.filter(s => {
                  if (s.status === 'canceled' && s.canceled_at) {
                    const cancelDate = new Date(s.canceled_at);
                    return cancelDate.getMonth() === currentDate.getMonth() && 
                           cancelDate.getFullYear() === currentDate.getFullYear();
                  }
                  return false;
                });
                
                // Current MRR
                activeSubscriptions.forEach(sub => {
                  totalMRR += parseFloat(sub.monthly_amount);
                });
                
                // Churned MRR
                churnedThisMonth.forEach(sub => {
                  churnedMRR += parseFloat(sub.monthly_amount);
                });
                
                // New MRR (subscriptions started this month)
                const newThisMonth = activeSubscriptions.filter(s => {
                  const startDate = new Date(s.started_at);
                  return startDate.getMonth() === currentDate.getMonth() && 
                         startDate.getFullYear() === currentDate.getFullYear();
                });
                
                newThisMonth.forEach(sub => {
                  newMRR += parseFloat(sub.monthly_amount);
                });
                
                return [{
                  json: {
                    date: currentDate.toISOString(),
                    metrics: {
                      mrr: totalMRR,
                      arr: totalMRR * 12,
                      newMRR: newMRR,
                      churnedMRR: churnedMRR,
                      netNewMRR: newMRR - churnedMRR,
                      activeSubscriptions: activeSubscriptions.length,
                      churnedSubscriptions: churnedThisMonth.length,
                      growthRate: totalMRR > 0 ? ((newMRR - churnedMRR) / totalMRR * 100).toFixed(2) : 0
                    },
                    subscriptions: subscriptions
                  }
                }];
              `
            }
          },
          {
            id: 'calculate_churn',
            name: 'Calculate Churn Rate',
            type: 'n8n-nodes-base.code',
            position: [850, 200],
            parameters: {
              jsCode: `
                const data = items[0].json;
                const subscriptions = data.subscriptions;
                
                // Calculate monthly churn rate
                const startOfMonth = new Date();
                startOfMonth.setDate(1);
                startOfMonth.setHours(0, 0, 0, 0);
                
                const activeAtStart = subscriptions.filter(s => {
                  const startDate = new Date(s.started_at);
                  return startDate < startOfMonth && 
                         (!s.canceled_at || new Date(s.canceled_at) >= startOfMonth);
                }).length;
                
                const churnedThisMonth = subscriptions.filter(s => {
                  if (s.canceled_at) {
                    const cancelDate = new Date(s.canceled_at);
                    return cancelDate >= startOfMonth;
                  }
                  return false;
                }).length;
                
                const monthlyChurnRate = activeAtStart > 0 ? 
                  (churnedThisMonth / activeAtStart * 100).toFixed(2) : 0;
                
                // Calculate annual churn rate
                const annualChurnRate = (1 - Math.pow(1 - monthlyChurnRate/100, 12)) * 100;
                
                return [{
                  json: {
                    ...data,
                    churnMetrics: {
                      monthlyChurnRate: monthlyChurnRate,
                      annualChurnRate: annualChurnRate.toFixed(2),
                      churnedCustomers: churnedThisMonth,
                      customersAtRisk: 0 // Will be calculated in next node
                    }
                  }
                }];
              `
            }
          },
          {
            id: 'calculate_ltv',
            name: 'Calculate LTV',
            type: 'n8n-nodes-base.code',
            position: [1050, 200],
            parameters: {
              jsCode: `
                const data = items[0].json;
                const subscriptions = data.subscriptions;
                const metrics = data.metrics;
                const churnRate = parseFloat(data.churnMetrics.monthlyChurnRate) / 100;
                
                // Average Revenue Per User (ARPU)
                const arpu = metrics.activeSubscriptions > 0 ? 
                  metrics.mrr / metrics.activeSubscriptions : 0;
                
                // Customer Lifetime (in months) = 1 / monthly churn rate
                const customerLifetime = churnRate > 0 ? 1 / churnRate : 36; // Cap at 36 months
                
                // LTV = ARPU × Customer Lifetime
                const ltv = arpu * customerLifetime;
                
                // Calculate LTV by plan
                const ltvByPlan = {};
                const planGroups = {};
                
                subscriptions.forEach(sub => {
                  if (!planGroups[sub.plan_name]) {
                    planGroups[sub.plan_name] = {
                      count: 0,
                      totalRevenue: 0,
                      churned: 0
                    };
                  }
                  
                  planGroups[sub.plan_name].count++;
                  planGroups[sub.plan_name].totalRevenue += parseFloat(sub.monthly_amount);
                  
                  if (sub.status === 'canceled') {
                    planGroups[sub.plan_name].churned++;
                  }
                });
                
                Object.keys(planGroups).forEach(plan => {
                  const group = planGroups[plan];
                  const planArpu = group.count > 0 ? group.totalRevenue / group.count : 0;
                  const planChurnRate = group.count > 0 ? group.churned / group.count : 0;
                  const planLifetime = planChurnRate > 0 ? 1 / planChurnRate : 36;
                  
                  ltvByPlan[plan] = {
                    arpu: planArpu.toFixed(2),
                    lifetime: planLifetime.toFixed(1),
                    ltv: (planArpu * planLifetime).toFixed(2),
                    customers: group.count
                  };
                });
                
                return [{
                  json: {
                    ...data,
                    ltvMetrics: {
                      averageLTV: ltv.toFixed(2),
                      arpu: arpu.toFixed(2),
                      customerLifetimeMonths: customerLifetime.toFixed(1),
                      ltvByPlan: ltvByPlan
                    }
                  }
                }];
              `
            }
          },
          {
            id: 'cohort_analysis',
            name: 'Cohort Retention Analysis',
            type: 'n8n-nodes-base.postgres',
            position: [450, 400],
            parameters: {
              operation: 'executeQuery',
              query: `
                WITH cohorts AS (
                  SELECT 
                    DATE_TRUNC('month', c.created_at) as cohort_month,
                    c.id as customer_id,
                    s.id as subscription_id,
                    s.started_at,
                    s.canceled_at,
                    s.status
                  FROM customers c
                  JOIN subscriptions s ON c.id = s.customer_id
                  WHERE c.created_at >= CURRENT_DATE - INTERVAL '12 months'
                ),
                retention AS (
                  SELECT 
                    cohort_month,
                    COUNT(DISTINCT customer_id) as cohort_size,
                    COUNT(DISTINCT CASE 
                      WHEN (canceled_at IS NULL OR canceled_at > cohort_month + INTERVAL '1 month') 
                      THEN customer_id END) as month_1,
                    COUNT(DISTINCT CASE 
                      WHEN (canceled_at IS NULL OR canceled_at > cohort_month + INTERVAL '3 months') 
                      THEN customer_id END) as month_3,
                    COUNT(DISTINCT CASE 
                      WHEN (canceled_at IS NULL OR canceled_at > cohort_month + INTERVAL '6 months') 
                      THEN customer_id END) as month_6,
                    COUNT(DISTINCT CASE 
                      WHEN (canceled_at IS NULL OR canceled_at > cohort_month + INTERVAL '12 months') 
                      THEN customer_id END) as month_12
                  FROM cohorts
                  GROUP BY cohort_month
                  ORDER BY cohort_month DESC
                )
                SELECT 
                  cohort_month,
                  cohort_size,
                  ROUND(100.0 * month_1 / NULLIF(cohort_size, 0), 2) as retention_1m,
                  ROUND(100.0 * month_3 / NULLIF(cohort_size, 0), 2) as retention_3m,
                  ROUND(100.0 * month_6 / NULLIF(cohort_size, 0), 2) as retention_6m,
                  ROUND(100.0 * month_12 / NULLIF(cohort_size, 0), 2) as retention_12m
                FROM retention
              `
            }
          },
          {
            id: 'identify_at_risk',
            name: 'Identify At-Risk Customers',
            type: 'n8n-nodes-base.postgres',
            position: [650, 400],
            parameters: {
              operation: 'executeQuery',
              query: `
                WITH usage_data AS (
                  SELECT 
                    c.id,
                    c.email,
                    s.monthly_amount,
                    DATE_PART('day', CURRENT_DATE - MAX(al.created_at)) as days_since_login,
                    COUNT(DISTINCT DATE(al.created_at)) as active_days_last_30,
                    COUNT(DISTINCT f.id) as features_used_last_30
                  FROM customers c
                  JOIN subscriptions s ON c.id = s.customer_id
                  LEFT JOIN activity_logs al ON c.id = al.customer_id 
                    AND al.created_at >= CURRENT_DATE - INTERVAL '30 days'
                  LEFT JOIN feature_usage f ON c.id = f.customer_id
                    AND f.created_at >= CURRENT_DATE - INTERVAL '30 days'
                  WHERE s.status = 'active'
                  GROUP BY c.id, c.email, s.monthly_amount
                ),
                risk_scores AS (
                  SELECT 
                    *,
                    CASE 
                      WHEN days_since_login > 14 THEN 3
                      WHEN days_since_login > 7 THEN 2
                      WHEN days_since_login > 3 THEN 1
                      ELSE 0
                    END +
                    CASE 
                      WHEN active_days_last_30 < 5 THEN 3
                      WHEN active_days_last_30 < 10 THEN 2
                      WHEN active_days_last_30 < 15 THEN 1
                      ELSE 0
                    END +
                    CASE 
                      WHEN features_used_last_30 < 3 THEN 2
                      WHEN features_used_last_30 < 5 THEN 1
                      ELSE 0
                    END as risk_score
                  FROM usage_data
                )
                SELECT * FROM risk_scores
                WHERE risk_score >= 5
                ORDER BY risk_score DESC, monthly_amount DESC
              `
            }
          },
          {
            id: 'merge_data',
            name: 'Merge All Metrics',
            type: 'n8n-nodes-base.merge',
            position: [850, 300],
            parameters: {
              mode: 'combine',
              combinationMode: 'multiplex'
            }
          },
          {
            id: 'generate_report',
            name: 'Generate Investor Report',
            type: 'n8n-nodes-base.code',
            position: [1050, 300],
            parameters: {
              jsCode: `
                const metricsData = items[0].json;
                const cohortData = items[1].json;
                const atRiskData = items[2].json;
                
                const report = {
                  reportDate: new Date().toISOString(),
                  executive_summary: {
                    mrr: metricsData.metrics.mrr,
                    arr: metricsData.metrics.arr,
                    growth_rate: metricsData.metrics.growthRate + '%',
                    churn_rate: metricsData.churnMetrics.monthlyChurnRate + '%',
                    ltv: metricsData.ltvMetrics.averageLTV,
                    active_customers: metricsData.metrics.activeSubscriptions
                  },
                  detailed_metrics: {
                    revenue: {
                      mrr: metricsData.metrics.mrr,
                      arr: metricsData.metrics.arr,
                      new_mrr: metricsData.metrics.newMRR,
                      churned_mrr: metricsData.metrics.churnedMRR,
                      net_new_mrr: metricsData.metrics.netNewMRR,
                      growth_rate: metricsData.metrics.growthRate
                    },
                    customers: {
                      total_active: metricsData.metrics.activeSubscriptions,
                      new_this_month: metricsData.metrics.newMRR / metricsData.ltvMetrics.arpu,
                      churned_this_month: metricsData.metrics.churnedSubscriptions,
                      at_risk: atRiskData.length
                    },
                    unit_economics: {
                      arpu: metricsData.ltvMetrics.arpu,
                      ltv: metricsData.ltvMetrics.averageLTV,
                      customer_lifetime_months: metricsData.ltvMetrics.customerLifetimeMonths,
                      ltv_by_plan: metricsData.ltvMetrics.ltvByPlan
                    },
                    retention: {
                      monthly_churn: metricsData.churnMetrics.monthlyChurnRate,
                      annual_churn: metricsData.churnMetrics.annualChurnRate,
                      cohort_retention: cohortData
                    }
                  },
                  alerts: {
                    customers_at_risk: atRiskData.map(c => ({
                      email: c.email,
                      monthly_value: c.monthly_amount,
                      risk_score: c.risk_score,
                      days_inactive: c.days_since_login
                    }))
                  },
                  recommendations: []
                };
                
                // Add recommendations based on metrics
                if (parseFloat(metricsData.churnMetrics.monthlyChurnRate) > 5) {
                  report.recommendations.push('High churn rate detected. Consider customer success initiatives.');
                }
                
                if (atRiskData.length > metricsData.metrics.activeSubscriptions * 0.1) {
                  report.recommendations.push('Over 10% of customers are at risk. Implement re-engagement campaign.');
                }
                
                if (parseFloat(metricsData.ltvMetrics.averageLTV) < parseFloat(metricsData.ltvMetrics.arpu) * 12) {
                  report.recommendations.push('LTV is less than 1 year of revenue. Focus on retention improvements.');
                }
                
                return [{
                  json: report
                }];
              `
            }
          },
          {
            id: 'format_html_report',
            name: 'Format HTML Report',
            type: 'n8n-nodes-base.html',
            position: [1250, 300],
            parameters: {
              html: '<!DOCTYPE html><html><head><style>body { font-family: Arial, sans-serif; margin: 40px; }h1, h2, h3 { color: #333; }.metric-card { background: #f5f5f5; padding: 20px; margin: 10px 0; border-radius: 8px;display: inline-block;width: 30%;margin-right: 3%;}.metric-value { font-size: 32px; font-weight: bold; color: #2196F3; }.metric-label { font-size: 14px; color: #666; }table { border-collapse: collapse; width: 100%; margin: 20px 0; }th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }th { background-color: #f2f2f2; }.alert { background: #fff3cd; padding: 15px; margin: 10px 0; border-radius: 5px; }.recommendation { background: #d4edda; padding: 15px; margin: 10px 0; border-radius: 5px; }</style></head><body><h1>Monthly Investor Report</h1><p>Report Date: {{$json["reportDate"]}}</p><h2>Executive Summary</h2><div><div class="metric-card"><div class="metric-value">\${{$json["executive_summary"]["mrr"]}}</div><div class="metric-label">Monthly Recurring Revenue</div></div><div class="metric-card"><div class="metric-value">{{$json["executive_summary"]["growth_rate"]}}</div><div class="metric-label">Growth Rate</div></div><div class="metric-card"><div class="metric-value">{{$json["executive_summary"]["churn_rate"]}}</div><div class="metric-label">Churn Rate</div></div></div><h2>Detailed Metrics</h2><h3>Revenue Metrics</h3><table><tr><th>Metric</th><th>Value</th></tr><tr><td>MRR</td><td>\${{$json["detailed_metrics"]["revenue"]["mrr"]}}</td></tr><tr><td>ARR</td><td>\${{$json["detailed_metrics"]["revenue"]["arr"]}}</td></tr><tr><td>New MRR</td><td>\${{$json["detailed_metrics"]["revenue"]["new_mrr"]}}</td></tr><tr><td>Churned MRR</td><td>\${{$json["detailed_metrics"]["revenue"]["churned_mrr"]}}</td></tr><tr><td>Net New MRR</td><td>\${{$json["detailed_metrics"]["revenue"]["net_new_mrr"]}}</td></tr></table><h3>Customer Metrics</h3><table><tr><th>Metric</th><th>Value</th></tr><tr><td>Total Active Customers</td><td>{{$json["detailed_metrics"]["customers"]["total_active"]}}</td></tr><tr><td>New Customers (This Month)</td><td>{{$json["detailed_metrics"]["customers"]["new_this_month"]}}</td></tr><tr><td>Churned Customers</td><td>{{$json["detailed_metrics"]["customers"]["churned_this_month"]}}</td></tr><tr><td>At-Risk Customers</td><td>{{$json["detailed_metrics"]["customers"]["at_risk"]}}</td></tr></table><h3>Unit Economics</h3><table><tr><th>Metric</th><th>Value</th></tr><tr><td>ARPU</td><td>\${{$json["detailed_metrics"]["unit_economics"]["arpu"]}}</td></tr><tr><td>LTV</td><td>\${{$json["detailed_metrics"]["unit_economics"]["ltv"]}}</td></tr><tr><td>Customer Lifetime</td><td>{{$json["detailed_metrics"]["unit_economics"]["customer_lifetime_months"]}} months</td></tr></table>{{#if $json["recommendations"].length}}<h2>Recommendations</h2>{{#each $json["recommendations"]}}<div class="recommendation">{{this}}</div>{{/each}}{{/if}}{{#if $json["alerts"]["customers_at_risk"].length}}<h2>Customers at Risk</h2><div class="alert"><strong>{{$json["alerts"]["customers_at_risk"].length}} customers identified as at-risk</strong></div>{{/if}}</body></html>'
            }
          },
          {
            id: 'save_report',
            name: 'Save Report',
            type: 'n8n-nodes-base.writeBinaryFile',
            position: [1450, 200],
            parameters: {
              fileName: '=/reports/investor-report-{{$now.format("YYYY-MM-DD")}}.html',
              dataPropertyName: 'data'
            }
          },
          {
            id: 'email_report',
            name: 'Email Report',
            type: 'n8n-nodes-base.emailSend',
            position: [1450, 400],
            parameters: {
              fromEmail: '{{$env.COMPANY_EMAIL}}',
              toEmail: '{{$env.INVESTOR_EMAILS}}',
              subject: 'Monthly Investor Report - {{$now.format("MMMM YYYY")}}',
              emailType: 'html',
              message: '={{$json["html"]}}',
              attachments: 'data'
            }
          }
        ],
        connections: {
          'Daily Analytics Run': {
            main: [[
              { node: 'Get Active Subscriptions', type: 'main', index: 0 },
              { node: 'Cohort Retention Analysis', type: 'main', index: 0 }
            ]]
          },
          'Get Active Subscriptions': {
            main: [[{ node: 'Calculate MRR/ARR', type: 'main', index: 0 }]]
          },
          'Calculate MRR/ARR': {
            main: [[{ node: 'Calculate Churn Rate', type: 'main', index: 0 }]]
          },
          'Calculate Churn Rate': {
            main: [[{ node: 'Calculate LTV', type: 'main', index: 0 }]]
          },
          'Calculate LTV': {
            main: [[{ node: 'Merge All Metrics', type: 'main', index: 0 }]]
          },
          'Cohort Retention Analysis': {
            main: [[
              { node: 'Identify At-Risk Customers', type: 'main', index: 0 },
              { node: 'Merge All Metrics', type: 'main', index: 1 }
            ]]
          },
          'Identify At-Risk Customers': {
            main: [[{ node: 'Merge All Metrics', type: 'main', index: 2 }]]
          },
          'Merge All Metrics': {
            main: [[{ node: 'Generate Investor Report', type: 'main', index: 0 }]]
          },
          'Generate Investor Report': {
            main: [[{ node: 'Format HTML Report', type: 'main', index: 0 }]]
          },
          'Format HTML Report': {
            main: [[
              { node: 'Save Report', type: 'main', index: 0 },
              { node: 'Email Report', type: 'main', index: 0 }
            ]]
          }
        }
      }
    }
  }
];