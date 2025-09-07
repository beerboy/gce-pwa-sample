# Use the official Nginx image from Docker Hub
FROM nginx:alpine

# Copy the PWA files to the default Nginx public directory
COPY ./pwa/ /usr/share/nginx/html/

# Expose port 80
EXPOSE 80
