const { join } = require('path');

/**
 * .puppeteerrc.cjs
 *
 * Redirects Puppeteer's Chrome download into the project folder instead of
 * the global user cache (~/.cache/puppeteer on Linux / /opt/render/.cache).
 *
 * On Render, the old global cache path sometimes contains a corrupt/partial
 * Chrome folder from a previous deploy, which breaks the postinstall step.
 * By placing the cache inside the project source directory we guarantee a
 * clean slate every build.
 */

/** @type {import("puppeteer").Configuration} */
module.exports = {
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
