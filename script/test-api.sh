#!/bin/bash
# Test tables and inventory API
TOKEN=$(curl -s http://localhost:5000/api/users/login -X POST -H "Content-Type: application/json" -d '{"email":"demo@burgerhouse.sa","password":"Demo@2026"}' | python3 -c "import sys,json; print(json.load(sys.stdin).get('token','NONE'))")
echo "Token: ${TOKEN:0:20}..."

echo "--- Tables ---"
curl -s http://localhost:5000/api/tables -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); print('Count:', len(d) if isinstance(d,list) else d)"

echo "--- Inventory ---"
curl -s http://localhost:5000/api/inventory -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); print('Count:', len(d) if isinstance(d,list) else d)"
