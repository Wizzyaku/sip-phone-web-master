import { randomUUID } from 'crypto';

const secretKey = process.env.KORAPAY_SECRET_KEY;
if (!secretKey) {
  console.error('Set KORAPAY_SECRET_KEY environment variable first.');
  process.exit(1);
}

const email = process.env.TEST_EMAIL || 'test@example.com';
const name = process.env.TEST_NAME || 'Test Customer';

const variations = [
  {
    label: 'Minimal: 1000 NGN',
    payload: {
      amount: 1000,
      currency: 'NGN',
      reference: `KPY${randomUUID().replace(/-/g, '').slice(0, 16)}`,
      customer: { email },
    },
  },
  {
    label: 'Full payload matching app: 1000 NGN',
    payload: {
      amount: 1000,
      currency: 'NGN',
      reference: `KPY${randomUUID().replace(/-/g, '').slice(0, 16)}`,
      customer: { email, name },
      redirect_url: 'https://sip-phone-web.vercel.app/billing',
      metadata: { userId: 'test-user-id', tokens: '1000' },
    },
  },
];

async function testVariation({ label, payload }) {
  console.log('\n--- Test:', label, '---');
  console.log('Payload:', JSON.stringify(payload, null, 2));

  try {
    const response = await fetch('https://api.korapay.com/merchant/api/v1/charges/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Fetch error:', err.message);
  }
}

(async () => {
  for (const variation of variations) {
    await testVariation(variation);
  }
})();
