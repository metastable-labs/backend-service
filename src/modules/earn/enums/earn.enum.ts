export enum ActivitySlug {
  REFERRAL = 'referral',
  NFT = 'nft',
  SOCIAL = 'social',
  BRIDGE = 'bridge',
  LIQUIDITY_MIGRATION = 'liquidity-migration',
  LIQUIDITY_SUPPLY = 'liquidity-supply',
}

export enum ActivityType {
  LIQUIDITY_MIGRATION,
  BRIDGING,
  SOCIAL_INTERACTION,
  NFT_MINT,
  REFERRAL,
}

export enum MultiplierSlug {
  FEATURED_TOKEN = 'featured-token',
  SUPERMIGRATE_TOKEN = 'supermigrate-token',
  VERIFIED_ACCOUNT = 'verified-account',
  FOLLOWER = '2k-follower',
  STAKE_LP = 'stake-lp',
}

export enum TransactionStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
}

export enum TransactionType {
  EARN = 'earn',
  SPEND = 'spend',
  CLAIM = 'claim',
}
