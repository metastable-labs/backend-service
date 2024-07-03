export interface Chain {
  id: number;
  name: string;
  deployer_address: string;
  transaction_hash: string;
  block_number: number;
}

export interface Social {
  [key: string]: {
    channel: {
      channel_id: string;
      name: string;
      url: string;
    };
  };
}

interface Appearance {
  primary_color: string;
  secondary_color: string;
}

export interface Navigation {
  logo_url: string;
  buy_button_link: string;
}

interface HeroSection {
  title: string;
  description: string;
  image_url: string;
}

interface Tokenomics {
  [key: string]: string;
}

interface FaqQuestion {
  title: string;
  answer: string;
}

interface Faq {
  title: string;
  description: string;
  question: FaqQuestion[];
}

interface Footer {
  x: string;
  farcaster: string;
  telegram: string;
  chain_explorer: string;
}

export interface WebsiteBuilder {
  appearance: Appearance;
  navigation: Navigation;
  hero_section: HeroSection;
  tokenomics: Tokenomics;
  faq: Faq;
  footer: Footer;
}
