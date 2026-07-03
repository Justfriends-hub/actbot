require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { STEPS, getState, setState, resetState } = require('./state');
const { fetchTransactions, insertTransfer, addMoney, listAllUsers } = require('./api');
const { takeFlashAzaScreenshot } = require('./screenshot');
const automate = require('./automate');

// ─── Validate env vars ────────────────────────────────────────────────────────
const requiredEnv = [
  'TELEGRAM_BOT_TOKEN',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'APP_USER_ID',
  'BACKEND_URL',
  'SESSION_COOKIE',
];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`[ERROR] Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

// Init automation with bot instance
automate.init(bot);

// ─── Persistent keyboard (shown at bottom of chat) ───────────────────────────

const MAIN_KEYBOARD = {
  reply_markup: {
    keyboard: [
      [{ text: '💸 Transfer' }, { text: '💰 Add Money' }, { text: '📋 Send Receipt' }],
      [{ text: '🤖 Auto Add Money' }],
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function send(chatId, text, opts = {}) {
  return bot.sendMessage(chatId, text, { parse_mode: 'Markdown', ...opts });
}

function sendWithKeyboard(chatId, text) {
  return bot.sendMessage(chatId, text, { parse_mode: 'Markdown', ...MAIN_KEYBOARD });
}

function sendError(chatId, msg) {
  resetState(chatId);
  return bot.sendMessage(chatId, `❌ Error: ${msg}\n\nTap a button below to try again.`, MAIN_KEYBOARD);
}

function txLabel(tx) {
  const amt  = Number(tx.amount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 });
  const name = (tx.accountname || 'Unknown').substring(0, 18);
  const bank = (tx.bankname    || '').substring(0, 12);
  const type = tx.type === 'sent' ? '↑' : '↓';
  return `${type} ₦${amt} · ${name} · ${bank}`;
}

function receiptKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '🟢 OPay Style',       callback_data: 'style_opay'       }],
      [{ text: '🔵 Moniepoint Style',  callback_data: 'style_moniepoint' }],
      [{ text: '🟣 Kuda Style',        callback_data: 'style_kuda'       }],
    ],
  };
}

// ─── /start ──────────────────────────────────────────────────────────────────

bot.onText(/\/start/, (msg) => {
  resetState(msg.chat.id);
  sendWithKeyboard(
    msg.chat.id,
    `👋 *Welcome to the FlashAza Bot!*\n\n` +
    `Use the buttons below:\n\n` +
    `💸 *Transfer* — Send money & get receipt\n` +
    `💰 *Add Money* — Add money & get receipt\n` +
    `📋 *Send Receipt* — Pick an existing transaction\n` +
    `🤖 *Auto Add Money* — Auto-generate receipts every 1 min\n\n` +
    `_Use /cancel to stop any flow._`
  );
});

// ─── /cancel ─────────────────────────────────────────────────────────────────

bot.onText(/\/cancel/, (msg) => {
  const chatId = msg.chat.id;
  const { step } = getState(chatId);
  resetState(chatId);
  if (step === STEPS.IDLE) {
    sendWithKeyboard(chatId, 'ℹ️ No active flow to cancel.');
  } else {
    sendWithKeyboard(chatId, '🚫 Cancelled.');
  }
});

// ─── /debug ──────────────────────────────────────────────────────────────────

bot.onText(/\/debug/, async (msg) => {
  const chatId = msg.chat.id;
  await send(chatId, '🔍 Fetching all FlashAza users from Supabase...');

  try {
    const users = await listAllUsers();
    if (!users || users.length === 0) {
      return send(chatId, '⚠️ *No users found in Supabase.*');
    }

    let msg2 = `📋 *FlashAza Users (${users.length}):*\n\n`;
    users.forEach((u, i) => {
      const name = (u.name || 'Unknown').replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
      msg2 += `${i + 1}\\. uid: \`${u.uid}\`\n   Name: ${name}\n\n`;
    });
    await send(chatId, msg2);
  } catch (err) {
    console.error('[ERROR] /debug:', err.message);
    send(chatId, `❌ Supabase error:\n\`${err.message}\``);
  }
});

// ═════════════════════════════════════════════════════════════════════════════
//  Text message handler — drives keyboard buttons & multi-step flows
// ═════════════════════════════════════════════════════════════════════════════

bot.on('message', async (msg) => {
  if (!msg.text) return;

  const chatId = msg.chat.id;
  const text   = msg.text.trim();
  const { step, data } = getState(chatId);

  // ── Keyboard button: 🤖 Auto Add Money ──
  if (text === '🤖 Auto Add Money') {
    const st = automate.status();
    if (st.running) {
      // Stop automation
      const result = automate.stop();
      return sendWithKeyboard(chatId,
        `🛑 *Auto Add Money Stopped*\n\n` +
        `Completed *${result.cycles}* cycles.`
      );
    } else {
      // Start automation setup: ask only for sender name and narration
      setState(chatId, STEPS.AUTO_ACCOUNT_NAME, { auto: {} });
      return send(chatId,
        `🤖 *Auto Add Money Setup*\n\n` +
        `Step 1/2 — Enter the *sender name* to use for all auto receipts:\n\n` +
        `_(e.g. JOHN DOE DAVID)_`
      );
    }
  }

  // ── Keyboard button: 💸 Transfer ──
  if (text === '💸 Transfer' || text === '/transfer') {
    if (step === STEPS.PROCESSING) return send(chatId, '⏳ Already processing. Please wait.');
    setState(chatId, STEPS.TX_ACCOUNT_NAME, { transfer: {} });
    return send(chatId,
      `💸 *New Transfer*\n\n` +
      `Step 1/5 — Enter the *recipient name*:\n\n` +
      `_(e.g. JOHN DOE DAVID)_`
    );
  }

  // ── Keyboard button: 💰 Add Money ──
  if (text === '💰 Add Money' || text === '/addmoney') {
    if (step === STEPS.PROCESSING) return send(chatId, '⏳ Already processing. Please wait.');
    setState(chatId, STEPS.AM_ACCOUNT_NAME, { addmoney: {} });
    return send(chatId,
      `💰 *Add Money*\n\n` +
      `Step 1/5 — Enter the *sender name*:\n\n` +
      `_(e.g. JOHN DOE DAVID)_`
    );
  }

  // ── Keyboard button: 📋 Send Receipt ──
  if (text === '📋 Send Receipt' || text === '/send') {
    if (step === STEPS.PROCESSING) return send(chatId, '⏳ Already processing. Please wait.');
    setState(chatId, STEPS.PROCESSING, {});
    await send(chatId, '🔄 Fetching your FlashAza transactions...');

    try {
      const transactions = await fetchTransactions(5);
      if (!transactions || transactions.length === 0) {
        resetState(chatId);
        return sendWithKeyboard(chatId,
          '⚠️ *No transactions found.*\n\n' +
          '👉 Use 💸 Transfer or 💰 Add Money to create one first.'
        );
      }

      setState(chatId, STEPS.PICK_TX, { transactions });
      const keyboard = transactions.map((tx, i) => ([{
        text:          txLabel(tx),
        callback_data: `pick_tx_${i}`,
      }]));

      await send(chatId, '📋 *Choose a transaction:*', {
        reply_markup: { inline_keyboard: keyboard },
      });
    } catch (err) {
      console.error('[ERROR] fetchTransactions:', err.message);
      sendError(chatId, 'Could not fetch transactions.\n\n' + err.message);
    }
    return;
  }

  // Skip other commands
  if (text.startsWith('/')) return;

  // ═══════════════════════════════════════════════════════════════════════════
  //  TRANSFER flow — Steps 1–5
  // ═══════════════════════════════════════════════════════════════════════════

  if (step === STEPS.TX_ACCOUNT_NAME) {
    if (text.length < 2) return send(chatId, '⚠️ Name too short. Enter the recipient name:');
    data.transfer.accountname = text.toUpperCase();
    setState(chatId, STEPS.TX_ACCOUNT_NUMBER, data);
    return send(chatId,
      `✅ *Name:* ${data.transfer.accountname}\n\n` +
      `Step 2/5 — Enter the *account number* (10 digits):`
    );
  }

  if (step === STEPS.TX_ACCOUNT_NUMBER) {
    const cleaned = text.replace(/\s/g, '');
    if (!/^\d{10}$/.test(cleaned)) return send(chatId, '⚠️ Must be exactly 10 digits. Try again:');
    data.transfer.accountnumber = cleaned;
    setState(chatId, STEPS.TX_BANK_NAME, data);
    return send(chatId,
      `✅ *Account:* ${cleaned}\n\nStep 3/5 — Enter the *bank name*:\n_(e.g. OPay, GTBank, Access Bank, Kuda)_`
    );
  }

  if (step === STEPS.TX_BANK_NAME) {
    if (text.length < 2) return send(chatId, '⚠️ Bank name too short. Try again:');
    data.transfer.bankname = text;
    setState(chatId, STEPS.TX_AMOUNT, data);
    return send(chatId,
      `✅ *Bank:* ${data.transfer.bankname}\n\nStep 4/5 — Enter the *amount* (in Naira):\n_(e.g. 25000)_`
    );
  }

  if (step === STEPS.TX_AMOUNT) {
    const amount = parseFloat(text.replace(/,/g, ''));
    if (isNaN(amount) || amount <= 0) return send(chatId, '⚠️ Invalid amount. Enter a number > 0:');
    data.transfer.amount = amount;
    setState(chatId, STEPS.TX_NARRATION, data);
    return send(chatId,
      `✅ *Amount:* ₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}\n\n` +
      `Step 5/5 — Enter a *narration* (or type "skip"):`
    );
  }

  if (step === STEPS.TX_NARRATION) {
    data.transfer.narration = text.toLowerCase() === 'skip' ? '' : text;
    setState(chatId, STEPS.TX_CONFIRM, data);
    const t = data.transfer;
    const amt = t.amount.toLocaleString('en-NG', { minimumFractionDigits: 2 });
    return send(chatId,
      `📋 *Confirm Transfer:*\n\n` +
      `👤 Name: *${t.accountname}*\n` +
      `🔢 Account: *${t.accountnumber}*\n` +
      `🏦 Bank: *${t.bankname}*\n` +
      `💵 Amount: *₦${amt}*\n` +
      `📝 Narration: *${t.narration || '(none)'}*\n\n` +
      `Proceed?`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Confirm', callback_data: 'transfer_confirm' },
              { text: '❌ Cancel',  callback_data: 'transfer_cancel'  },
            ],
          ],
        },
      }
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  ADD MONEY flow — Steps 1–5
  // ═══════════════════════════════════════════════════════════════════════════

  if (step === STEPS.AM_ACCOUNT_NAME) {
    if (text.length < 2) return send(chatId, '⚠️ Name too short. Enter the sender name:');
    data.addmoney.accountname = text.toUpperCase();
    setState(chatId, STEPS.AM_ACCOUNT_NUMBER, data);
    return send(chatId,
      `✅ *Name:* ${data.addmoney.accountname}\n\n` +
      `Step 2/5 — Enter the *sender account number* (10 digits):`
    );
  }

  if (step === STEPS.AM_ACCOUNT_NUMBER) {
    const cleaned = text.replace(/\s/g, '');
    if (!/^\d{10}$/.test(cleaned)) return send(chatId, '⚠️ Must be exactly 10 digits. Try again:');
    data.addmoney.accountnumber = cleaned;
    setState(chatId, STEPS.AM_BANK_NAME, data);
    return send(chatId,
      `✅ *Account:* ${cleaned}\n\nStep 3/5 — Enter the *sender bank name*:\n_(e.g. OPay, GTBank, Access Bank, Kuda)_`
    );
  }

  if (step === STEPS.AM_BANK_NAME) {
    if (text.length < 2) return send(chatId, '⚠️ Bank name too short. Try again:');
    data.addmoney.bankname = text;
    setState(chatId, STEPS.AM_AMOUNT, data);
    return send(chatId,
      `✅ *Bank:* ${data.addmoney.bankname}\n\nStep 4/5 — Enter the *amount* (in Naira):\n_(e.g. 50000)_`
    );
  }

  if (step === STEPS.AM_AMOUNT) {
    const amount = parseFloat(text.replace(/,/g, ''));
    if (isNaN(amount) || amount <= 0) return send(chatId, '⚠️ Invalid amount. Enter a number > 0:');
    data.addmoney.amount = amount;
    setState(chatId, STEPS.AM_NARRATION, data);
    return send(chatId,
      `✅ *Amount:* ₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}\n\n` +
      `Step 5/5 — Enter a *narration* (or type "skip"):`
    );
  }

  if (step === STEPS.AM_NARRATION) {
    data.addmoney.narration = text.toLowerCase() === 'skip' ? '' : text;
    setState(chatId, STEPS.AM_CONFIRM, data);
    const t = data.addmoney;
    const amt = t.amount.toLocaleString('en-NG', { minimumFractionDigits: 2 });
    return send(chatId,
      `📋 *Confirm Add Money:*\n\n` +
      `👤 From: *${t.accountname}*\n` +
      `🔢 Account: *${t.accountnumber}*\n` +
      `🏦 Bank: *${t.bankname}*\n` +
      `💵 Amount: *₦${amt}*\n` +
      `📝 Narration: *${t.narration || '(none)'}*\n\n` +
      `Proceed?`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Confirm', callback_data: 'addmoney_confirm' },
              { text: '❌ Cancel',  callback_data: 'addmoney_cancel'  },
            ],
          ],
        },
      }
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  //  AUTO Add Money setup — ask only sender name, then narration
  // ───────────────────────────────────────────────────────────────────────────

  if (step === STEPS.AUTO_ACCOUNT_NAME) {
    if (text.length < 2) return send(chatId, '⚠️ Name too short. Enter the sender name:');
    data.auto.accountname = text.toUpperCase();
    setState(chatId, STEPS.AUTO_NARRATION, data);
    return send(chatId,
      `✅ *Name:* ${data.auto.accountname}\n\n` +
      `Step 2/2 — Enter a *narration/remarks* to use for all auto receipts (or type "skip"):`
    );
  }

  if (step === STEPS.AUTO_NARRATION) {
    data.auto.narration = text.toLowerCase() === 'skip' ? '' : text;
    setState(chatId, STEPS.AUTO_CONFIRM, data);
    const t = data.auto;
    return send(chatId,
      `📋 *Auto Add Money — Confirm settings:*\n\n` +
      `👤 Sender: *${t.accountname}*\n` +
      `📝 Narration: *${t.narration || '(none)'}*\n\n` +
      `When you confirm, the bot will start sending auto receipts to this chat using the above sender name and narration until you tap *🤖 Auto Add Money* to stop.`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '▶️ Start Automation', callback_data: 'auto_start_confirm' },
              { text: '❌ Cancel', callback_data: 'auto_start_cancel' },
            ],
          ],
        },
      }
    );
  }
});

// ═════════════════════════════════════════════════════════════════════════════
//  Callback query handler — buttons for confirm + receipt style
// ═════════════════════════════════════════════════════════════════════════════

bot.on('callback_query', async (query) => {
  const chatId       = query.message.chat.id;
  const callbackData = query.data;

  await bot.answerCallbackQuery(query.id);

  const { step, data } = getState(chatId);

  // ── Transfer: confirm ──
  if (step === STEPS.TX_CONFIRM && callbackData === 'transfer_confirm') {
    const t = data.transfer;
    if (!t) return sendError(chatId, 'Transfer data lost. Start again.');

    setState(chatId, STEPS.PROCESSING, data);
    await send(chatId, '⏳ Creating transfer in FlashAza...');

    try {
      const inserted = await insertTransfer({
        accountname:   t.accountname,
        accountnumber: t.accountnumber,
        bankname:      t.bankname,
        amount:        t.amount,
        narration:     t.narration || '',
      });

      data.selectedTx = inserted;
      setState(chatId, STEPS.RECEIPT_STYLE, data);

      const amt = Number(inserted.amount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 });

      await send(chatId,
        `✅ *Transfer Successful!*\n\n` +
        `💵 Amount: *₦${amt}*\n` +
        `👤 To: *${inserted.accountname}*\n` +
        `🏦 Bank: *${inserted.bankname}*\n` +
        `🔢 Account: *${inserted.accountnumber}*\n\n` +
        `🧾 *Choose a receipt style:*`,
        { reply_markup: receiptKeyboard() }
      );
    } catch (err) {
      console.error('[ERROR] insertTransfer:', err.message);
      sendError(chatId, 'Failed to create transfer:\n' + err.message);
    }
    return;
  }

  // ── Transfer: cancel ──
  if (step === STEPS.TX_CONFIRM && callbackData === 'transfer_cancel') {
    resetState(chatId);
    return sendWithKeyboard(chatId, '🚫 Transfer cancelled.');
  }

  // ── Add Money: confirm ──
  if (step === STEPS.AM_CONFIRM && callbackData === 'addmoney_confirm') {
    const t = data.addmoney;
    if (!t) return sendError(chatId, 'Add Money data lost. Start again.');

    setState(chatId, STEPS.PROCESSING, data);
    await send(chatId, '⏳ Adding money via FlashAza...');

    try {
      // Calls the REAL FlashAza process.php endpoint
      await addMoney({
        accountname:   t.accountname,
        accountnumber: t.accountnumber,
        bankname:      t.bankname,
        amount:        t.amount,
        narration:     t.narration || '',
      });

      const amt = t.amount.toLocaleString('en-NG', { minimumFractionDigits: 2 });

      await send(chatId,
        `✅ *Money Added Successfully!*\n\n` +
        `💵 Amount: *₦${amt}*\n` +
        `👤 From: *${t.accountname}*\n` +
        `🏦 Bank: *${t.bankname}*\n\n` +
        `📋 Loading your transaction history...`
      );

      // Now fetch transaction history and show it (like Send Receipt)
      // Add Money doesn't generate a receipt immediately — it shows in history
      const transactions = await fetchTransactions(5);

      if (!transactions || transactions.length === 0) {
        resetState(chatId);
        return sendWithKeyboard(chatId, '⚠️ *No transactions found in history.*');
      }

      setState(chatId, STEPS.PICK_TX, { transactions });
      const keyboard = transactions.map((tx, i) => ([{
        text:          txLabel(tx),
        callback_data: `pick_tx_${i}`,
      }]));

      await send(chatId, '📋 *Choose a transaction to generate a receipt:*', {
        reply_markup: { inline_keyboard: keyboard },
      });

    } catch (err) {
      console.error('[ERROR] addMoney:', err.message);
      sendError(chatId, 'Failed to add money:\n' + err.message);
    }
    return;
  }

  // ── Add Money: cancel ──
  if (step === STEPS.AM_CONFIRM && callbackData === 'addmoney_cancel') {
    resetState(chatId);
    return sendWithKeyboard(chatId, '🚫 Add Money cancelled.');
  }

  // ── Auto setup: confirm ──
  if (step === STEPS.AUTO_CONFIRM && callbackData === 'auto_start_confirm') {
    const t = data.auto;
    if (!t) return sendError(chatId, 'Auto setup data lost. Start again.');

    // Start automation with provided sender name + narration
    automate.start(chatId, {
      accountname: t.accountname,
      narration:   t.narration || '',
    });

    resetState(chatId);
    const st2 = automate.status();
    return sendWithKeyboard(chatId,
      `🤖 *Auto Add Money Started!*\n\n` +
      `Every *${st2.interval}s* → *${st2.perCycle}* transactions\n` +
      `Using sender: *${t.accountname}*\n` +
      `Narration: *${t.narration || '(none)'}*\n\n` +
      `Receipts will be sent here automatically.\n` +
      `Tap *🤖 Auto Add Money* again to stop.`
    );
  }

  if (step === STEPS.AUTO_CONFIRM && callbackData === 'auto_start_cancel') {
    resetState(chatId);
    return sendWithKeyboard(chatId, '🚫 Auto Add Money setup cancelled.');
  }

  // ── Picking a transaction from Send Receipt ──
  if (step === STEPS.PICK_TX && callbackData.startsWith('pick_tx_')) {
    const index = parseInt(callbackData.replace('pick_tx_', ''), 10);
    const tx    = data.transactions?.[index];

    if (!tx) return send(chatId, '⚠️ Invalid selection.');

    setState(chatId, STEPS.RECEIPT_STYLE, { ...data, selectedTx: tx });

    const amt  = Number(tx.amount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 });
    const type = tx.type === 'sent' ? '↑ Sent to' : '↓ Received from';

    await send(
      chatId,
      `✅ *Selected:*\n` +
      `${type}: *${tx.accountname || 'Unknown'}*\n` +
      `Amount: *₦${amt}*\n` +
      `Bank: *${tx.bankname || 'N/A'}*\n\n` +
      `🧾 *Choose a receipt style:*`,
      { reply_markup: receiptKeyboard() }
    );
    return;
  }

  // ── Picking receipt style → screenshot from FlashAza ──
  if (step === STEPS.RECEIPT_STYLE && callbackData.startsWith('style_')) {
    const style = callbackData.replace('style_', '');
    const styleNames = { opay: 'OPay', moniepoint: 'Moniepoint', kuda: 'Kuda' };

    const tx = data.selectedTx;
    if (!tx) return sendError(chatId, 'Transaction data lost. Please start again.');

    const productId = tx.product_id || tx.id?.toString();
    if (!productId) return sendError(chatId, 'Transaction has no product_id.');

    setState(chatId, STEPS.PROCESSING, { ...data, style });
    await send(chatId,
      `⏳ Loading *${styleNames[style] || style}* receipt from FlashAza...\n\n` +
      `📸 Taking screenshot — please wait...`
    );

    try {
      const screenshotBuffer = await takeFlashAzaScreenshot(style, tx);

      const safeName = (tx.accountname || '').replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
      const safeBank = (tx.bankname   || '').replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');

      await bot.sendPhoto(
        chatId,
        screenshotBuffer,
        {
          caption:    `✅ Receipt Generated\\!\n\n💵 Amount: ₦${Number(tx.amount||0).toLocaleString()}\n${tx.type === 'sent' ? '📤 To' : '📥 From'}: ${safeName}\n🏦 Bank: ${safeBank}\n🔢 Account: ${tx.accountnumber || 'N/A'}\n🧾 Style: ${styleNames[style] || style}`,
          parse_mode: 'MarkdownV2',
        },
        { filename: 'receipt.png', contentType: 'image/png' }
      );

      resetState(chatId);
      // Show keyboard again after receipt is sent
      sendWithKeyboard(chatId, '✅ Done! What would you like to do next?');

    } catch (err) {
      console.error(`[ERROR] chatId=${chatId}:`, err.message);
      sendError(chatId, err.message || 'Something went wrong generating the receipt.');
    }
    return;
  }
});

// ─── Error handling ───────────────────────────────────────────────────────────

bot.on('polling_error', (err) => {
  console.error('[POLLING ERROR]', err.message);
});

bot.on('error', (err) => {
  console.error('[BOT ERROR]', err.message);
});

process.on('unhandledRejection', (err) => {
  console.error('[UNHANDLED REJECTION]', err?.message || err);
});

console.log('🤖 FlashAza Bot is running...');
