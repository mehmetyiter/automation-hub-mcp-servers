#!/bin/bash

# Setup script for n8n-MCP monitoring infrastructure

set -e

echo "Setting up n8n-MCP monitoring infrastructure..."

# Check for required tools
command -v docker >/dev/null 2>&1 || { echo "Docker is required but not installed. Aborting." >&2; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo "Docker Compose is required but not installed. Aborting." >&2; exit 1; }

# Create necessary directories
echo "Creating monitoring directories..."
mkdir -p ./prometheus/data
mkdir -p ./grafana/data
mkdir -p ./elasticsearch/data
mkdir -p ./jaeger/data
mkdir -p ./alertmanager/data
mkdir -p ../logs

# Set proper permissions
echo "Setting permissions..."
chmod -R 777 ./prometheus/data
chmod -R 777 ./grafana/data
chmod -R 777 ./elasticsearch/data
chmod -R 777 ./jaeger/data
chmod -R 777 ./alertmanager/data

# Create Elasticsearch index templates
echo "Waiting for Elasticsearch to be ready..."
sleep 30

echo "Creating Elasticsearch ILM policies..."
curl -X PUT "localhost:9200/_ilm/policy/n8n-mcp-logs-policy" \
  -H 'Content-Type: application/json' \
  -d @elasticsearch/ilm-policies.json

echo "Creating Elasticsearch index templates..."
curl -X PUT "localhost:9200/_index_template/n8n-mcp-logs" \
  -H 'Content-Type: application/json' \
  -d @elasticsearch/index-templates.json

# Import Grafana dashboards
echo "Importing Grafana dashboards..."
GRAFANA_API="http://admin:admin@localhost:3000/api"

# Wait for Grafana to be ready
until curl -s "$GRAFANA_API/health" > /dev/null; do
  echo "Waiting for Grafana..."
  sleep 5
done

# Create data source
echo "Creating Prometheus data source..."
curl -X POST "$GRAFANA_API/datasources" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Prometheus",
    "type": "prometheus",
    "url": "http://prometheus:9090",
    "access": "proxy",
    "isDefault": true
  }'

# Import dashboards
for dashboard in grafana/dashboards/*.json; do
  echo "Importing dashboard: $dashboard"
  curl -X POST "$GRAFANA_API/dashboards/db" \
    -H "Content-Type: application/json" \
    -d "{\"dashboard\": $(cat $dashboard), \"overwrite\": true}"
done

# Create Prometheus alerts
echo "Verifying Prometheus configuration..."
docker exec n8n-mcp-prometheus promtool check config /etc/prometheus/prometheus.yml
docker exec n8n-mcp-prometheus promtool check rules /etc/prometheus/rules/*.yml

# Setup Jaeger
echo "Setting up Jaeger..."
curl -X POST "http://localhost:16686/api/v2/samplingStrategies" \
  -H "Content-Type: application/json" \
  -d @jaeger/sampling-strategies.json

# Create monitoring user for database
echo "Creating monitoring user for PostgreSQL..."
PGPASSWORD=your_password psql -h localhost -U postgres -c "
CREATE USER monitoring WITH PASSWORD 'monitoring_password';
GRANT pg_monitor TO monitoring;
GRANT CONNECT ON DATABASE n8n_mcp TO monitoring;
"

# Install Node.js dependencies for APM
echo "Installing APM dependencies..."
cd ..
npm install --save @opentelemetry/instrumentation-http @opentelemetry/instrumentation-express
npm install --save winston-elasticsearch
npm install --save prom-client

# Create systemd service for monitoring exporters (if on Linux)
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
  echo "Creating systemd services..."
  
  # Node exporter service
  sudo tee /etc/systemd/system/node_exporter.service > /dev/null <<EOF
[Unit]
Description=Node Exporter
Wants=network-online.target
After=network-online.target

[Service]
User=prometheus
Group=prometheus
Type=simple
ExecStart=/usr/local/bin/node_exporter

[Install]
WantedBy=multi-user.target
EOF

  sudo systemctl daemon-reload
  sudo systemctl enable node_exporter
  sudo systemctl start node_exporter
fi

# Create monitoring configuration file
echo "Creating monitoring configuration..."
cat > ../src/config/monitoring.json <<EOF
{
  "tracing": {
    "enabled": true,
    "jaegerEndpoint": "http://localhost:14268/api/traces",
    "samplingRate": 0.1
  },
  "metrics": {
    "enabled": true,
    "prometheusPort": 9464,
    "defaultLabels": {
      "environment": "${NODE_ENV:-development}",
      "service": "n8n-mcp"
    }
  },
  "logging": {
    "enabled": true,
    "elasticsearchUrl": "http://localhost:9200",
    "level": "info"
  },
  "apm": {
    "enabled": false,
    "provider": "elastic",
    "config": {
      "serverUrl": "http://localhost:8200",
      "serviceName": "n8n-mcp",
      "environment": "${NODE_ENV:-development}"
    }
  }
}
EOF

echo "Monitoring setup complete!"
echo ""
echo "Access points:"
echo "- Prometheus: http://localhost:9090"
echo "- Grafana: http://localhost:3000 (admin/admin)"
echo "- Jaeger: http://localhost:16686"
echo "- Elasticsearch: http://localhost:9200"
echo "- Kibana: http://localhost:5601"
echo "- AlertManager: http://localhost:9093"
echo ""
echo "To start monitoring, run: docker-compose -f docker-compose.monitoring.yml up -d"