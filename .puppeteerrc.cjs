const { join } = require('path');

/**
 * .puppeteerrc.cjs
 *
 * Two problems this config solves for Render deployments:
 *
 * 1. skipDownload: true
 *    Puppeteer's npm postinstall script also tries to download Chrome.
 *    If that download fails (timeout / partial write), it leaves a corrupt
 *    folder. Then the explicit build-command step
 *      npx puppeteer browsers install chrome
 *    sees "folder exists but executable missing" and errors.
 *    Setting skipDownload skips the postinstall entirely, so the explicit
 *    step always runs against a clean (empty) cache directory.
 *
 * 2. cacheDirectory inside the project
 *    Points Chrome to .cache/puppeteer (inside the repo) rather than the
 *    global /opt/render/.cache which can contain stale folders from older
 *    deploys that used a different puppeteer version.
 */

/** @type {import("puppeteer").Configuration} */
module.exports = {
  // Skip the automatic download that runs during 'npm install'.
  // Chrome is installed explicitly via the build command instead.
  skipDownload: true,
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
