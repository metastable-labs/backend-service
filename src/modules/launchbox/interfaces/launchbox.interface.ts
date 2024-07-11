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

export interface ILaunchboxTokenLeaderboard {
  id: string;
  token_id: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  incentives: IIncentiveChannel[];
}

export interface IIncentiveChannel {
  id: string;
  name: string;
  info: string;
  actions: IIncentiveAction[];
}

export interface IIncentiveAction {
  id: string;
  name: string;
  description: string;
  points: number;
}

export interface ILeaderboardParticipant {
  id: string;
  associated_address: string;
  leaderboard_id: string;
  created_at: Date;
  updated_at: Date;
  completed_actions: IIncentiveAction[];
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

interface AboutSection {
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
  about_section: AboutSection;
}
