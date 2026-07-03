// api.js – Reads/writes transactions to FlashAza's Supabase database
// and calls the live FlashAza API for Add Money (process.php)
require('dotenv').config();
const https = require('https');
const http  = require('http');

// ─── Supabase config (from .env) ────────────────────────────────────────────
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const FLASHAZA_UID = (process.env.APP_USER_ID || '').trim();

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[api.js] ⚠️  SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in .env');
}

// ─── Generic Supabase REST helper ───────────────────────────────────────────
function supabaseRequest(method, path, body = null, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const url    = `${SUPABASE_URL}/rest/v1${path}`;
    const parsed = new URL(url);
    const isHttps = parsed.protocol === 'https:';
    const lib    = isHttps ? https : http;

    const options = {
      hostname: parsed.hostname,
      port:     parsed.port || (isHttps ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      method,
      headers: {
        'apikey':        SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type':  'application/json',
        'Accept':        'application/json',
        ...extraHeaders,
      },
    };

    const req = lib.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => (raw += chunk));
      res.on('end', () => {
        console.log(`[Supabase] ${method} ${path.substring(0, 80)} → HTTP ${res.statusCode}`);
        if (res.statusCode < 200 || res.statusCode >= 300) {
          console.error(`[Supabase] Error body: ${raw.substring(0, 300)}`);
          return reject(new Error(`Supabase ${method} → HTTP ${res.statusCode}: ${raw.substring(0, 200)}`));
        }
        try {
          resolve(raw ? JSON.parse(raw) : []);
        } catch {
          resolve(raw);
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ─── Generic HTTP POST helper (for calling FlashAza endpoints) ──────────────
function httpPost(url, jsonBody, cookie) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === 'https:';
    const lib = isHttps ? https : http;
    const bodyStr = JSON.stringify(jsonBody);

    const options = {
      hostname: parsed.hostname,
      port:     parsed.port || (isHttps ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      method:   'POST',
      headers: {
        'Content-Type':  'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        'Cookie':        cookie || '',
      },
    };

    const req = lib.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => (raw += chunk));
      res.on('end', () => {
        console.log(`[FlashAza API] POST ${parsed.pathname} → HTTP ${res.statusCode}`);
        try {
          resolve({ status: res.statusCode, body: raw ? JSON.parse(raw) : {}, raw });
        } catch {
          resolve({ status: res.statusCode, body: {}, raw });
        }
      });
    });

    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

// ─── List ALL users (for /debug command) ────────────────────────────────────
async function listAllUsers() {
  const path = `/users?select=uid,name,number,email,plan&order=id.asc&limit=20`;
  const rows = await supabaseRequest('GET', path);
  if (!Array.isArray(rows)) throw new Error('Unexpected response from Supabase');
  return rows;
}

// ─── Fetch last N transactions for this FlashAza user ───────────────────────
async function fetchTransactions(limit = 5) {
  if (!FLASHAZA_UID) throw new Error('APP_USER_ID is not set in .env');

  const uid  = encodeURIComponent(FLASHAZA_UID);
  const path = `/history?select=*&uid=eq.${uid}&order=id.desc&limit=${limit}`;

  console.log(`[api.js] Fetching transactions for uid="${FLASHAZA_UID}" ...`);
  const rows = await supabaseRequest('GET', path);
  if (!Array.isArray(rows)) throw new Error('Unexpected response from Supabase');
  console.log(`[api.js] Found ${rows.length} transaction(s).`);
  return rows;
}

// ─── Fetch a single transaction by product_id ───────────────────────────────
async function fetchTransactionByProductId(productId) {
  const uid  = encodeURIComponent(FLASHAZA_UID);
  const pid  = encodeURIComponent(productId);
  const path = `/history?select=*&uid=eq.${uid}&product_id=eq.${pid}&limit=1`;

  const rows = await supabaseRequest('GET', path);
  if (Array.isArray(rows) && rows.length > 0) return rows[0];
  return null;
}

// ═════════════════════════════════════════════════════════════════════════════
//  ADD MONEY — calls the real FlashAza process.php endpoint
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Calls the real FlashAza process.php endpoint to add money.
 * This is the same API the add-money.php page calls.
 *
 * @param {Object} params
 * @param {string} params.accountname   - Sender name
 * @param {string} params.accountnumber - Sender account number
 * @param {string} params.bankname      - Sender bank name
 * @param {number} params.amount        - Amount
 * @param {string} [params.narration]   - Optional narration
 * @param {string} [params.url]         - Optional bank logo URL
 * @returns {Promise<Object>} The inserted transaction row from Supabase
 */
async function addMoney({ accountname, accountnumber, bankname, amount, narration = '', url = '' }) {
  const BACKEND_URL    = (process.env.BACKEND_URL || '').replace(/\/$/, '');
  const SESSION_COOKIE = process.env.SESSION_COOKIE || '';

  if (!BACKEND_URL) throw new Error('BACKEND_URL is not set in .env');
  if (!SESSION_COOKIE) throw new Error('SESSION_COOKIE is not set in .env');

  const processUrl = `${BACKEND_URL}/process.php`;
  const payload = {
    amount:        parseFloat(amount),
    accountnumber,
    accountname,
    bankname,
    narration,
    url,
    scheduleOn:   false,
    scheduleTime: '',
  };

  console.log(`[api.js] Calling process.php: ₦${amount} from ${accountname} (${bankname})`);

  const result = await httpPost(processUrl, payload, `PHPSESSID=${SESSION_COOKIE}`);

  console.log(`[api.js] process.php response:`, JSON.stringify(result.body).substring(0, 300));

  // Check if the API returned an error
  if (result.status >= 400 || result.body.status === false) {
    const errMsg = result.body.message || result.body.error || result.raw?.substring(0, 200) || 'Unknown error';
    throw new Error(`FlashAza process.php failed: ${errMsg}`);
  }

  // process.php returns { status: true, redirect: "opy-receipt.php?product_id=XXXXX" }
  // or { status: true, redirect: "dashboard.php" }
  // Extract product_id from the redirect URL if present
  let productId = null;
  const redirect = result.body.redirect || '';
  const match = redirect.match(/product_id=([^&]+)/);
  if (match) {
    productId = match[1];
  }

  // Fetch the newly created transaction from Supabase
  // Try by product_id first, then fall back to most recent
  let transaction = null;
  if (productId) {
    console.log(`[api.js] Fetching inserted transaction: product_id=${productId}`);
    transaction = await fetchTransactionByProductId(productId);
  }

  if (!transaction) {
    // Fallback: get the most recent transaction
    console.log(`[api.js] Fetching most recent transaction as fallback...`);
    const recent = await fetchTransactions(1);
    transaction = recent?.[0] || null;
  }

  if (!transaction) {
    throw new Error('Add Money succeeded but could not find the transaction in history.');
  }

  console.log(`[api.js] Add Money done — id=${transaction.id}, product_id=${transaction.product_id}`);
  return transaction;
}

// ═════════════════════════════════════════════════════════════════════════════
//  TRANSFER — inserts directly into Supabase (loader.php uses form POST,
//  which is harder to call from Node.js, so we replicate its logic)
// ═════════════════════════════════════════════════════════════════════════════

function generateRandomNumber(len) {
  let r = '';
  for (let i = 0; i < len; i++) r += Math.floor(Math.random() * 10);
  return r;
}

function generateReference(len) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let r = '';
  for (let i = 0; i < len; i++) r += chars[Math.floor(Math.random() * chars.length)];
  return r;
}

function formatFlashAzaDates(dateObj) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const d = dateObj || new Date();
  const day = d.getDate();
  const suffix = [11,12,13].includes(day) ? 'th' : ({1:'st',2:'nd',3:'rd'}[day%10] || 'th');
  const mon = months[d.getMonth()];
  const year = d.getFullYear();
  const H = String(d.getHours()).padStart(2, '0');
  const M = String(d.getMinutes()).padStart(2, '0');
  const S = String(d.getSeconds()).padStart(2, '0');

  const monthNum = String(d.getMonth() + 1).padStart(2, '0');
  const dayPad   = String(day).padStart(2, '0');
  const time1 = `${monthNum}-${dayPad} ${H}:${M}:${S}`;

  const d2 = new Date(d.getTime() + 5000);
  const H2 = String(d2.getHours()).padStart(2, '0');
  const M2 = String(d2.getMinutes()).padStart(2, '0');
  const S2 = String(d2.getSeconds()).padStart(2, '0');
  const time3 = `${String(d2.getMonth() + 1).padStart(2, '0')}-${String(d2.getDate()).padStart(2, '0')} ${H2}:${M2}:${S2}`;

  return {
    date3: `${mon} ${String(day).padStart(2, '0')}, ${year} ${H}:${M}`,
    time:  `${H}:${M}`,
    date1: `${mon} ${day}${suffix}, ${H}:${M}:${S}`,
    date2: `${mon} ${day}${suffix}, ${year} ${H}:${M}:${S}`,
    time1,
    time3,
  };
}

/**
 * Creates a transfer (sent) transaction directly in Supabase.
 * Mirrors loader.php logic.
 */
async function insertTransfer({ accountname, accountnumber, bankname, amount, narration = '', url = '' }) {
  if (!FLASHAZA_UID) throw new Error('APP_USER_ID is not set in .env');

  const now = new Date();
  const dates = formatFlashAzaDates(now);
  const sid        = generateRandomNumber(29);
  const tid        = generateRandomNumber(24);
  const product_id = generateReference(15);

  const row = {
    accountname, accountnumber, bankname,
    amount:     parseFloat(amount),
    narration,
    date3: dates.date3, time: dates.time,
    time1: dates.time1, time3: dates.time3,
    date1: dates.date1, date2: dates.date2,
    category: 'money', type: 'sent', url,
    sid, status: 'success', tid, product_id,
    uid: FLASHAZA_UID,
  };

  console.log(`[api.js] Inserting transfer: ₦${amount} → ${accountname} (${bankname})`);

  const result = await supabaseRequest('POST', '/history', row, {
    'Prefer': 'return=representation',
  });

  const inserted = Array.isArray(result) ? result[0] : result;
  console.log(`[api.js] Inserted transfer — id=${inserted?.id}, product_id=${product_id}`);

  // Update user balance (deduct)
  try {
    const userPath = `/users?select=balance,amount_out&uid=eq.${encodeURIComponent(FLASHAZA_UID)}&limit=1`;
    const users = await supabaseRequest('GET', userPath);
    if (Array.isArray(users) && users.length > 0) {
      const user = users[0];
      const newBalance   = parseFloat(user.balance || 0) - parseFloat(amount);
      const newAmountOut = parseFloat(user.amount_out || 0) + parseFloat(amount);
      await supabaseRequest(
        'PATCH',
        `/users?uid=eq.${encodeURIComponent(FLASHAZA_UID)}`,
        { balance: newBalance, amount_out: newAmountOut }
      );
      console.log(`[api.js] Updated user balance (sent): ${newBalance}`);
    }
  } catch (err) {
    console.error(`[api.js] Warning: failed to update user balance: ${err.message}`);
  }

  return inserted;
}

module.exports = { fetchTransactions, insertTransfer, addMoney, listAllUsers };
