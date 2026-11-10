# Build stage
FROM node:22-alpine AS build
WORKDIR /app
ARG NPM_REGISTRY=https://nexus.digi-texx.vn/repository/npm/
RUN npm config set registry "$NPM_REGISTRY"
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Serve stage: static files only, no Node at runtime
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
# The stock config listens on 80; serve on 3000 instead.
RUN sed -i 's/^\(\s*listen\s\+\)80;/\13000;/' /etc/nginx/conf.d/default.conf
EXPOSE 3000
