# Slack Webhook Setup for n8n

## Problem
Slack requires webhook endpoints to respond to URL verification challenges immediately with the challenge value. n8n's default webhook behavior doesn't handle this automatically.

## Solution 1: Simple Webhook (For Testing)
Use a basic webhook that accepts all events:

1. Add a **Webhook** node
   - HTTP Method: POST
   - Path: slack-events
   - Response Mode: "When Last Node Finishes"
   - Response Code: 200
   - Response Data: "First Entry JSON"

2. Add a **Code** node after webhook:
```javascript
const body = $input.all()[0].json;

// URL verification - return challenge immediately
if (body.type === 'url_verification' && body.challenge) {
  return [{
    json: { challenge: body.challenge }
  }];
}

// Process events
if (body.event) {
  return [{
    json: body.event
  }];
}

return [];
```

## Solution 2: Production Webhook with Respond Node
For production use with proper response handling:

1. **Webhook** node:
   - HTTP Method: POST
   - Path: slack-events
   - Response Mode: "Using Respond to Webhook Node"

2. **Switch** node to check event type:
   - Mode: "Expression"
   - Output: 2
   - Routing Rules:
     - Rule 1: `{{$json.type === 'url_verification'}}`
     - Rule 2: `{{$json.type === 'event_callback'}}`

3. **Respond to Webhook** node (for challenges):
   - Connect to Switch output 1
   - Response Code: 200
   - Respond With: "Text"
   - Response Body: `{{$json.challenge}}`

4. Continue processing for actual events on Switch output 2

## Important Notes

1. **URL Format**: 
   - Test: `https://[your-instance].app.n8n.cloud/webhook-test/slack-events`
   - Production: `https://[your-instance].app.n8n.cloud/webhook/slack-events`

2. **Slack App Configuration**:
   - Enable Event Subscriptions
   - Add Request URL (use production URL)
   - Subscribe to bot events: `team_join`, `member_joined_channel`, etc.

3. **OAuth Scopes Required**:
   - `channels:read`
   - `chat:write`
   - `users:read`
   - `team:read` (for team_join events)

4. **Testing**:
   ```bash
   # Test challenge
   curl -X POST your-webhook-url \
     -H "Content-Type: application/json" \
     -d '{"type":"url_verification","challenge":"test123"}'
   
   # Should return: test123
   ```

## Common Issues

1. **"Your URL didn't respond with the correct challenge"**
   - Make sure webhook is active
   - Check Response Mode settings
   - Verify the Code node returns challenge correctly

2. **Events not triggering**
   - Check OAuth scopes
   - Verify event subscriptions are saved
   - Ensure webhook URL uses production path (not test)

3. **Socket Mode Conflict**
   - Socket Mode and webhooks are mutually exclusive
   - Disable Socket Mode to use webhooks