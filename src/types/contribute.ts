export interface AppLinks {
  google?: string;
  apple?: string;
}

export interface ExternalLink {
  urls: string[]; // Multiple URLs to try, first matching one wins
  name: string;
  description: string;
  apps?: AppLinks;
  order?: number;
  icon?: string;
  color?: string;
  featured?: boolean;
}
