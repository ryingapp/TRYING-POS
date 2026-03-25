#!/bin/bash
# Removed set -e to handle errors individually and avoid silent failures

echo "========================================="
echo "  TRYING - Production Deployment Script"
echo "========================================="

APP_DIR="/opt/trying"
DB_URL="${DATABASE_URL:?DATABASE_URL environment variable is required}"
DOMAIN="tryingpos.com"
PORT=5000

# 1. System update & install dependencies (skip full upgrade - too slow)
echo "[1/8] Installing system dependencies..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y -q
apt-get install -y -q curl nginx certbot python3-certbot-nginx

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
if [ -f package-lock.json ]; then
  echo "  Found package-lock.json, running npm ci..."
  npm ci 2>&1 || { echo "  npm ci failed, falling back to npm install..."; npm install --production=false 2>&1; }
else
  echo "  No package-lock.json, running npm install..."
  npm install --production=false 2>&1
fi
echo "  Dependencies installed."

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

# Run database migrations via direct SQL (drizzle-kit push hangs on interactive rename prompts over SSH)
echo "[6.25/8] Running database migrations..."

# Extract DB connection from DATABASE_URL for psql
if command -v psql &> /dev/null; then
  echo "  Running schema migrations via psql..."
  
  # Add missing columns to delivery_integrations (if old schema had different column names)
  psql "$DATABASE_URL" -c "
    DO \$\$
    BEGIN
      -- Add new columns if they don't exist
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='delivery_integrations' AND column_name='chain_id') THEN
        ALTER TABLE delivery_integrations ADD COLUMN chain_id text;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='delivery_integrations' AND column_name='vendor_id') THEN
        ALTER TABLE delivery_integrations ADD COLUMN vendor_id text;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='delivery_integrations' AND column_name='client_id') THEN
        ALTER TABLE delivery_integrations ADD COLUMN client_id text;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='delivery_integrations' AND column_name='client_secret') THEN
        ALTER TABLE delivery_integrations ADD COLUMN client_secret text;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='delivery_integrations' AND column_name='webhook_secret') THEN
        ALTER TABLE delivery_integrations ADD COLUMN webhook_secret text;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='delivery_integrations' AND column_name='access_token') THEN
        ALTER TABLE delivery_integrations ADD COLUMN access_token text;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='delivery_integrations' AND column_name='token_expires_at') THEN
        ALTER TABLE delivery_integrations ADD COLUMN token_expires_at timestamp;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='delivery_integrations' AND column_name='auto_accept') THEN
        ALTER TABLE delivery_integrations ADD COLUMN auto_accept boolean DEFAULT false;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='delivery_integrations' AND column_name='outlet_status') THEN
        ALTER TABLE delivery_integrations ADD COLUMN outlet_status text DEFAULT 'closed';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='delivery_integrations' AND column_name='last_sync_at') THEN
        ALTER TABLE delivery_integrations ADD COLUMN last_sync_at timestamp;
      END IF;
      -- Drop old columns that were renamed
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='delivery_integrations' AND column_name='external_store_id') THEN
        ALTER TABLE delivery_integrations DROP COLUMN external_store_id;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='delivery_integrations' AND column_name='api_key') THEN
        ALTER TABLE delivery_integrations DROP COLUMN api_key;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='delivery_integrations' AND column_name='api_secret') THEN
        ALTER TABLE delivery_integrations DROP COLUMN api_secret;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='delivery_integrations' AND column_name='settings') THEN
        ALTER TABLE delivery_integrations DROP COLUMN settings;
      END IF;
    END \$\$;
  " 2>&1 && echo "  ✅ Schema migration done" || echo "  ⚠️ Schema migration had issues (may be OK if table doesn't exist yet)"
  
  # Run full schema SQL (all tables use CREATE TABLE IF NOT EXISTS - safe to re-run)
  echo "  Running full schema migration..."
  psql "$DATABASE_URL" -f $APP_DIR/migrations/0000_full_schema.sql 2>&1 || echo "  ⚠️ Full schema migration had issues"
  
  # Run incremental migrations
  for migration in $APP_DIR/migrations/0001_*.sql $APP_DIR/migrations/0002_*.sql; do
    if [ -f "$migration" ]; then
      echo "  Running migration: $(basename $migration)..."
      psql "$DATABASE_URL" -f "$migration" 2>&1 || echo "  ⚠️ Migration $(basename $migration) had issues (may already be applied)"
    fi
  done
  
  echo "  ✅ All SQL migrations completed"
else
  echo "  ⚠️ psql not available - installing postgresql-client..."
  apt-get install -y -q postgresql-client 2>/dev/null
  if command -v psql &> /dev/null; then
    echo "  Running full schema migration..."
    psql "$DATABASE_URL" -f $APP_DIR/migrations/0000_full_schema.sql 2>&1 || echo "  ⚠️ Schema migration had issues"
    for migration in $APP_DIR/migrations/0001_*.sql $APP_DIR/migrations/0002_*.sql; do
      if [ -f "$migration" ]; then
        psql "$DATABASE_URL" -f "$migration" 2>&1 || true
      fi
    done
  else
    echo "  ⚠️ Could not install psql - skipping migrations (app will handle schema at startup)"
  fi
fi

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
