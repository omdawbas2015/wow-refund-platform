import axios from 'axios';

export const CURRENCY_MAP: Record<string, string> = {
  'KW': 'KWD',
  'SA': 'SAR',
  'AE': 'AED',
  'QA': 'QAR',
  'BH': 'BHD',
  'OM': 'OMR',
  'EG': 'EGP',
  'JO': 'JOD',
  'LB': 'LBP'
};

let currencyCache = {
  rates: {} as Record<string, number>,
  lastFetched: 0
};

export async function getExchangeRates() {
  const ONE_DAY = 24 * 60 * 60 * 1000;
  if (Date.now() - currencyCache.lastFetched < ONE_DAY && Object.keys(currencyCache.rates).length > 0) {
    return currencyCache.rates;
  }

  try {
    const response = await axios.get('https://open.er-api.com/v6/latest/KWD');
    if (response.data && response.data.rates) {
      currencyCache.rates = response.data.rates;
      currencyCache.lastFetched = Date.now();
      return currencyCache.rates;
    }
  } catch (error) {
    console.error('Exchange rate fetch failed:', error);
  }
  return currencyCache.rates;
}

export function convertToKWD(amount: number, fromCurrency: string, rates: Record<string, number>) {
  if (fromCurrency === 'KWD') return amount;
  const rate = rates[fromCurrency];
  if (!rate) return amount; // Fallback or assume 1:1 if unknown
  return amount / rate;
}
