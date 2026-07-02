#!/bin/bash
# ─────────────────────────────────────────────────────────────
#  MyCashBridge Instant Loan — Deploy Script
#  Usage: bash deploy.sh
#  Run from: /var/www/instantloan  (on the server)
# ─────────────────────────────────────────────────────────────

set -e  # exit immediately if any command fails

APP_DIR="/var/www/instantloan"
APP_NAME="instantloan"   # PM2 process name

echo "▶ Pulling latest code from git..."
cd "$APP_DIR"
git pull origin main

echo "▶ Installing / updating dependencies..."
npm install --omit=dev

echo "▶ Restarting app with PM2..."
# If PM2 process already exists → reload (zero-downtime)
# If it doesn't exist yet       → start it fresh
if pm2 describe "$APP_NAME" > /dev/null 2>&1; then
  pm2 reload "$APP_NAME" --update-env
else
  pm2 start server.js --name "$APP_NAME" --env production
  pm2 save   # persist across server reboots
fi

echo "✔ Deployment complete."
pm2 status "$APP_NAME"
