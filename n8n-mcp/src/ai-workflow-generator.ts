import { default as fetch } from 'node-fetch';

export interface WorkflowGenerationOptions {
  useAI?: boolean;
  apiKey?: string;
  provider?: 'openai' | 'anthropic';
}

export class AIWorkflowGenerator {
  private apiKey?: string;

  constructor(options?: WorkflowGenerationOptions) {
    this.apiKey = options?.apiKey;
  }

  async generateFromPrompt(prompt: string, name: string): Promise<any> {
    // Try AI generation first if API key is available
    if (this.apiKey) {
      try {
        const aiResult = await this.generateWithAI(prompt, name);
        if (aiResult.success) {
          return aiResult;
        }
      } catch (error) {
        console.error('AI generation failed:', error);
      }
    }

    // Fallback to basic pattern matching only for specific cases
    const promptLower = prompt.toLowerCase();
    
    // Only keep re-engagement as a fallback since we implemented it
    const reEngagementKeywords = ['inactive', 'miss you', 'incentive', 'last chance', 'unsubscribe', 're-engagement', 'win back', '90 days', '90+ days'];
    const isReEngagement = reEngagementKeywords.some(keyword => promptLower.includes(keyword));

    if (isReEngagement) {
      return {
        success: true,
        workflow: this.createReEngagementWorkflow(name),
        method: 'pattern-fallback',
        confidence: 0.7
      };
    }

    // For everything else, return failure to force proper AI implementation
    return {
      success: false,
      error: 'AI generation is required for this type of workflow. Please ensure OpenAI API key is configured.'
    };
  }

  private async generateWithAI(prompt: string, name: string): Promise<any> {
    if (!this.apiKey) {
      throw new Error('API key not configured');
    }

    const systemPrompt = `You are an n8n workflow expert. Generate a complete, production-ready n8n workflow based on the user's requirements.

IMPORTANT RULES:
1. Generate a realistic workflow with ALL necessary nodes (typically 5-15 nodes)
2. Use actual n8n node types like:
   - n8n-nodes-base.httpRequest (typeVersion: 4.2)
   - n8n-nodes-base.code (typeVersion: 2, parameter: "jsCode" not "functionCode")
   - n8n-nodes-base.postgres (typeVersion: 2.4)
   - n8n-nodes-base.set (typeVersion: 3.4)
   - n8n-nodes-base.if (typeVersion: 2)
   - n8n-nodes-base.merge (typeVersion: 3)
   - n8n-nodes-base.splitInBatches (typeVersion: 3)
   - n8n-nodes-base.emailSend (typeVersion: 2.1)
   - n8n-nodes-base.slack (typeVersion: 2.2)
   - n8n-nodes-base.scheduleTrigger (typeVersion: 1.2, use "rule.interval" array with proper values)
   - n8n-nodes-base.webhook (typeVersion: 2)

3. Each node must have:
   - Unique id (use descriptive snake_case like "schedule_trigger", "fetch_data", "process_metrics" - NOT numeric IDs)
   - Descriptive name
   - Correct type and typeVersion
   - Position [x, y] coordinates (increment x by 200 for each node)
   - Proper parameters based on node type

4. Include proper error handling and data validation
5. Use environment variables for sensitive data ({{$env.VAR_NAME}})
6. Include detailed parameters for each node. Examples:
   - Code node: use "jsCode" parameter, not "functionCode"
   - Set node: use "assignments" parameter with "assignmentType": "simple"
   - HTTP Request: use proper authentication and options structure
   - Schedule Trigger: must have complete rule.interval array, e.g., {"field": "hours", "hoursInterval": 1}
   - Wait node: must have "resume" parameter (e.g., "timeInterval", with "amount" and "unit")
7. Connect all nodes properly in the connections object:
   - Connection KEYS use node NAMEs: "Webhook Trigger": { ... }
   - Connection VALUES reference node NAMEs: { "node": "Format Message", "type": "main", "index": 0 }
   Example: "Webhook Trigger": { "main": [[{ "node": "Format Message", "type": "main", "index": 0 }]] }

CRITICAL: 
- In the connections object, use node NAMEs (not IDs) for both keys and references
- For Code nodes, use "jsCode" parameter, NOT "functionCode"
- Use correct typeVersion for each node type
- For parallel execution (split flow), each target gets its own array:
  "Format Message": { "main": [[{"node": "Send Slack"}], [{"node": "Send Email"}], [{"node": "Send SMS"}]] }
- For sequential or joining flows, use single array:
  "Send Slack": { "main": [[{"node": "Wait for Acknowledgment"}]] }

Return ONLY a JSON object with this structure:
{
  "workflow": {
    "name": "workflow name",
    "nodes": [...],
    "connections": {...},
    "settings": {}
  }
}`;

    const userPrompt = `Create an n8n workflow for: ${prompt}\n\nWorkflow name: ${name}`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.7,
          max_tokens: 4000,
          response_format: { type: 'json_object' }
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;
      const parsed = JSON.parse(content);

      if (parsed.workflow) {
        return {
          success: true,
          workflow: parsed.workflow,
          method: 'ai-generated',
          confidence: 0.9
        };
      }

      throw new Error('Invalid AI response format');
    } catch (error) {
      console.error('AI generation error:', error);
      throw error;
    }
  }

  private createReEngagementWorkflow(name: string): any {
    // Keep the re-engagement workflow as fallback
    return {
      name,
      nodes: [
        {
          id: 'schedule_trigger',
          name: 'Daily Check',
          type: 'n8n-nodes-base.scheduleTrigger',
          typeVersion: 1.1,
          position: [250, 300],
          parameters: {
            rule: {
              interval: [{
                field: 'days',
                daysInterval: 1
              }]
            }
          }
        },
        {
          id: 'get_inactive_subscribers',
          name: 'Get Inactive Subscribers (90+ days)',
          type: 'n8n-nodes-base.postgres',
          typeVersion: 2.4,
          position: [450, 300],
          parameters: {
            operation: 'executeQuery',
            query: `
              SELECT id, email, name, last_activity_date
              FROM subscribers
              WHERE status = 'active'
                AND last_activity_date <= CURRENT_DATE - INTERVAL '90 days'
                AND NOT EXISTS (
                  SELECT 1 FROM campaign_sends
                  WHERE campaign_id = 're-engagement'
                    AND subscriber_id = subscribers.id
                    AND sent_at >= CURRENT_DATE - INTERVAL '30 days'
                )
              LIMIT 100
            `
          }
        },
        {
          id: 'send_we_miss_you',
          name: 'Send "We Miss You" Email with Incentive',
          type: 'n8n-nodes-base.emailSend',
          typeVersion: 2.1,
          position: [650, 300],
          parameters: {
            fromEmail: '={{$env.COMPANY_EMAIL}}',
            toEmail: '={{$json["email"]}}',
            subject: 'We miss you, {{$json["name"]}}! 💙 Special offer inside',
            emailType: 'html',
            message: `
              <h2>Hi {{$json["name"]}},</h2>
              <p>We noticed you haven't been active lately and we miss you!</p>
              <p>As a valued member, we'd love to have you back. Here's an exclusive offer just for you:</p>
              <div style="background: #f0f0f0; padding: 20px; margin: 20px 0; text-align: center;">
                <h3>🎁 30% OFF Your Next Purchase</h3>
                <p>Use code: <strong>MISSYOU30</strong></p>
                <a href="{{$env.SITE_URL}}/shop?code=MISSYOU30&utm_source=reengagement" 
                   style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                  Shop Now
                </a>
              </div>
              <p>This offer expires in 7 days, so don't miss out!</p>
              <p style="font-size: 12px; color: #666;">
                If you no longer wish to receive our emails, 
                <a href="{{$env.SITE_URL}}/unsubscribe?id={{$json["id"]}}">click here to unsubscribe</a>
              </p>
            `
          }
        },
        {
          id: 'log_email_sent',
          name: 'Log Email Sent',
          type: 'n8n-nodes-base.postgres',
          typeVersion: 2.4,
          position: [850, 300],
          parameters: {
            operation: 'executeQuery',
            query: `
              INSERT INTO campaign_sends (campaign_id, subscriber_id, sent_at, email_type)
              VALUES ('re-engagement', {{$json["id"]}}, NOW(), 'we_miss_you')
            `
          }
        },
        {
          id: 'wait_7_days',
          name: 'Wait 7 Days',
          type: 'n8n-nodes-base.wait',
          typeVersion: 1,
          position: [1050, 300],
          parameters: {
            amount: 7,
            unit: 'days'
          }
        },
        {
          id: 'check_activity',
          name: 'Check If Reactivated',
          type: 'n8n-nodes-base.postgres',
          typeVersion: 2.4,
          position: [1250, 300],
          parameters: {
            operation: 'executeQuery',
            query: `
              SELECT id, email, name, last_activity_date,
                CASE WHEN last_activity_date > CURRENT_DATE - INTERVAL '7 days' 
                     THEN 'reactivated' 
                     ELSE 'still_inactive' 
                END as status
              FROM subscribers
              WHERE id = {{$json["id"]}}
            `
          }
        },
        {
          id: 'filter_still_inactive',
          name: 'Filter Still Inactive',
          type: 'n8n-nodes-base.filter',
          typeVersion: 1,
          position: [1450, 300],
          parameters: {
            conditions: {
              string: [{
                value1: '={{$json["status"]}}',
                operation: 'equals',
                value2: 'still_inactive'
              }]
            }
          }
        },
        {
          id: 'send_last_chance',
          name: 'Send "Last Chance" Email',
          type: 'n8n-nodes-base.emailSend',
          typeVersion: 2.1,
          position: [1650, 300],
          parameters: {
            fromEmail: '={{$env.COMPANY_EMAIL}}',
            toEmail: '={{$json["email"]}}',
            subject: 'Last chance to stay with us! ⏰',
            emailType: 'html',
            message: `
              <h2>{{$json["name"]}}, this is your last chance!</h2>
              <p>We haven't heard from you and we'll be removing you from our list soon.</p>
              <p>If you'd like to stay, just click the button below:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="{{$env.SITE_URL}}/stay-subscribed?id={{$json["id"]}}" 
                   style="background: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px;">
                  Yes, I want to stay!
                </a>
              </div>
              <p>If we don't hear from you in the next 48 hours, we'll remove you from our list.</p>
              <p style="font-size: 12px; color: #666;">
                <a href="{{$env.SITE_URL}}/unsubscribe?id={{$json["id"]}}">
                  Unsubscribe immediately
                </a>
              </p>
            `
          }
        },
        {
          id: 'wait_48_hours',
          name: 'Wait 48 Hours',
          type: 'n8n-nodes-base.wait',
          typeVersion: 1,
          position: [1850, 300],
          parameters: {
            amount: 48,
            unit: 'hours'
          }
        },
        {
          id: 'check_final_activity',
          name: 'Check Final Activity',
          type: 'n8n-nodes-base.postgres',
          typeVersion: 2.4,
          position: [2050, 300],
          parameters: {
            operation: 'executeQuery',
            query: `
              SELECT id, email, name, last_activity_date,
                CASE WHEN last_activity_date > {{$json["last_activity_date"]}}
                     THEN 'reactivated' 
                     ELSE 'unsubscribe' 
                END as final_status
              FROM subscribers
              WHERE id = {{$json["id"]}}
            `
          }
        },
        {
          id: 'filter_unsubscribe',
          name: 'Filter Non-Responders',
          type: 'n8n-nodes-base.filter',
          typeVersion: 1,
          position: [2250, 300],
          parameters: {
            conditions: {
              string: [{
                value1: '={{$json["final_status"]}}',
                operation: 'equals',
                value2: 'unsubscribe'
              }]
            }
          }
        },
        {
          id: 'unsubscribe_user',
          name: 'Unsubscribe Non-Responders',
          type: 'n8n-nodes-base.postgres',
          typeVersion: 2.4,
          position: [2450, 300],
          parameters: {
            operation: 'executeQuery',
            query: `
              UPDATE subscribers 
              SET status = 'unsubscribed',
                  unsubscribed_at = NOW(),
                  unsubscribe_reason = 'inactive_90_days'
              WHERE id = {{$json["id"]}};\n              
              INSERT INTO unsubscribe_log (subscriber_id, reason, campaign_id)
              VALUES ({{$json["id"]}}, 'inactive_90_days', 're-engagement');
            `
          }
        },
        {
          id: 'update_segments',
          name: 'Update Segments & Tags',
          type: 'n8n-nodes-base.postgres',
          typeVersion: 2.4,
          position: [2650, 300],
          parameters: {
            operation: 'executeQuery',
            query: `
              -- Remove from active segments
              DELETE FROM segment_members 
              WHERE subscriber_id = {{$json["id"]}} 
                AND segment_id IN (SELECT id FROM segments WHERE type = 'active');
              
              -- Add to churned segment
              INSERT INTO segment_members (subscriber_id, segment_id)
              VALUES ({{$json["id"]}}, (SELECT id FROM segments WHERE name = 'churned'))
              ON CONFLICT DO NOTHING;
              
              -- Update tags
              INSERT INTO subscriber_tags (subscriber_id, tag, added_at)
              VALUES 
                ({{$json["id"]}}, 'churned', NOW()),
                ({{$json["id"]}}, 're-engagement-failed', NOW())
              ON CONFLICT DO NOTHING;
            `
          }
        }
      ],
      connections: {
        'Daily Check': {
          main: [[{ node: 'Get Inactive Subscribers (90+ days)', type: 'main', index: 0 }]]
        },
        'Get Inactive Subscribers (90+ days)': {
          main: [[{ node: 'Send "We Miss You" Email with Incentive', type: 'main', index: 0 }]]
        },
        'Send "We Miss You" Email with Incentive': {
          main: [[{ node: 'Log Email Sent', type: 'main', index: 0 }]]
        },
        'Log Email Sent': {
          main: [[{ node: 'Wait 7 Days', type: 'main', index: 0 }]]
        },
        'Wait 7 Days': {
          main: [[{ node: 'Check If Reactivated', type: 'main', index: 0 }]]
        },
        'Check If Reactivated': {
          main: [[{ node: 'Filter Still Inactive', type: 'main', index: 0 }]]
        },
        'Filter Still Inactive': {
          main: [[{ node: 'Send "Last Chance" Email', type: 'main', index: 0 }]]
        },
        'Send "Last Chance" Email': {
          main: [[{ node: 'Wait 48 Hours', type: 'main', index: 0 }]]
        },
        'Wait 48 Hours': {
          main: [[{ node: 'Check Final Activity', type: 'main', index: 0 }]]
        },
        'Check Final Activity': {
          main: [[{ node: 'Filter Non-Responders', type: 'main', index: 0 }]]
        },
        'Filter Non-Responders': {
          main: [[{ node: 'Unsubscribe Non-Responders', type: 'main', index: 0 }]]
        },
        'Unsubscribe Non-Responders': {
          main: [[{ node: 'Update Segments & Tags', type: 'main', index: 0 }]]
        }
      },
      settings: {}
    };
  }
}