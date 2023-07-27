# Stage 1: Build the Angular application
#FROM node:12 AS build

# Set the working directory in the Docker image
#WORKDIR /app

# Copy the application source code to the Docker image
#COPY . .

# Install project dependencies
#RUN npm install

# Build the Angular application for production
#RUN npm run build --prod

# Stage 2: Set up a web server to serve the static assets
FROM docker.io/nginx:alpine

# Copy the static assets from the build stage to the web server
COPY /dist/santeLib /usr/share/nginx/html

# Expose the web server's port (usually port 80)
EXPOSE 80

# Start the web server
CMD ["nginx", "-g", "daemon off;"] 
