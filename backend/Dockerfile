# Use Node 20 (matches your local version)
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install system dependencies required by pdf2pic
RUN apk add --no-cache \
    graphicsmagick \
    ghostscript

# Copy package files first (better caching)
COPY package*.json ./

# Install only production dependencies
RUN npm install --production

# Copy remaining backend files
COPY . .

# Expose backend port
EXPOSE 8000

# Start the server
CMD ["node", "index.js"]
