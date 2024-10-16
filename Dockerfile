# Stage 1: Build the application
FROM node:alpine as build-stage

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the application (this compiles the JavaScript)
RUN npm run build

# Stage 2: Setup Nginx and Express
FROM node:alpine as production-stage

# Create a new user to avoid running as root
RUN addgroup -S app && adduser -S app -G app

WORKDIR /app

# Copy the built application from the build stage
COPY --from=build-stage /app/dist ./dist

# Copy the rest of the application code (including views and public)
COPY --from=build-stage /app/src ./src
COPY --from=build-stage /app/package*.json ./

# Install only production dependencies
RUN npm install --production

# Expose port 3000 for the Express server
EXPOSE 3000

# Start the Express server
CMD ["node", "src/server.js"]
