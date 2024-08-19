import { Injectable, Logger } from '@nestjs/common';
import { ethers } from 'ethers';
import { env } from '../../config/env';
import { ActivityType } from '../../../modules/earn/enums/earn.enum';

@Injectable()
export class ContractService {
  private httpsProviders: {
    [key: string]: ethers.providers.JsonRpcProvider;
  } = {};

  private logger = new Logger(ContractService.name);

  getProvider(
    rpcUrl = env.blockchain.rpcUrl,
  ): ethers.providers.JsonRpcProvider {
    if (!this.httpsProviders[rpcUrl]) {
      this.httpsProviders[rpcUrl] = new ethers.providers.JsonRpcProvider(
        rpcUrl,
      );
    }

    return this.httpsProviders[rpcUrl];
  }

  getProviderWithSigner(wallet: ethers.Wallet, rpcUrl = env.blockchain.rpcUrl) {
    return wallet.connect(this.getProvider(rpcUrl));
  }

  getContract(
    address: string,
    abi: string[],
    provider?: ethers.Wallet,
  ): ethers.Contract {
    return new ethers.Contract(address, abi, provider || this.getProvider());
  }

  getTokenTransferEventAbi() {
    return [
      'event Transfer(address indexed from, address indexed to, uint value)',
    ];
  }

  getExchangeEventsAbi() {
    return [
      'event TokenBuy(uint256 ethIn, uint256 tokenOut, uint256 fee, address buyer)',
      'event TokenSell(uint256 tokenIn, uint256 ethOut, uint256 fee, address seller)',
    ];
  }

  async getNFTBalance(
    address: string,
    nftContractAddress: string,
  ): Promise<number> {
    const ABI = [
      'function balanceOf(address account, uint256 id) external view returns (uint256)',
      'function nextTokenId() external view returns (uint256)',
    ];
    const contract = this.getContract(nftContractAddress, ABI);

    const nextTokenId = await contract.nextTokenId();

    for (let i = 1; i < nextTokenId; i++) {
      const balance = await contract.balanceOf(address, i);
      if (balance > 0) {
        return i;
      }
    }

    return 0;
  }

  async getTokenPriceAndMarketCap(contractAddress: string): Promise<{
    priceEth: string;
    marketCapUsd: string;
  }> {
    const ABI = [
      'function marketCap() external view returns (uint256)',
      'function getTokenPriceinETH() external view returns (uint256 ethAmount)',
    ];

    const contract = new ethers.Contract(
      contractAddress,
      ABI,
      this.getProvider(),
    );

    const marketCap = await contract.marketCap();
    const price = await contract.getTokenPriceinETH();

    return {
      priceEth: ethers.utils.formatEther(price),
      marketCapUsd: ethers.utils.formatEther(marketCap),
    };
  }

  async getTokenLiquidity(
    tokenAddress: string,
    exchangeAddress: string,
    decimals: number,
  ): Promise<{
    tokenLiquidity: string;
    tokenEthLiquidity: string;
  }> {
    const provider = this.getProvider();

    const ABI = [
      'function balanceOf(address account) external view returns (uint256)',
    ];

    const contract = new ethers.Contract(tokenAddress, ABI, provider);

    const tokenLiquidityValue = await contract.balanceOf(exchangeAddress);
    const tokenEthLiquidityValue = await provider.getBalance(exchangeAddress);

    return {
      tokenLiquidity: ethers.utils.formatUnits(tokenLiquidityValue, decimals),
      tokenEthLiquidity: ethers.utils.formatEther(tokenEthLiquidityValue),
    };
  }

  async getTokenDeployerAddress(hash: string): Promise<string> {
    const provider = this.getProvider();
    const transaction = await provider.getTransaction(hash);
    await transaction.wait();

    return transaction.from;
  }

  async recordPoints(
    address: string,
    amount: number,
    activityType: ActivityType,
  ): Promise<boolean> {
    try {
      const ABI = [
        'function recordPoints(address user, uint256 pointsAmount, uint8 activityType) external',
      ];

      const wallet = new ethers.Wallet(
        env.admin.privateKey,
        this.getProvider(env.blockchain.testnetRpcUrl),
      );
      const provider = this.getProviderWithSigner(
        wallet,
        env.blockchain.testnetRpcUrl,
      );

      const contract = this.getContract(
        env.contract.pointAddress,
        ABI,
        provider,
      );

      const tx = await contract.recordPoints(address, amount, activityType);
      await tx.wait();

      this.logger.log(
        `Recorded ${amount} points for ${address} with tx ${tx.hash}`,
      );

      return true;
    } catch (error) {
      this.logger.error('Error recording points', error.stack, 'recordPoints');

      throw error;
    }
  }
}
