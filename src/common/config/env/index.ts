import { config } from 'dotenv';
import * as envVar from 'env-var';
import { getEnvPath } from '../../utils/';

const envPath = getEnvPath();

config({ path: envPath });

export const env = {
  isProduction: envVar.get('APP_ENV').required().asString() === 'production',
  isStaging: envVar.get('APP_ENV').required().asString() === 'staging',
  isDevelopment: envVar.get('APP_ENV').required().asString() === 'development',
  isTest: envVar.get('APP_ENV').required().asString() === 'test',

  app: {
    env: envVar.get('APP_ENV').required().asString(),
    port: envVar.get('APP_PORT').required().asPortNumber(),
    name: envVar.get('APP_NAME').required().asString(),
    url: envVar.get('APP_URL').required().asString(),
    version: envVar.get('APP_VERSION').required().asString(),
  },
  db: {
    connection: envVar.get('DB_CONNECTION').required().asString(),
    url: envVar.get('DB_URL').required().asString(),
    synchronize: envVar.get('DB_SYNCHRONIZE').required().asBool(),
    logging: envVar.get('DB_LOGGING').required().asBool(),
  },
  jwt: {
    secret: envVar.get('JWT_SECRET').required().asString(),
    expiresIn: envVar.get('JWT_EXPIRES_IN').required().asString(),
  },
  throttle: {
    ttl: envVar.get('THROTTLE_TTL').required().asIntPositive(),
    limit: envVar.get('THROTTLE_LIMIT').required().asIntPositive(),
  },
  file: {
    maxSize: envVar.get('MAX_FILE_SIZE').required().asIntPositive(),
    allowedMimes: envVar.get('ALLOWED_MIME_TYPES').required().asArray(),
  },
  github: {
    url: envVar.get('GITHUB_URL').required().asString(),
    clientId: envVar.get('GITHUB_CLIENT_ID').required().asString(),
    clientSecret: envVar.get('GITHUB_CLIENT_SECRET').required().asString(),
    appId: envVar.get('GITHUB_APP_ID').required().asString(),
    appPrivateKey: envVar.get('GITHUB_APP_PRIVATE_KEY').required().asString(),
  },
  cloudinary: {
    cloudName: envVar.get('CLOUDINARY_CLOUD_NAME').required().asString(),
    apiKey: envVar.get('CLOUDINARY_API_KEY').required().asString(),
    apiSecret: envVar.get('CLOUDINARY_API_SECRET').required().asString(),
  },
  blockchain: {
    rpcUrl: envVar.get('BLOCKCHAIN_RPC_URL').required().asString(),
  },
  contract: {
    nftAddress: envVar.get('NFT_CONTRACT_ADDRESS').required().asString(),
  },
  client: {
    origin: envVar.get('CLIENT_ORIGIN').required().asString(),
  },
  airstack: {
    env: envVar.get('AIRSTACK_ENV').required().asString(),
    key: envVar.get('AIRSTACK_KEY').required().asString(),
  },

  blockchainPrice: {
    url: envVar.get('BLOCKCHAIN_PRICE_URL').required().asString(),
  },
  privy: {
    appId: envVar.get('PRIVY_APP_ID').required().asString(),
    appSecret: envVar.get('PRIVY_APP_SECRET').required().asString(),
  },
};
