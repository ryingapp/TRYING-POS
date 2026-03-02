#!/bin/bash
cd /opt/trying
source .env

# Login to get a real token
LOGIN_RESULT=$(curl -s -X POST "http://localhost:5000/api/auth/login" -H "Content-Type: application/json" -d '{"email":"cto@tryingapp.com","password":"Admin123!"}')
echo "Login result (first 200):"
echo "$LOGIN_RESULT" | head -c 200
echo ""

TOKEN=$(echo "$LOGIN_RESULT" | node -p "JSON.parse(require('fs').readFileSync(0,'utf8')).token" 2>/dev/null)
if [ -z "$TOKEN" ]; then
  echo "Login failed, cannot continue"
  exit 1
fi
echo "TOKEN: ${TOKEN:0:20}..."

RESULT=$(curl -s "http://localhost:5000/api/kitchen/orders?branch=19894740-20d9-45a4-ba58-175444c84f3f" -H "Authorization: Bearer $TOKEN")
echo "Raw (first 300):"
echo "$RESULT" | head -c 300
echo ""
echo "---"

echo "$RESULT" | node -e "
const d=require('fs').readFileSync(0,'utf8');
try {
  const j=JSON.parse(d);
  if (Array.isArray(j)) {
    console.log('Total orders:', j.length);
    j.forEach(o => {
      console.log('  Order:', (o.id||'').slice(0,8), 'status='+o.status, 'num='+o.orderNumber, 'items='+(o.items?o.items.length:0));
    });
  } else {
    console.log('Not array:', JSON.stringify(j).slice(0,200));
  }
} catch(e) { console.log('Parse error:', e.message); }
"

echo ""
echo "=== Test status update ==="
ORDERID=$(echo "$RESULT" | node -e "try{const d=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(Array.isArray(d)&&d[0]?d[0].id:'')}catch(e){}")
if [ -n "$ORDERID" ]; then
  echo "Updating order $ORDERID to preparing..."
  curl -s -X PUT "http://localhost:5000/api/orders/$ORDERID/status" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"status":"preparing"}' | head -c 200
  echo ""
else
  echo "No orders to test"
fi
