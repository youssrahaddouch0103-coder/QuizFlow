#!/bin/sh
# Active HTTPS (port 443 du conteneur, https://localhost:3443 sur le PC) seulement si un certificat
# a été copié dans le dossier certs/ du projet. Sinon le site reste en HTTP, comme avant.
if [ -f /etc/nginx/certs/localhost.crt ] && [ -f /etc/nginx/certs/localhost.key ]; then
  cat > /etc/nginx/conf.d/https.conf <<'CONF'
server {
  listen 443 ssl;
  ssl_certificate /etc/nginx/certs/localhost.crt;
  ssl_certificate_key /etc/nginx/certs/localhost.key;
  include /etc/nginx/quizflow-locations.conf;
}
CONF
  echo "QuizFlow : HTTPS actif (https://localhost:3443)"
else
  rm -f /etc/nginx/conf.d/https.conf
fi
