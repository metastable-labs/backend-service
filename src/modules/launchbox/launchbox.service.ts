import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { v4 as uuidv4 } from 'uuid';
import validator from 'validator';
import { MongoRepository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ethers } from 'ethers';
import {
  LaunchboxToken,
  LaunchboxTokenHolder,
  LaunchboxTokenTransaction,
} from './entities/launchbox.entity';
import {
  ChainDto,
  CreateDto,
  PaginateDto,
  SocialDto,
  UpdateDto,
} from './dtos/launchbox.dto';
import { ServiceError } from '../../common/errors/service.error';
import { CloudinaryService } from '../../common/helpers/cloudinary/cloudinary.service';
import { IResponse } from '../../common/interfaces/response.interface';
import { successResponse } from '../../common/responses/success.helper';
import { Chain } from './interfaces/launchbox.interface';
import { FarcasterService } from '../../common/helpers/farcaster/farcaster.service';
import { ContractService } from '../../common/helpers/contract/contract.service';
import { Currency, TransactionType } from './enums/launchbox.enum';
import { SharedService } from '../../common/helpers/shared/shared.service';

@Injectable()
export class LaunchboxService {
  constructor(
    @InjectRepository(LaunchboxToken)
    private readonly launchboxTokenRepository: MongoRepository<LaunchboxToken>,
    @InjectRepository(LaunchboxTokenHolder)
    private readonly launchboxTokenHolderRepository: MongoRepository<LaunchboxTokenHolder>,
    @InjectRepository(LaunchboxTokenTransaction)
    private readonly launchboxTokenTransactionRepository: MongoRepository<LaunchboxTokenTransaction>,
    private readonly cloudinaryService: CloudinaryService,
    private readonly farcasterService: FarcasterService,
    private readonly httpService: HttpService,
    private readonly contractService: ContractService,
    private readonly sharedService: SharedService,
  ) {}

  private logger = new Logger(LaunchboxService.name);

  async init() {
    const tokens = await this.launchboxTokenRepository.find({
      is_active: true,
    });

    tokens.forEach((token) => {
      this.tokenHoldersListener(token);
      this.tokenTransactionsListener(token);
    });

    const [latestTransaction, latestHolder] = await Promise.all([
      this.launchboxTokenTransactionRepository.findOne({
        order: { block_number: 'DESC' },
      }),
      this.launchboxTokenHolderRepository.findOne({
        order: { block_number: 'DESC' },
      }),
    ]);

    await Promise.all(
      tokens.map(async (token) => {
        await this.seedTokenTransactions(
          token,
          latestTransaction?.block_number ?? token.chain.block_number,
        );

        await this.seedTokenHolders(
          token,
          latestHolder?.block_number ?? token.chain.block_number,
        );
      }),
    );
  }

  async create(
    body: CreateDto,
    file: Express.Multer.File,
  ): Promise<IResponse | ServiceError> {
    try {
      const formattedChain: Chain = JSON.parse(body.chain);
      this.validateBodyChain(formattedChain);

      let formattedSocials: SocialDto = {} as SocialDto;

      if (body.socials) {
        formattedSocials = JSON.parse(body.socials);
        this.validateBodySocial(formattedSocials);
      }

      const tokenExists = await this.launchboxTokenRepository.findOne({
        where: {
          token_address: body.token_address,
          'chain.id': formattedChain.id,
        },
      });

      if (tokenExists) {
        throw new ServiceError('Token already exists', HttpStatus.BAD_REQUEST);
      }

      const logoUrl = await this.cloudinaryService.upload(file, 'launchboxes');

      if (!logoUrl) {
        throw new ServiceError('Upload failed', HttpStatus.BAD_REQUEST);
      }

      const launchbox = this.launchboxTokenRepository.create({
        ...body,
        id: uuidv4(),
        token_decimals: Number(body.token_decimals),
        token_total_supply: Number(body.token_total_supply),
        create_token_page: body.create_token_page === 'true',
        chain: formattedChain,
        socials: {
          warpcast: { channel: formattedSocials },
        },
        token_logo_url: logoUrl,
        is_active: true,
      });

      await this.launchboxTokenRepository.save(launchbox);

      const token = await this.launchboxTokenRepository.findOne({
        where: {
          id: launchbox.id,
        },
      });

      return successResponse({
        status: true,
        message: 'Token created successfully',
        data: token,
      });
    } catch (error) {
      this.logger.error('An error occurred while creating the token.', error);

      if (error instanceof ServiceError) {
        return error.toErrorResponse();
      }

      throw new ServiceError(
        'An error occurred while creating the token. Please try again later.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      ).toErrorResponse();
    }
  }

  async updateOne(
    id: string,
    body: UpdateDto,
  ): Promise<IResponse | ServiceError> {
    try {
      const token = await this.launchboxTokenRepository.findOne({
        where: { id },
      });

      if (!token) {
        throw new ServiceError('Token not found', HttpStatus.NOT_FOUND);
      }

      await this.launchboxTokenRepository.updateOne(
        { id },
        {
          $set: {
            socials: {
              warpcast: { channel: body.socials },
            },
          },
        },
      );

      const updatedToken = await this.launchboxTokenRepository.findOne({
        where: { id },
      });

      return successResponse({
        status: true,
        message: 'Token updated successfully',
        data: updatedToken,
      });
    } catch (error) {
      this.logger.error('An error occurred while updating the token.', error);

      if (error instanceof ServiceError) {
        return error.toErrorResponse();
      }

      throw new ServiceError(
        'An error occurred while updating the token. Please try again later.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      ).toErrorResponse();
    }
  }

  async findAll(query: PaginateDto): Promise<IResponse | ServiceError> {
    try {
      const totalTokensCount = await this.launchboxTokenRepository.count({
        is_active: true,
      });

      let queryOptions = {};

      if (query.deployer_address) {
        queryOptions = {
          'chain.deployer_address': query.deployer_address,
          is_active: true,
        };
      } else if (query.search) {
        queryOptions = {
          is_active: true,
          $or: [
            {
              token_name: { $regex: query.search, $options: 'i' },
            },
            {
              token_symbol: { $regex: query.search, $options: 'i' },
            },
            {
              token_address: { $regex: query.search, $options: 'i' },
            },
          ],
        };
      } else {
        queryOptions = {
          is_active: true,
        };
      }

      const launchboxTokens = await this.launchboxTokenRepository.find({
        where: queryOptions,
        order: {
          created_at: 'DESC',
        },
        skip: Number(query.skip),
        take: Number(query.take),
      });

      const ethPriceUSD = await this.getEthPriceInUsd();

      const formattedTokensPromises = launchboxTokens.map(async (token) => {
        const transactionData = await this.getMoreTransactionData(
          token.id,
          token.token_address,
          token.exchange_address,
          ethPriceUSD,
          token.token_decimals,
        );

        return {
          ...token,
          _id: undefined,
          price: transactionData.price,
          liquidity: transactionData.liquidity,
          market_cap: transactionData.marketCap,
          volume: transactionData.volume,
          total_sell_count: transactionData.totalSellCount,
          total_buy_count: transactionData.totalBuyCount,
        };
      });

      const formattedTokens = await Promise.all(formattedTokensPromises);

      return successResponse({
        status: true,
        message: 'Tokens fetched successfully',
        data: formattedTokens,
        meta: {
          take: Number(query.take),
          skip: Number(query.skip),
          total_count: totalTokensCount,
        },
      });
    } catch (error) {
      this.logger.error(
        'An error occurred while fetching the tokens.',
        error.stack,
      );

      if (error instanceof ServiceError) {
        return error.toErrorResponse();
      }

      throw new ServiceError(
        'An error occurred while fetching the tokens. Please try again later.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      ).toErrorResponse();
    }
  }

  async findOne(reference: string): Promise<IResponse | ServiceError> {
    try {
      const isUuid = validator.isUUID(reference);
      const launchboxToken = await this.launchboxTokenRepository.findOne({
        where: isUuid ? { id: reference } : { token_address: reference },
      });

      if (!launchboxToken) {
        throw new ServiceError('Token not found', HttpStatus.NOT_FOUND);
      }

      const ethPriceUSD = await this.getEthPriceInUsd();
      const transactionData = await this.getMoreTransactionData(
        launchboxToken.id,
        launchboxToken.token_address,
        launchboxToken.exchange_address,
        ethPriceUSD,
        launchboxToken.token_decimals,
      );

      return successResponse({
        status: true,
        message: 'Token fetched successfully',
        data: {
          ...launchboxToken,
          _id: undefined,
          price: transactionData.price,
          liquidity: transactionData.liquidity,
          market_cap: transactionData.marketCap,
          volume: transactionData.volume,
          total_sell_count: transactionData.totalSellCount,
          total_buy_count: transactionData.totalBuyCount,
        },
      });
    } catch (error) {
      this.logger.error('An error occurred while fetching the token.', error);

      if (error instanceof ServiceError) {
        return error.toErrorResponse();
      }

      throw new ServiceError(
        'An error occurred while fetching the token. Please try again later.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      ).toErrorResponse();
    }
  }

  async getTokenHolders(
    query: PaginateDto,
    id: string,
  ): Promise<IResponse | ServiceError> {
    try {
      const take = Number(query.take);
      const skip = Number(query.skip);

      const token = await this.launchboxTokenRepository.findOne({
        where: { id },
      });

      if (!token) {
        throw new ServiceError('Token not found', HttpStatus.NOT_FOUND);
      }

      const holdersCount = await this.launchboxTokenHolderRepository.count({
        token_id: token.id,
      });

      const pipeline = [
        { $match: { token_id: id } },
        {
          $addFields: {
            balance: { $toDouble: '$balance' },
          },
        },
        { $sort: { balance: -1 } },
        { $skip: skip },
        { $limit: take },
        {
          $project: {
            _id: 0,
            id: 1,
            address: 1,
            balance: 1,
            block_number: 1,
            token_id: 1,
            created_at: 1,
            updated_at: 1,
          },
        },
      ];

      const holders = await this.launchboxTokenHolderRepository
        .aggregate(pipeline)
        .toArray();

      return successResponse({
        status: true,
        message: 'Token holders fetched successfully',
        data: holders,
        meta: {
          take,
          skip,
          total_count: holdersCount,
        },
      });
    } catch (error) {
      this.logger.error(
        'An error occurred while fetching the token holders.',
        error.stack,
      );

      if (error instanceof ServiceError) {
        return error.toErrorResponse();
      }

      throw new ServiceError(
        'An error occurred while fetching the token holders. Please try again later.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      ).toErrorResponse();
    }
  }

  async getTokenCasts(id: string): Promise<IResponse | ServiceError> {
    try {
      const token = await this.launchboxTokenRepository.findOne({
        where: { id },
      });

      if (!token) {
        throw new ServiceError('Token not found', HttpStatus.NOT_FOUND);
      } else if (!token.socials?.warpcast?.channel?.url) {
        throw new ServiceError(
          'Token does not have a connected channel',
          HttpStatus.BAD_REQUEST,
        );
      }

      const casts = await this.farcasterService.getChannelCasts(
        token.socials.warpcast.channel.url,
      );
      let weeklyCasts = 0;
      let socialCapital = 0;

      if (token.socials?.warpcast?.channel?.url) {
        weeklyCasts = await this.farcasterService.getNumberOfWeeklyCasts(
          token.socials.warpcast.channel.url,
        );
        socialCapital = await this.farcasterService.getSocialCapitalNumber(
          token.socials.warpcast.channel.name,
          token.chain.name,
          token.token_address,
        );
      }

      return successResponse({
        status: true,
        message: 'Token casts fetched successfully',
        data: casts,
        meta: {
          weekly_casts: weeklyCasts,
          social_capital: socialCapital,
        },
      });
    } catch (error) {
      this.logger.error(
        'An error occurred while fetching the token casts.',
        error.stack,
      );

      if (error instanceof ServiceError) {
        return error.toErrorResponse();
      }

      throw new ServiceError(
        'An error occurred while fetching the token casts. Please try again later.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      ).toErrorResponse();
    }
  }

  async getTokenTransactions(
    query: PaginateDto,
    id: string,
  ): Promise<IResponse | ServiceError> {
    try {
      const token = await this.launchboxTokenRepository.findOne({
        where: { id },
      });

      if (!token) {
        throw new ServiceError('Token not found', HttpStatus.NOT_FOUND);
      }

      const transactionsCount =
        await this.launchboxTokenTransactionRepository.count({
          token_id: id,
        });

      const transactions = await this.launchboxTokenTransactionRepository.find({
        where: {
          token_id: id,
        },
        order: {
          created_at: 'DESC',
        },
        skip: Number(query.skip),
        take: Number(query.take),
      });

      return successResponse({
        status: true,
        message: 'Token transactions fetched successfully',
        data: transactions,
        meta: {
          take: Number(query.take),
          skip: Number(query.skip),
          total_count: transactionsCount,
        },
      });
    } catch (error) {
      this.logger.error(
        'An error occurred while fetching the token transactions.',
        error.stack,
      );

      if (error instanceof ServiceError) {
        return error.toErrorResponse();
      }

      throw new ServiceError(
        'An error occurred while fetching the token transactions. Please try again later.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      ).toErrorResponse();
    }
  }

  async getChannelsByAddress(
    address: string,
  ): Promise<IResponse | ServiceError> {
    try {
      const channels =
        await this.farcasterService.getChannelsByAddress(address);

      const formattedChannels = channels.map((channel) => {
        return {
          name: channel.name,
          description: channel.description,
          channel_id: channel.channelId,
          image_url: channel.imageUrl,
          lead_ids: channel.leadIds,
          dapp_name: channel.dappName,
          url: channel.url,
          follower_count: channel.followerCount,
          created_at: channel.createdAtTimestamp,
        };
      });

      return successResponse({
        status: true,
        message: 'farcast channels fetched successfully',
        data: formattedChannels,
      });
    } catch (error) {
      this.logger.error(
        'An error occurred while fetching the channels.',
        error,
      );

      if (error instanceof ServiceError) {
        return error.toErrorResponse();
      }

      throw new ServiceError(
        'An error occurred while fetching the channels. Please try again later.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      ).toErrorResponse();
    }
  }

  async getCoinPrice(): Promise<IResponse | ServiceError> {
    try {
      const price = await this.getEthPriceInUsd();

      return successResponse({
        status: true,
        message: 'Get current coin price',
        data: {
          name: 'Ethereum',
          symbol: 'ETH',
          price,
          currency: Currency.USD,
        },
      });
    } catch (error) {
      this.logger.error('An error occurred while fetching the price.', error);

      if (error instanceof ServiceError) {
        return error.toErrorResponse();
      }

      throw new ServiceError(
        'An error occurred while fetching the price. Please try again later.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      ).toErrorResponse();
    }
  }

  private async getEthPriceInUsd(): Promise<number> {
    try {
      const ethPrice = await this.sharedService.getEthPriceInUsd();

      return ethPrice;
    } catch (error) {
      this.logger.error('An error occurred while fetching the price.', error);

      throw new ServiceError(
        'An error occurred while fetching the price. Please try again later.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async seedTokenTransactions(
    token: LaunchboxToken,
    blockNumber: number,
  ): Promise<void> {
    this.logger.log(
      `Seeding token transactions of ${token.token_name} ${token.exchange_address}`,
    );

    const contract = this.getContract(
      token.exchange_address,
      this.contractService.getExchangeEventsAbi(),
    );
    const buyEvents = await contract.queryFilter(
      contract.filters.TokenBuy(),
      blockNumber,
    );

    const sellEvents = await contract.queryFilter(
      contract.filters.TokenSell(),
      blockNumber,
    );

    for (const event of buyEvents) {
      await this.processTransactionEvent(
        token,
        event,
        TransactionType.Buy,
        blockNumber,
      );
    }

    for (const event of sellEvents) {
      await this.processTransactionEvent(
        token,
        event,
        TransactionType.Sell,
        blockNumber,
      );
    }
  }

  async seedTokenHolders(
    token: LaunchboxToken,
    blockNumber: number,
  ): Promise<void> {
    this.logger.log(
      `Seeding token holders of ${token.token_name} ${token.token_address}`,
    );

    const contract = this.getContract(
      token.token_address,
      this.contractService.getTokenTransferEventAbi(),
    );
    const events = await contract.queryFilter(
      contract.filters.Transfer(),
      blockNumber,
    );

    for (const event of events) {
      await this.processTransferEvent(token, event);
    }
  }

  async tokenHoldersListener(token: LaunchboxToken): Promise<void> {
    this.logger.log(
      `Listening for token holders of ${token.token_name} ${token.token_address}`,
    );

    const contract = this.getContract(
      token.token_address,
      this.contractService.getTokenTransferEventAbi(),
    );

    contract.on(
      'Transfer',
      async (
        _from: string,
        _to: string,
        _value: string,
        event: ethers.Event,
      ) => {
        await this.processTransferEvent(token, event);
      },
    );
  }

  async tokenTransactionsListener(token: LaunchboxToken): Promise<void> {
    this.logger.log(
      `Listening for token transactions of ${token.token_name} ${token.exchange_address}`,
    );

    const contract = this.getContract(
      token.exchange_address,
      this.contractService.getExchangeEventsAbi(),
    );

    contract.on(
      'TokenBuy',
      async (_ethIn, _tokenOut, _fee, _buyer, event: ethers.Event) => {
        await this.processTransactionEvent(
          token,
          event,
          TransactionType.Buy,
          event.blockNumber,
        );
      },
    );

    contract.on(
      'TokenSell',
      async (_tokenIn, _ethOut, _fee, _seller, event: ethers.Event) => {
        await this.processTransactionEvent(
          token,
          event,
          TransactionType.Sell,
          event.blockNumber,
        );
      },
    );
  }

  private getContract(contractAddress: string, abi: string[]): ethers.Contract {
    const provider = this.contractService.getProvider();
    return new ethers.Contract(contractAddress, abi, provider);
  }

  private async processTransferEvent(
    token: LaunchboxToken,
    event: ethers.Event,
  ): Promise<void> {
    const { from, to, value } = event.args as unknown as {
      from: string;
      to: string;
      value: ethers.BigNumber;
    };

    await this.updateHolderBalance(token, to, value, true, event.blockNumber);

    await this.updateHolderBalance(
      token,
      from,
      value,
      false,
      event.blockNumber,
    );
  }

  private async updateHolderBalance(
    token: LaunchboxToken,
    address: string,
    value: ethers.BigNumber,
    isReceiver: boolean,
    blockNumber: number,
  ): Promise<void> {
    const holder = await this.launchboxTokenHolderRepository.findOne({
      where: { address, token_id: token.id },
    });

    if (holder) {
      const formattedBalanceValue = ethers.utils.parseUnits(
        holder.balance,
        token.token_decimals,
      );

      const updatedBalance = isReceiver
        ? ethers.BigNumber.from(formattedBalanceValue.toString()).add(value)
        : ethers.BigNumber.from(formattedBalanceValue.toString()).sub(value);

      const formattedBalance = ethers.utils.formatUnits(
        updatedBalance,
        token.token_decimals,
      );

      await this.launchboxTokenHolderRepository.updateOne(
        { address, token_id: token.id },
        { $set: { balance: formattedBalance.toString() } },
      );
    } else if (isReceiver) {
      const formattedValue = ethers.utils.formatUnits(
        value.toString(),
        token.token_decimals,
      );

      const newHolder = this.launchboxTokenHolderRepository.create({
        id: uuidv4(),
        balance: formattedValue.toString(),
        address,
        token_id: token.id,
        block_number: blockNumber,
      });

      await this.launchboxTokenHolderRepository.save(newHolder);
    }
  }

  private async processTransactionEvent(
    token: LaunchboxToken,
    event: ethers.Event,
    type: TransactionType,
    blockNumber: number,
  ): Promise<void> {
    let ethValue, tokenValue, fee, address;

    const transactionExists =
      await this.launchboxTokenTransactionRepository.findOne({
        where: {
          transaction_hash: event.transactionHash,
          chain: {
            id: token.chain.id,
          },
        },
      });

    if (transactionExists) {
      return;
    }

    if (type === TransactionType.Buy) {
      const args = event.args as unknown as {
        ethIn: string;
        tokenOut: string;
        fee: string;
        buyer: string;
      };

      ethValue = ethers.utils.formatEther(args.ethIn);
      tokenValue = ethers.utils.formatUnits(
        args.tokenOut,
        token.token_decimals,
      );
      fee = ethers.utils.formatEther(args.fee);
      address = args.buyer;
    } else {
      const args = event.args as unknown as {
        tokenIn: string;
        ethOut: string;
        fee: string;
        seller: string;
      };

      tokenValue = ethers.utils.formatUnits(args.tokenIn, token.token_decimals);
      ethValue = ethers.utils.formatEther(args.ethOut);
      fee = ethers.utils.formatUnits(args.fee, token.token_decimals);
      address = args.seller;
    }

    const newTransaction = this.launchboxTokenTransactionRepository.create({
      id: uuidv4(),
      eth_value: ethValue,
      token_value: tokenValue,
      fee,
      address,
      type,
      token_id: token.id,
      block_number: blockNumber,
      transaction_hash: event.transactionHash,
      chain: {
        id: token.chain.id,
        name: token.chain.name,
      },
    });

    await this.launchboxTokenTransactionRepository.save(newTransaction);
  }

  private validateBodyChain(chain: Chain) {
    const chainDTO = plainToInstance(ChainDto, chain);

    const validationErrors = validateSync(chainDTO);

    if (validationErrors.length > 0) {
      const errorMessage = Object.values(
        validationErrors[0].constraints as {
          [type: string]: string;
        },
      )[0];

      throw new ServiceError(errorMessage, HttpStatus.BAD_REQUEST);
    }
  }

  private validateBodySocial(socials: SocialDto) {
    const socialDTO = plainToInstance(SocialDto, socials);

    const validationErrors = validateSync(socialDTO);

    if (validationErrors.length > 0) {
      const errorMessage = Object.values(
        validationErrors[0].constraints as {
          [type: string]: string;
        },
      )[0];

      throw new ServiceError(errorMessage, HttpStatus.BAD_REQUEST);
    }
  }

  private async getMoreTransactionData(
    tokenId: string,
    tokenAddress: string,
    exchangeAddress: string,
    ethPriceUSD: number,
    tokenDecimals: number,
  ) {
    const pipeline = [
      {
        $match: {
          token_id: tokenId,
        },
      },
      {
        $group: {
          _id: null,
          total: {
            $sum: {
              $toDouble: '$eth_value',
            },
          },
        },
      },
    ];

    const [
      totalSellCount,
      totalBuyCount,
      resultVolume,
      { priceEth, marketCapUsd },
    ] = await Promise.all([
      this.launchboxTokenTransactionRepository.count({
        token_id: tokenId,
        type: 'sell',
      }),
      this.launchboxTokenTransactionRepository.count({
        token_id: tokenId,
        type: 'buy',
      }),
      this.launchboxTokenTransactionRepository.aggregate(pipeline).toArray(),
      this.contractService.getTokenPriceAndMarketCap(exchangeAddress),
    ]);

    const volumeEth = (
      resultVolume[0] as unknown as {
        total: number;
      }
    ).total;

    const volume = volumeEth * ethPriceUSD;
    const price = parseFloat(priceEth) * ethPriceUSD;

    const { tokenLiquidity, tokenEthLiquidity } =
      await this.contractService.getTokenLiquidity(
        tokenAddress,
        exchangeAddress,
        tokenDecimals,
      );
    const tokenLiquidityUsd = parseFloat(tokenLiquidity) * price;
    const tokenEthLiquidityUsd = parseFloat(tokenEthLiquidity) * ethPriceUSD;
    const liquidity = tokenLiquidityUsd + tokenEthLiquidityUsd;

    return {
      totalSellCount,
      totalBuyCount,
      volume: volume,
      liquidity,
      price,
      marketCap: parseFloat(marketCapUsd),
    };
  }
}
