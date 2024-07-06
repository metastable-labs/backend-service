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
