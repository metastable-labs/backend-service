export interface Chain {
  id: number;
  name: string;
  transaction_hash?: string;
  deployer_address?: string;
}

interface Token {
  name: string;
  decimals: number;
  symbol: string;
  address: string;
}

interface Pool {
  pool_address: string;
  guage_address?: string;
  token_0: Token;
  token_1: Token;
}

interface Provider {
  v1?: Pool[];
  v2?: Pool[];
  v3?: Pool[];
  chain: Chain;
}

export interface Providers {
  uniswap: Provider;
  aerodrome: Provider;
}
