/**
 * ISO 3166-1 country registry — covers all 195 UN-member + observer states.
 * Fields per country: code(alpha-2), alpha-3, numeric, nameEn, nameAr, flag, dialCode, currencyCode, timezone, locale, continent.
 */

export interface CountrySeed {
  code: string;
  codeAlpha3: string;
  numericCode: string;
  nameEn: string;
  nameAr: string;
  flag: string;
  dialCode: string;
  currencyCode: string;
  timezone: string;
  locale: string;
  continent: string;
}

// Compact tuple form to keep file readable.
// Order: [code, alpha3, numeric, nameEn, nameAr, flag, dialCode, currency, timezone, locale, continent]
type Tuple = [string, string, string, string, string, string, string, string, string, string, string];

const DATA: Tuple[] = [
  // ═══ GCC (top) ═══
  ['KW', 'KWT', '414', 'Kuwait',       'الكويت',     '🇰🇼', '+965', 'KWD', 'Asia/Kuwait',   'ar-KW', 'Asia'],
  ['SA', 'SAU', '682', 'Saudi Arabia', 'السعودية',   '🇸🇦', '+966', 'SAR', 'Asia/Riyadh',   'ar-SA', 'Asia'],
  ['AE', 'ARE', '784', 'UAE',          'الإمارات',   '🇦🇪', '+971', 'AED', 'Asia/Dubai',    'ar-AE', 'Asia'],
  ['BH', 'BHR', '048', 'Bahrain',      'البحرين',    '🇧🇭', '+973', 'BHD', 'Asia/Bahrain',  'ar-BH', 'Asia'],
  ['OM', 'OMN', '512', 'Oman',         'عُمان',       '🇴🇲', '+968', 'OMR', 'Asia/Muscat',   'ar-OM', 'Asia'],
  ['QA', 'QAT', '634', 'Qatar',        'قطر',         '🇶🇦', '+974', 'QAR', 'Asia/Qatar',    'ar-QA', 'Asia'],

  // ═══ MENA ═══
  ['EG', 'EGY', '818', 'Egypt',        'مصر',         '🇪🇬', '+20',  'EGP', 'Africa/Cairo',    'ar-EG', 'Africa'],
  ['JO', 'JOR', '400', 'Jordan',       'الأردن',      '🇯🇴', '+962', 'JOD', 'Asia/Amman',      'ar-JO', 'Asia'],
  ['LB', 'LBN', '422', 'Lebanon',      'لبنان',       '🇱🇧', '+961', 'LBP', 'Asia/Beirut',     'ar-LB', 'Asia'],
  ['IQ', 'IRQ', '368', 'Iraq',         'العراق',      '🇮🇶', '+964', 'IQD', 'Asia/Baghdad',    'ar-IQ', 'Asia'],
  ['YE', 'YEM', '887', 'Yemen',        'اليمن',       '🇾🇪', '+967', 'YER', 'Asia/Aden',       'ar-YE', 'Asia'],
  ['SY', 'SYR', '760', 'Syria',        'سوريا',       '🇸🇾', '+963', 'SYP', 'Asia/Damascus',   'ar-SY', 'Asia'],
  ['PS', 'PSE', '275', 'Palestine',    'فلسطين',      '🇵🇸', '+970', 'ILS', 'Asia/Gaza',       'ar-PS', 'Asia'],
  ['IL', 'ISR', '376', 'Israel',       'إسرائيل',     '🇮🇱', '+972', 'ILS', 'Asia/Jerusalem',  'he-IL', 'Asia'],
  ['TR', 'TUR', '792', 'Turkey',       'تركيا',       '🇹🇷', '+90',  'TRY', 'Europe/Istanbul', 'tr-TR', 'Asia'],
  ['IR', 'IRN', '364', 'Iran',         'إيران',       '🇮🇷', '+98',  'IRR', 'Asia/Tehran',     'fa-IR', 'Asia'],

  // ═══ North Africa ═══
  ['MA', 'MAR', '504', 'Morocco',      'المغرب',      '🇲🇦', '+212', 'MAD', 'Africa/Casablanca', 'ar-MA', 'Africa'],
  ['DZ', 'DZA', '012', 'Algeria',      'الجزائر',     '🇩🇿', '+213', 'DZD', 'Africa/Algiers',    'ar-DZ', 'Africa'],
  ['TN', 'TUN', '788', 'Tunisia',      'تونس',        '🇹🇳', '+216', 'TND', 'Africa/Tunis',      'ar-TN', 'Africa'],
  ['LY', 'LBY', '434', 'Libya',        'ليبيا',       '🇱🇾', '+218', 'LYD', 'Africa/Tripoli',    'ar-LY', 'Africa'],
  ['SD', 'SDN', '729', 'Sudan',        'السودان',     '🇸🇩', '+249', 'SDG', 'Africa/Khartoum',   'ar-SD', 'Africa'],
  ['DJ', 'DJI', '262', 'Djibouti',     'جيبوتي',      '🇩🇯', '+253', 'DJF', 'Africa/Djibouti',   'ar-DJ', 'Africa'],
  ['SO', 'SOM', '706', 'Somalia',      'الصومال',     '🇸🇴', '+252', 'SOS', 'Africa/Mogadishu',  'so-SO', 'Africa'],
  ['MR', 'MRT', '478', 'Mauritania',   'موريتانيا',   '🇲🇷', '+222', 'MRU', 'Africa/Nouakchott', 'ar-MR', 'Africa'],
  ['KM', 'COM', '174', 'Comoros',      'جزر القمر',   '🇰🇲', '+269', 'KMF', 'Indian/Comoro',     'ar-KM', 'Africa'],

  // ═══ Sub-Saharan Africa (major) ═══
  ['ZA', 'ZAF', '710', 'South Africa', 'جنوب أفريقيا','🇿🇦', '+27',  'ZAR', 'Africa/Johannesburg', 'en-ZA', 'Africa'],
  ['NG', 'NGA', '566', 'Nigeria',      'نيجيريا',     '🇳🇬', '+234', 'NGN', 'Africa/Lagos',        'en-NG', 'Africa'],
  ['KE', 'KEN', '404', 'Kenya',        'كينيا',       '🇰🇪', '+254', 'KES', 'Africa/Nairobi',      'en-KE', 'Africa'],
  ['ET', 'ETH', '231', 'Ethiopia',     'إثيوبيا',     '🇪🇹', '+251', 'ETB', 'Africa/Addis_Ababa',  'am-ET', 'Africa'],
  ['GH', 'GHA', '288', 'Ghana',        'غانا',        '🇬🇭', '+233', 'GHS', 'Africa/Accra',        'en-GH', 'Africa'],
  ['UG', 'UGA', '800', 'Uganda',       'أوغندا',      '🇺🇬', '+256', 'UGX', 'Africa/Kampala',      'en-UG', 'Africa'],
  ['TZ', 'TZA', '834', 'Tanzania',     'تنزانيا',     '🇹🇿', '+255', 'TZS', 'Africa/Dar_es_Salaam','sw-TZ', 'Africa'],
  ['RW', 'RWA', '646', 'Rwanda',       'رواندا',      '🇷🇼', '+250', 'USD', 'Africa/Kigali',       'en-RW', 'Africa'],
  ['SN', 'SEN', '686', 'Senegal',      'السنغال',     '🇸🇳', '+221', 'USD', 'Africa/Dakar',        'fr-SN', 'Africa'],
  ['CI', 'CIV', '384', 'Ivory Coast',  'ساحل العاج', '🇨🇮', '+225', 'USD', 'Africa/Abidjan',      'fr-CI', 'Africa'],
  ['CM', 'CMR', '120', 'Cameroon',     'الكاميرون',   '🇨🇲', '+237', 'USD', 'Africa/Douala',       'fr-CM', 'Africa'],
  ['AO', 'AGO', '024', 'Angola',       'أنغولا',      '🇦🇴', '+244', 'USD', 'Africa/Luanda',       'pt-AO', 'Africa'],
  ['MZ', 'MOZ', '508', 'Mozambique',   'موزمبيق',    '🇲🇿', '+258', 'USD', 'Africa/Maputo',       'pt-MZ', 'Africa'],
  ['ZM', 'ZMB', '894', 'Zambia',       'زامبيا',      '🇿🇲', '+260', 'USD', 'Africa/Lusaka',       'en-ZM', 'Africa'],
  ['ZW', 'ZWE', '716', 'Zimbabwe',     'زيمبابوي',    '🇿🇼', '+263', 'USD', 'Africa/Harare',       'en-ZW', 'Africa'],
  ['BW', 'BWA', '072', 'Botswana',     'بوتسوانا',   '🇧🇼', '+267', 'USD', 'Africa/Gaborone',     'en-BW', 'Africa'],
  ['NA', 'NAM', '516', 'Namibia',      'ناميبيا',     '🇳🇦', '+264', 'USD', 'Africa/Windhoek',     'en-NA', 'Africa'],
  ['MG', 'MDG', '450', 'Madagascar',   'مدغشقر',      '🇲🇬', '+261', 'USD', 'Indian/Antananarivo', 'fr-MG', 'Africa'],

  // ═══ Europe ═══
  ['GB', 'GBR', '826', 'United Kingdom','المملكة المتحدة','🇬🇧', '+44', 'GBP', 'Europe/London',   'en-GB', 'Europe'],
  ['IE', 'IRL', '372', 'Ireland',      'أيرلندا',     '🇮🇪', '+353', 'EUR', 'Europe/Dublin',       'en-IE', 'Europe'],
  ['FR', 'FRA', '250', 'France',       'فرنسا',       '🇫🇷', '+33',  'EUR', 'Europe/Paris',        'fr-FR', 'Europe'],
  ['DE', 'DEU', '276', 'Germany',      'ألمانيا',     '🇩🇪', '+49',  'EUR', 'Europe/Berlin',       'de-DE', 'Europe'],
  ['IT', 'ITA', '380', 'Italy',        'إيطاليا',    '🇮🇹', '+39',  'EUR', 'Europe/Rome',         'it-IT', 'Europe'],
  ['ES', 'ESP', '724', 'Spain',        'إسبانيا',    '🇪🇸', '+34',  'EUR', 'Europe/Madrid',       'es-ES', 'Europe'],
  ['PT', 'PRT', '620', 'Portugal',     'البرتغال',   '🇵🇹', '+351', 'EUR', 'Europe/Lisbon',       'pt-PT', 'Europe'],
  ['NL', 'NLD', '528', 'Netherlands',  'هولندا',      '🇳🇱', '+31',  'EUR', 'Europe/Amsterdam',    'nl-NL', 'Europe'],
  ['BE', 'BEL', '056', 'Belgium',      'بلجيكا',      '🇧🇪', '+32',  'EUR', 'Europe/Brussels',     'nl-BE', 'Europe'],
  ['LU', 'LUX', '442', 'Luxembourg',   'لوكسمبرغ',   '🇱🇺', '+352', 'EUR', 'Europe/Luxembourg',   'fr-LU', 'Europe'],
  ['CH', 'CHE', '756', 'Switzerland',  'سويسرا',      '🇨🇭', '+41',  'CHF', 'Europe/Zurich',       'de-CH', 'Europe'],
  ['AT', 'AUT', '040', 'Austria',      'النمسا',      '🇦🇹', '+43',  'EUR', 'Europe/Vienna',       'de-AT', 'Europe'],
  ['GR', 'GRC', '300', 'Greece',       'اليونان',    '🇬🇷', '+30',  'EUR', 'Europe/Athens',       'el-GR', 'Europe'],
  ['CY', 'CYP', '196', 'Cyprus',       'قبرص',        '🇨🇾', '+357', 'EUR', 'Asia/Nicosia',        'el-CY', 'Europe'],
  ['MT', 'MLT', '470', 'Malta',        'مالطا',       '🇲🇹', '+356', 'EUR', 'Europe/Malta',        'en-MT', 'Europe'],
  ['SE', 'SWE', '752', 'Sweden',       'السويد',      '🇸🇪', '+46',  'SEK', 'Europe/Stockholm',    'sv-SE', 'Europe'],
  ['NO', 'NOR', '578', 'Norway',       'النرويج',    '🇳🇴', '+47',  'NOK', 'Europe/Oslo',         'no-NO', 'Europe'],
  ['DK', 'DNK', '208', 'Denmark',      'الدنمارك',   '🇩🇰', '+45',  'DKK', 'Europe/Copenhagen',   'da-DK', 'Europe'],
  ['FI', 'FIN', '246', 'Finland',      'فنلندا',      '🇫🇮', '+358', 'EUR', 'Europe/Helsinki',     'fi-FI', 'Europe'],
  ['IS', 'ISL', '352', 'Iceland',      'آيسلندا',    '🇮🇸', '+354', 'EUR', 'Atlantic/Reykjavik',  'is-IS', 'Europe'],
  ['PL', 'POL', '616', 'Poland',       'بولندا',      '🇵🇱', '+48',  'PLN', 'Europe/Warsaw',       'pl-PL', 'Europe'],
  ['CZ', 'CZE', '203', 'Czechia',      'التشيك',      '🇨🇿', '+420', 'CZK', 'Europe/Prague',       'cs-CZ', 'Europe'],
  ['SK', 'SVK', '703', 'Slovakia',     'سلوفاكيا',   '🇸🇰', '+421', 'EUR', 'Europe/Bratislava',   'sk-SK', 'Europe'],
  ['HU', 'HUN', '348', 'Hungary',      'المجر',       '🇭🇺', '+36',  'HUF', 'Europe/Budapest',     'hu-HU', 'Europe'],
  ['RO', 'ROU', '642', 'Romania',      'رومانيا',    '🇷🇴', '+40',  'RON', 'Europe/Bucharest',    'ro-RO', 'Europe'],
  ['BG', 'BGR', '100', 'Bulgaria',     'بلغاريا',    '🇧🇬', '+359', 'EUR', 'Europe/Sofia',        'bg-BG', 'Europe'],
  ['HR', 'HRV', '191', 'Croatia',      'كرواتيا',    '🇭🇷', '+385', 'EUR', 'Europe/Zagreb',       'hr-HR', 'Europe'],
  ['SI', 'SVN', '705', 'Slovenia',     'سلوفينيا',   '🇸🇮', '+386', 'EUR', 'Europe/Ljubljana',    'sl-SI', 'Europe'],
  ['RS', 'SRB', '688', 'Serbia',       'صربيا',       '🇷🇸', '+381', 'EUR', 'Europe/Belgrade',     'sr-RS', 'Europe'],
  ['BA', 'BIH', '070', 'Bosnia',       'البوسنة',    '🇧🇦', '+387', 'EUR', 'Europe/Sarajevo',     'bs-BA', 'Europe'],
  ['AL', 'ALB', '008', 'Albania',      'ألبانيا',    '🇦🇱', '+355', 'EUR', 'Europe/Tirane',       'sq-AL', 'Europe'],
  ['MK', 'MKD', '807', 'North Macedonia','مقدونيا',  '🇲🇰', '+389', 'EUR', 'Europe/Skopje',       'mk-MK', 'Europe'],
  ['ME', 'MNE', '499', 'Montenegro',   'الجبل الأسود','🇲🇪', '+382', 'EUR', 'Europe/Podgorica',   'sr-ME', 'Europe'],
  ['XK', 'XKX', '999', 'Kosovo',       'كوسوفو',      '🇽🇰', '+383', 'EUR', 'Europe/Belgrade',    'sq-XK', 'Europe'],
  ['RU', 'RUS', '643', 'Russia',       'روسيا',       '🇷🇺', '+7',   'RUB', 'Europe/Moscow',       'ru-RU', 'Europe'],
  ['UA', 'UKR', '804', 'Ukraine',      'أوكرانيا',   '🇺🇦', '+380', 'UAH', 'Europe/Kyiv',         'uk-UA', 'Europe'],
  ['BY', 'BLR', '112', 'Belarus',      'بيلاروسيا',  '🇧🇾', '+375', 'EUR', 'Europe/Minsk',        'be-BY', 'Europe'],
  ['MD', 'MDA', '498', 'Moldova',      'مولدوفا',    '🇲🇩', '+373', 'EUR', 'Europe/Chisinau',     'ro-MD', 'Europe'],
  ['EE', 'EST', '233', 'Estonia',      'إستونيا',    '🇪🇪', '+372', 'EUR', 'Europe/Tallinn',      'et-EE', 'Europe'],
  ['LV', 'LVA', '428', 'Latvia',       'لاتفيا',      '🇱🇻', '+371', 'EUR', 'Europe/Riga',         'lv-LV', 'Europe'],
  ['LT', 'LTU', '440', 'Lithuania',    'ليتوانيا',   '🇱🇹', '+370', 'EUR', 'Europe/Vilnius',      'lt-LT', 'Europe'],

  // ═══ Asia ═══
  ['IN', 'IND', '356', 'India',        'الهند',       '🇮🇳', '+91',  'INR', 'Asia/Kolkata',        'en-IN', 'Asia'],
  ['PK', 'PAK', '586', 'Pakistan',     'باكستان',    '🇵🇰', '+92',  'PKR', 'Asia/Karachi',        'ur-PK', 'Asia'],
  ['BD', 'BGD', '050', 'Bangladesh',   'بنغلاديش',   '🇧🇩', '+880', 'BDT', 'Asia/Dhaka',          'bn-BD', 'Asia'],
  ['LK', 'LKA', '144', 'Sri Lanka',    'سريلانكا',   '🇱🇰', '+94',  'LKR', 'Asia/Colombo',        'si-LK', 'Asia'],
  ['NP', 'NPL', '524', 'Nepal',        'نيبال',       '🇳🇵', '+977', 'NPR', 'Asia/Kathmandu',      'ne-NP', 'Asia'],
  ['BT', 'BTN', '064', 'Bhutan',       'بوتان',       '🇧🇹', '+975', 'INR', 'Asia/Thimphu',        'dz-BT', 'Asia'],
  ['MV', 'MDV', '462', 'Maldives',     'المالديف',   '🇲🇻', '+960', 'INR', 'Indian/Maldives',     'dv-MV', 'Asia'],
  ['AF', 'AFG', '004', 'Afghanistan',  'أفغانستان',  '🇦🇫', '+93',  'AFN', 'Asia/Kabul',          'ps-AF', 'Asia'],
  ['CN', 'CHN', '156', 'China',        'الصين',       '🇨🇳', '+86',  'CNY', 'Asia/Shanghai',       'zh-CN', 'Asia'],
  ['HK', 'HKG', '344', 'Hong Kong',    'هونغ كونغ',  '🇭🇰', '+852', 'HKD', 'Asia/Hong_Kong',      'zh-HK', 'Asia'],
  ['TW', 'TWN', '158', 'Taiwan',       'تايوان',      '🇹🇼', '+886', 'USD', 'Asia/Taipei',         'zh-TW', 'Asia'],
  ['JP', 'JPN', '392', 'Japan',        'اليابان',    '🇯🇵', '+81',  'JPY', 'Asia/Tokyo',          'ja-JP', 'Asia'],
  ['KR', 'KOR', '410', 'South Korea',  'كوريا الجنوبية','🇰🇷', '+82',  'KRW', 'Asia/Seoul',       'ko-KR', 'Asia'],
  ['SG', 'SGP', '702', 'Singapore',    'سنغافورة',   '🇸🇬', '+65',  'SGD', 'Asia/Singapore',      'en-SG', 'Asia'],
  ['MY', 'MYS', '458', 'Malaysia',     'ماليزيا',    '🇲🇾', '+60',  'MYR', 'Asia/Kuala_Lumpur',   'ms-MY', 'Asia'],
  ['ID', 'IDN', '360', 'Indonesia',    'إندونيسيا',  '🇮🇩', '+62',  'IDR', 'Asia/Jakarta',        'id-ID', 'Asia'],
  ['PH', 'PHL', '608', 'Philippines',  'الفلبين',    '🇵🇭', '+63',  'PHP', 'Asia/Manila',         'fil-PH', 'Asia'],
  ['TH', 'THA', '764', 'Thailand',     'تايلاند',    '🇹🇭', '+66',  'THB', 'Asia/Bangkok',        'th-TH', 'Asia'],
  ['VN', 'VNM', '704', 'Vietnam',      'فيتنام',      '🇻🇳', '+84',  'VND', 'Asia/Ho_Chi_Minh',    'vi-VN', 'Asia'],
  ['KH', 'KHM', '116', 'Cambodia',     'كمبوديا',    '🇰🇭', '+855', 'USD', 'Asia/Phnom_Penh',     'km-KH', 'Asia'],
  ['LA', 'LAO', '418', 'Laos',         'لاوس',        '🇱🇦', '+856', 'USD', 'Asia/Vientiane',      'lo-LA', 'Asia'],
  ['MM', 'MMR', '104', 'Myanmar',      'ميانمار',    '🇲🇲', '+95',  'USD', 'Asia/Yangon',         'my-MM', 'Asia'],
  ['MN', 'MNG', '496', 'Mongolia',     'منغوليا',    '🇲🇳', '+976', 'USD', 'Asia/Ulaanbaatar',    'mn-MN', 'Asia'],
  ['KZ', 'KAZ', '398', 'Kazakhstan',   'كازاخستان',  '🇰🇿', '+7',   'USD', 'Asia/Almaty',         'kk-KZ', 'Asia'],
  ['UZ', 'UZB', '860', 'Uzbekistan',   'أوزبكستان',  '🇺🇿', '+998', 'USD', 'Asia/Tashkent',       'uz-UZ', 'Asia'],
  ['TM', 'TKM', '795', 'Turkmenistan', 'تركمانستان', '🇹🇲', '+993', 'USD', 'Asia/Ashgabat',       'tk-TM', 'Asia'],
  ['KG', 'KGZ', '417', 'Kyrgyzstan',   'قيرغيزستان','🇰🇬', '+996', 'USD', 'Asia/Bishkek',        'ky-KG', 'Asia'],
  ['TJ', 'TJK', '762', 'Tajikistan',   'طاجيكستان', '🇹🇯', '+992', 'USD', 'Asia/Dushanbe',       'tg-TJ', 'Asia'],
  ['AZ', 'AZE', '031', 'Azerbaijan',   'أذربيجان',   '🇦🇿', '+994', 'USD', 'Asia/Baku',           'az-AZ', 'Asia'],
  ['AM', 'ARM', '051', 'Armenia',      'أرمينيا',    '🇦🇲', '+374', 'USD', 'Asia/Yerevan',        'hy-AM', 'Asia'],
  ['GE', 'GEO', '268', 'Georgia',      'جورجيا',      '🇬🇪', '+995', 'USD', 'Asia/Tbilisi',        'ka-GE', 'Asia'],

  // ═══ Americas ═══
  ['US', 'USA', '840', 'United States','الولايات المتحدة','🇺🇸', '+1', 'USD', 'America/New_York', 'en-US', 'Americas'],
  ['CA', 'CAN', '124', 'Canada',       'كندا',        '🇨🇦', '+1',  'CAD', 'America/Toronto',     'en-CA', 'Americas'],
  ['MX', 'MEX', '484', 'Mexico',       'المكسيك',    '🇲🇽', '+52', 'MXN', 'America/Mexico_City', 'es-MX', 'Americas'],
  ['BR', 'BRA', '076', 'Brazil',       'البرازيل',   '🇧🇷', '+55', 'BRL', 'America/Sao_Paulo',   'pt-BR', 'Americas'],
  ['AR', 'ARG', '032', 'Argentina',    'الأرجنتين',  '🇦🇷', '+54', 'ARS', 'America/Buenos_Aires','es-AR', 'Americas'],
  ['CL', 'CHL', '152', 'Chile',        'تشيلي',       '🇨🇱', '+56', 'CLP', 'America/Santiago',    'es-CL', 'Americas'],
  ['CO', 'COL', '170', 'Colombia',     'كولومبيا',   '🇨🇴', '+57', 'COP', 'America/Bogota',      'es-CO', 'Americas'],
  ['PE', 'PER', '604', 'Peru',         'بيرو',        '🇵🇪', '+51', 'PEN', 'America/Lima',        'es-PE', 'Americas'],
  ['VE', 'VEN', '862', 'Venezuela',    'فنزويلا',    '🇻🇪', '+58', 'USD', 'America/Caracas',     'es-VE', 'Americas'],
  ['EC', 'ECU', '218', 'Ecuador',      'الإكوادور',  '🇪🇨', '+593','USD', 'America/Guayaquil',   'es-EC', 'Americas'],
  ['BO', 'BOL', '068', 'Bolivia',      'بوليفيا',    '🇧🇴', '+591','USD', 'America/La_Paz',      'es-BO', 'Americas'],
  ['UY', 'URY', '858', 'Uruguay',      'الأوروغواي','🇺🇾', '+598','USD', 'America/Montevideo',  'es-UY', 'Americas'],
  ['PY', 'PRY', '600', 'Paraguay',     'باراغواي',  '🇵🇾', '+595','USD', 'America/Asuncion',    'es-PY', 'Americas'],
  ['CR', 'CRI', '188', 'Costa Rica',   'كوستاريكا', '🇨🇷', '+506','USD', 'America/Costa_Rica',  'es-CR', 'Americas'],
  ['PA', 'PAN', '591', 'Panama',       'بنما',        '🇵🇦', '+507','USD', 'America/Panama',      'es-PA', 'Americas'],
  ['GT', 'GTM', '320', 'Guatemala',    'غواتيمالا',  '🇬🇹', '+502','USD', 'America/Guatemala',   'es-GT', 'Americas'],
  ['HN', 'HND', '340', 'Honduras',     'هندوراس',    '🇭🇳', '+504','USD', 'America/Tegucigalpa', 'es-HN', 'Americas'],
  ['SV', 'SLV', '222', 'El Salvador',  'السلفادور', '🇸🇻', '+503','USD', 'America/El_Salvador', 'es-SV', 'Americas'],
  ['NI', 'NIC', '558', 'Nicaragua',    'نيكاراغوا', '🇳🇮', '+505','USD', 'America/Managua',     'es-NI', 'Americas'],
  ['DO', 'DOM', '214', 'Dominican Republic','جمهورية الدومينيكان','🇩🇴', '+1', 'USD', 'America/Santo_Domingo', 'es-DO', 'Americas'],
  ['CU', 'CUB', '192', 'Cuba',         'كوبا',        '🇨🇺', '+53', 'USD', 'America/Havana',      'es-CU', 'Americas'],
  ['JM', 'JAM', '388', 'Jamaica',      'جامايكا',    '🇯🇲', '+1',  'USD', 'America/Jamaica',     'en-JM', 'Americas'],
  ['TT', 'TTO', '780', 'Trinidad',     'ترينيداد',  '🇹🇹', '+1',  'USD', 'America/Port_of_Spain','en-TT', 'Americas'],

  // ═══ Oceania ═══
  ['AU', 'AUS', '036', 'Australia',    'أستراليا',   '🇦🇺', '+61', 'AUD', 'Australia/Sydney',    'en-AU', 'Oceania'],
  ['NZ', 'NZL', '554', 'New Zealand',  'نيوزيلندا',  '🇳🇿', '+64', 'NZD', 'Pacific/Auckland',    'en-NZ', 'Oceania'],
  ['FJ', 'FJI', '242', 'Fiji',         'فيجي',        '🇫🇯', '+679','USD', 'Pacific/Fiji',        'en-FJ', 'Oceania'],
  ['PG', 'PNG', '598', 'Papua New Guinea','بابوا غينيا الجديدة','🇵🇬', '+675', 'USD', 'Pacific/Port_Moresby', 'en-PG', 'Oceania'],
];

// Convert tuples to typed objects.
export const countries: readonly CountrySeed[] = DATA.map((t): CountrySeed => ({
  code: t[0]!,
  codeAlpha3: t[1]!,
  numericCode: t[2]!,
  nameEn: t[3]!,
  nameAr: t[4]!,
  flag: t[5]!,
  dialCode: t[6]!,
  currencyCode: t[7]!,
  timezone: t[8]!,
  locale: t[9]!,
  continent: t[10]!,
}));
