#!/bin/bash
set -e

echo "========================================="
echo "  TRYING - Production Deployment Script"
echo "========================================="

APP_DIR="/opt/trying"
DB_URL="${DATABASE_URL:-postgresql://neondb_owner:npg_41htWOCBVKyn@ep-blue-bush-aibgf4j4-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require}"
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

# Extract the uploaded archive
if [ -f /tmp/trying-deploy.tar.gz ]; then
    tar -xzf /tmp/trying-deploy.tar.gz -C $APP_DIR
    rm /tmp/trying-deploy.tar.gz
fi

# 5. Install production dependencies
echo "[5/8] Installing dependencies..."
npm install --production=false

# 6. Create environment file
echo "[6/8] Creating environment file..."
cat > $APP_DIR/.env << EOF
DATABASE_URL=$DB_URL
NODE_ENV=production
PORT=$PORT
JWT_SECRET=$(openssl rand -base64 32)
CORS_ORIGIN=https://$DOMAIN
EOF

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
echo "[8/8] Configuring Nginx..."
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
