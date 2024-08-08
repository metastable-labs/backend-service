import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { v4 as uuidv4 } from 'uuid';
import { MongoRepository } from 'typeorm';
import { LiquidityPool } from './entities/liquidity.entity';
import { PaginateDto } from './dtos/liquidity.dto';
import { IResponse } from '../../common/interfaces/response.interface';
import { ServiceError } from '../../common/errors/service.error';
import { successResponse } from '../../common/responses/success.helper';
import { Providers } from './interfaces/liquidity.interface';

@Injectable()
export class LiquidityService {
  constructor(
    @InjectRepository(LiquidityPool)
    private readonly liquidityPoolRepository: MongoRepository<LiquidityPool>,
  ) {}

  private readonly logger = new Logger(LiquidityService.name);

  async getPools(query: PaginateDto): Promise<IResponse | ServiceError> {
    try {
      const { skip, take } = query;
      const totalLiquidityPools = await this.liquidityPoolRepository.count({
        is_active: true,
      });

      const liquidityPools = await this.liquidityPoolRepository.find({
        where: {
          is_active: true,
        },
        skip,
        take,
        order: {
          created_at: 'DESC',
        },
      });

      return successResponse({
        status: true,
        message: 'Liquidity pools fetched',
        data: liquidityPools,
        meta: {
          take,
          skip,
          total_count: totalLiquidityPools,
        },
      });
    } catch (error) {
      if (error instanceof ServiceError) {
        return error.toErrorResponse();
      }

      throw new ServiceError(
        'Error getting all liquidity pools',
        HttpStatus.INTERNAL_SERVER_ERROR,
      ).toErrorResponse();
    }
  }

  async getOnePool(id: string): Promise<IResponse | ServiceError> {
    try {
      const liquidityPool = await this.liquidityPoolRepository.findOne({
        where: {
          id,
          is_active: true,
        },
      });

      if (!liquidityPool) {
        throw new ServiceError(
          'Liquidity pool not found',
          HttpStatus.NOT_FOUND,
        );
      }

      return successResponse({
        status: true,
        message: 'Liquidity pool fetched',
        data: liquidityPool,
      });
    } catch (error) {
      if (error instanceof ServiceError) {
        return error.toErrorResponse();
      }

      throw new ServiceError(
        'Error getting liquidity pool',
        HttpStatus.INTERNAL_SERVER_ERROR,
      ).toErrorResponse();
    }
  }

  async seedPools() {
    const chains = {
      ethereum: {
        id: 1,
        name: 'Ethereum',
      },
      base: {
        id: 8453,
        name: 'Base',
      },
    };

    const ethereumTokens = {
      USDC: {
        name: 'USD Coin',
        symbol: 'USDC',
        decimals: 6,
        address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      },
      WETH: {
        name: 'Wrapped Ether',
        symbol: 'WETH',
        decimals: 18,
        address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      },
      DAI: {
        name: 'Dai Stablecoin',
        symbol: 'DAI',
        decimals: 18,
        address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      },
      USDT: {
        name: 'Tether USD',
        symbol: 'USDT',
        decimals: 6,
        address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      },
      wstETH: {
        name: 'Wrapped liquid staked Ether 2.0',
        symbol: 'wstETH',
        decimals: 18,
        address: '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0',
      },
      weETH: {
        name: 'Wrapped eETH',
        symbol: 'weETH',
        decimals: 18,
        address: '0xCd5fE23C85820F7B72D0926FC9b05b43E359b7ee',
      },
      PEPE: {
        name: 'Pepe',
        symbol: 'PEPE',
        decimals: 18,
        address: '0x6982508145454Ce325dDbE47a25d4ec3d2311933',
      },
    };

    const baseTokens = {
      WETH: {
        name: 'Wrapped Ether',
        symbol: 'WETH',
        decimals: 18,
        address: '0x4200000000000000000000000000000000000006',
      },
      USDC: {
        name: 'USD Coin',
        symbol: 'USDC',
        decimals: 6,
        address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      },
      DAI: {
        name: 'Dai Stablecoin',
        symbol: 'DAI',
        decimals: 18,
        address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
      },
      USDT: {
        name: 'Tether USD',
        symbol: 'USDT',
        decimals: 6,
        address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
      },
      wstETH: {
        name: 'Wrapped liquid staked Ether 2.0',
        symbol: 'wstETH',
        decimals: 18,
        address: '0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452',
      },
      weETH: {
        name: 'Wrapped eETH',
        symbol: 'weETH',
        decimals: 18,
        address: '0x04C0599Ae5A44757c0af6F9eC3b93da8976c150A',
      },
      PEPE: {
        name: 'Pepe',
        symbol: 'PEPE',
        decimals: 18,
        address: '0xB4fDe59a779991bfB6a52253B51947828b982be3',
      },
    };

    const pools: Providers[] = [
      {
        uniswap: {
          v2: [
            {
              pool_address: '0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc',
              token_0: ethereumTokens.USDC,
              token_1: ethereumTokens.WETH,
            },
          ],
          v3: [
            {
              pool_address: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640',
              token_0: ethereumTokens.USDC,
              token_1: ethereumTokens.WETH,
            },
          ],
          chain: chains.ethereum,
        },
        aerodrome: {
          v1: [
            {
              pool_address: '0xcDAC0d6c6C59727a65F871236188350531885C43',
              guage_address: '0x519BBD1Dd8C6A94C46080E24f316c14Ee758C025',
              token_0: baseTokens.WETH,
              token_1: baseTokens.USDC,
            },
          ],
          chain: chains.base,
        },
      },
      {
        uniswap: {
          v3: [
            {
              pool_address: '0x5777d92f208679DB4b9778590Fa3CAB3aC9e2168',
              token_0: ethereumTokens.DAI,
              token_1: ethereumTokens.USDC,
            },
          ],
          chain: chains.ethereum,
        },
        aerodrome: {
          v1: [
            {
              pool_address: '0x67b00B46FA4f4F24c03855c5C8013C0B938B3eEc',
              guage_address: '0x640e9ef68e1353112fF18826c4eDa844E1dC5eD0',
              token_0: baseTokens.DAI,
              token_1: baseTokens.USDC,
            },
          ],
          chain: chains.base,
        },
      },
      {
        uniswap: {
          v3: [
            {
              pool_address: '0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8',
              token_0: ethereumTokens.DAI,
              token_1: ethereumTokens.WETH,
            },
          ],
          chain: chains.ethereum,
        },
        aerodrome: {
          v1: [
            {
              pool_address: '0x9287C921f5d920cEeE0d07d7c58d476E46aCC640',
              guage_address: '0x36BdA777CCBefE881ed729AfF7F1f06779f4199a',
              token_0: baseTokens.WETH,
              token_1: baseTokens.DAI,
            },
          ],
          chain: chains.base,
        },
      },
      {
        uniswap: {
          v2: [
            {
              pool_address: '0x3041CbD36888bECc7bbCBc0045E3B1f144466f5f',
              token_0: ethereumTokens.USDC,
              token_1: ethereumTokens.USDT,
            },
          ],
          v3: [
            {
              pool_address: '0x3416cF6C708Da44DB2624D63ea0AAef7113527C6',
              token_0: ethereumTokens.USDC,
              token_1: ethereumTokens.USDT,
            },
          ],
          chain: chains.ethereum,
        },
        aerodrome: {
          v1: [
            {
              pool_address: '0xa41Bc0AFfbA7Fd420d186b84899d7ab2aC57fcD1',
              guage_address: '0xBd85D45f1636fCEB2359d9Dcf839f12b3cF5AF3F',
              token_0: baseTokens.USDC,
              token_1: baseTokens.USDT,
            },
          ],
          chain: chains.base,
        },
      },
      {
        uniswap: {
          v2: [
            {
              pool_address: '0x0d4a11d5EEaaC28EC3F61d100daF4d40471f1852',
              token_0: ethereumTokens.WETH,
              token_1: ethereumTokens.USDT,
            },
          ],
          v3: [
            {
              pool_address: '0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36',
              token_0: ethereumTokens.WETH,
              token_1: ethereumTokens.USDT,
            },
          ],
          chain: chains.ethereum,
        },
        aerodrome: {
          v1: [
            {
              pool_address: '0x9785eF59E2b499fB741674ecf6fAF912Df7b3C1b',
              guage_address: '0x2c0CbF25Bb64687d11ea2E4a3dc893D56Ca39c10',
              token_0: baseTokens.WETH,
              token_1: baseTokens.USDT,
            },
          ],
          chain: chains.base,
        },
      },
      {
        uniswap: {
          v3: [
            {
              pool_address: '0x109830a1AAaD605BbF02a9dFA7B0B92EC2FB7dAa',
              token_0: ethereumTokens.wstETH,
              token_1: ethereumTokens.WETH,
            },
          ],
          chain: chains.ethereum,
        },
        aerodrome: {
          v1: [
            {
              pool_address: '0x861A2922bE165a5Bd41b1E482B49216b465e1B5F',
              guage_address: '0x2A1f7bf46bd975b5004b61c6040597E1B6117040',
              token_0: baseTokens.WETH,
              token_1: baseTokens.wstETH,
            },
            {
              pool_address: '0xA6385c73961dd9C58db2EF0c4EB98cE4B60651e8',
              guage_address: '0xDf7c8F17Ab7D47702A4a4b6D951d2A4c90F99bf4',
              token_0: baseTokens.WETH,
              token_1: baseTokens.wstETH,
            },
          ],
          chain: chains.base,
        },
      },
      {
        uniswap: {
          v3: [
            {
              pool_address: '0x202A6012894Ae5c288eA824cbc8A9bfb26A49b93',
              token_0: ethereumTokens.WETH,
              token_1: ethereumTokens.weETH,
            },
            {
              pool_address: '0x7A415B19932c0105c82FDB6b720bb01B0CC2CAe3',
              token_0: ethereumTokens.WETH,
              token_1: ethereumTokens.weETH,
            },
          ],
          chain: chains.ethereum,
        },
        aerodrome: {
          v1: [
            {
              pool_address: '0x91F0f34916Ca4E2cCe120116774b0e4fA0cdcaA8',
              guage_address: '0xf8d47b641eD9DF1c924C0F7A6deEEA2803b9CfeF',
              token_0: baseTokens.weETH,
              token_1: baseTokens.WETH,
            },
            {
              pool_address: '0xbD3cd0D9d429b41F0a2e1C026552Bd598294d5E0',
              guage_address: '0xfCfEE5f453728BaA5ffDA151f25A0e53B8C5A01C',
              token_0: baseTokens.weETH,
              token_1: baseTokens.WETH,
            },
          ],
          chain: chains.base,
        },
      },
      {
        uniswap: {
          v2: [
            {
              pool_address: '0xA43fe16908251ee70EF74718545e4FE6C5cCEc9f',
              token_0: ethereumTokens.PEPE,
              token_1: ethereumTokens.WETH,
            },
          ],
          v3: [
            {
              pool_address: '0x11950d141EcB863F01007AdD7D1A342041227b58',
              token_0: ethereumTokens.PEPE,
              token_1: ethereumTokens.WETH,
            },
          ],
          chain: chains.ethereum,
        },
        aerodrome: {
          v1: [
            {
              pool_address: '0x3333E1d9174720D6eC2cF815e65B82915a9eaE1e',
              guage_address: '0x399fFB6b1263a12Ed23c27BA07043f07D74c19DA',
              token_0: baseTokens.WETH,
              token_1: baseTokens.PEPE,
            },
          ],
          chain: chains.base,
        },
      },
    ];

    this.logger.log(`Seeding ${pools.length} pools`);
    for (const pool of pools) {
      const foundPool = await this.liquidityPoolRepository.findOne({
        where: {
          providers: pool,
        },
      });

      if (foundPool) {
        continue;
      }

      const liquidityPool = this.liquidityPoolRepository.create({
        id: uuidv4(),
        providers: pool,
        is_active: true,
      });

      await this.liquidityPoolRepository.save(liquidityPool);
    }
    this.logger.log(`Liquidity pools seeded: ${pools.length}`);
  }
}
