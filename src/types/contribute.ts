export interface AppLinks {
  google?: string;
  apple?: string;
}

export interface ExternalLink {
  urls: string[]; // Multiple URLs to try, first matching one wins
  name: string;
  description: string;
  nameKey?: string; // Translation key for i18n
  descriptionKey?: string; // Translation key for i18n
  apps?: AppLinks;
  order?: number;
  icon?: string;
  color?: string;
  featured?: boolean;
  starRating?: number; // Number of stars to display (0-5)
}
