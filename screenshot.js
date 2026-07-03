// screenshot.js – Screenshots real FlashAza receipt pages from the live site
// Expands scroll containers and waits for animations so the FULL page is captured.
const puppeteer = require('puppeteer');
require('dotenv').config();

/**
 * Takes a FULL screenshot of a real FlashAza receipt page.
 * Expands all scroll containers so nothing is clipped.
 *
 * Page mapping:
 *   Transfer (type="sent"):
 *     opay       → bnk_receipt.php      (has timeline, Transfer to, Recipient Details)
 *     moniepoint → m-receipt.php
 *     kuda       → k-receipt.php
 *
 *   Add Money (type="received"):
 *     opay       → from-bnk-receipt.php (no timeline, Transfer from, Sender Details, Bank Deposit)
 *     moniepoint → m-receipt.php
 *     kuda       → k-receipt.php
 *
 * @param {'opay'|'moniepoint'|'kuda'} style - Which FlashAza receipt style
 * @param {Object} tx - Transaction object from Supabase (needs product_id, type)
 * @param {string} [overridePage] - Optional: explicitly set the PHP page (e.g. 'from-bnk-receipt.php')
 * @returns {Promise<Buffer>} PNG screenshot buffer
 */
async function takeFlashAzaScreenshot(style, tx, overridePage = null) {
  if (!tx) throw new Error('No transaction data provided');

  const productId = tx.product_id || tx.id?.toString();
  if (!productId) throw new Error('Transaction has no product_id');

  const BACKEND_URL    = (process.env.BACKEND_URL || '').replace(/\/$/, '');
  const SESSION_COOKIE = process.env.SESSION_COOKIE || '';

  if (!BACKEND_URL) {
    throw new Error('BACKEND_URL is not set in .env');
  }
  if (!SESSION_COOKIE) {
    throw new Error('SESSION_COOKIE is not set in .env');
  }

  // ─── Map style + transaction type → correct PHP receipt page ─────────────
  let phpPage;

  if (overridePage) {
    // Caller explicitly chose the page (used by automation)
    phpPage = overridePage;
  } else {
    // Auto-detect from transaction type
    const isReceived = tx.type === 'received';
    const pageMap = {
      opay:       isReceived ? 'from-bnk-receipt.php' : 'bnk_receipt.php',
      moniepoint: 'm-receipt.php',
      kuda:       'k-receipt.php',
    };
    phpPage = pageMap[style];
  }

  if (!phpPage) throw new Error(`Unknown receipt style: "${style}"`);

  const receiptUrl = `${BACKEND_URL}/${phpPage}?product_id=${encodeURIComponent(productId)}`;
  console.log(`[screenshot] tx.type="${tx.type}", overridePage="${overridePage}" → ${phpPage}`);
  console.log(`[screenshot] Navigating to: ${receiptUrl}`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 420, height: 900 });

    // Set the PHPSESSID cookie
    const url = new URL(BACKEND_URL);
    await page.setCookie({
      name:     'PHPSESSID',
      value:    SESSION_COOKIE,
      domain:   url.hostname,
      path:     '/',
      httpOnly: true,
      secure:   url.protocol === 'https:',
      sameSite: 'Lax',
    });

    // Navigate to the receipt page
    const response = await page.goto(receiptUrl, { waitUntil: 'networkidle0', timeout: 25000 });
    console.log(`[screenshot] HTTP ${response?.status()} — Final URL: ${page.url()}`);

    // Check if redirected to login
    const currentUrl = page.url();
    if (currentUrl.includes('login.php') || currentUrl.includes('login')) {
      throw new Error('Session expired! Log into FlashAza at ' + BACKEND_URL + ', copy fresh PHPSESSID cookie, update SESSION_COOKIE in .env');
    }

    // Check for error messages
    const bodyText = await page.evaluate(() => document.body?.innerText || '');
    if (bodyText.includes('Transaction not found') || bodyText.includes('Database error') || bodyText.includes('Invalid request')) {
      throw new Error(`FlashAza error: ${bodyText.substring(0, 200)}`);
    }

    // Wait for any loading animations to complete
    try {
      await page.waitForFunction(
        () => {
          // Check if loadingOverlay is hidden (opy-receipt)
          const overlay = document.getElementById('loadingOverlay');
          if (overlay && !overlay.classList.contains('hidden') && overlay.style.display !== 'none') {
            return false;
          }
          // Check if headSection is visible (opy-receipt's initPage)
          const head = document.getElementById('headSection');
          if (head && head.classList.contains('hidden')) {
            return false;
          }
          // For from-bnk-receipt / bnk_receipt: check if content section exists
          if (document.querySelector('.content, .scroll-view')) {
            return true;
          }
          // For m-receipt / k-receipt
          if (document.querySelector('.receipt-wrapper, .receipt-card')) {
            return true;
          }
          const body = document.getElementById('bodySection');
          return body && !body.classList.contains('hidden');
        },
        { timeout: 8000 }
      );
    } catch {
      console.log('[screenshot] Loading wait timed out — proceeding anyway');
    }

    // Extra wait for fonts and transitions
    await new Promise(r => setTimeout(r, 1000));

    // EXPAND all scrollable containers so the full page is captured
    await page.evaluate(() => {
      // Expand scroll container (opy-receipt)
      const sc = document.getElementById('scrollContainer') || document.querySelector('.scroll-container');
      if (sc) {
        sc.style.overflow = 'visible';
        sc.style.height = 'auto';
        sc.style.maxHeight = 'none';
      }
      // Expand .scroll-view (bnk_receipt.php)
      const sv = document.querySelector('.scroll-view');
      if (sv) {
        sv.style.overflow = 'visible';
        sv.style.height = 'auto';
        sv.style.maxHeight = 'none';
      }
      // Expand .content (from-bnk-receipt.php)
      const content = document.querySelector('.content');
      if (content) {
        content.style.overflow = 'visible';
        content.style.height = 'auto';
        content.style.maxHeight = 'none';
      }
      // Expand the main container
      const container = document.querySelector('.container');
      if (container) {
        container.style.paddingBottom = '20px';
        container.style.minHeight = 'auto';
        container.style.overflow = 'visible';
        container.style.height = 'auto';
      }
      // Make sure footers are not position:fixed
      const footers = document.querySelectorAll('.footer, .footer-container');
      footers.forEach(f => {
        f.style.position = 'relative';
        f.style.bottom = 'auto';
      });
      // Make sure headers are not position:fixed (from-bnk-receipt)
      const header = document.querySelector('.header');
      if (header) {
        header.style.position = 'relative';
      }
    });

    // Small delay after DOM changes
    await new Promise(r => setTimeout(r, 300));

    // Take the FULL page screenshot
    const screenshotBuffer = await page.screenshot({ fullPage: true, type: 'png' });
    console.log(`[screenshot] Done — ${style} receipt, page=${phpPage} (${screenshotBuffer.length} bytes)`);
    return screenshotBuffer;

  } finally {
    await browser.close();
  }
}

module.exports = { takeFlashAzaScreenshot };
