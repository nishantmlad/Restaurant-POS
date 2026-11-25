export interface CurrencyOption {
  value: string;
  label: string;
  symbol: string;
  name: string;
}

export const COMMON_CURRENCIES: CurrencyOption[] = [
  { value: "INR", label: "INR — Indian Rupee (₹)", symbol: "₹", name: "Indian Rupee" },
  { value: "USD", label: "USD — US Dollar ($)", symbol: "$", name: "US Dollar" },
  { value: "EUR", label: "EUR — Euro (€)", symbol: "€", name: "Euro" },
  { value: "GBP", label: "GBP — British Pound (£)", symbol: "£", name: "British Pound" },
  { value: "AED", label: "AED — UAE Dirham (د.إ)", symbol: "د.إ", name: "UAE Dirham" },
  { value: "SAR", label: "SAR — Saudi Riyal (﷼)", symbol: "﷼", name: "Saudi Riyal" },
  { value: "CAD", label: "CAD — Canadian Dollar ($)", symbol: "$", name: "Canadian Dollar" },
  { value: "AUD", label: "AUD — Australian Dollar ($)", symbol: "$", name: "Australian Dollar" },
  { value: "SGD", label: "SGD — Singapore Dollar ($)", symbol: "$", name: "Singapore Dollar" },
  { value: "JPY", label: "JPY — Japanese Yen (¥)", symbol: "¥", name: "Japanese Yen" },
  { value: "CNY", label: "CNY — Chinese Yuan (¥)", symbol: "¥", name: "Chinese Yuan" },
  { value: "NZD", label: "NZD — New Zealand Dollar ($)", symbol: "$", name: "New Zealand Dollar" },
  { value: "CHF", label: "CHF — Swiss Franc (CHF)", symbol: "CHF", name: "Swiss Franc" },
  { value: "HKD", label: "HKD — Hong Kong Dollar ($)", symbol: "$", name: "Hong Kong Dollar" },
  { value: "MYR", label: "MYR — Malaysian Ringgit (RM)", symbol: "RM", name: "Malaysian Ringgit" },
  { value: "THB", label: "THB — Thai Baht (฿)", symbol: "฿", name: "Thai Baht" },
  { value: "PHP", label: "PHP — Philippine Peso (₱)", symbol: "₱", name: "Philippine Peso" },
  { value: "IDR", label: "IDR — Indonesian Rupiah (Rp)", symbol: "Rp", name: "Indonesian Rupiah" },
  { value: "VND", label: "VND — Vietnamese Dong (₫)", symbol: "₫", name: "Vietnamese Dong" },
  { value: "KRW", label: "KRW — South Korean Won (₩)", symbol: "₩", name: "South Korean Won" },
  { value: "BRL", label: "BRL — Brazilian Real (R$)", symbol: "R$", name: "Brazilian Real" },
  { value: "MXN", label: "MXN — Mexican Peso ($)", symbol: "$", name: "Mexican Peso" },
  { value: "ZAR", label: "ZAR — South African Rand (R)", symbol: "R", name: "South African Rand" },
  { value: "QAR", label: "QAR — Qatari Riyal (﷼)", symbol: "﷼", name: "Qatari Riyal" },
  { value: "KWD", label: "KWD — Kuwaiti Dinar (د.ك)", symbol: "د.ك", name: "Kuwaiti Dinar" },
  { value: "BHD", label: "BHD — Bahraini Dinar (.د.ب)", symbol: ".د.ب", name: "Bahraini Dinar" },
  { value: "OMR", label: "OMR — Omani Rial (﷼)", symbol: "﷼", name: "Omani Rial" },
  { value: "NPR", label: "NPR — Nepalese Rupee (रू)", symbol: "रू", name: "Nepalese Rupee" },
  { value: "BDT", label: "BDT — Bangladeshi Taka (৳)", symbol: "৳", name: "Bangladeshi Taka" },
  { value: "LKR", label: "LKR — Sri Lankan Rupee (Rs)", symbol: "Rs", name: "Sri Lankan Rupee" },
  { value: "PKR", label: "PKR — Pakistani Rupee (Rs)", symbol: "Rs", name: "Pakistani Rupee" },
  { value: "TRY", label: "TRY — Turkish Lira (₺)", symbol: "₺", name: "Turkish Lira" },
  { value: "RUB", label: "RUB — Russian Ruble (₽)", symbol: "₽", name: "Russian Ruble" },
  { value: "PLN", label: "PLN — Polish Zloty (zł)", symbol: "zł", name: "Polish Zloty" },
  { value: "SEK", label: "SEK — Swedish Krona (kr)", symbol: "kr", name: "Swedish Krona" },
  { value: "NOK", label: "NOK — Norwegian Krone (kr)", symbol: "kr", name: "Norwegian Krone" },
  { value: "DKK", label: "DKK — Danish Krone (kr)", symbol: "kr", name: "Danish Krone" },
  { value: "EGP", label: "EGP — Egyptian Pound (E£)", symbol: "E£", name: "Egyptian Pound" },
  { value: "ILS", label: "ILS — Israeli Shekel (₪)", symbol: "₪", name: "Israeli Shekel" },
  { value: "KES", label: "KES — Kenyan Shilling (KSh)", symbol: "KSh", name: "Kenyan Shilling" },
  { value: "NGN", label: "NGN — Nigerian Naira (₦)", symbol: "₦", name: "Nigerian Naira" },
];

