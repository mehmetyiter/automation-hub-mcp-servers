# VSCode'da n8n MCP Server Kullanımı

## HTTP API Örnekleri

### 1. Sağlık Kontrolü
```bash
curl http://localhost:3100/health
```

### 2. Workflow Listele
```bash
curl -X POST http://localhost:3100/tools/n8n_list_workflows \
  -H "Content-Type: application/json" \
  -d '{"limit": 10}'
```

### 3. Belirli Bir Workflow'u Getir
```bash
curl -X POST http://localhost:3100/tools/n8n_get_workflow \
  -H "Content-Type: application/json" \
  -d '{"id": "WORKFLOW_ID"}'
```

### 4. Yeni Workflow Oluştur
```bash
curl -X POST http://localhost:3100/tools/n8n_create_workflow \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Workflow",
    "nodes": [
      {
        "id": "trigger",
        "name": "Manual Trigger",
        "type": "n8n-nodes-base.manualTrigger",
        "typeVersion": 1,
        "position": [250, 300],
        "parameters": {}
      }
    ],
    "connections": {}
  }'
```

### 5. Workflow Çalıştır
```bash
curl -X POST http://localhost:3100/tools/n8n_execute_workflow \
  -H "Content-Type: application/json" \
  -d '{"id": "WORKFLOW_ID", "data": {"test": "data"}}'
```

## VSCode Tasks

`.vscode/tasks.json` dosyanıza ekleyin:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "List n8n Workflows",
      "type": "shell",
      "command": "curl -s -X POST http://localhost:3100/tools/n8n_list_workflows -H 'Content-Type: application/json' -d '{\"limit\": 10}' | jq",
      "problemMatcher": []
    },
    {
      "label": "Check n8n Connection",
      "type": "shell",
      "command": "curl -s http://localhost:3100/health | jq",
      "problemMatcher": []
    }
  ]
}
```

## VSCode REST Client Extension

`.http` dosyası oluşturun:

```http
### Health Check
GET http://localhost:3100/health

### List Workflows
POST http://localhost:3100/tools/n8n_list_workflows
Content-Type: application/json

{
  "limit": 10
}

### Get Workflow
POST http://localhost:3100/tools/n8n_get_workflow
Content-Type: application/json

{
  "id": "WORKFLOW_ID"
}

### Create Workflow
POST http://localhost:3100/tools/n8n_create_workflow
Content-Type: application/json

{
  "name": "VSCode Test Workflow",
  "nodes": [
    {
      "id": "webhook",
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 1,
      "position": [250, 300],
      "parameters": {
        "path": "test-webhook",
        "responseMode": "onReceived"
      }
    }
  ],
  "connections": {}
}
```

## Bash Alias'ları

`.bashrc` veya `.zshrc` dosyanıza ekleyin:

```bash
# n8n MCP shortcuts
alias n8n-list="curl -s -X POST http://localhost:3100/tools/n8n_list_workflows -H 'Content-Type: application/json' -d '{\"limit\": 10}' | jq"
alias n8n-health="curl -s http://localhost:3100/health | jq"
alias n8n-test="curl -s -X POST http://localhost:3100/tools/n8n_test_connection -H 'Content-Type: application/json' -d '{}' | jq"
```