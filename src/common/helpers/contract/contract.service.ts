import { Injectable } from '@nestjs/common';
import { ethers } from 'ethers';
import { env } from '../../config/env';

@Injectable()
export class ContractService {
  private httpsProviders: {
    [key: string]: ethers.providers.JsonRpcProvider;
  } = {};

  getProvider(): ethers.providers.JsonRpcProvider {
    if (!this.httpsProviders[env.blockchain.rpcUrl]) {
      this.httpsProviders[env.blockchain.rpcUrl] =
        new ethers.providers.JsonRpcProvider(env.blockchain.rpcUrl);
    }

    return this.httpsProviders[env.blockchain.rpcUrl];
  }

  getContract(address: string, abi: string[]): ethers.Contract {
    return new ethers.Contract(address, abi, this.getProvider());
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
}
