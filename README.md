# 🤖 Receipt Telegram Bot

A Telegram bot that performs credit transactions in your PHP banking app and sends back bank receipt screenshots (OPay, Kuda, or Moniepoint style).

---

## 📁 File Structure

```
/bot
  index.js        ← Main bot entry point (state machine + Telegram handlers)
  screenshot.js   ← Puppeteer screenshot helper
  api.js          ← Calls bot-api.php to create the transaction
  state.js        ← In-memory conversation state manager per chatId
  .env.example    ← Required environment variables
  package.json    ← Node.js dependencies

/php
  bot-api.php     ← PHP endpoint that writes to your DB and returns product_id

README.md         ← This file
```

---

## 🚀 Setup Instructions

### Step 1 — Install Node.js dependencies

```bash
cd bot
npm install
```

> **Note:** Puppeteer will automatically download Chromium during `npm install`. This may take a few minutes and requires ~300MB of disk space.

---

### Step 2 — Configure environment variables

```bash
cp .env.example .env
```

Then edit `.env` and fill in each value:

| Variable | Description |
|---|---|
| `TELEGRAM_BOT_TOKEN` | From [@BotFather](https://t.me/BotFather) on Telegram |
| `BACKEND_URL` | Full URL to your banking app, e.g. `https://yoursite.com` (no trailing slash) |
| `BOT_SECRET_TOKEN` | A random secret shared with `bot-api.php`. Generate with: `openssl rand -hex 32` |
| `APP_USER_ID` | The `uid` of the bot's user account in your `users` table |
| `SESSION_COOKIE` | The `PHPSESSID` cookie value (see Step 4) |

---

### Step 3 — Deploy the PHP file

Copy `php/bot-api.php` to your banking app's root directory (same level as `config.php`).

Make sure `config.php` provides:
- A `$pdo` PDO instance connected to your database
- Either a `BOT_SECRET_TOKEN` constant **or** an environment variable with the same name

Optional: define `APP_USER_ID` as a constant in `config.php`:
```php
define('BOT_SECRET_TOKEN', 'your_secret_here');
define('APP_USER_ID', 1);
```

---

### Step 4 — Get your PHPSESSID cookie

The bot uses Puppeteer to open receipt pages, which require authentication. You need to give it a valid session cookie.

1. Open your banking app in **Chrome** or **Firefox**
2. Log in to the account that the bot should use (the one with `APP_USER_ID`)
3. Open **DevTools** → **Application** tab → **Cookies** → your site
4. Find the cookie named `PHPSESSID` and copy its **Value**
5. Paste it into `.env` as `SESSION_COOKIE`

> ⚠️ **Important:** PHP sessions expire. If the bot stops working after a while, repeat this step to get a fresh session cookie.

---

### Step 5 — Start the bot

```bash
cd bot
npm start
```

For development with auto-restart:
```bash
npm run dev
```

---

## 💬 Bot Commands

| Command | Action |
|---|---|
| `/start` | Welcome message |
| `/send` | Start a new transaction flow |
| `/cancel` | Cancel the current flow |

### Transaction Flow

```
/send
  → Enter amount (e.g. 50000)
  → Enter sender's full name (e.g. John Doe)
  → Enter sender's account number (10 digits)
  → Enter sender's bank name (e.g. First Bank)
  → Enter narration or type "skip"
  → Pick receipt style: OPay | Kuda | Moniepoint
  → Bot processes and sends receipt screenshot
```

---

## 🌐 Receipt URLs

The PHP receipt pages are expected at:

| Type | URL |
|---|---|
| OPay | `BACKEND_URL/OPay/opy-receipt.php?product_id=XXXXX` |
| Kuda | `BACKEND_URL/OPay/k-receipt.php?product_id=XXXXX` |
| Moniepoint | `BACKEND_URL/OPay/m-receipt.php?product_id=XXXXX` |

---

## 🖥️ Hosting on a VPS

If running on a Linux VPS (Ubuntu/Debian), install Chromium dependencies:

```bash
apt-get install -y \
  libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 \
  libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2
```

To keep the bot running in the background:

```bash
npm install -g pm2
pm2 start index.js --name receipt-bot
pm2 save
pm2 startup
```

---

## 🔒 Security Notes

- `bot-api.php` validates the `X-Bot-Token` header using `hash_equals()` (timing-safe comparison)
- User inputs are validated: amount must be a positive number, account number must be exactly 10 digits
- All DB operations use PDO prepared statements (SQL injection safe)
- The transaction uses a DB-level rollback if any step fails
- Never commit your `.env` file to version control — it's listed in `.gitignore`

---

## 🐛 Troubleshooting

**Bot doesn't respond**
- Check that `TELEGRAM_BOT_TOKEN` is correct
- Ensure the bot is started and polling is active

**"Unauthorized" from backend**
- Make sure `BOT_SECRET_TOKEN` in `.env` matches what's in `config.php` or your server's environment

**Receipt page is blank / redirects to login**
- Your `SESSION_COOKIE` has expired. Re-copy a fresh `PHPSESSID` from the browser (Step 4)

**Puppeteer crashes on VPS**
- Install the Chromium dependencies listed in the VPS hosting section above
# flashazabot
# flashazabot
# flashazabot
