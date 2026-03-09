#!/bin/bash
set -e

echo "========================================="
echo "  TRYING - Production Deployment Script"
echo "========================================="

APP_DIR="/opt/trying"
DB_URL="${DATABASE_URL:?DATABASE_URL environment variable is required}"
DOMAIN="tryingpos.com"
PORT=5000

# 1. System update & install dependencies
echo "[1/8] Updating system packages..."
apt-get update -y && apt-get upgrade -y
apt-get install -y curl nginx certbot python3-certbot-nginx

# 2. Install Node.js 20 LTS if not present
if ! command -v node &> /dev/null || [[ $(node -v | cut -d'.' -f1 | tr -d 'v') -lt 20 ]]; then
    echo "[2/8] Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
else
    echo "[2/8] Node.js $(node -v) already installed"
fi

# 3. Install PM2 globally
echo "[3/8] Installing PM2..."
npm install -g pm2

# 4. Setup application directory
echo "[4/8] Setting up application..."
mkdir -p $APP_DIR
cd $APP_DIR

# IMPORTANT: Read JWT_SECRET BEFORE extracting archive (archive may overwrite .env)
EXISTING_JWT=""
if [ -f $APP_DIR/.env ]; then
  EXISTING_JWT=$(grep '^JWT_SECRET=' $APP_DIR/.env | cut -d'=' -f2-)
  echo "  Preserved existing JWT_SECRET"
fi

# Extract the uploaded archive
if [ -f /tmp/trying-deploy.tar.gz ]; then
    tar -xzf /tmp/trying-deploy.tar.gz --exclude='.env' -C $APP_DIR
    rm /tmp/trying-deploy.tar.gz
fi

# 5. Install production dependencies
echo "[5/8] Installing dependencies..."
npm install --production=false

# 5.5. Build client for production
echo "[5.5/8] Building client..."
npx vite build 2>&1 || echo "  ⚠️ Client build failed, using existing build"

# 6. Create environment file (preserve JWT_SECRET across deploys)
echo "[6/8] Creating environment file..."
if [ -z "$EXISTING_JWT" ]; then
  EXISTING_JWT=$(openssl rand -base64 32)
  echo "  Generated new JWT_SECRET"
fi

cat > $APP_DIR/.env << EOF
DATABASE_URL=$DB_URL
NODE_ENV=production
PORT=$PORT
JWT_SECRET=$EXISTING_JWT
CORS_ORIGIN=https://$DOMAIN
EOF

# Load environment variables for migration scripts
export DATABASE_URL=$DB_URL

# Run schema migration fixes if present
if [ -f $APP_DIR/add-cashier-name.cjs ]; then
    echo "[6.5/8] Running schema fixes (cashier_name)..."
    node $APP_DIR/add-cashier-name.cjs || echo "  ⚠️ Schema fix failed/skipped"
fi

# 7. Setup PM2 ecosystem
echo "[7/8] Setting up PM2..."
cat > $APP_DIR/ecosystem.config.cjs << 'PMEOF'
module.exports = {
  apps: [{
    name: "trying",
    script: "npx",
    args: "tsx server/index.ts",
    cwd: "/opt/trying",
    env: {
      NODE_ENV: "production",
      PORT: 5000,
    },
    env_file: "/opt/trying/.env",
    instances: 1,
    exec_mode: "fork",
    max_memory_restart: "512M",
    autorestart: true,
    watch: false,
    log_date_format: "YYYY-MM-DD HH:mm:ss",
    error_file: "/var/log/trying-error.log",
    out_file: "/var/log/trying-out.log",
    merge_logs: true,
  }]
};
PMEOF

# Load env and start with PM2
set -a; source $APP_DIR/.env; set +a
pm2 delete trying 2>/dev/null || true
pm2 start $APP_DIR/ecosystem.config.cjs
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || true

# 8. Setup Nginx
echo "[8/9] Configuring Nginx..."
cat > /etc/nginx/sites-available/trying << NGINXEOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
        client_max_body_size 10M;
    }
}
NGINXEOF

ln -sf /etc/nginx/sites-available/trying /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

# 9. Setup automated database backups
echo "[9/9] Setting up automated backups..."
apt-get install -y postgresql-client
chmod +x $APP_DIR/backup-db.sh $APP_DIR/restore-db.sh $APP_DIR/setup-backup.sh
$APP_DIR/setup-backup.sh

echo ""
echo "========================================="
echo "  Deployment Complete!"
echo "========================================="
echo "  App running on: http://$DOMAIN"
echo "  PM2 status: pm2 status"
echo "  Logs: pm2 logs trying"
echo ""
echo "  To add SSL, make sure DNS points to this server then run:"
echo "  certbot --nginx -d $DOMAIN -d www.$DOMAIN"
echo "========================================="
