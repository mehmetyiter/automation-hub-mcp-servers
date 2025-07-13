# Predictive Analytics & Optimization Engine

An advanced AI-powered predictive analytics and optimization platform for the n8n-MCP automation hub, providing machine learning-based predictions, anomaly detection, workflow optimization, and intelligent recommendations using TensorFlow.js and advanced statistical models.

## Features

### 🤖 Machine Learning & Predictions
- **Multiple ML Algorithms**: Linear Regression, Polynomial Regression, LSTM, Random Forest, SVM
- **Real-time Predictions**: Instant predictions with confidence intervals
- **Time Series Forecasting**: Advanced forecasting with trend and seasonality analysis
- **Model Management**: Full lifecycle management with training, validation, and deployment
- **Auto-Retraining**: Automatic model retraining with fresh data

### 🔍 Anomaly Detection
- **Statistical Anomaly Detection**: Z-score and sliding window analysis
- **Real-time Monitoring**: Continuous anomaly detection with severity classification
- **Pattern Recognition**: Detect deviations from normal behavior patterns
- **Configurable Thresholds**: Customizable sensitivity and alerting thresholds
- **Historical Analysis**: Analyze anomaly patterns over time

### ⚡ Workflow Optimization
- **Performance Analysis**: Identify bottlenecks and optimization opportunities
- **Resource Optimization**: CPU, memory, and network usage optimization
- **Cost Optimization**: Reduce operational costs through intelligent resource allocation
- **Parallelization Opportunities**: Detect workflows that can benefit from parallel execution
- **Caching Strategies**: Identify and implement optimal caching strategies

### 📊 Advanced Analytics
- **Predictive Modeling**: Build custom prediction models for various metrics
- **Feature Engineering**: Automatic feature extraction and importance analysis
- **Cross-Validation**: Robust model validation with performance metrics
- **Hyperparameter Tuning**: Optimize model parameters for best performance
- **Model Explainability**: Understand what drives model predictions

### 🎯 Intelligent Recommendations
- **Optimization Recommendations**: AI-generated suggestions for performance improvement
- **Implementation Plans**: Detailed step-by-step optimization implementation guides
- **Impact Analysis**: Estimated improvements and confidence levels
- **Priority Ranking**: Recommendations ranked by impact and implementation effort
- **Success Tracking**: Monitor implementation success and ROI

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Predictive      │    │ Optimization    │    │ Predictive API  │
│ Engine          │    │ Engine          │    │                 │
│                 │    │                 │    │ • REST API      │
│ • ML Models     │◄──►│ • Workflow Opt  │◄──►│ • WebSocket     │
│ • Predictions   │    │ • Resource Opt  │    │ • Real-time     │
│ • Anomalies     │    │ • Performance   │    │ • Dashboard     │
│ • Forecasting   │    │ • Cost Analysis │    │ • Management    │
│ • Auto-Retrain  │    │ • Recommendations│   │ • Analytics     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Prediction Storage (PostgreSQL)                │
│                                                                 │
│ • Models          • Predictions      • Anomalies              │
│ • Training Data   • Forecasts        • Optimizations         │
│ • Experiments     • Performance      • Recommendations       │
│ • Feature Store   • Model History    • Analytics Results     │
└─────────────────────────────────────────────────────────────────┘
```

## Installation

1. **Clone and Setup**
   ```bash
   git clone <repository-url>
   cd predictive-analytics-engine
   npm install
   ```

2. **Environment Configuration**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

3. **Database Setup**
   ```bash
   createdb predictive_analytics
   # Tables will be created automatically on startup
   ```

4. **Build and Start**
   ```bash
   npm run build
   npm start
   ```

## Configuration

### Database Configuration
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=predictive_analytics
DB_USERNAME=postgres
DB_PASSWORD=password
```

### Machine Learning Configuration
```env
ENABLE_TENSORFLOW=true
ENABLE_GPU=false
MAX_TRAINING_EPOCHS=100
DEFAULT_BATCH_SIZE=32
VALIDATION_SPLIT=0.2
CONFIDENCE_THRESHOLD=0.7
```

### Optimization Configuration
```env
ENABLE_WORKFLOW_OPTIMIZATION=true
ENABLE_RESOURCE_OPTIMIZATION=true
ENABLE_PERFORMANCE_OPTIMIZATION=true
ENABLE_COST_OPTIMIZATION=true
OPTIMIZATION_INTERVAL=14400000
```

## API Usage

### Model Management

#### Create Predictive Model
```bash
POST /api/models
Content-Type: application/json

{
  "name": "Workflow Execution Time Predictor",
  "type": "linear_regression",
  "target": "execution_time",
  "features": ["complexity", "data_size", "node_count"],
  "hyperparameters": {
    "learningRate": 0.01,
    "regularization": 0.001
  },
  "thresholds": {
    "responseTime": {
      "warning": 5000,
      "critical": 10000
    },
    "availability": {
      "warning": 95,
      "critical": 90
    }
  },
  "enabled": true,
  "tags": ["workflow", "performance"]
}
```

#### Train Model
```bash
POST /api/models/{modelId}/train
Content-Type: application/json

{
  "trainingData": [
    {
      "timestamp": 1640995200000,
      "value": 1250,
      "metadata": {
        "complexity": 7.5,
        "data_size": 500,
        "node_count": 12
      }
    }
  ]
}
```

#### Deploy Model
```bash
POST /api/models/{modelId}/deploy

# Response
{
  "message": "Model deployed successfully"
}
```

### Predictions

#### Make Prediction
```bash
POST /api/models/{modelId}/predict
Content-Type: application/json

{
  "features": {
    "complexity": 8.0,
    "data_size": 750,
    "node_count": 15
  }
}

# Response
{
  "id": "pred-123",
  "modelId": "model-456",
  "modelType": "linear_regression",
  "timestamp": 1640995200000,
  "predictedValue": 1450.25,
  "confidence": 0.85,
  "predictionInterval": {
    "lower": 1350.0,
    "upper": 1550.5
  },
  "horizon": 0,
  "features": {
    "complexity": 8.0,
    "data_size": 750,
    "node_count": 15
  }
}
```

#### Generate Forecast
```bash
POST /api/models/{modelId}/forecast
Content-Type: application/json

{
  "horizon": 24,
  "features": {
    "baseline_load": 45.2
  }
}

# Response
{
  "modelId": "model-456",
  "target": "execution_time",
  "predictions": [
    {
      "timestamp": 1640995200000,
      "value": 1450.25,
      "confidence": 0.85,
      "interval": {
        "lower": 1350.0,
        "upper": 1550.5
      }
    }
  ],
  "horizon": 24,
  "accuracy": 87.5,
  "trend": "increasing",
  "seasonality": {
    "detected": true,
    "period": 24,
    "strength": 0.3
  },
  "generatedAt": 1640995200000
}
```

### Anomaly Detection

#### Detect Anomalies
```bash
POST /api/anomaly-detection
Content-Type: application/json

{
  "data": [
    {
      "timestamp": 1640995200000,
      "value": 1250.5,
      "metadata": {"source": "workflow_metrics"}
    }
  ],
  "threshold": 2.5
}

# Response
[
  {
    "id": "anomaly-123",
    "timestamp": 1640995200000,
    "value": 2450.5,
    "isAnomaly": true,
    "anomalyScore": 3.2,
    "threshold": 2.5,
    "severity": "high",
    "context": {
      "windowSize": 100,
      "baseline": 1250.0,
      "deviation": 1200.5
    }
  }
]
```

### Workflow Optimization

#### Optimize Workflow
```bash
POST /api/optimization/workflow
Content-Type: application/json

{
  "id": "workflow-123",
  "name": "Data Processing Pipeline",
  "executionData": [
    {
      "timestamp": 1640995200000,
      "duration": 5000,
      "resourceUsage": {
        "cpu": 75.5,
        "memory": 512,
        "network": 1024
      },
      "errorCount": 0,
      "steps": [
        {
          "name": "Data Fetch",
          "duration": 2000,
          "resourceUsage": {"cpu": 30, "memory": 256}
        },
        {
          "name": "Data Transform",
          "duration": 2500,
          "resourceUsage": {"cpu": 80, "memory": 1024}
        }
      ]
    }
  ]
}

# Response
{
  "id": "opt-456",
  "workflowId": "workflow-123",
  "workflowName": "Data Processing Pipeline",
  "optimizationType": "performance",
  "currentMetrics": {
    "executionTime": 5000,
    "resourceUsage": {"cpu": 75.5, "memory": 512},
    "errorRate": 0.02,
    "throughput": 0.2,
    "cost": 0.05
  },
  "optimizedMetrics": {
    "executionTime": 3500,
    "resourceUsage": {"cpu": 60.0, "memory": 400},
    "errorRate": 0.01,
    "throughput": 0.28,
    "cost": 0.035
  },
  "improvements": [
    {
      "metric": "execution_time",
      "currentValue": 5000,
      "optimizedValue": 3500,
      "improvementPercent": 30.0
    }
  ],
  "optimizations": [
    {
      "type": "parallelization",
      "description": "Implement parallel execution for independent steps",
      "impact": 0.3,
      "effort": "medium",
      "implementation": [
        "Identify independent workflow steps",
        "Implement parallel execution framework"
      ]
    }
  ],
  "confidence": 0.85,
  "estimatedSavings": {
    "time": 1500,
    "cost": 0.015,
    "resources": 20.5
  }
}
```

### Analytics & Reporting

#### Get Analytics Overview
```bash
GET /api/analytics/overview

# Response
{
  "models": {
    "total": 5,
    "deployed": 3,
    "training": 1,
    "avgAccuracy": 87.5
  },
  "predictions": {
    "total24h": 1250,
    "avgConfidence": 0.82
  },
  "anomalies": {
    "total7d": 45,
    "critical": 3,
    "high": 12
  },
  "timestamp": 1640995200000
}
```

#### Get Model Performance
```bash
GET /api/analytics/model-performance

# Response
[
  {
    "id": "model-123",
    "name": "Execution Time Predictor",
    "type": "linear_regression",
    "accuracy": 87.5,
    "mse": 125.6,
    "mae": 8.9,
    "r2": 0.875,
    "mape": 5.2,
    "predictions": 2500,
    "lastUsed": 1640995200000
  }
]
```

#### Get Optimization Report
```bash
GET /api/optimization/report

# Response
{
  "summary": {
    "totalOptimizations": 15,
    "potentialSavings": {
      "time": 25000,
      "cost": 150.75,
      "resources": 35.2
    },
    "highPriorityRecommendations": 3
  },
  "workflows": [...],
  "resources": [...],
  "performance": [...],
  "costs": [...]
}
```

## WebSocket Events

### Client Connection
```javascript
const socket = io('http://localhost:3010');

// Subscribe to events
socket.emit('subscribe', ['predictions', 'models', 'anomalies', 'optimizations']);

// Real-time prediction
socket.emit('predict_realtime', {
  modelId: 'model-123',
  features: { complexity: 8.0, data_size: 750 }
});

socket.on('prediction_result', (prediction) => {
  console.log('Real-time prediction:', prediction);
});
```

### Server Events
```javascript
// Model events
socket.on('model_created', (model) => {
  console.log('New model created:', model);
});

socket.on('model_trained', (model) => {
  console.log('Model training completed:', model);
});

// Prediction events
socket.on('prediction_made', (prediction) => {
  console.log('New prediction:', prediction);
});

// Anomaly events
socket.on('anomalies_detected', (anomalies) => {
  console.log('Anomalies detected:', anomalies);
});

// Optimization events
socket.on('workflow_optimization_created', (optimization) => {
  console.log('Workflow optimization:', optimization);
});

socket.on('recommendations_generated', (recommendations) => {
  console.log('New recommendations:', recommendations);
});
```

## Machine Learning Models

### Linear Regression
Simple and fast for linear relationships:
```json
{
  "type": "linear_regression",
  "hyperparameters": {
    "learningRate": 0.01,
    "regularization": 0.001
  }
}
```

### Polynomial Regression
For non-linear relationships:
```json
{
  "type": "polynomial_regression",
  "hyperparameters": {
    "degree": 2,
    "learningRate": 0.01
  }
}
```

### LSTM Neural Networks
For time series and sequential data:
```json
{
  "type": "lstm",
  "hyperparameters": {
    "units": 50,
    "dropout": 0.2,
    "lookBack": 10,
    "epochs": 50
  }
}
```

### Random Forest
For robust predictions with feature importance:
```json
{
  "type": "random_forest",
  "hyperparameters": {
    "nTrees": 100,
    "maxDepth": 10,
    "minSamplesLeaf": 5
  }
}
```

## Optimization Types

### Workflow Optimization
- **Parallelization**: Identify steps that can run in parallel
- **Caching**: Implement result caching for repeated operations
- **Resource Optimization**: Optimize CPU, memory, and network usage
- **Error Reduction**: Implement error prevention mechanisms

### Resource Optimization
- **Right-sizing**: Optimize resource allocation based on usage patterns
- **Load Balancing**: Distribute workload for optimal performance
- **Scaling Strategies**: Auto-scaling recommendations
- **Cost Reduction**: Minimize resource costs while maintaining performance

### Performance Optimization
- **Bottleneck Identification**: Find and eliminate performance bottlenecks
- **Query Optimization**: Database and API query performance improvements
- **Network Optimization**: Reduce network latency and bandwidth usage
- **Memory Management**: Optimize memory allocation and garbage collection

### Cost Optimization
- **Reserved Instances**: Identify opportunities for cost-effective reservations
- **Unused Resources**: Find and eliminate unused or underutilized resources
- **Storage Optimization**: Optimize storage costs and performance
- **Service Optimization**: Right-size cloud services and instances

## Advanced Features

### Feature Engineering
- Automatic feature extraction from raw data
- Feature importance analysis and ranking
- Correlation analysis and feature selection
- Time-based feature creation (hour, day, season)

### Model Explainability
- Feature importance scores
- Prediction confidence intervals
- Model decision boundaries
- What-if analysis capabilities

### Experiment Management
- A/B testing for different models
- Hyperparameter optimization
- Cross-validation and performance tracking
- Model comparison and selection

### Data Pipeline
- Automated data preprocessing
- Missing value handling
- Outlier detection and handling
- Data validation and quality checks

## Performance & Scalability

### Horizontal Scaling
- Stateless API design
- WebSocket clustering support
- Database connection pooling
- Load balancer compatibility

### Caching Strategy
- Prediction result caching
- Model caching for fast inference
- Feature store for reusable features
- Redis integration for distributed caching

### Performance Monitoring
- Built-in performance metrics
- Model inference latency tracking
- Resource usage monitoring
- Bottleneck identification

## Security & Privacy

### Data Protection
- Sensitive data encryption
- Model access controls
- Audit logging
- GDPR compliance options

### API Security
- Rate limiting
- Authentication and authorization
- Input validation and sanitization
- Security headers

## Development

### Running in Development
```bash
npm run dev
```

### Testing
```bash
npm test
npm run test:coverage
```

### Model Training
```bash
npm run train
```

### Model Evaluation
```bash
npm run evaluate
```

## Production Deployment

### Docker Support
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3010
CMD ["npm", "start"]
```

### Environment Variables
```env
NODE_ENV=production
LOG_LEVEL=info
ENABLE_GPU=true
MAX_CONCURRENT_PREDICTIONS=500
ENABLE_MODEL_VERSIONING=true
```

### Monitoring
- Prometheus metrics integration
- Health check endpoints
- Performance dashboards
- Alert integration

## Troubleshooting

### Common Issues

1. **Model Training Failures**
   - Check data quality and quantity
   - Verify hyperparameter settings
   - Monitor memory usage during training

2. **Low Prediction Accuracy**
   - Increase training data size
   - Try different algorithms
   - Perform feature engineering
   - Check for data drift

3. **High Memory Usage**
   - Enable model cleanup
   - Optimize batch sizes
   - Use model caching strategically

### Debug Mode
Enable debug logging:
```env
LOG_LEVEL=debug
DEBUG_MODEL_OUTPUTS=true
```

### Performance Tuning
- Adjust batch sizes for optimal performance
- Use GPU acceleration when available
- Implement model quantization for faster inference
- Monitor and optimize database queries

## Contributing

1. Fork the repository
2. Create a feature branch
3. Implement your changes
4. Add comprehensive tests
5. Update documentation
6. Submit a pull request

## License

MIT License - see LICENSE file for details.