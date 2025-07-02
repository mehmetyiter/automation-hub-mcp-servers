import { WorkflowPattern } from '../pattern-matcher.js';

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
                      new_this_month: Math.round(metricsData.metrics.newMRR / parseFloat(metricsData.ltvMetrics.arpu)),
                      churned_this_month: metricsData.metrics.churnedSubscriptions,
                      at_risk: 0
                    },
                    unit_economics: {
                      arpu: metricsData.ltvMetrics.arpu,
                      ltv: metricsData.ltvMetrics.averageLTV,
                      customer_lifetime_months: metricsData.ltvMetrics.customerLifetimeMonths,
                      ltv_by_plan: metricsData.ltvMetrics.ltvByPlan
                    },
                    retention: {
                      monthly_churn: metricsData.churnMetrics.monthlyChurnRate,
                      annual_churn: metricsData.churnMetrics.annualChurnRate
                    }
                  },
                  recommendations: []
                };
                
                // Add recommendations based on metrics
                if (parseFloat(metricsData.churnMetrics.monthlyChurnRate) > 5) {
                  report.recommendations.push('High churn rate detected. Consider customer success initiatives.');
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
            id: 'email_report',
            name: 'Email Report',
            type: 'n8n-nodes-base.emailSend',
            position: [1250, 300],
            parameters: {
              fromEmail: '{{$env.COMPANY_EMAIL}}',
              toEmail: '{{$env.INVESTOR_EMAILS}}',
              subject: 'Monthly Investor Report - {{$now.format("MMMM YYYY")}}',
              emailType: 'text',
              message: 'Monthly Investor Report\n\nExecutive Summary:\n- MRR: \\${{$json["executive_summary"]["mrr"]}}\n- ARR: \\${{$json["executive_summary"]["arr"]}}\n- Growth Rate: {{$json["executive_summary"]["growth_rate"]}}\n- Churn Rate: {{$json["executive_summary"]["churn_rate"]}}\n- LTV: \\${{$json["executive_summary"]["ltv"]}}\n- Active Customers: {{$json["executive_summary"]["active_customers"]}}\n\nRevenue Metrics:\n- New MRR: \\${{$json["detailed_metrics"]["revenue"]["new_mrr"]}}\n- Churned MRR: \\${{$json["detailed_metrics"]["revenue"]["churned_mrr"]}}\n- Net New MRR: \\${{$json["detailed_metrics"]["revenue"]["net_new_mrr"]}}\n\nUnit Economics:\n- ARPU: \\${{$json["detailed_metrics"]["unit_economics"]["arpu"]}}\n- Customer Lifetime: {{$json["detailed_metrics"]["unit_economics"]["customer_lifetime_months"]}} months\n\n{{#if $json["recommendations"].length}}\nRecommendations:\n{{#each $json["recommendations"]}}\n- {{this}}\n{{/each}}\n{{/if}}'
            }
          }
        ],
        connections: {
          'Daily Analytics Run': {
            main: [[
              { node: 'Get Active Subscriptions', type: 'main', index: 0 }
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
          'Merge All Metrics': {
            main: [[{ node: 'Generate Investor Report', type: 'main', index: 0 }]]
          },
          'Generate Investor Report': {
            main: [[{ node: 'Email Report', type: 'main', index: 0 }]]
          }
        }
      }
    }
  }
];