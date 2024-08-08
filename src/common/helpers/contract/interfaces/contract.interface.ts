import { ethers } from 'ethers';
import { TransactionType } from '../../../../modules/launchbox/enums/launchbox.enum';

export interface Transaction {
  address: string;
  tokenValue: string;
  ethValue: string;
  fee: string;
  type: TransactionType;
  transactionHash: string;
  blockNumber: number;
}

export interface Holder {
  [key: string]: {
    balance: ethers.BigNumber;
    blockNumber: number;
  };
}

export interface AerodromePool {
  lp: string;
  symbol: string;
  decimals: number;
  liquidity: ethers.BigNumber;
  type: number;
  tick: number;
  sqrt_ratio: ethers.BigNumber;
  token0: string;
  reserve0: ethers.BigNumber;
  staked0: ethers.BigNumber;
  token1: string;
  reserve1: ethers.BigNumber;
  staked1: ethers.BigNumber;
  gauge: string;
  gauge_liquidity: ethers.BigNumber;
  gauge_alive: boolean;
  fee: string;
  bribe: string;
  factory: string;
  emissions: ethers.BigNumber;
  emissions_token: string;
  pool_fee: ethers.BigNumber;
  unstaked_fee: ethers.BigNumber;
  token0_fees: ethers.BigNumber;
  token1_fees: ethers.BigNumber;
  nfpm: string;
}
