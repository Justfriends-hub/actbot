// names.js — 300 Nigerian names + bank list for automation

const FIRST_NAMES = [
  'Adebayo', 'Chidinma', 'Oluwaseun', 'Ngozi', 'Emeka', 'Folake', 'Tunde', 'Amina',
  'Chukwuemeka', 'Yetunde', 'Obinna', 'Funke', 'Ayodeji', 'Halima', 'Ikechukwu',
  'Bukola', 'Oluwatobi', 'Fatima', 'Nnamdi', 'Adaeze', 'Kehinde', 'Zainab', 'Ugochukwu',
  'Omolara', 'Babatunde', 'Aisha', 'Chinedu', 'Titilayo', 'Olumide', 'Habiba',
  'Ifeanyi', 'Modupe', 'Damilola', 'Maryam', 'Chibueze', 'Jumoke', 'Ayomide',
  'Rashidat', 'Obiora', 'Adeola', 'Segun', 'Blessing', 'Olamide', 'Khadijah',
  'Uchenna', 'Tolani', 'Adewale', 'Salamatu', 'Ebuka', 'Morenike', 'Taiwo',
  'Hauwa', 'Chidi', 'Sade', 'Oluwafemi', 'Bilkisu', 'Nonso', 'Yewande',
  'Oluwadamilare', 'Nafisa', 'Uzoma', 'Bimpe', 'Olawale', 'Rahma', 'Kelechi',
  'Toyin', 'Adeniyi', 'Hadiza', 'Somtochukwu', 'Laide', 'Kunle', 'Mariam',
  'Obianuju', 'Ronke', 'Olayinka', 'Safiya', 'Izuchukwu', 'Busola', 'Femi',
  'Hassana', 'Chioma', 'Shade', 'Rotimi', 'Binta', 'Nkechi', 'Ayo', 'Gbenga',
  'Asabe', 'Ogechi', 'Wale', 'Abiodun', 'Rabi', 'Chiamaka', 'Bola',
  'Oluwaseyi', 'Jamila', 'Kenechukwu', 'Tope', 'Jide', 'Amara', 'Dotun',
  'Nneka', 'Yusuf', 'Lola', 'Chima', 'Iyabo', 'Dapo', 'Sumaiya',
  'Chukwuma', 'Peju', 'Lanre', 'Hussaina', 'Uche', 'Simbi', 'Dele',
  'Ramatu', 'Obafemi', 'Tinuke', 'Seyi', 'Balkisu', 'Ndubuisi', 'Joke',
  'Mayowa', 'Firdaus', 'Eze', 'Bunmi', 'Kayode', 'Aderonke', 'Tochukwu',
  'Abiola', 'Bolanle', 'Chukwudi', 'Morayo', 'Idris', 'Damola', 'Wasiu',
  'Kamsi', 'Dolapo', 'Ndidi', 'Abdullahi', 'Temitope', 'Lukman', 'Mosunmola',
  'Ekene', 'Remi', 'Tobi', 'Suliat', 'Chidozie', 'Temi', 'Lateef', 'Nkeiru',
  'Bankole', 'Oyinlola', 'Nkem', 'Abike', 'Taofeek', 'Oreofe', 'Chigozie',
  'Ibukun', 'Mustapha', 'Dayo', 'Chibuzor', 'Omolade', 'Rilwan', 'Gbemisola',
];

const LAST_NAMES = [
  'Adeyemi', 'Okafor', 'Ibrahim', 'Olawale', 'Nwankwo', 'Bakare', 'Okonkwo',
  'Abubakar', 'Oladipo', 'Eze', 'Bello', 'Adeleke', 'Nwosu', 'Ayodele',
  'Mohammed', 'Ogunleye', 'Chukwu', 'Abdulrahman', 'Adekunle', 'Okoro',
  'Suleiman', 'Olayiwola', 'Nwachukwu', 'Lawal', 'Adewumi', 'Igwe',
  'Aliyu', 'Oladimeji', 'Onyekachi', 'Balogun', 'Adeniji', 'Uzodinma',
  'Hassan', 'Olorunfemi', 'Nwafor', 'Garba', 'Adebiyi', 'Chidimma',
  'Musa', 'Ojo', 'Obi', 'Yusuf', 'Afolabi', 'Nnadi', 'Salisu',
  'Ogundele', 'Emenike', 'Usman', 'Akinyemi', 'Nweke', 'Danjuma',
  'Olusegun', 'Achebe', 'Ismail', 'Adegoke', 'Okorie', 'Sani',
  'Oyeleke', 'Ikenna', 'Shehu', 'Akinwale', 'Onuoha', 'Hamza',
  'Olufunmilayo', 'Ejiofor', 'Audu', 'Adebowale', 'Nnamdi', 'Bashir',
  'Ogunyemi', 'Uzor', 'Abdullahi', 'Akindele', 'Amaechi', 'Jimoh',
  'Olatunde', 'Ugwu', 'Dahiru', 'Adetokunbo', 'Diala', 'Mukhtar',
  'Olowookere', 'Ibe', 'Magaji', 'Adeola', 'Ekwueme', 'Tanko',
  'Olajide', 'Nwoga', 'Yakubu', 'Adesanya', 'Ikechukwu', 'Haruna',
  'Oni', 'Obiekwe', 'Rabiu', 'Adeoye', 'Nwobodo', 'Sadiq',
  'Ogunbiyi', 'Kalu', 'Gambo', 'Adeyinka', 'Okereke', 'Waziri',
  'Okeowo', 'Anyanwu', 'Nuhu', 'Adetunji', 'Agu', 'Tijani',
  'Osei', 'Nwabueze', 'Ahmad', 'Ademola', 'Ogbonna', 'Dikko',
  'Ajayi', 'Opara', 'Idris', 'Adeniran', 'Ibe', 'Sulaiman',
  'Badmus', 'Ezekiel', 'Lawal', 'Odunayo', 'Chukwuemeka', 'Sanusi',
  'Fagbemi', 'Nwoye', 'Shittu', 'Awolowo', 'Nzekwe', 'Bala',
  'Owolabi', 'Uchenna', 'Dauda', 'Oguntade', 'Nwaeze', 'Jibrin',
  'Olaleye', 'Madueke', 'Kabiru', 'Omoyeni', 'Ekechi', 'Shuaibu',
  'Effiong', 'Bassey', 'Etim', 'Akpan', 'Udoh', 'Essien',
];

const BUSINESSES = [
  'Enterprise', 'Ventures', 'Global', 'International', 'Resources', 'Solutions',
  'Services', 'Trading', 'Logistics', 'Technologies', 'Investments', 'Holdings',
  'Industries', 'Associates', 'Concepts', 'Limited', 'Nigeria Ltd',
];

const BANKS = [
  { name: 'opay',                       url: '' },
  { name: 'palmpay',                    url: '' },
  { name: 'moniepoint',                 url: '' },
  { name: 'kuda microfinance bank',     url: '' },
  { name: 'access bank',                url: '' },
  { name: 'gtbank',                     url: '' },
  { name: 'first bank of nigeria',      url: '' },
  { name: 'united bank for africa',     url: '' },
  { name: 'zenith bank',                url: '' },
  { name: 'fidelity bank',             url: '' },
  { name: 'union bank',                 url: '' },
  { name: 'stanbic ibtc bank',         url: '' },
  { name: 'sterling bank',              url: '' },
  { name: 'polaris bank',               url: '' },
  { name: 'wema bank',                  url: '' },
  { name: 'ecobank nigeria',            url: '' },
  { name: 'fcmb',                       url: '' },
  { name: 'jaiz bank',                  url: '' },
  { name: 'keystone bank',              url: '' },
  { name: 'heritage bank',              url: '' },
];

// ─── Banned Banks — auto bots must NEVER choose any of these ────────────────
const BANNED_BANKS = [
  'aella firsttrust',
  'above only mfb',
  'go money',
  'chikum mfb',
  'consumer mfb',
  'corestep',
  'coronation',
  'bainescredit',
  'astrapolaris',
  'aramoko',
  'dot microfinance',
  'chanelle mfb',
  'parkway',
  'mint mfb',
  'paystack',
  'ekimogun mfb',
  'ibile mfb',
  'firmus mfb',
  'gateway mortgage',
  'infinity mfb',
  'ilaro poly',
  'kadpoly',
  'lagos building investment company',
  'kredi money mfb',
  'solid rock mfb',
  'unical mfb',
  'solid allianze mfb',
  'u and c mfb',
  'u&c microfinance bank',
  'refuge mortgage bank',
  'waya microfinance bank',
  'hopepsb',
  'imowo mfb',
  'shield mfb',
  'links mfb',
  'ikoyi osun mfb',
  'stanbic ibtc bank',
  'union bank',
  'jaiz bank',
  'fcmb',
  'keystone bank',
  'kuda microfinance bank',
  'heritage bank',
  'sterling bank',
  'wema bank',
  'moniepoint',
  'palmpay',
  'ecobank',
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Check if a bank name matches any banned bank (case-insensitive partial match).
 * Returns true if the bank is banned.
 */
function isBankBanned(bankName) {
  const name = (bankName || '').toLowerCase().trim();
  return BANNED_BANKS.some(banned => {
    const b = banned.toLowerCase().trim();
    return name.includes(b) || b.includes(name);
  });
}

/**
 * Pick a random bank from BANKS, guaranteed to NOT be a banned bank.
 * Falls back to first safe bank if all random picks are banned (shouldn't happen
 * with the current list since no BANKS entries overlap with BANNED_BANKS).
 */
function pickSafeBank() {
  // Filter out any banned banks from the list
  const safeBanks = BANKS.filter(bank => !isBankBanned(bank.name));

  if (safeBanks.length === 0) {
    // Absolute fallback — should never happen
    console.error('[WARN] All banks are banned! Falling back to first BANKS entry.');
    return BANKS[0];
  }

  return pick(safeBanks);
}

/** Generate a random 10-digit account number */
function randomAccountNumber() {
  let r = '';
  for (let i = 0; i < 10; i++) r += Math.floor(Math.random() * 10);
  return r;
}

/**
 * Generate a random Nigerian name.
 * ~30% chance of being a business name (e.g. "Adeyemi Ventures")
 */
function randomName() {
  if (Math.random() < 0.3) {
    // Business name
    return `${pick(LAST_NAMES)} ${pick(BUSINESSES)}`;
  }
  // Personal name (FIRST LAST or FIRST MIDDLE LAST)
  if (Math.random() < 0.4) {
    return `${pick(FIRST_NAMES)} ${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`.toUpperCase();
  }
  return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`.toUpperCase();
}

/** Random amount between min and max, rounded to nearest 100 */
function randomAmount(min = 300000, max = 980000) {
  const raw = randInt(min, max);
  return Math.round(raw / 100) * 100; // round to nearest 100
}

/** Random narration */
function randomNarration(name) {
  const templates = [
    `Transfer from ${name}`,
    `Payment`,
    `${name} Payout`,
    `Business Transfer`,
    `Funds Transfer`,
    `Invoice Payment`,
    `Contract Payment`,
    `Commission`,
    `Sales Proceeds`,
    `${pick(LAST_NAMES)} Payment`,
    `Salary Payment`,
    `Earnings`,
  ];
  return pick(templates);
}

module.exports = {
  FIRST_NAMES, LAST_NAMES, BUSINESSES, BANKS, BANNED_BANKS,
  pick, randInt, randomAccountNumber, randomName, randomAmount, randomNarration,
  isBankBanned, pickSafeBank,
};
