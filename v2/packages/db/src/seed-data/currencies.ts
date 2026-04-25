/**
 * ISO 4217 currency registry.
 * Covers GCC, MENA, and major world currencies.
 */

export interface CurrencySeed {
  code: string;
  name: string;
  nameAr: string;
  symbol: string;
  decimals: number;
}

export const currencies: readonly CurrencySeed[] = [
  // ─── GCC ───
  { code: 'KWD', name: 'Kuwaiti Dinar', nameAr: 'دينار كويتي', symbol: 'د.ك', decimals: 3 },
  { code: 'SAR', name: 'Saudi Riyal', nameAr: 'ريال سعودي', symbol: 'ر.س', decimals: 2 },
  { code: 'AED', name: 'UAE Dirham', nameAr: 'درهم إماراتي', symbol: 'د.إ', decimals: 2 },
  { code: 'BHD', name: 'Bahraini Dinar', nameAr: 'دينار بحريني', symbol: 'د.ب', decimals: 3 },
  { code: 'OMR', name: 'Omani Rial', nameAr: 'ريال عماني', symbol: 'ر.ع', decimals: 3 },
  { code: 'QAR', name: 'Qatari Riyal', nameAr: 'ريال قطري', symbol: 'ر.ق', decimals: 2 },

  // ─── MENA & neighbouring ───
  { code: 'EGP', name: 'Egyptian Pound', nameAr: 'جنيه مصري', symbol: 'ج.م', decimals: 2 },
  { code: 'JOD', name: 'Jordanian Dinar', nameAr: 'دينار أردني', symbol: 'د.أ', decimals: 3 },
  { code: 'LBP', name: 'Lebanese Pound', nameAr: 'ليرة لبنانية', symbol: 'ل.ل', decimals: 2 },
  { code: 'IQD', name: 'Iraqi Dinar', nameAr: 'دينار عراقي', symbol: 'د.ع', decimals: 3 },
  { code: 'YER', name: 'Yemeni Rial', nameAr: 'ريال يمني', symbol: '﷼', decimals: 2 },
  { code: 'SYP', name: 'Syrian Pound', nameAr: 'ليرة سورية', symbol: 'ل.س', decimals: 2 },
  { code: 'TRY', name: 'Turkish Lira', nameAr: 'ليرة تركية', symbol: '₺', decimals: 2 },
  { code: 'MAD', name: 'Moroccan Dirham', nameAr: 'درهم مغربي', symbol: 'د.م', decimals: 2 },
  { code: 'DZD', name: 'Algerian Dinar', nameAr: 'دينار جزائري', symbol: 'د.ج', decimals: 2 },
  { code: 'TND', name: 'Tunisian Dinar', nameAr: 'دينار تونسي', symbol: 'د.ت', decimals: 3 },
  { code: 'LYD', name: 'Libyan Dinar', nameAr: 'دينار ليبي', symbol: 'ل.د', decimals: 3 },
  { code: 'SDG', name: 'Sudanese Pound', nameAr: 'جنيه سوداني', symbol: 'ج.س', decimals: 2 },
  { code: 'ILS', name: 'Israeli Shekel', nameAr: 'شيكل إسرائيلي', symbol: '₪', decimals: 2 },
  { code: 'IRR', name: 'Iranian Rial', nameAr: 'ريال إيراني', symbol: '﷼', decimals: 2 },

  // ─── Major world ───
  { code: 'USD', name: 'US Dollar', nameAr: 'دولار أمريكي', symbol: '$', decimals: 2 },
  { code: 'EUR', name: 'Euro', nameAr: 'يورو', symbol: '€', decimals: 2 },
  { code: 'GBP', name: 'British Pound', nameAr: 'جنيه إسترليني', symbol: '£', decimals: 2 },
  { code: 'CHF', name: 'Swiss Franc', nameAr: 'فرنك سويسري', symbol: 'CHF', decimals: 2 },
  { code: 'JPY', name: 'Japanese Yen', nameAr: 'ين ياباني', symbol: '¥', decimals: 0 },
  { code: 'CNY', name: 'Chinese Yuan', nameAr: 'يوان صيني', symbol: '¥', decimals: 2 },
  { code: 'HKD', name: 'Hong Kong Dollar', nameAr: 'دولار هونغ كونغ', symbol: 'HK$', decimals: 2 },
  { code: 'SGD', name: 'Singapore Dollar', nameAr: 'دولار سنغافوري', symbol: 'S$', decimals: 2 },
  { code: 'KRW', name: 'South Korean Won', nameAr: 'وون كوري', symbol: '₩', decimals: 0 },
  { code: 'INR', name: 'Indian Rupee', nameAr: 'روبية هندية', symbol: '₹', decimals: 2 },
  { code: 'PKR', name: 'Pakistani Rupee', nameAr: 'روبية باكستانية', symbol: '₨', decimals: 2 },
  { code: 'BDT', name: 'Bangladeshi Taka', nameAr: 'تاكا', symbol: '৳', decimals: 2 },
  { code: 'LKR', name: 'Sri Lankan Rupee', nameAr: 'روبية سريلانكية', symbol: 'Rs', decimals: 2 },
  { code: 'NPR', name: 'Nepalese Rupee', nameAr: 'روبية نيبالية', symbol: 'Rs', decimals: 2 },
  { code: 'AFN', name: 'Afghan Afghani', nameAr: 'أفغاني', symbol: '؋', decimals: 2 },
  { code: 'THB', name: 'Thai Baht', nameAr: 'بات تايلاندي', symbol: '฿', decimals: 2 },
  { code: 'VND', name: 'Vietnamese Dong', nameAr: 'دونغ فيتنامي', symbol: '₫', decimals: 0 },
  { code: 'PHP', name: 'Philippine Peso', nameAr: 'بيزو فلبيني', symbol: '₱', decimals: 2 },
  { code: 'IDR', name: 'Indonesian Rupiah', nameAr: 'روبية إندونيسية', symbol: 'Rp', decimals: 2 },
  { code: 'MYR', name: 'Malaysian Ringgit', nameAr: 'رينغت ماليزي', symbol: 'RM', decimals: 2 },

  // ─── Europe ───
  { code: 'SEK', name: 'Swedish Krona', nameAr: 'كرونة سويدية', symbol: 'kr', decimals: 2 },
  { code: 'NOK', name: 'Norwegian Krone', nameAr: 'كرونة نرويجية', symbol: 'kr', decimals: 2 },
  { code: 'DKK', name: 'Danish Krone', nameAr: 'كرونة دنماركية', symbol: 'kr', decimals: 2 },
  { code: 'PLN', name: 'Polish Zloty', nameAr: 'زلوتي', symbol: 'zł', decimals: 2 },
  { code: 'CZK', name: 'Czech Koruna', nameAr: 'كرون تشيكي', symbol: 'Kč', decimals: 2 },
  { code: 'HUF', name: 'Hungarian Forint', nameAr: 'فورنت', symbol: 'Ft', decimals: 2 },
  { code: 'RON', name: 'Romanian Leu', nameAr: 'ليو', symbol: 'lei', decimals: 2 },
  { code: 'RUB', name: 'Russian Ruble', nameAr: 'روبل روسي', symbol: '₽', decimals: 2 },
  { code: 'UAH', name: 'Ukrainian Hryvnia', nameAr: 'هريفنيا', symbol: '₴', decimals: 2 },

  // ─── Americas ───
  { code: 'CAD', name: 'Canadian Dollar', nameAr: 'دولار كندي', symbol: 'C$', decimals: 2 },
  { code: 'MXN', name: 'Mexican Peso', nameAr: 'بيزو مكسيكي', symbol: '$', decimals: 2 },
  { code: 'BRL', name: 'Brazilian Real', nameAr: 'ريال برازيلي', symbol: 'R$', decimals: 2 },
  { code: 'ARS', name: 'Argentine Peso', nameAr: 'بيزو أرجنتيني', symbol: '$', decimals: 2 },
  { code: 'CLP', name: 'Chilean Peso', nameAr: 'بيزو تشيلي', symbol: '$', decimals: 0 },
  { code: 'COP', name: 'Colombian Peso', nameAr: 'بيزو كولومبي', symbol: '$', decimals: 2 },
  { code: 'PEN', name: 'Peruvian Sol', nameAr: 'سول بيروفي', symbol: 'S/', decimals: 2 },

  // ─── Africa ───
  { code: 'ZAR', name: 'South African Rand', nameAr: 'راند', symbol: 'R', decimals: 2 },
  { code: 'NGN', name: 'Nigerian Naira', nameAr: 'نايرا', symbol: '₦', decimals: 2 },
  { code: 'KES', name: 'Kenyan Shilling', nameAr: 'شلن كيني', symbol: 'KSh', decimals: 2 },
  { code: 'ETB', name: 'Ethiopian Birr', nameAr: 'بير إثيوبي', symbol: 'Br', decimals: 2 },
  { code: 'GHS', name: 'Ghanaian Cedi', nameAr: 'سيدي غاني', symbol: '₵', decimals: 2 },
  { code: 'UGX', name: 'Ugandan Shilling', nameAr: 'شلن أوغندي', symbol: 'USh', decimals: 0 },
  { code: 'TZS', name: 'Tanzanian Shilling', nameAr: 'شلن تنزاني', symbol: 'TSh', decimals: 2 },
  { code: 'DJF', name: 'Djiboutian Franc', nameAr: 'فرنك جيبوتي', symbol: 'Fdj', decimals: 0 },
  { code: 'SOS', name: 'Somali Shilling', nameAr: 'شلن صومالي', symbol: 'S', decimals: 2 },
  { code: 'MRU', name: 'Mauritanian Ouguiya', nameAr: 'أوقية', symbol: 'UM', decimals: 2 },
  { code: 'KMF', name: 'Comorian Franc', nameAr: 'فرنك قمري', symbol: 'CF', decimals: 0 },

  // ─── Oceania ───
  { code: 'AUD', name: 'Australian Dollar', nameAr: 'دولار أسترالي', symbol: 'A$', decimals: 2 },
  { code: 'NZD', name: 'New Zealand Dollar', nameAr: 'دولار نيوزيلندي', symbol: 'NZ$', decimals: 2 },
];
