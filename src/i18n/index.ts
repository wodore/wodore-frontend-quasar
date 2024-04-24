import en from './locales/en.json';
import de from './locales/de.json';
import fr from './locales/fr.json';
import it from './locales/it.json';

export default {
  de: de,
  en: en,
  fr: fr,
  it: it,
};

export type Locale = 'de' | 'en' | 'fr' | 'it';
export type Locales = Locale[];
