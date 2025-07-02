FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source files
COPY . .

# Build the project
RUN npm install typescript && npm run build || echo "Build step skipped"

# Create non-root user
RUN addgroup -g 1001 -S mcpuser && \
    adduser -S mcpuser -u 1001

USER mcpuser

CMD ["node", "dist/index.js"]