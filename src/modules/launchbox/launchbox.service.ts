/* eslint-disable @typescript-eslint/no-unused-vars */
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { User } from '@privy-io/server-auth';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ethers } from 'ethers';
import { v4 as uuidv4 } from 'uuid';
import { ServiceError } from '../../common/errors/service.error';
import { successResponse } from '../../common/responses/success.helper';
import {
  ActionsArrayDTO,
  ChainDto,
  CreateApiKeyDto,
  CreateDto,
  PaginateDto,
  RankingPaginateDto,
  SocialDto,
  UpdateDto,
  WebsiteBuilderDto,
} from './dtos/launchbox.dto';
import {
  IncentiveAction,
  IncentiveChannel,
  LaunchboxApiCredential,
  LaunchboxToken,
  LaunchboxTokenHolder,
  LaunchboxTokenLeaderboard,
  LaunchboxTokenTransaction,
  LaunchboxUser,
  LeaderboardParticipant,
  TokenConfiguredAction,
} from './entities/launchbox.entity';
import {
  ChannelSlug,
  FarcasterActions,
  NFTActions,
} from './enums/leaderboard.enum';
import {
  IIncentiveAction,
  IIncentiveChannel,
  ILaunchboxTokenLeaderboard,
  Chain,
} from './interfaces/launchbox.interface';

import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import Launchbox, { Cast, Participant } from 'channels-lib';
import { env } from 'src/common/config/env';
import { MongoRepository } from 'typeorm';
import validator from 'validator';
import { AnalyticService } from '../../common/helpers/analytic/analytic.service';
import { PeriodKey } from '../../common/helpers/analytic/interfaces/analytic.interface';
import { CloudinaryService } from '../../common/helpers/cloudinary/cloudinary.service';
import { ContractService } from '../../common/helpers/contract/contract.service';
import { FarcasterService } from '../../common/helpers/farcaster/farcaster.service';
import { PrivyService } from '../../common/helpers/privy/privy.service';
import { SharedService } from '../../common/helpers/shared/shared.service';
import { IResponse } from '../../common/interfaces/response.interface';
import {
  decrypt,
  encrypt,
  generateKey,
  getDateRangeFromKey,
  hashKey,
} from '../../common/utils';
import {
  Currency,
  FileUploadFolder,
  TransactionType,
} from './enums/launchbox.enum';

@Injectable()
export class LaunchboxService {
  constructor(
    @InjectRepository(LaunchboxToken)
    private readonly launchboxTokenRepository: MongoRepository<LaunchboxToken>,
    @InjectRepository(LaunchboxTokenHolder)
    private readonly launchboxTokenHolderRepository: MongoRepository<LaunchboxTokenHolder>,
    @InjectRepository(LaunchboxTokenTransaction)
    private readonly launchboxTokenTransactionRepository: MongoRepository<LaunchboxTokenTransaction>,
    @InjectRepository(LaunchboxTokenLeaderboard)
    private readonly leaderboardRepository: MongoRepository<LaunchboxTokenLeaderboard>,
    @InjectRepository(IncentiveChannel)
    private readonly incentiveChannelRespository: MongoRepository<IncentiveChannel>,
    @InjectRepository(LeaderboardParticipant)
    private readonly leaderboardParticipantRepository: MongoRepository<LeaderboardParticipant>,
    @InjectRepository(LaunchboxUser)
    private readonly launchboxUserRepository: MongoRepository<LaunchboxUser>,
    @InjectRepository(LaunchboxApiCredential)
    private readonly launchboxApiKeyRepository: MongoRepository<LaunchboxApiCredential>,
    private readonly cloudinaryService: CloudinaryService,
    private readonly farcasterService: FarcasterService,
    private readonly contractService: ContractService,
    private readonly sharedService: SharedService,
    private readonly analyticService: AnalyticService,
    private readonly privyService: PrivyService,
    private readonly jwtService: JwtService,
  ) {}

  private logger = new Logger(LaunchboxService.name);

  async init() {
    try {
      const tokens = await this.launchboxTokenRepository.find({
        is_active: true,
      });

      tokens.forEach((token) => {
        this.tokenHoldersListener(token);
        this.tokenTransactionsListener(token);
      });
    } catch (error) {
      this.logger.error('Error initializing launchbox service', error.stack);
    }
  }

  async authenticate(privyUserId: string): Promise<IResponse | ServiceError> {
    try {
      const userExists = await this.launchboxUserRepository.findOne({
        where: {
          reference: privyUserId,
        },
      });

      if (userExists) {
        const { token, expire } = await this.generateToken(userExists.id);

        return successResponse({
          status: true,
          message: 'Authenticated successfully',
          data: {
            token,
            expire,
            user: userExists,
          },
        });
      }

      const privyUser = await this.privyService.clinet.getUser(privyUserId);

      const { identifier, type, walletAddress } = this.getAuthType(privyUser);

      const newUser = this.launchboxUserRepository.create({
        id: uuidv4(),
        reference: privyUserId,
        auth_id: identifier,
        auth_type: type,
        wallet_address: walletAddress,
        is_active: true,
      });

      await this.launchboxUserRepository.save(newUser);

      const { token, expire } = await this.generateToken(newUser.id);

      return successResponse({
        status: true,
        message: 'Authenticated successfully',
        data: {
          token,
          expire,
          user: newUser,
        },
      });
    } catch (error) {
      this.logger.error('An error occurred while authenticating.', error.stack);

      if (error instanceof ServiceError) {
        return error.toErrorResponse();
      }

      throw new ServiceError(
        'An error occurred while authenticating.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      ).toErrorResponse();
    }
  }

  async authSession(user: LaunchboxUser): Promise<IResponse | ServiceError> {
    try {
      return successResponse({
        status: true,
        message: 'Authenticated session',
        data: user,
      });
    } catch (error) {
      this.logger.error(
        'An error occurred while authenticating the session.',
        error.stack,
      );

      if (error instanceof ServiceError) {
        return error.toErrorResponse();
      }

      throw new ServiceError(
        'An error occurred while authenticating the session. Please try again later.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      ).toErrorResponse();
    }
  }

  async create(
    user: LaunchboxUser,
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

      const fetchedUser = await this.fetchOrCreateUser(
        user,
        formattedChain.transaction_hash,
      );

      const tokenExists = await this.launchboxTokenRepository.findOne({
        where: {
          token_address: body.token_address,
          'chain.id': formattedChain.id,
        },
      });

      if (tokenExists) {
        throw new ServiceError('Token already exists', HttpStatus.BAD_REQUEST);
      }

      const logoUrl = await this.cloudinaryService.upload(
        file,
        FileUploadFolder.Launchbox,
      );

      if (!logoUrl) {
        throw new ServiceError('Upload failed', HttpStatus.BAD_REQUEST);
      }

      const launchbox = this.launchboxTokenRepository.create({
        ...body,
        id: uuidv4(),
        token_decimals: Number(body.token_decimals),
        token_total_supply: Number(body.token_total_supply),
        create_token_page: body.create_token_page === 'true',
        chain: {
          ...formattedChain,
          deployer_address: fetchedUser.wallet_address,
        },
        socials: {
          warpcast: { channel: formattedSocials },
        },
        token_logo_url: logoUrl,
        is_active: true,
        user_id: fetchedUser.id,
        reference: user?.apiCredential?.id,
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
    user: LaunchboxUser,
    id: string,
    body: UpdateDto,
  ): Promise<IResponse | ServiceError> {
    try {
      const token = await this.launchboxTokenRepository.findOne({
        where: {
          id,
          ...(user.externalApiCall
            ? { reference: user.apiCredential?.id }
            : { user_id: user.id }),
        },
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
            telegram_url: body.telegram_url,
            twitter_url: body.twitter_url,
            create_token_page: body.create_token_page,
            website_url: body.website_url,
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

  async findAll(
    apiKey: string,
    query: PaginateDto,
  ): Promise<IResponse | ServiceError> {
    try {
      let apiCredential: LaunchboxApiCredential | undefined;

      if (apiKey) {
        apiCredential = await this.validateApiKey(apiKey);
      }

      const totalTokensCount = await this.launchboxTokenRepository.count({
        is_active: true,
        ...(apiCredential?.id && { reference: apiCredential?.id }),
      });

      let queryOptions = {};

      if (query.deployer_address) {
        queryOptions = {
          'chain.deployer_address': query.deployer_address,
          is_active: true,
          ...(apiCredential?.id && {
            reference: apiCredential?.id,
          }),
        };
      } else if (query.search) {
        queryOptions = {
          is_active: true,
          ...(apiCredential?.id && {
            reference: apiCredential?.id,
          }),
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
        queryOptions = apiCredential?.id
          ? {
              is_active: true,
              reference: apiCredential?.id,
            }
          : {
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

  async getPriceAnalytics(
    reference: string,
    period: PeriodKey,
  ): Promise<IResponse | ServiceError> {
    try {
      const isUuid = validator.isUUID(reference);
      const launchboxToken = await this.launchboxTokenRepository.findOne({
        where: isUuid ? { id: reference } : { token_address: reference },
      });

      if (!launchboxToken) {
        throw new ServiceError('Token not found', HttpStatus.NOT_FOUND);
      }

      getDateRangeFromKey(period);

      const analytics = await this.analyticService.getPriceAnalyticsByKey(
        launchboxToken.exchange_address,
        period,
      );

      return successResponse({
        status: true,
        message: 'Token price analytics fetched successfully',
        data: analytics,
      });
    } catch (error) {
      this.logger.error(
        'An error occurred while fetching the token price analytics. Please try again later.',
        error.stack,
      );

      if (error instanceof ServiceError) {
        return error.toErrorResponse();
      }

      throw new ServiceError(
        'An error occurred while fetching the token price analytics. Please try again later.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      ).toErrorResponse();
    }
  }

  async getChannelAnalytics(
    reference: string,
    period: PeriodKey,
  ): Promise<IResponse | ServiceError> {
    try {
      const isUuid = validator.isUUID(reference);
      const launchboxToken = await this.launchboxTokenRepository.findOne({
        where: isUuid ? { id: reference } : { token_address: reference },
      });

      if (!launchboxToken) {
        throw new ServiceError('Token not found', HttpStatus.NOT_FOUND);
      } else if (!launchboxToken.socials?.warpcast?.channel?.url) {
        throw new ServiceError(
          'Token does not have a connected channel',
          HttpStatus.BAD_REQUEST,
        );
      }
      getDateRangeFromKey(period);

      const analytics = await this.farcasterService.getChannelAnalyticsByKey(
        launchboxToken.socials?.warpcast?.channel?.name,
        period,
      );

      return successResponse({
        status: true,
        message: 'Token channel analytics fetched successfully',
        data: analytics,
      });
    } catch (error) {
      this.logger.error(
        'An error occurred while fetching the token channel analytics. Please try again later.',
        error.stack,
      );

      if (error instanceof ServiceError) {
        return error.toErrorResponse();
      }

      throw new ServiceError(
        'An error occurred while fetching the token channel analytics. Please try again later.',
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

  async getTokenCasts(
    id: string,
    limit: number,
  ): Promise<IResponse | ServiceError> {
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
        token.socials.warpcast.channel.name,
        limit,
      );

      let weeklyRecord: {
        castsCount: number;
        percentageChange: number;
        isIncreased: boolean;
      } = {
        castsCount: 0,
        percentageChange: 0,
        isIncreased: false,
      };

      let socialCapital = 0;

      if (token.socials?.warpcast?.channel?.url) {
        weeklyRecord = await this.farcasterService.getNumberOfWeeklyCasts(
          token.socials.warpcast.channel.name,
        );
        socialCapital = await this.farcasterService.getSocialCapitalNumber(
          token.socials.warpcast.channel.name,
          token.token_address,
        );
      }

      return successResponse({
        status: true,
        message: 'Token casts fetched successfully',
        data: casts,
        meta: {
          weekly_casts: weeklyRecord.castsCount,
          weekly_casts_percentage_change: weeklyRecord.percentageChange,
          weekly_casts_increased: weeklyRecord.isIncreased,
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
    user: LaunchboxUser,
    limit: number,
  ): Promise<IResponse | ServiceError> {
    try {
      const channels = await this.farcasterService.getChannelsByAddress(
        user.wallet_address,
        limit,
      );

      const formattedChannels = channels.map((channel) => {
        return {
          name: channel.name,
          description: channel.description,
          channel_id: channel.channelId,
          image_url: channel.imageUrl,
          lead_ids: channel.leadIds,
          dapp_name: channel.dappName,
          url: channel.url,
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

  async updateWebsiteBuilder(
    user: LaunchboxUser,
    id: string,
    body: WebsiteBuilderDto,
    files: {
      logo: Express.Multer.File[];
      hero: Express.Multer.File[];
      about: Express.Multer.File[];
    },
  ): Promise<IResponse | ServiceError> {
    try {
      const token = await this.launchboxTokenRepository.findOne({
        where: {
          id,
          user_id: user.id,
        },
      });

      if (!token) {
        throw new ServiceError('Token not found', HttpStatus.NOT_FOUND);
      } else if (!token.create_token_page) {
        throw new ServiceError(
          'Create webiste page is not active on this token',
          HttpStatus.BAD_REQUEST,
        );
      }

      const { logoUrl, heroUrl, aboutUrl } = await this.handleFileUploads(
        files,
        {
          logoUrl: token.website_builder?.navigation?.logo_url,
          heroUrl: token.website_builder?.hero_section?.image_url,
          aboutUrl: token.website_builder?.about_section?.image_url,
        },
      );

      const formattedBody: WebsiteBuilderDto = {
        ...body,
      };

      if (body.navigation || files.logo) {
        formattedBody.navigation = {
          ...body.navigation,
          logo_url: logoUrl ?? body.navigation.logo_url,
        };
      }

      if (body.hero_section || files.hero) {
        formattedBody.hero_section = {
          ...body.hero_section,
          image_url: heroUrl ?? body.hero_section.image_url,
        };
      }

      if (body.about_section || files.about) {
        formattedBody.about_section = {
          ...body.about_section,
          image_url: aboutUrl ?? body.about_section.image_url,
        };
      }

      await this.launchboxTokenRepository.updateOne(
        {
          id,
        },
        { $set: { website_builder: formattedBody } },
      );

      return successResponse({
        status: true,
        message: 'Token website builder created successfully',
      });
    } catch (error) {
      this.logger.error(
        'An error occurred while creating website builder',
        error.stack,
      );

      if (error instanceof ServiceError) {
        return error.toErrorResponse();
      }

      throw new ServiceError(
        'An error occurred while creating website builder. Please try again later.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      ).toErrorResponse();
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

  async createApiKey(body: CreateApiKeyDto): Promise<IResponse | ServiceError> {
    try {
      const key = generateKey(64);
      const encryptedKey = await encrypt(key, env.encryption.key);
      const hash = hashKey(key);

      const apiKey = this.launchboxApiKeyRepository.create({
        id: uuidv4(),
        name: body.name,
        key: encryptedKey,
        hash,
        is_active: true,
      });

      await this.launchboxApiKeyRepository.save(apiKey);

      return successResponse({
        status: true,
        message: 'API key created successfully',
        data: {
          key,
        },
      });
    } catch (error) {
      this.logger.error('An error occurred while creating the API key.', error);

      if (error instanceof ServiceError) {
        return error.toErrorResponse();
      }

      throw new ServiceError(
        'An error occurred while creating the API key. Please try again later.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      ).toErrorResponse();
    }
  }

  async validateApiKey(key: string): Promise<LaunchboxApiCredential> {
    const apiKeyHash = hashKey(key);
    const apiKey = await this.launchboxApiKeyRepository.findOne({
      where: { hash: apiKeyHash, is_active: true },
    });

    if (!apiKey) {
      throw new ServiceError('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    const decryptedKey = await decrypt(apiKey.key, env.encryption.key);
    const decryptedKeyHash = hashKey(decryptedKey);

    if (decryptedKeyHash !== apiKeyHash) {
      throw new ServiceError('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    return apiKey;
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

  async getTokenLeaderBoard(id: string): Promise<IResponse | ServiceError> {
    try {
      const token = await this.launchboxTokenRepository.findOne({
        where: { id },
      });

      if (!token) {
        throw new ServiceError('Token not found', HttpStatus.NOT_FOUND);
      }

      let leaderboard = await this.leaderboardRepository.findOne({
        where: {
          token_id: token.id,
        },
        relations: ['participants', 'incentives'],
      });

      if (!leaderboard) {
        await this.leaderboardRepository.save(
          this.leaderboardRepository.create({
            is_active: true,
            token_id: token.id,
            id: uuidv4(),
          }),
        );

        leaderboard = await this.leaderboardRepository.findOne({
          where: {
            token_id: token.id,
          },
          relations: ['participants', 'incentives'],
        });
      }

      const { ...data } = leaderboard!;

      const response: ILaunchboxTokenLeaderboard = {
        id: data.id,
        token_id: data.token_id,
        is_active: data.is_active,
        created_at: data.created_at,
        updated_at: data.updated_at,
        incentives: [],
      };

      if (data.incentives && data.incentives.length >= 1) {
        const channels = await this.getSystemChannels();

        const incentiveMap = new Map<string, IIncentiveChannel>();

        data.incentives.forEach((cfg) => {
          const channel = channels.find((ch) =>
            ch.actions.some((ac) => ac.id === cfg.action_id),
          );

          if (channel) {
            const action = channel.actions.find(
              (ac) => ac.id === cfg.action_id,
            );
            if (action) {
              const { _id, ...clean } = channel;
              const newAction: IIncentiveAction = {
                ...action,
                points: cfg.points,
                metadata: cfg.metadata,
              } as unknown as IIncentiveAction;

              if (incentiveMap.has(clean.name)) {
                incentiveMap.get(clean.name)!.actions.push(newAction);
              } else {
                // If it's a new incentive, create a new entry in the map
                incentiveMap.set(clean.name, {
                  ...clean,
                  actions: [newAction],
                });
              }
            }
          }
        });

        response.incentives = Array.from(
          incentiveMap.values(),
        ) as IIncentiveChannel[];
      }

      return successResponse({
        status: true,
        message: 'success',
        data: response,
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

  async activateLeaderboard(
    user: LaunchboxUser,
    token_id: string,
  ): Promise<IResponse | ServiceError> {
    try {
      const lbToken = await this.launchboxTokenRepository.findOne({
        where: {
          id: token_id,
          user_id: user.id,
        },
      });

      if (!lbToken) {
        throw new ServiceError('Token not found', HttpStatus.NOT_FOUND);
      }

      let leaderboard = await this.leaderboardRepository.findOne({
        where: {
          token_id,
        },
      });

      if (!leaderboard) {
        leaderboard = await this.leaderboardRepository.save(
          this.leaderboardRepository.create({
            token_id,
            is_active: true,
          }),
        );
      }

      if (!leaderboard.is_active) {
        await this.leaderboardRepository.updateOne(
          { token_id },
          {
            $set: {
              is_active: true,
            },
          },
        );
      } else {
        await this.leaderboardRepository.updateOne(
          { token_id },
          {
            $set: {
              is_active: false,
            },
          },
        );
      }

      return successResponse({
        status: true,
        message: 'Token casts fetched successfully',
        data: {
          id: leaderboard.id,
          token_id: leaderboard.token_id,
          is_active: !leaderboard.is_active,
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

  async earnPoints(
    user: LaunchboxUser,
    token_id: string,
  ): Promise<IResponse | ServiceError> {
    try {
      const lbToken = await this.launchboxTokenRepository.findOne({
        where: {
          id: token_id,
        },
      });

      if (!lbToken) {
        throw new ServiceError('Token not found', HttpStatus.NOT_FOUND);
      }

      const leaderboard = await this.leaderboardRepository.findOne({
        where: {
          token_id,
        },
      });

      if (!leaderboard) {
        throw new ServiceError(
          'Leaderboard not active for token',
          HttpStatus.NOT_FOUND,
        );
      }

      let rank = await this.leaderboardParticipantRepository.findOne({
        where: {
          leaderboard_id: leaderboard.id,
          associated_address: user.wallet_address,
        },
      });

      if (!rank) {
        rank = new LeaderboardParticipant(leaderboard.id, user.wallet_address);

        if (!leaderboard.participants) {
          leaderboard.participants = [rank];
        } else {
          leaderboard.participants.push(rank);
        }
        await this.leaderboardRepository.updateOne(
          { id: leaderboard.id },
          {
            $set: {
              participants: [...leaderboard.participants],
            },
          },
        );
      } else {
        return successResponse({
          status: true,
          statusCode: 409,
          message: 'success',
          data: { rank },
        });
      }

      return successResponse({
        status: true,
        message: 'success',
        data: { rank },
      });
    } catch (error) {
      this.logger.error(
        'An error occurred while fetching the rank.',
        error.stack,
      );

      if (error instanceof ServiceError) {
        return error.toErrorResponse();
      }

      throw new ServiceError(
        'An error occurred while fetching the rank. Please try again later.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      ).toErrorResponse();
    }
  }

  async getRank(
    address: string,
    token_id: string,
  ): Promise<IResponse | ServiceError> {
    try {
      const leaderboard = await this.leaderboardRepository.findOne({
        where: { token_id },
        relations: ['participants', 'incentives'],
      });

      if (!leaderboard) {
        throw new ServiceError('Leaderboard not found', HttpStatus.NOT_FOUND);
      }

      const participant = leaderboard.participants.find(
        (p) => p.associated_address === address,
      );

      if (!participant) {
        throw new ServiceError('Participant not found', HttpStatus.NOT_FOUND);
      }

      if (!participant.completed_actions) {
        return successResponse({
          status: true,
          message: 'Rank fetched successfully',
          data: {
            total_points: 0,
            rank: leaderboard.participants.length,
          },
        });
      }

      const participantPoints = participant.completed_actions.reduce(
        (acc, actionId) => {
          const action = leaderboard.incentives.find(
            (a) => a.action_id === actionId,
          );
          return acc + (action ? action.points : 0);
        },
        0,
      );

      const sortedParticipants = await Promise.all(
        leaderboard.participants.map(async (p) => {
          if (p.completed_actions) {
            const points = p.completed_actions.reduce((acc, actionId) => {
              const action = leaderboard.incentives.find(
                (a) => a.action_id === actionId,
              );
              return acc + (action ? action.points : 0);
            }, 0);
            return { ...p, points };
          }
          return { ...p, points: 0 };
        }),
      );

      sortedParticipants.sort((a, b) => b.points - a.points);

      const rank =
        sortedParticipants.findIndex((p) => p.associated_address === address) +
        1;

      return successResponse({
        status: true,
        message: 'Rank fetched successfully',
        data: {
          total_points: participantPoints,
          rank: rank,
        },
      });
    } catch (error) {
      this.logger.error(
        'An error occurred while fetching the rank.',
        error.stack,
      );

      if (error instanceof ServiceError) {
        return error.toErrorResponse();
      }

      throw new ServiceError(
        'An error occurred while fetching the rank. Please try again later.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      ).toErrorResponse();
    }
  }

  async getAllRanking(
    token_id: string,
    paginate: RankingPaginateDto,
  ): Promise<IResponse | ServiceError> {
    try {
      const leaderboard = await this.leaderboardRepository.findOne({
        where: { token_id },
        relations: ['participants', 'incentives'],
      });

      if (!leaderboard) {
        throw new ServiceError('Leaderboard not found', HttpStatus.NOT_FOUND);
      }

      if (!leaderboard.participants) {
        return successResponse({
          status: true,
          message: 'success',
          data: {
            ranking: [],
            total: 0,
          },
        });
      }

      const sortedParticipants = await Promise.all(
        leaderboard.participants.map(async (p) => {
          const actionIds = p.completed_actions;
          if (actionIds) {
            const points = actionIds.reduce((acc, actionId) => {
              const action = leaderboard.incentives.find(
                (a) => a.action_id === actionId,
              );
              return acc + (action ? action.points : 0);
            }, 0);
            return { ...p, points };
          }

          return { ...p, points: 0 };
        }),
      );

      const ranking = sortedParticipants
        .map((p) => ({
          points: p.points,
          address: p.associated_address,
          created_at: p.created_at,
          farcaster_username: p.farcaster_username,
        }))
        .sort((a, b) => b.points - a.points);

      const paginatedParticipants = ranking.slice(
        (paginate.page - 1) * paginate.limit,
        paginate.page * paginate.limit,
      );

      return successResponse({
        status: true,
        message: 'Ranking fetched successfully',
        data: {
          ranking: paginatedParticipants,
          total: sortedParticipants.length,
        },
      });
    } catch (error) {
      this.logger.error(
        'An error occurred while fetching the ranking.',
        error.stack,
      );

      if (error instanceof ServiceError) {
        return error.toErrorResponse();
      }

      throw new ServiceError(
        'An error occurred while fetching the ranking. Please try again later.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      ).toErrorResponse();
    }
  }

  async addIncentiveAction(
    user: LaunchboxUser,
    token_id: string,
    actionsArray: ActionsArrayDTO,
  ): Promise<IResponse | ServiceError> {
    try {
      const token = await this.launchboxTokenRepository.findOne({
        where: {
          user_id: user.id,
          id: token_id,
        },
      });
      if (!token) {
        throw new ServiceError('Token not found', HttpStatus.NOT_FOUND);
      }

      const leaderboard = await this.leaderboardRepository.findOne({
        where: { token_id },
        relations: ['incentives'],
      });

      if (!leaderboard) {
        throw new ServiceError('Leaderboard not found', HttpStatus.NOT_FOUND);
      }

      const incentiveChannels = await this.getSystemChannels();

      const validatedActions = await Promise.all(
        actionsArray.actions.map(async (action) => {
          const channel = incentiveChannels.find((ch) =>
            ch.actions.some((a) => a.id === action.id),
          );

          if (leaderboard.incentives) {
            const existing = leaderboard.incentives.find(
              (a) => a.action_id == action.id,
            );

            if (existing) {
              throw new ServiceError(
                `Action Already Configured: ${action.id}`,
                HttpStatus.BAD_REQUEST,
              );
            }
          }

          if (!channel) {
            throw new ServiceError(
              `Invalid action ID: ${action.id}`,
              HttpStatus.BAD_REQUEST,
            );
          }

          if (channel.slug === ChannelSlug.NFT && !action.metadata.contract) {
            throw new ServiceError(
              `NFT action requires contract in metadata`,
              HttpStatus.BAD_REQUEST,
            );
          }

          if (
            channel.slug === ChannelSlug.FARCASTER &&
            !action.metadata.channel
          ) {
            throw new ServiceError(
              `Farcaster action requires channel in metadata`,
              HttpStatus.BAD_REQUEST,
            );
          }

          const newAction = new TokenConfiguredAction();
          newAction.id = uuidv4();
          newAction.action_id = action.id;
          newAction.points = action.points;
          newAction.is_active = true;
          newAction.metadata = action.metadata;

          return newAction;
        }),
      );

      leaderboard.incentives = leaderboard.incentives
        ? [...leaderboard.incentives, ...validatedActions]
        : validatedActions;
      await this.leaderboardRepository.save(leaderboard);

      return successResponse({
        status: true,
        message: 'Actions added successfully',
        data: leaderboard,
      });
    } catch (error) {
      this.logger.error(
        'An error occurred while adding the incentive actions.',
        error.stack,
      );

      if (error instanceof ServiceError) {
        return error.toErrorResponse();
      }

      throw new ServiceError(
        'An error occurred while adding the incentive actions. Please try again later.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      ).toErrorResponse();
    }
  }

  async removeIncentiveAction(
    user: LaunchboxUser,
    token_id: string,
    action_id: string,
  ): Promise<IResponse | ServiceError> {
    try {
      const token = await this.launchboxTokenRepository.findOne({
        where: {
          user_id: user.id,
          id: token_id,
        },
      });
      if (!token) {
        throw new ServiceError('Token not found', HttpStatus.NOT_FOUND);
      }

      const leaderboard = await this.leaderboardRepository.findOne({
        where: {
          token_id,
        },
        relations: ['incentives'],
      });

      if (!leaderboard) {
        throw new ServiceError('Leaderboard not found', HttpStatus.NOT_FOUND);
      }

      leaderboard.incentives = leaderboard.incentives.filter(
        (action) => action.action_id !== action_id,
      );

      await this.leaderboardRepository.updateOne(
        { token_id: token.id },
        { $set: { incentives: [...leaderboard.incentives] } },
      );

      return successResponse({
        status: true,
        message: 'Action removed successfully',
      });
    } catch (error) {
      this.logger.error(
        'An error occurred while removing the incentive action.',
        error.stack,
      );

      if (error instanceof ServiceError) {
        return error.toErrorResponse();
      }

      throw new ServiceError(
        'An error occurred while removing the incentive action. Please try again later.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      ).toErrorResponse();
    }
  }

  async getSystemChannels(): Promise<IncentiveChannel[]> {
    try {
      const channels = await this.incentiveChannelRespository.find();
      return channels;
    } catch (error) {
      throw new ServiceError(
        'something went wrong',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async seedSystemChannels() {
    const channels = [
      {
        id: uuidv4(),
        name: 'NFT',
        slug: ChannelSlug.NFT,
        info: 'Users hold the project NFT earn points.',
        actions: [
          {
            id: uuidv4(),
            name: 'OWN',
            description: 'User must own the channel NFT',
            slug: NFTActions.OWN,
          },
        ],
      },
      {
        id: uuidv4(),
        name: 'FARCASTER',
        slug: ChannelSlug.FARCASTER,
        info: 'Users who participate in project Channel earn points.',
        actions: [
          {
            id: uuidv4(),
            name: 'CAST',
            description: 'User must cast in channel',
            slug: FarcasterActions.CHANNEL_CAST,
          },
          {
            id: uuidv4(),
            name: 'FOLLOW',
            description: 'User must follow',
            slug: FarcasterActions.CHANNEL_FOLLOW,
          },
        ],
      },
    ];

    const activityPromises = channels.map(async (channel) => {
      const channelExist = await this.incentiveChannelRespository.findOne({
        where: {
          slug: channel.slug,
        },
      });

      if (!channelExist) {
        await this.incentiveChannelRespository.save(channel);
      }
    });

    await Promise.all(activityPromises);
  }

  async calculateRanks() {
    try {
      const launchbox = new Launchbox(env.airstack.key, 'prod');

      const leaderboards = await this.leaderboardRepository.find({
        where: {
          is_active: true,
        },
        relations: ['incentives', 'participants'],
      });

      const channels = await this.getSystemChannels();
      const actions = channels.flatMap((c) => c.actions);

      for (const leaderboard of leaderboards) {
        const updatedParticipants: LeaderboardParticipant[] = [];

        for (const incentive of leaderboard.incentives) {
          if (!incentive.is_active) continue;

          const action = actions.find((a) => a.id === incentive.action_id);
          if (!action) continue;

          if (action.slug === NFTActions.OWN) {
            await this.processNFTAction(
              leaderboard,
              incentive,
              action,
              updatedParticipants,
            );
          } else if (
            action.slug === FarcasterActions.CHANNEL_CAST ||
            action.slug === FarcasterActions.CHANNEL_FOLLOW
          ) {
            await this.processFarcasterAction(
              leaderboard,
              incentive,
              action,
              launchbox,
              updatedParticipants,
            );
          }
        }

        const updatedParticipantsMap = new Map(
          updatedParticipants.map((p) => [p.id, p]),
        );

        const updatedArray = leaderboard.participants.map((participant) => {
          const update = updatedParticipantsMap.get(participant.id);
          return update ? { ...participant, ...update } : participant;
        });

        const existingIds = new Set(leaderboard.participants.map((p) => p.id));
        const newParticipants = updatedParticipants.filter(
          (p) => !existingIds.has(p.id),
        );

        const finalParticipants = [...updatedArray, ...newParticipants];

        await this.leaderboardRepository.updateOne(
          { id: leaderboard.id },
          { $set: { participants: finalParticipants } },
        );
      }
    } catch (error) {
      this.logger.error('Error calculating ranks', error.stack);
    }
  }

  private async processNFTAction(
    leaderboard: LaunchboxTokenLeaderboard,
    incentive: TokenConfiguredAction,
    action: IncentiveAction,
    updatedParticipants: LeaderboardParticipant[],
  ) {
    const contractAddress = incentive.metadata.contract;
    if (!contractAddress) {
      this.logger.warn(`No contract address for NFT action ${action.id}`);
      return;
    }

    for (const participant of leaderboard.participants) {
      const balance = await this.contractService.getBalance(
        participant.associated_address,
        contractAddress,
      );
      if (balance > 0) {
        const updatedParticipant = { ...participant };

        if (
          updatedParticipant.completed_actions &&
          !updatedParticipant.completed_actions.includes(action.id)
        ) {
          updatedParticipant.completed_actions.push(action.id);
        } else if (!updatedParticipant.completed_actions) {
          updatedParticipant.completed_actions = [action.id];
        }
        updatedParticipants.push(updatedParticipant);
      }
    }
  }

  private async processFarcasterAction(
    leaderboard: LaunchboxTokenLeaderboard,
    incentive: TokenConfiguredAction,
    action: IncentiveAction,
    launchbox: Launchbox,
    updatedParticipants: LeaderboardParticipant[],
  ) {
    const channelName = incentive.metadata.channel;
    if (!channelName) {
      this.logger.warn(`No channel name for Farcaster action ${action.id}`);
      return;
    }

    const channelParticipants: Participant[] =
      await launchbox.getChannelParticipants(channelName);

    const channelCasts: Cast[] = await launchbox.getChannelCasts(channelName);

    for (const participant of leaderboard.participants) {
      const updatedParticipant = { ...participant };

      const matchingChannelParticipant = channelParticipants.find((cp) =>
        cp.addresses.includes(participant.associated_address),
      );

      const castByParticipant = channelCasts.find((cast) => {
        return cast.castedBy.userAddress === participant.associated_address;
      });

      if (castByParticipant && action.slug === FarcasterActions.CHANNEL_CAST) {
        if (
          updatedParticipant.completed_actions &&
          !updatedParticipant.completed_actions.includes(action.id)
        ) {
          updatedParticipant.completed_actions.push(action.id);
        } else if (!updatedParticipant.completed_actions) {
          updatedParticipant.completed_actions = [action.id];
        }

        updatedParticipants.push(updatedParticipant);
      }

      if (
        matchingChannelParticipant &&
        action.slug === FarcasterActions.CHANNEL_FOLLOW
      ) {
        if (
          updatedParticipant.completed_actions &&
          !updatedParticipant.completed_actions.includes(action.id)
        ) {
          updatedParticipant.completed_actions.push(action.id);
        } else if (!updatedParticipant.completed_actions) {
          updatedParticipant.completed_actions = [action.id];
        }

        updatedParticipants.push(updatedParticipant);
      }
    }
  }

  private async getMoreTransactionData(
    tokenId: string,
    tokenAddress: string,
    exchangeAddress: string,
    ethPriceUSD: number,
    tokenDecimals: number,
  ) {
    try {
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

      const volumeEth = resultVolume[0] as { total?: number };
      const volume = (volumeEth?.total ?? 0) * ethPriceUSD;

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
    } catch (error) {
      this.logger.error('getMoreTransactionData', error.stack);

      throw new ServiceError(
        'Error fetching data',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async handleFileUploads(
    files: {
      logo: Express.Multer.File[];
      hero: Express.Multer.File[];
      about: Express.Multer.File[];
    },
    existingUrls: { logoUrl?: string; heroUrl?: string; aboutUrl?: string },
  ): Promise<{ logoUrl?: string; heroUrl?: string; aboutUrl?: string }> {
    const result: { logoUrl?: string; heroUrl?: string; aboutUrl?: string } =
      {};

    if (files.logo && files.logo.length > 0) {
      result.logoUrl = await this.uploadOrUpdateFile(
        files.logo[0],
        existingUrls.logoUrl,
      );
    }

    if (files.hero && files.hero.length > 0) {
      result.heroUrl = await this.uploadOrUpdateFile(
        files.hero[0],
        existingUrls.heroUrl,
      );
    }

    if (files.about && files.about.length > 0) {
      result.aboutUrl = await this.uploadOrUpdateFile(
        files.about[0],
        existingUrls.aboutUrl,
      );
    }

    return result;
  }

  private async uploadOrUpdateFile(
    file: Express.Multer.File,
    currentImageUrl?: string,
  ) {
    if (!file) {
      return undefined;
    }

    if (currentImageUrl) {
      const publicId = currentImageUrl.split('/').pop();
      const publicIdWithoutExtension = publicId?.split('.')[0];

      await this.cloudinaryService.delete(
        `${FileUploadFolder.Launchbox}/${publicIdWithoutExtension?.trim()}`,
      );
    }

    return this.cloudinaryService.upload(file, FileUploadFolder.Launchbox);
  }

  private async generateToken(id: string): Promise<{
    token: string;
    expire: number;
  }> {
    const token = this.jwtService.sign({
      sub: id,
    });
    const decoded = this.jwtService.decode(token);

    return {
      token,
      expire: decoded.exp,
    };
  }

  private getAuthType(privyUser: User) {
    const authTypes = [
      {
        check: () => privyUser.email,
        type: 'email',
        getId: () => privyUser.email?.address,
      },
      {
        check: () => privyUser.wallet?.walletClientType !== 'privy',
        type: () => privyUser.wallet?.walletClientType,
        getId: () => privyUser.wallet?.address,
      },
    ];

    for (const auth of authTypes) {
      if (auth.check() && privyUser.wallet) {
        return {
          identifier: auth.getId(),
          type: typeof auth.type === 'function' ? auth.type() : auth.type,
          walletAddress: privyUser.wallet.address,
        };
      }
    }

    throw new ServiceError(
      'No valid authentication method found',
      HttpStatus.BAD_REQUEST,
    );
  }

  private async fetchOrCreateUser(
    user: LaunchboxUser,
    transactionHash: string,
  ): Promise<LaunchboxUser> {
    if (!user.externalApiCall) {
      return user;
    }

    const deployerAddress =
      await this.contractService.getTokenDeployerAddress(transactionHash);

    const userExists = await this.launchboxUserRepository.findOne({
      where: {
        wallet_address: deployerAddress,
      },
    });

    if (userExists) {
      return userExists;
    }

    const newUser = this.launchboxUserRepository.create({
      id: uuidv4(),
      reference: user.apiCredential?.id,
      auth_id: user.apiCredential?.id,
      auth_type: 'api-key',
      wallet_address: deployerAddress,
      is_active: true,
    });

    return this.launchboxUserRepository.save(newUser);
  }
}
