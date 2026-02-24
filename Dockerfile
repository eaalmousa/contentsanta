# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Expose port (Railway will override with PORT env var)
EXPOSE 5000

# Start the application
CMD ["npm", "start"]
