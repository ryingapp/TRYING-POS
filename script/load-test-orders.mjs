/*
  Lightweight order creation load test
  Usage:
    BASE_URL=https://tryingpos.com API_EMAIL=owner@example.com API_PASSWORD=secret node script/load-test-orders.mjs
    or provide API_TOKEN directly.
*/

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const API_TOKEN = process.env.API_TOKEN || '';
const API_EMAIL = process.env.API_EMAIL || '';
const API_PASSWORD = process.env.API_PASSWORD || '';
const CONCURRENCY = Number(process.env.CONCURRENCY || 10);
const REQUESTS = Number(process.env.REQUESTS || 200);

if (!API_TOKEN && (!API_EMAIL || !API_PASSWORD)) {
  console.error('Provide API_TOKEN or API_EMAIL + API_PASSWORD');
  process.exit(1);
}

async function login() {
  if (API_TOKEN) return API_TOKEN;

  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email: API_EMAIL, password: API_PASSWORD }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Login failed: ${res.status} ${body}`);
  }

  const data = await res.json();
  if (!data?.token) throw new Error('Login response does not include token');
  return data.token;
}

function buildOrderPayload(index) {
  const subtotal = 10 + (index % 11);
  const tax = +(subtotal * 0.15).toFixed(2);
  const total = +(subtotal + tax).toFixed(2);
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);

  return {
    orderNumber: `LT-${stamp}-${String(index).padStart(6, '0')}`,
    orderType: 'delivery',
    status: 'pending',
    customerName: `Load Test ${index}`,
    customerPhone: `05${String(10000000 + (index % 90000000)).padStart(8, '0')}`,
    customerAddress: 'Load Testing Address',
    subtotal: String(subtotal.toFixed(2)),
    discount: '0',
    deliveryFee: '0',
    tax: String(tax.toFixed(2)),
    total: String(total.toFixed(2)),
    paymentMethod: 'cash',
    isPaid: true,
    notes: 'load-test',
  };
}

async function run() {
  const token = await login();

  let cursor = 0;
  let success = 0;
  let failed = 0;
  const latencies = [];

  async function worker(workerId) {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= REQUESTS) break;

      const payload = buildOrderPayload(index);
      const start = Date.now();

      try {
        const res = await fetch(`${BASE_URL}/api/orders`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
            'X-Idempotency-Key': `load-${workerId}-${index}`,
          },
          body: JSON.stringify(payload),
        });

        const elapsed = Date.now() - start;
        latencies.push(elapsed);

        if (!res.ok) {
          failed += 1;
          const body = await res.text();
          console.error(`[${workerId}] request ${index} failed: ${res.status} ${body}`);
          continue;
        }

        success += 1;
      } catch (error) {
        failed += 1;
        console.error(`[${workerId}] request ${index} error:`, error.message || error);
      }
    }
  }

  const startedAt = Date.now();
  await Promise.all(Array.from({ length: CONCURRENCY }, (_, idx) => worker(idx + 1)));
  const totalMs = Date.now() - startedAt;

  latencies.sort((a, b) => a - b);
  const p = (q) => {
    if (latencies.length === 0) return 0;
    const position = Math.min(latencies.length - 1, Math.floor((q / 100) * latencies.length));
    return latencies[position];
  };

  const throughput = totalMs > 0 ? ((success + failed) / (totalMs / 1000)).toFixed(2) : '0';

  console.log('--- Load Test Summary ---');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Requests: ${REQUESTS}`);
  console.log(`Concurrency: ${CONCURRENCY}`);
  console.log(`Success: ${success}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total time: ${totalMs} ms`);
  console.log(`Throughput: ${throughput} req/s`);
  console.log(`Latency p50: ${p(50)} ms`);
  console.log(`Latency p90: ${p(90)} ms`);
  console.log(`Latency p99: ${p(99)} ms`);

  if (failed > 0) {
    process.exitCode = 2;
  }
}

run().catch((error) => {
  console.error('Load test crashed:', error);
  process.exit(1);
});
