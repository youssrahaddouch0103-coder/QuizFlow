FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY nginx/quizflow-locations.conf /etc/nginx/quizflow-locations.conf
# Script lancé au démarrage de nginx : active HTTPS si un certificat est fourni (voir microsoft/README.md).
COPY nginx/https.sh /docker-entrypoint.d/40-quizflow-https.sh
RUN sed -i 's/\r$//' /docker-entrypoint.d/40-quizflow-https.sh && chmod +x /docker-entrypoint.d/40-quizflow-https.sh
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80 443
