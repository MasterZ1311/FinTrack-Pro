import { getById, update } from '../db.js';
import { guardFetch, canMakeRequest } from './network-guard.js';

export const CURRENCIES = [
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', locale: 'en-IN', decimals: 2 },
  { code: 'USD', name: 'US Dollar', symbol: '$', locale: 'en-US', decimals: 2 },
  { code: 'EUR', name: 'Euro', symbol: '€', locale: 'de-DE', decimals: 2 },
  { code: 'GBP', name: 'British Pound', symbol: '£', locale: 'en-GB', decimals: 2 },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', locale: 'ja-JP', decimals: 0 },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', locale: 'en-AU', decimals: 2 },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', locale: 'en-CA', decimals: 2 },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', locale: 'de-CH', decimals: 2 },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', locale: 'zh-CN', decimals: 2 },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', locale: 'en-SG', decimals: 2 },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', locale: 'ar-AE', decimals: 2 },
  { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼', locale: 'ar-SA', decimals: 2 },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', locale: 'ms-MY', decimals: 2 },
  { code: 'THB', name: 'Thai Baht', symbol: '฿', locale: 'th-TH', decimals: 2 },
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp', locale: 'id-ID', decimals: 0 },
  { code: 'PHP', name: 'Philippine Peso', symbol: '₱', locale: 'en-PH', decimals: 2 },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R', locale: 'en-ZA', decimals: 2 },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', locale: 'pt-BR', decimals: 2 },
  { code: 'MXN', name: 'Mexican Peso', symbol: '$', locale: 'es-MX', decimals: 2 },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩', locale: 'ko-KR', decimals: 0 },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', locale: 'zh-HK', decimals: 2 },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$', locale: 'en-NZ', decimals: 2 },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr', locale: 'sv-SE', decimals: 2 },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr', locale: 'no-NO', decimals: 2 },
  { code: 'DKK', name: 'Danish Krone', symbol: 'kr', locale: 'da-DK', decimals: 2 },
  { code: 'PLN', name: 'Polish Zloty', symbol: 'zł', locale: 'pl-PL', decimals: 2 },
  { code: 'CZK', name: 'Czech Koruna', symbol: 'Kč', locale: 'cs-CZ', decimals: 2 },
  { code: 'HUF', name: 'Hungarian Forint', symbol: 'Ft', locale: 'hu-HU', decimals: 0 },
  { code: 'RON', name: 'Romanian Leu', symbol: 'lei', locale: 'ro-RO', decimals: 2 },
  { code: 'TRY', name: 'Turkish Lira', symbol: '₺', locale: 'tr-TR', decimals: 2 },
  { code: 'EGP', name: 'Egyptian Pound', symbol: '£', locale: 'ar-EG', decimals: 2 },
  { code: 'NGN', name: 'Nigerian Naira', symbol: '₦', locale: 'en-NG', decimals: 2 },
  { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh', locale: 'en-KE', decimals: 2 },
  { code: 'GHS', name: 'Ghanaian Cedi', symbol: 'GH₵', locale: 'en-GH', decimals: 2 },
  { code: 'PKR', name: 'Pakistani Rupee', symbol: '₨', locale: 'ur-PK', decimals: 2 },
  { code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳', locale: 'bn-BD', decimals: 2 },
  { code: 'LKR', name: 'Sri Lankan Rupee', symbol: '₨', locale: 'si-LK', decimals: 2 },
  { code: 'NPR', name: 'Nepalese Rupee', symbol: '₨', locale: 'ne-NP', decimals: 2 },
  { code: 'MMK', name: 'Myanmar Kyat', symbol: 'K', locale: 'my-MM', decimals: 2 },
  { code: 'VND', name: 'Vietnamese Dong', symbol: '₫', locale: 'vi-VN', decimals: 0 },
  { code: 'TWD', name: 'New Taiwan Dollar', symbol: 'NT$', locale: 'zh-TW', decimals: 2 },
  { code: 'QAR', name: 'Qatari Riyal', symbol: '﷼', locale: 'ar-QA', decimals: 2 },
  { code: 'KWD', name: 'Kuwaiti Dinar', symbol: 'د.ك', locale: 'ar-KW', decimals: 3 },
  { code: 'BHD', name: 'Bahraini Dinar', symbol: '.د.ب', locale: 'ar-BH', decimals: 3 },
  { code: 'OMR', name: 'Omani Rial', symbol: 'ر.ع.', locale: 'ar-OM', decimals: 3 },
  { code: 'JOD', name: 'Jordanian Dinar', symbol: 'د.ا', locale: 'ar-JO', decimals: 3 },
  { code: 'ILS', name: 'Israeli New Shekel', symbol: '₪', locale: 'he-IL', decimals: 2 },
  { code: 'RUB', name: 'Russian Ruble', symbol: '₽', locale: 'ru-RU', decimals: 2 },
  { code: 'COP', name: 'Colombian Peso', symbol: '$', locale: 'es-CO', decimals: 2 },
  { code: 'ARS', name: 'Argentine Peso', symbol: '$', locale: 'es-AR', decimals: 2 },
  { code: 'CLP', name: 'Chilean Peso', symbol: '$', locale: 'es-CL', decimals: 0 },
  { code: 'PEN', name: 'Peruvian Sol', symbol: 'S/', locale: 'es-PE', decimals: 2 },
  { code: 'UYU', name: 'Uruguayan Peso', symbol: '$U', locale: 'es-UY', decimals: 2 },
  { code: 'CRC', name: 'Costa Rican Colón', symbol: '₡', locale: 'es-CR', decimals: 2 },
  { code: 'DOP', name: 'Dominican Peso', symbol: 'RD$', locale: 'es-DO', decimals: 2 },
  { code: 'GTQ', name: 'Guatemalan Quetzal', symbol: 'Q', locale: 'es-GT', decimals: 2 },
  { code: 'PAB', name: 'Panamanian Balboa', symbol: 'B/.', locale: 'es-PA', decimals: 2 },
  { code: 'BOB', name: 'Bolivian Boliviano', symbol: 'Bs.', locale: 'es-BO', decimals: 2 },
  { code: 'HNL', name: 'Honduran Lempira', symbol: 'L', locale: 'es-HN', decimals: 2 },
  { code: 'PYG', name: 'Paraguayan Guaraní', symbol: '₲', locale: 'es-PY', decimals: 0 },
  { code: 'NIO', name: 'Nicaraguan Córdoba', symbol: 'C$', locale: 'es-NI', decimals: 2 },
  { code: 'BGN', name: 'Bulgarian Lev', symbol: 'лв', locale: 'bg-BG', decimals: 2 },
  { code: 'RSD', name: 'Serbian Dinar', symbol: 'дин', locale: 'sr-RS', decimals: 2 },
  { code: 'HRK', name: 'Croatian Kuna', symbol: 'kn', locale: 'hr-HR', decimals: 2 },
  { code: 'BAM', name: 'Bosnia-Herzegovina Convertible Mark', symbol: 'KM', locale: 'bs-BA', decimals: 2 },
  { code: 'ALL', name: 'Albanian Lek', symbol: 'L', locale: 'sq-AL', decimals: 2 },
  { code: 'MKD', name: 'Macedonian Denar', symbol: 'ден', locale: 'mk-MK', decimals: 2 },
  { code: 'MDL', name: 'Moldovan Leu', symbol: 'L', locale: 'ro-MD', decimals: 2 },
  { code: 'ISK', name: 'Icelandic Króna', symbol: 'kr', locale: 'is-IS', decimals: 0 },
  { code: 'UAH', name: 'Ukrainian Hryvnia', symbol: '₴', locale: 'uk-UA', decimals: 2 },
  { code: 'GEL', name: 'Georgian Lari', symbol: '₾', locale: 'ka-GE', decimals: 2 },
  { code: 'AMD', name: 'Armenian Dram', symbol: '֏', locale: 'hy-AM', decimals: 2 },
  { code: 'AZN', name: 'Azerbaijani Manat', symbol: '₼', locale: 'az-AZ', decimals: 2 },
  { code: 'KZT', name: 'Kazakhstani Tenge', symbol: '₸', locale: 'kk-KZ', decimals: 2 },
  { code: 'UZS', name: 'Uzbekistani Som', symbol: 'soʻm', locale: 'uz-UZ', decimals: 2 },
  { code: 'TJS', name: 'Tajikistani Somoni', symbol: 'ЅМ', locale: 'tg-TJ', decimals: 2 },
  { code: 'KGS', name: 'Kyrgystani Som', symbol: 'с', locale: 'ky-KG', decimals: 2 },
  { code: 'TMT', name: 'Turkmenistani Manat', symbol: 'm', locale: 'tk-TM', decimals: 2 },
  { code: 'AFN', name: 'Afghan Afghani', symbol: '؋', locale: 'ps-AF', decimals: 2 },
  { code: 'MVR', name: 'Maldivian Rufiyaa', symbol: 'Rf', locale: 'dv-MV', decimals: 2 },
  { code: 'BND', name: 'Brunei Dollar', symbol: 'B$', locale: 'ms-BN', decimals: 2 },
  { code: 'KHR', name: 'Cambodian Riel', symbol: '៛', locale: 'km-KH', decimals: 2 },
  { code: 'LAK', name: 'Lao Kip', symbol: '₭', locale: 'lo-LA', decimals: 2 },
  { code: 'MNT', name: 'Mongolian Tögrög', symbol: '₮', locale: 'mn-MN', decimals: 2 },
  { code: 'BWP', name: 'Botswana Pula', symbol: 'P', locale: 'en-BW', decimals: 2 },
  { code: 'NAD', name: 'Namibian Dollar', symbol: 'N$', locale: 'en-NA', decimals: 2 },
  { code: 'ZMW', name: 'Zambian Kwacha', symbol: 'ZK', locale: 'en-ZM', decimals: 2 },
  { code: 'MWK', name: 'Malawian Kwacha', symbol: 'MK', locale: 'en-MW', decimals: 2 },
  { code: 'TZS', name: 'Tanzanian Shilling', symbol: 'TSh', locale: 'sw-TZ', decimals: 2 },
  { code: 'UGX', name: 'Ugandan Shilling', symbol: 'USh', locale: 'en-UG', decimals: 0 },
  { code: 'RWF', name: 'Rwandan Franc', symbol: 'FRw', locale: 'en-RW', decimals: 0 },
  { code: 'BIF', name: 'Burundian Franc', symbol: 'FBu', locale: 'fr-BI', decimals: 0 },
  { code: 'ETB', name: 'Ethiopian Birr', symbol: 'Br', locale: 'am-ET', decimals: 2 },
  { code: 'MAD', name: 'Moroccan Dirham', symbol: 'د.م.', locale: 'ar-MA', decimals: 2 },
  { code: 'DZD', name: 'Algerian Dinar', symbol: 'د.ج', locale: 'ar-DZ', decimals: 2 },
  { code: 'TND', name: 'Tunisian Dinar', symbol: 'د.ت', locale: 'ar-TN', decimals: 3 },
  { code: 'LYD', name: 'Libyan Dinar', symbol: 'ل.د', locale: 'ar-LY', decimals: 3 },
  { code: 'SDG', name: 'Sudanese Pound', symbol: 'ج.س.', locale: 'ar-SD', decimals: 2 },
  { code: 'XAF', name: 'Central African CFA Franc', symbol: 'FCFA', locale: 'fr-CF', decimals: 0 },
  { code: 'XOF', name: 'West African CFA Franc', symbol: 'CFA', locale: 'fr-SN', decimals: 0 },
  { code: 'GNF', name: 'Guinean Franc', symbol: 'FG', locale: 'fr-GN', decimals: 0 },
  { code: 'SLL', name: 'Sierra Leonean Leone', symbol: 'Le', locale: 'en-SL', decimals: 2 },
  { code: 'LRD', name: 'Liberian Dollar', symbol: 'L$', locale: 'en-LR', decimals: 2 },
  { code: 'CVE', name: 'Cape Verdean Escudo', symbol: '$', locale: 'pt-CV', decimals: 2 },
  { code: 'GMD', name: 'Gambian Dalasi', symbol: 'D', locale: 'en-GM', decimals: 2 },
  { code: 'MRO', name: 'Mauritanian Ouguiya', symbol: 'UM', locale: 'ar-MR', decimals: 2 },
  { code: 'MGA', name: 'Malagasy Ariary', symbol: 'Ar', locale: 'mg-MG', decimals: 2 },
  { code: 'MUR', name: 'Mauritian Rupee', symbol: '₨', locale: 'en-MU', decimals: 2 },
  { code: 'SCR', name: 'Seychellois Rupee', symbol: '₨', locale: 'en-SC', decimals: 2 },
  { code: 'DJF', name: 'Djiboutian Franc', symbol: 'Fdj', locale: 'fr-DJ', decimals: 0 },
  { code: 'SOS', name: 'Somali Shilling', symbol: 'S', locale: 'so-SO', decimals: 2 },
  { code: 'AOA', name: 'Angolan Kwanza', symbol: 'Kz', locale: 'pt-AO', decimals: 2 },
  { code: 'MZN', name: 'Mozambican Metical', symbol: 'MT', locale: 'pt-MZ', decimals: 2 },
  { code: 'SZL', name: 'Swazi Lilangeni', symbol: 'L', locale: 'en-SZ', decimals: 2 },
  { code: 'LSL', name: 'Lesotho Loti', symbol: 'L', locale: 'en-LS', decimals: 2 },
  { code: 'BBD', name: 'Barbadian Dollar', symbol: 'Bds$', locale: 'en-BB', decimals: 2 },
  { code: 'JMD', name: 'Jamaican Dollar', symbol: 'J$', locale: 'en-JM', decimals: 2 },
  { code: 'TTD', name: 'Trinidad & Tobago Dollar', symbol: 'TT$', locale: 'en-TT', decimals: 2 },
  { code: 'BSD', name: 'Bahamian Dollar', symbol: 'B$', locale: 'en-BS', decimals: 2 },
  { code: 'BZD', name: 'Belize Dollar', symbol: 'BZ$', locale: 'en-BZ', decimals: 2 },
  { code: 'XCD', name: 'East Caribbean Dollar', symbol: '$', locale: 'en-AG', decimals: 2 },
  { code: 'HTG', name: 'Haitian Gourde', symbol: 'G', locale: 'fr-HT', decimals: 2 },
  { code: 'CUP', name: 'Cuban Peso', symbol: '$', locale: 'es-CU', decimals: 2 },
  { code: 'AWG', name: 'Aruban Florin', symbol: 'ƒ', locale: 'nl-AW', decimals: 2 },
  { code: 'ANG', name: 'Netherlands Antillean Guilder', symbol: 'ƒ', locale: 'nl-AN', decimals: 2 },
  { code: 'SRD', name: 'Surinamese Dollar', symbol: '$', locale: 'nl-SR', decimals: 2 },
  { code: 'GYD', name: 'Guyanese Dollar', symbol: '$', locale: 'en-GY', decimals: 2 },
  { code: 'FJD', name: 'Fijian Dollar', symbol: 'FJ$', locale: 'en-FJ', decimals: 2 },
  { code: 'SBD', name: 'Solomon Islands Dollar', symbol: 'SI$', locale: 'en-SB', decimals: 2 },
  { code: 'VUV', name: 'Vanuatu Vatu', symbol: 'VT', locale: 'en-VU', decimals: 0 },
  { code: 'PGK', name: 'Papua New Guinean Kina', symbol: 'K', locale: 'en-PG', decimals: 2 },
  { code: 'WST', name: 'Samoan Tala', symbol: 'WS$', locale: 'sm-WS', decimals: 2 },
  { code: 'TOP', name: 'Tongan Paʻanga', symbol: 'T$', locale: 'en-TO', decimals: 2 },
  { code: 'XPF', name: 'CFP Franc', symbol: '₣', locale: 'fr-PF', decimals: 0 },
  { code: 'BTC', name: 'Bitcoin', symbol: '₿', locale: 'en-US', decimals: 8 },
  { code: 'ETH', name: 'Ethereum', symbol: 'Ξ', locale: 'en-US', decimals: 8 }
];

let ratesCache = null;

export async function fetchExchangeRates(baseCurrency) {
  try {
    const cachedData = await getById('exchangeRates', baseCurrency);
    const now = Date.now();
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    
    if (cachedData && (now - cachedData.timestamp) < TWENTY_FOUR_HOURS) {
      ratesCache = { base: baseCurrency, rates: cachedData.rates };
      return ratesCache.rates;
    }

    if (!canMakeRequest('exchange_rate')) {
      if (cachedData) {
        ratesCache = { base: baseCurrency, rates: cachedData.rates };
        return cachedData.rates;
      }
      return null;
    }

    const response = await guardFetch(
      `https://open.er-api.com/v6/latest/${baseCurrency}`,
      {},
      { category: 'exchange_rate', description: 'Exchange rate refresh' }
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch rates: ${response.statusText}`);
    }
    const data = await response.json();
    
    await update('exchangeRates', {
      currency: baseCurrency,
      rates: data.rates,
      timestamp: now
    });

    ratesCache = { base: baseCurrency, rates: data.rates };
    return data.rates;
  } catch (error) {
    console.warn('[Currency Service] Error fetching rates, falling back to cache if available.', error.message || error);
    const cachedData = await getById('exchangeRates', baseCurrency);
    if (cachedData) {
      ratesCache = { base: baseCurrency, rates: cachedData.rates };
      return cachedData.rates;
    }
    return null;
  }
}

export function convert(amount, fromCurrency, toCurrency) {
  if (fromCurrency === toCurrency) return amount;
  
  if (!ratesCache) {
    console.warn('[Currency Service] Rates not loaded yet, returning original amount');
    return amount;
  }

  let amountInBase = amount;
  if (fromCurrency !== ratesCache.base) {
    const fromRate = ratesCache.rates[fromCurrency];
    if (!fromRate) return amount; // Cannot convert
    amountInBase = amount / fromRate;
  }

  if (toCurrency === ratesCache.base) {
    return amountInBase;
  }

  const toRate = ratesCache.rates[toCurrency];
  if (!toRate) return amount; // Cannot convert

  return amountInBase * toRate;
}

export function convertToBase(amount, fromCurrency) {
  if (!ratesCache) return amount;
  return convert(amount, fromCurrency, ratesCache.base);
}

export function toIndianNumberFormat(number) {
  const numStr = Math.abs(number).toString().split('.');
  let integerPart = numStr[0];
  const decimalPart = numStr.length > 1 ? '.' + numStr[1] : '';

  if (integerPart.length > 3) {
    const lastThree = integerPart.substring(integerPart.length - 3);
    const otherNumbers = integerPart.substring(0, integerPart.length - 3);
    integerPart = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + lastThree;
  }
  
  return (number < 0 ? '-' : '') + integerPart + decimalPart;
}

export function formatCurrency(amount, currencyCode, locale) {
  const currencyInfo = CURRENCIES.find(c => c.code === currencyCode) || CURRENCIES.find(c => c.code === 'USD');
  const targetLocale = locale || currencyInfo.locale;
  const isIndianSystem = currencyCode === 'INR' || targetLocale.includes('IN');
  const isCrypto = currencyCode === 'BTC' || currencyCode === 'ETH';
  
  const options = {
    minimumFractionDigits: currencyInfo.decimals,
    maximumFractionDigits: currencyInfo.decimals
  };
  
  let formattedNumber = '';

  if (isIndianSystem) {
    // Standard Intl.NumberFormat with 'en-IN' works, but we also have toIndianNumberFormat.
    // Intl.NumberFormat('en-IN') handles it natively.
    formattedNumber = new Intl.NumberFormat('en-IN', options).format(amount);
  } else if (isCrypto) {
    // Cryptos typically have custom formatting
    formattedNumber = Number(amount).toLocaleString('en-US', options);
    return `${currencyInfo.symbol} ${formattedNumber}`;
  } else {
    // Default Intl.NumberFormat
    formattedNumber = new Intl.NumberFormat(targetLocale, options).format(amount);
  }

  // Use Intl.NumberFormat currency formatting where appropriate if we want to rely entirely on it,
  // but to guarantee custom symbols placement and Arabic RTL, we might need custom logic.
  // Actually Intl.NumberFormat with style: 'currency' handles RTL and placements beautifully.
  try {
     return new Intl.NumberFormat(targetLocale, {
       style: 'currency',
       currency: currencyCode,
       minimumFractionDigits: currencyInfo.decimals,
       maximumFractionDigits: currencyInfo.decimals
     }).format(amount);
  } catch (e) {
    // Fallback if currency code is not supported by Intl
    return `${currencyInfo.symbol}${formattedNumber}`;
  }
}

export function formatCompact(amount, currencyCode) {
  const isIndian = currencyCode === 'INR';
  const absAmount = Math.abs(amount);
  let formatted = amount.toString();
  let suffix = '';

  if (isIndian) {
    if (absAmount >= 10000000) {
      formatted = (amount / 10000000).toFixed(1);
      suffix = 'Cr';
    } else if (absAmount >= 100000) {
      formatted = (amount / 100000).toFixed(1);
      suffix = 'L';
    } else if (absAmount >= 1000) {
      formatted = (amount / 1000).toFixed(1);
      suffix = 'K';
    } else {
      formatted = amount.toFixed(0);
    }
  } else {
    if (absAmount >= 1000000000) {
      formatted = (amount / 1000000000).toFixed(1);
      suffix = 'B';
    } else if (absAmount >= 1000000) {
      formatted = (amount / 1000000).toFixed(1);
      suffix = 'M';
    } else if (absAmount >= 1000) {
      formatted = (amount / 1000).toFixed(1);
      suffix = 'K';
    } else {
      formatted = amount.toFixed(0);
    }
  }
  
  // Remove trailing .0
  if (formatted.endsWith('.0')) {
    formatted = formatted.substring(0, formatted.length - 2);
  }
  
  const currencyInfo = CURRENCIES.find(c => c.code === currencyCode) || { symbol: currencyCode };
  return `${currencyInfo.symbol}${formatted}${suffix}`;
}

export function detectCurrencyFromLocale(locale) {
  const language = locale || (navigator && navigator.language) || 'en-US';
  
  // Try exact match
  const exactMatch = CURRENCIES.find(c => c.locale.toLowerCase() === language.toLowerCase());
  if (exactMatch) return exactMatch.code;
  
  // Try matching by country code (e.g. IN from en-IN)
  const parts = language.split('-');
  if (parts.length === 2) {
    const countryMatch = CURRENCIES.find(c => c.locale.split('-')[1]?.toLowerCase() === parts[1].toLowerCase());
    if (countryMatch) return countryMatch.code;
  }
  
  // Try matching by language code
  const langMatch = CURRENCIES.find(c => c.locale.split('-')[0]?.toLowerCase() === parts[0].toLowerCase());
  if (langMatch) return langMatch.code;
  
  return 'USD';
}
