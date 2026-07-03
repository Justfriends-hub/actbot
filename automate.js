// automate.js — Auto Add Money: every ~1 min, picks 2 random names,
// calls process.php (same route as the Add Money button), takes receipt
// screenshot from from-bnk-receipt.php, sends to chat.
const { addMoney } = require('./api');
const { takeFlashAzaScreenshot } = require('./screenshot');
const {
  randomName, randomAccountNumber, randomAmount, randomNarration, pickSafeBank,
} = require('./names');

// ─── State ──────────────────────────────────────────────────────────────────
let intervalId    = null;
let isRunning     = false;
let bot           = null;   // Telegram bot instance (set via init)
let targetChatId  = null;   // chat to send receipts to
let cycleCount    = 0;
// persisted config while automation is running
let fixedSenderName = null;
let fixedNarration  = null;

// ─── Config ─────────────────────────────────────────────────────────────────
const INTERVAL_MS    = 60 * 1000;   // 1 minute between cycles
const TXN_PER_CYCLE  = 2;           // 2 transactions per cycle
const MIN_AMOUNT     = 300000;
const MAX_AMOUNT     = 980000;
const RECEIPT_STYLE  = 'opay';      // always OPay for auto receipts
const DELAY_BETWEEN  = 10000;       // 10s gap between the 2 txns

// ─── Init ───────────────────────────────────────────────────────────────────
function init(botInstance) {
  bot = botInstance;
}

// ─── Single auto transaction ────────────────────────────────────────────────
async function doOneAutoTransaction(chatId, index) {
  const name    = fixedSenderName || randomName();
  const account = randomAccountNumber();
  const bank    = pickSafeBank();
  const amount  = randomAmount(MIN_AMOUNT, MAX_AMOUNT);
  const narration = (fixedNarration != null && fixedNarration !== '') ? fixedNarration : randomNarration(name);

  const amtFmt = amount.toLocaleString('en-NG', { minimumFractionDigits: 2 });

  console.log(`[auto] #${index} — ₦${amtFmt} from ${name} (${bank.name})`);

  try {
    // ── Step 1: Call process.php (SAME route as the 💰 Add Money button) ──
    // addMoney() calls process.php then fetches the transaction from Supabase
    const tx = await addMoney({
      accountname:   name,
      accountnumber: account,
      bankname:      bank.name,
      amount,
      narration,
      url:           bank.url || '',
    });

    if (!tx || !tx.product_id) {
      await bot.sendMessage(chatId,
        `⚠️ Auto #${index}: Added ₦${amtFmt} from ${name} but could not find transaction for receipt.`
      );
      return;
    }

    // ── Step 2: Ensure type is 'received' ──
    // process.php inserts with type='received' but just in case the DB
    // returns something unexpected, force it since we KNOW this is Add Money
    console.log(`[auto] #${index} — tx.id=${tx.id}, product_id=${tx.product_id}, type="${tx.type}"`);
    if (tx.type !== 'received') {
      console.log(`[auto] #${index} — WARNING: tx.type was "${tx.type}", forcing to "received"`);
      tx.type = 'received';
    }

    // ── Step 3: Take receipt screenshot ──
    // EXPLICITLY use from-bnk-receipt.php for Add Money receipts
    // (Transfer from, Sender Details, Bank Deposit — NO timeline)
    console.log(`[auto] #${index} — Taking screenshot from from-bnk-receipt.php`);
    const screenshotBuffer = await takeFlashAzaScreenshot(RECEIPT_STYLE, tx, 'from-bnk-receipt.php');

    // ── Step 4: Send receipt photo to chat ──
    await bot.sendPhoto(
      chatId,
      screenshotBuffer,
      {
        caption:
          `🤖 *Auto Add Money*\n\n` +
          `💵 Amount: ₦${amtFmt}\n` +
          `👤 From: ${name}\n` +
          `🏦 Bank: ${bank.name}\n` +
          `🔢 Account: ${account}\n` +
          `📝 Narration: ${narration}`,
        parse_mode: 'Markdown',
      },
      { filename: 'receipt.png', contentType: 'image/png' }
    );

    console.log(`[auto] #${index} — Receipt sent ✓`);

  } catch (err) {
    console.error(`[auto] #${index} ERROR:`, err.message);
    try {
      await bot.sendMessage(chatId,
        `❌ Auto #${index} failed: ${err.message}\n\nℹ️ Automation continues...`
      );
    } catch { /* ignore send errors */ }
  }
}

// ─── Run one cycle (2 transactions) ─────────────────────────────────────────
async function runCycle() {
  if (!isRunning || !targetChatId) return;

  cycleCount++;
  console.log(`[auto] ═══ Cycle #${cycleCount} starting (${TXN_PER_CYCLE} transactions) ═══`);

  for (let i = 1; i <= TXN_PER_CYCLE; i++) {
    if (!isRunning) break; // stopped mid-cycle

    await doOneAutoTransaction(targetChatId, `${cycleCount}.${i}`);

    // Wait between transactions (except after the last one)
    if (i < TXN_PER_CYCLE && isRunning) {
      await new Promise(r => setTimeout(r, DELAY_BETWEEN));
    }
  }
}

// ─── Start / Stop ───────────────────────────────────────────────────────────

function start(chatId) {
  // accept optional config as second argument: { accountname, narration }
  if (isRunning) return { already: true };
  const config = arguments[1] || {};
  fixedSenderName = config.accountname || null;
  fixedNarration  = typeof config.narration !== 'undefined' ? config.narration : null;

  targetChatId = chatId;
  isRunning    = true;
  cycleCount   = 0;

  console.log(`[auto] Started — chatId=${chatId}, interval=${INTERVAL_MS}ms, txn/cycle=${TXN_PER_CYCLE}`);

  // Run the first cycle immediately
  runCycle();

  // Then repeat every INTERVAL_MS
  intervalId = setInterval(() => {
    runCycle();
  }, INTERVAL_MS);

  return { already: false };
}

function stop() {
  if (!isRunning) return { wasStopped: false };

  isRunning = false;
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }

  const total = cycleCount;
  cycleCount   = 0;
  targetChatId = null;

  // clear persisted config
  fixedSenderName = null;
  fixedNarration  = null;

  console.log(`[auto] Stopped after ${total} cycles`);
  return { wasStopped: true, cycles: total };
}

function status() {
  return {
    running:   isRunning,
    cycles:    cycleCount,
    interval:  INTERVAL_MS / 1000,
    perCycle:  TXN_PER_CYCLE,
    minAmount: MIN_AMOUNT,
    maxAmount: MAX_AMOUNT,
  };
}

module.exports = { init, start, stop, status };
