/** Betradar-style locale catalog. Chrome strings fall back to EN when missing. */

export const LOCALES = [
  { id: "en", name: "English", flag: "🇬🇧" },
  { id: "pt", name: "Português", flag: "🇵🇹" },
  { id: "de", name: "Deutsch", flag: "🇩🇪" },
  { id: "fr", name: "Français", flag: "🇫🇷" },
  { id: "es", name: "Español", flag: "🇪🇸" },
  { id: "it", name: "Italiano", flag: "🇮🇹" },
  { id: "nl", name: "Nederlands", flag: "🇳🇱" },
  { id: "pl", name: "Polski", flag: "🇵🇱" },
  { id: "tr", name: "Türkçe", flag: "🇹🇷" },
  { id: "ru", name: "Русский", flag: "🇷🇺" },
  { id: "ar", name: "العربية", flag: "🇸🇦" },
  { id: "ja", name: "日本語", flag: "🇯🇵" },
  { id: "zh", name: "简体中文", flag: "🇨🇳" },
  { id: "ko", name: "한국어", flag: "🇰🇷" },
  { id: "hi", name: "हिन्दी", flag: "🇮🇳" },
  { id: "af", name: "Afrikaans", flag: "🇿🇦" },
  { id: "zu", name: "isiZulu", flag: "🇿🇦" },
  { id: "sv", name: "Svenska", flag: "🇸🇪" },
  { id: "da", name: "Dansk", flag: "🇩🇰" },
  { id: "no", name: "Norsk", flag: "🇳🇴" },
  { id: "fi", name: "Suomeksi", flag: "🇫🇮" },
  { id: "cs", name: "Česky", flag: "🇨🇿" },
  { id: "ro", name: "Română", flag: "🇷🇴" },
  { id: "hu", name: "Magyar", flag: "🇭🇺" },
  { id: "el", name: "Ελληνικά", flag: "🇬🇷" },
  { id: "he", name: "עברית", flag: "🇮🇱" },
  { id: "th", name: "ไทย", flag: "🇹🇭" },
  { id: "vi", name: "Tiếng Việt", flag: "🇻🇳" },
  { id: "id", name: "Bahasa Indonesia", flag: "🇮🇩" },
  { id: "uk", name: "Українська", flag: "🇺🇦" },
  { id: "hr", name: "Hrvatski", flag: "🇭🇷" },
  { id: "sk", name: "Slovenčina", flag: "🇸🇰" },
  { id: "sl", name: "Slovenščina", flag: "🇸🇮" },
  { id: "bg", name: "Български", flag: "🇧🇬" },
  { id: "sr", name: "Српски", flag: "🇷🇸" },
  { id: "bs", name: "Bosanski", flag: "🇧🇦" },
  { id: "sq", name: "Shqip", flag: "🇦🇱" },
  { id: "lt", name: "Lietuvių", flag: "🇱🇹" },
  { id: "lv", name: "Latviešu", flag: "🇱🇻" },
  { id: "et", name: "Eesti", flag: "🇪🇪" },
];

export const LANGS = LOCALES.map((row) => row.id);

export function localeFor(id) {
  return LOCALES.find((row) => row.id === id) || LOCALES[0];
}
