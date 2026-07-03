/**
 * In-memory conversation state manager per chatId.
 * Each state object tracks the current step and collected data.
 */

const states = {};

const STEPS = {
  IDLE:            'IDLE',

  // ── Receipt from history ──
  PICK_TX:         'PICK_TX',
  RECEIPT_STYLE:   'RECEIPT_STYLE',
  PROCESSING:      'PROCESSING',

  // ── Transfer flow (send money out) ──
  TX_ACCOUNT_NAME:   'TX_ACCOUNT_NAME',
  TX_ACCOUNT_NUMBER: 'TX_ACCOUNT_NUMBER',
  TX_BANK_NAME:      'TX_BANK_NAME',
  TX_AMOUNT:         'TX_AMOUNT',
  TX_NARRATION:      'TX_NARRATION',
  TX_CONFIRM:        'TX_CONFIRM',

  // ── Add Money flow (receive money in) ──
  AM_ACCOUNT_NAME:   'AM_ACCOUNT_NAME',
  AM_ACCOUNT_NUMBER: 'AM_ACCOUNT_NUMBER',
  AM_BANK_NAME:      'AM_BANK_NAME',
  AM_AMOUNT:         'AM_AMOUNT',
  AM_NARRATION:      'AM_NARRATION',
  AM_CONFIRM:        'AM_CONFIRM',
  // ── Auto Add Money setup (ask only sender name + narration) ──
  AUTO_ACCOUNT_NAME:  'AUTO_ACCOUNT_NAME',
  AUTO_NARRATION:     'AUTO_NARRATION',
  AUTO_CONFIRM:       'AUTO_CONFIRM',
};

function getState(chatId) {
  return states[chatId] || { step: STEPS.IDLE, data: {} };
}

function setState(chatId, step, data = {}) {
  states[chatId] = { step, data };
}

function updateData(chatId, key, value) {
  if (!states[chatId]) states[chatId] = { step: STEPS.IDLE, data: {} };
  states[chatId].data[key] = value;
}

function resetState(chatId) {
  delete states[chatId];
}

module.exports = { STEPS, getState, setState, updateData, resetState };
