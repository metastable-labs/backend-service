import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MongoRepository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import BigNumber from 'bignumber.js';
import { ethers } from 'ethers';
import { env } from '../../common/config/env';
import { ServiceError } from '../../common/errors/service.error';
import { ContractService } from '../../common/helpers/contract/contract.service';
import { IResponse } from '../../common/interfaces/response.interface';
import { successResponse } from '../../common/responses/success.helper';
import { Activity } from './entities/activity.entity';
import { SharedReferral } from '../shared/entities/referral.entity';
import { Transaction } from './entities/transaction.entity';
import {
  ActivitySlug,
  ActivityType,
  MultiplierSlug,
  TransactionStatus,
  TransactionType,
} from './enums/earn.enum';
import { SharedWallet } from '../shared/entities/wallet.entity';
import { RecordActivityPoint, RecordPoint } from './interfaces/earn.interface';
import { SharedUser } from '../shared/entities/user.entity';
import { PaginateDto } from './dtos/earn.dto';
import { Token } from '../../common/enums/index.enum';
import { AnalyticService } from '../../common/helpers/analytic/analytic.service';
import { SharedCache } from '../shared/entities/cache.entity';
import {
  PROCESS_PENDING_BLANCE_CACHE_KEY,
  PROCESS_PENDING_BLANCE_CACHE_TTL,
} from './constants/earn.constant';

const activitySlugToActivityType: Record<ActivitySlug, ActivityType> = {
  [ActivitySlug.REFERRAL]: ActivityType.REFERRAL,
  [ActivitySlug.NFT]: ActivityType.NFT_MINT,
  [ActivitySlug.SOCIAL]: ActivityType.SOCIAL_INTERACTION,
  [ActivitySlug.BRIDGE]: ActivityType.BRIDGING,
  [ActivitySlug.LIQUIDITY_MIGRATION]: ActivityType.LIQUIDITY_MIGRATION,
  [ActivitySlug.LIQUIDITY_SUPPLY]: ActivityType.LIQUIDITY_MIGRATION,
};

@Injectable()
export class EarnService {
  constructor(
    @InjectRepository(Activity)
    private readonly activityRepository: MongoRepository<Activity>,
    @InjectRepository(SharedReferral)
    private readonly referralRepository: MongoRepository<SharedReferral>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: MongoRepository<Transaction>,
    @InjectRepository(SharedWallet)
    private readonly walletRepository: MongoRepository<SharedWallet>,
    @InjectRepository(SharedUser)
    private readonly sharedUserRepository: MongoRepository<SharedUser>,
    @InjectRepository(SharedCache)
    private readonly cacheRepository: MongoRepository<SharedCache>,
    private readonly contractService: ContractService,
    private readonly analyticService: AnalyticService,
  ) {}

  private logger = new Logger(EarnService.name);

  async init() {
    await this.seedActivities();
    await this.tokenBridgeListener();
    await this.liquidityMigrationListener();
  }

  async getEarnings(user: SharedUser): Promise<IResponse | ServiceError> {
    try {
      const numberOfReferrals = await this.referralRepository.find({
        where: {
          referrer_user_id: user.id,
        },
      });

      const referralPoints = await this.getTotalReferralPoints(user.wallet.id);
      const totalPoints = await this.getTotalPointsInCirculation();
      const userRank = await this.getUserRankByWalletId(user.wallet.id);

      return successResponse({
        status: true,
        message: 'User earnings fetched successfully',
        data: {
          ...user,
          referral: {
            counts: numberOfReferrals.length,
            points: referralPoints,
          },
          rank: userRank,
          total_circulation_points: totalPoints,
        },
      });
    } catch (error) {
      if (error instanceof ServiceError) {
        return error.toErrorResponse();
      }

      throw new ServiceError(
        'Error getting user earnings',
        HttpStatus.INTERNAL_SERVER_ERROR,
      ).toErrorResponse();
    }
  }

  async getTransactions(
    user: SharedUser,
    query: PaginateDto,
  ): Promise<IResponse | ServiceError> {
    try {
      const { skip, take } = query;
      const transactionsCount = await this.transactionRepository.count({
        where: {
          wallet_id: user.wallet.id,
        },
      });

      const transactions = await this.transactionRepository.find({
        where: {
          wallet_id: user.wallet.id,
        },
        skip,
        take,
        order: {
          created_at: 'DESC',
        },
      });

      return successResponse({
        status: true,
        message: 'Transactions fetched successfully',
        data: transactions,
        meta: {
          take,
          skip,
          total_count: transactionsCount,
        },
      });
    } catch (error) {
      if (error instanceof ServiceError) {
        return error.toErrorResponse();
      }

      throw new ServiceError(
        'Error getting user transactions',
        HttpStatus.INTERNAL_SERVER_ERROR,
      ).toErrorResponse();
    }
  }

  async getLeaderboard(): Promise<IResponse | ServiceError> {
    try {
      const users = await this.getUsersRank();

      return successResponse({
        status: true,
        message: 'Leaderboard fetched successfully',
        data: users,
      });
    } catch (error) {
      if (error instanceof ServiceError) {
        return error.toErrorResponse();
      }

      throw new ServiceError(
        'Error getting leaderboard',
        HttpStatus.INTERNAL_SERVER_ERROR,
      ).toErrorResponse();
    }
  }

  async getActivities(): Promise<IResponse | ServiceError> {
    try {
      const activities = await this.activityRepository.find({
        where: {
          is_active: true,
        },
      });

      return successResponse({
        status: true,
        message: 'Activities fetched successfully',
        data: activities,
      });
    } catch (error) {
      if (error instanceof ServiceError) {
        return error.toErrorResponse();
      }

      throw new ServiceError(
        'Error getting activities',
        HttpStatus.INTERNAL_SERVER_ERROR,
      ).toErrorResponse();
    }
  }

  async claimNFTEarnings(user: SharedUser): Promise<IResponse | ServiceError> {
    try {
      const balance = await this.contractService.getNFTBalance(
        user.wallet_address,
        env.contract.nftAddress,
      );

      if (balance === 0) {
        throw new ServiceError(
          'Not eligible for NFT earnings, please mint NFT first',
          HttpStatus.BAD_REQUEST,
        );
      }

      const activity = await this.activityRepository.findOne({
        where: {
          slug: ActivitySlug.NFT,
        },
      });

      if (!activity) {
        throw new ServiceError('Activity not found', HttpStatus.NOT_FOUND);
      }

      const transaction = await this.transactionRepository.findOne({
        where: {
          wallet_id: user.wallet.id,
          activity_id: activity.id,
        },
      });

      if (transaction) {
        throw new ServiceError(
          'NFT earnings already claimed',
          HttpStatus.BAD_REQUEST,
        );
      }

      await this.recordActivityPoints({
        userId: user.id,
        walletId: user.wallet.id,
        walletAddress: user.wallet_address,
        activitySlug: ActivitySlug.NFT,
      });

      return successResponse({
        status: true,
        message: 'NFT earnings claimed successfully',
      });
    } catch (error) {
      if (error instanceof ServiceError) {
        return error.toErrorResponse();
      }

      throw new ServiceError(
        'Error claiming NFT earnings',
        HttpStatus.INTERNAL_SERVER_ERROR,
      ).toErrorResponse();
    }
  }

  async processPendingBalances(): Promise<IResponse | ServiceError> {
    try {
      const wallets = await this.walletRepository.find({
        where: {
          pending_balance: { $gt: 0 },
        },
      });

      const cache = await this.cacheRepository.findOne({
        where: {
          key: PROCESS_PENDING_BLANCE_CACHE_KEY,
        },
      });

      if (cache) {
        if (cache.expires > Date.now()) {
          return successResponse({
            status: true,
            message: 'Pending balances processed successfully',
          });
        }
      }

      this.logger.log(
        `Processing pending balances for ${wallets.length} wallets`,
      );

      for (const wallet of wallets) {
        this.logger.log(
          `Processing pending balance for ${wallet.id} balance ${wallet.pending_balance}`,
        );

        const pendingBalance = wallet.pending_balance;

        await this.contractService.recordPoints(
          wallet.wallet_address,
          pendingBalance,
          ActivityType.BRIDGING,
        );

        await this.walletRepository.updateOne(
          { id: wallet.id },
          {
            $inc: {
              total_balance: pendingBalance,
            },
            $set: {
              pending_balance: 0,
            },
          },
        );
      }

      if (cache) {
        await this.cacheRepository.updateOne(
          { id: cache.id },
          {
            $set: {
              expires: Date.now() + PROCESS_PENDING_BLANCE_CACHE_TTL,
            },
          },
        );
      } else {
        const newCache = this.cacheRepository.create({
          id: uuidv4(),
          key: PROCESS_PENDING_BLANCE_CACHE_KEY,
          value: true,
          expires: Date.now() + PROCESS_PENDING_BLANCE_CACHE_TTL,
        });
        await this.cacheRepository.save(newCache);
      }

      return successResponse({
        status: true,
        message: 'Pending balances processed successfully',
      });
    } catch (error) {
      this.logger.error('Error processing pending balances', error.stack);

      if (error instanceof ServiceError) {
        return error.toErrorResponse();
      }

      throw new ServiceError(
        'Error processing pending balances',
        HttpStatus.INTERNAL_SERVER_ERROR,
      ).toErrorResponse();
    }
  }

  private async getUsersRank() {
    const wallets = await this.walletRepository.find({
      order: {
        total_balance: 'DESC',
      },
    });

    let rank = 1;
    let previousPoints = null;
    let tiedCount = 0;

    for (const wallet of wallets) {
      if (previousPoints !== wallet.total_balance) {
        rank += tiedCount;
        tiedCount = 0;
      }

      wallet.rank = rank;
      previousPoints = wallet.total_balance;
      tiedCount++;
    }

    return wallets;
  }

  private async getUserRankByWalletId(walletId: string) {
    const wallets = await this.getUsersRank();
    const walletRank = wallets.find((w) => w.id === walletId);

    return walletRank?.rank || 0;
  }

  private async getTotalReferralPoints(walletId: string) {
    const activity = await this.activityRepository.findOne({
      where: {
        slug: ActivitySlug.REFERRAL,
      },
    });

    if (!activity) {
      return 0;
    }

    const referralPoints = await this.transactionRepository
      .aggregate([
        {
          $match: {
            wallet_id: walletId,
            activity_id: activity.id,
          },
        },
        {
          $group: {
            _id: null,
            totalPoints: { $sum: '$points' },
          },
        },
      ])
      .toArray();

    if (referralPoints.length > 0) {
      return referralPoints[0].totalPoints || 0;
    } else {
      return 0;
    }
  }

  private async getTotalPointsInCirculation() {
    const totalPoints = await this.transactionRepository
      .aggregate([
        {
          $match: {
            type: TransactionType.EARN,
            status: TransactionStatus.SUCCESS,
          },
        },
        {
          $group: {
            _id: null,
            totalPoints: { $sum: '$points' },
          },
        },
      ])
      .toArray();

    if (totalPoints.length > 0) {
      return totalPoints[0].totalPoints;
    } else {
      return 0;
    }
  }

  async recordActivityPoints({
    userId,
    walletId,
    walletAddress,
    activitySlug,
    points,
  }: RecordActivityPoint) {
    try {
      const activity = await this.activityRepository.findOne({
        where: {
          slug: activitySlug,
        },
      });

      if (!activity) {
        throw new ServiceError('Activity not found', HttpStatus.NOT_FOUND);
      }

      const activityPoints = points || activity.points;
      const activityType = activitySlugToActivityType[activitySlug];

      await this.recordPoints({
        userId,
        walletId,
        walletAddress,
        activityId: activity.id,
        activityType,
        description: activity.name,
        points: activityPoints,
      });

      await this.recordReferralPoints(userId, activity.points);

      return true;
    } catch (error) {
      this.logger.error(
        `Error recording activity points for user ${userId} and wallet ${walletId}`,
        error.stack,
      );

      return false;
    }
  }

  private async recordReferralPoints(userId: string, points: number) {
    const referral = await this.referralRepository.findOne({
      where: {
        referred_user_id: userId,
      },
    });

    if (!referral) {
      return;
    }

    const activity = await this.activityRepository.findOne({
      where: {
        slug: ActivitySlug.REFERRAL,
      },
    });

    if (!activity) {
      throw new ServiceError('Activity not found', HttpStatus.NOT_FOUND);
    }

    const user = await this.getUserById(referral.referrer_user_id);

    const earnedPoints = BigNumber(points)
      .multipliedBy(activity.percentage)
      .div(100);

    const activityType = activitySlugToActivityType[activity.slug];

    return await this.recordPoints({
      userId: user.id,
      walletId: user.wallet.id,
      walletAddress: user.wallet_address,
      activityId: activity.id,
      activityType,
      description: activity.name,
      points: earnedPoints.toNumber(),
    });
  }

  private async recordPoints({
    userId,
    walletId,
    walletAddress,
    activityId,
    activityType,
    description,
    points,
  }: RecordPoint) {
    try {
      await Promise.all([
        this.contractService.recordPoints(walletAddress, points, activityType),
        this.walletRepository.updateOne(
          { id: walletId, user_id: userId },
          {
            $inc: {
              total_balance: points,
            },
          },
        ),
        this.transactionRepository.save({
          id: uuidv4(),
          wallet_id: walletId,
          activity_id: activityId,
          points,
          description: `${points} points earned for ${description}`,
          status: TransactionStatus.SUCCESS,
          type: TransactionType.EARN,
        }),
      ]);

      return true;
    } catch (error) {
      this.logger.error(
        `Error recording points for user ${userId} and wallet ${walletId}`,
        error.stack,
      );

      return false;
    }
  }

  private async tokenBridgeListener(): Promise<void> {
    this.logger.log(`Listening for token bridging events`);

    const contract = this.contractService.getContract(
      env.contract.bridgeAddress,
      [
        'event ERC20BridgeFinalized(address indexed localToken, address indexed remoteToken, address indexed from, address to, uint256 amount, bytes extraData)',
      ],
    );

    contract.on(
      'ERC20BridgeFinalized',
      async (
        localToken: string,
        remoteToken: string,
        from: string,
        to: string,
        amount: ethers.BigNumber,
        extraData: string,
      ) => {
        this.logger.log(
          `ERC20BridgeFinalized event emitted for ${localToken} ${remoteToken} ${from} ${to} ${amount} ${extraData}`,
        );
      },
    );
  }

  private async liquidityMigrationListener(): Promise<void> {
    this.logger.log(`Listening for liquidity migration events`);

    const contract = this.contractService.getContract(
      env.contract.bridgeAddress,
      [
        'event LiquidityDeposited(address user, address token0, address token1, uint256 amount0, uint256 amount1, uint256 lpTokens)',
      ],
    );

    contract.on(
      'LiquidityDeposited',
      async (
        user: string,
        token0: string,
        token1: string,
        amount0: ethers.BigNumber,
        amount1: ethers.BigNumber,
        lpTokens: ethers.BigNumber,
      ) => {
        this.logger.log(
          `LiquidityDeposited event emitted ${user} ${token0} ${token1} ${amount0} ${amount1} ${lpTokens}`,
        );

        const isETH = token0 === Token.BASE_WETH || token1 === Token.BASE_WETH;
        const ethAmount = token0 === Token.BASE_WETH ? amount0 : amount1;

        if (isETH) {
          const points =
            await this.calculateETHLiquidityMigrationPoints(ethAmount);

          if (points <= 0) {
            return;
          }

          const authUser = await this.getUserByWalletAddress(user);

          await this.recordActivityPoints({
            userId: authUser.id,
            walletId: authUser.wallet.id,
            walletAddress: authUser.wallet_address,
            activitySlug: ActivitySlug.LIQUIDITY_MIGRATION,
            points,
          });
        } else {
          const authUser = await this.getUserByWalletAddress(user);

          const points = amount0.mul(1000);
          await this.recordActivityPoints({
            userId: authUser.id,
            walletId: authUser.wallet.id,
            walletAddress: authUser.wallet_address,
            activitySlug: ActivitySlug.LIQUIDITY_MIGRATION,
            points: points.toNumber(),
          });
        }
      },
    );
  }

  private async calculateETHLiquidityMigrationPoints(amount: ethers.BigNumber) {
    const ethPriceUSD = await this.analyticService.getEthPriceInUsd();
    const amountInEth = ethers.utils.parseEther(amount.toString());
    const amountInUSD = amountInEth.mul(ethPriceUSD);

    if (amountInUSD.lt(1)) {
      return 0;
    }

    const points = amountInUSD.mul(1000);

    return points.toNumber();
  }

  private async seedActivities() {
    const activities = [
      {
        id: uuidv4(),
        name: 'Referral',
        slug: ActivitySlug.REFERRAL,
        points: 250,
        description:
          'Users who refer their friends will get 10% of the points your referrals earn.',
        is_percentage_based: true,
        percentage: 10,
        is_active: true,
        multipliers: [],
      },
      {
        id: uuidv4(),
        name: 'The Great Migration NFT',
        slug: ActivitySlug.NFT,
        points: 500,
        description:
          'Users who mint The Great Migration NFT will receive 500 Migrate points',
        is_percentage_based: false,
        percentage: 0,
        is_active: true,
        multipliers: [],
      },
      {
        id: uuidv4(),
        name: 'Social Interaction',
        slug: ActivitySlug.SOCIAL,
        points: 250,
        description:
          'Users who follow Supermigrate twitter account will receive 250 Migrate Points.',
        is_percentage_based: false,
        percentage: 0,
        is_active: true,
        multipliers: [
          {
            id: uuidv4(),
            slug: MultiplierSlug.VERIFIED_ACCOUNT,
            description: '1x PTS multipliers for Verified account',
            multiplier: 1,
            is_active: true,
            activity_slug: ActivitySlug.SOCIAL,
          },
          {
            id: uuidv4(),
            slug: MultiplierSlug.FOLLOWER,
            description: '2x PTS multiplier for accounts above 2,000 followers',
            multiplier: 2,
            is_active: true,
            activity_slug: ActivitySlug.SOCIAL,
          },
        ],
      },
      {
        id: uuidv4(),
        name: 'Bridge',
        slug: ActivitySlug.BRIDGE,
        points: 500,
        description:
          'All users on Supermigrate bridging through the bridge interface on supermigrate will earn  500 points for every $1 bridged.',
        is_percentage_based: false,
        percentage: 0,
        is_active: true,
        multipliers: [
          {
            id: uuidv4(),
            slug: MultiplierSlug.FEATURED_TOKEN,
            description: '1.5x Migrate PTS multipliers for featured tokens',
            note: 'Bridging rewards will be earned retroactively and points will become available every 2 weeks after snapshots have been taken.',
            multiplier: 1.5,
            is_active: true,
            activity_slug: ActivitySlug.BRIDGE,
          },
          {
            id: uuidv4(),
            slug: MultiplierSlug.SUPERMIGRATE_TOKEN,
            description:
              '3x Migrate PTS multiplier for tokens that migrated using Supermigrate',
            note: 'Bridging rewards will be earned retroactively and points will become available every 2 weeks after snapshots have been taken.',
            multiplier: 3,
            is_active: true,
            activity_slug: ActivitySlug.BRIDGE,
          },
        ],
      },
      {
        id: uuidv4(),
        name: 'Liquidity Migration',
        slug: ActivitySlug.LIQUIDITY_MIGRATION,
        points: 1000,
        description:
          'Users who migrate Liquidity will receive 1000 points for every $1 worth of Liquidity migrated ',
        is_percentage_based: false,
        percentage: 0,
        is_active: true,
        multipliers: [
          {
            id: uuidv4(),
            slug: MultiplierSlug.STAKE_LP,
            description:
              '2.5x Migrate point multipliers for users who opt in to stake LP tokens.',
            multiplier: 2.5,
            is_active: true,
            activity_slug: ActivitySlug.LIQUIDITY_MIGRATION,
          },
        ],
      },
    ];

    const activityPromises = activities.map(async (activity) => {
      const activityExist = await this.activityRepository.findOne({
        where: {
          slug: activity.slug,
        },
      });

      if (!activityExist) {
        await this.activityRepository.save(activity);
      }
    });

    await Promise.all(activityPromises);
  }

  async getUserByWalletAddress(walletAddress: string) {
    const user = await this.sharedUserRepository.findOne({
      where: {
        wallet_address: walletAddress,
      },
    });

    if (!user) {
      throw new ServiceError('User not found', HttpStatus.NOT_FOUND);
    }

    const wallet = await this.walletRepository.findOne({
      where: {
        user_id: user.id,
      },
    });

    if (!wallet) {
      throw new ServiceError('Wallet not found', HttpStatus.NOT_FOUND);
    }

    return {
      ...user,
      wallet,
    };
  }

  async getUserById(id: string) {
    const user = await this.sharedUserRepository.findOne({
      where: {
        id,
      },
    });

    if (!user) {
      throw new ServiceError('User not found', HttpStatus.NOT_FOUND);
    }

    const wallet = await this.walletRepository.findOne({
      where: {
        user_id: user.id,
      },
    });

    if (!wallet) {
      throw new ServiceError('Wallet not found', HttpStatus.NOT_FOUND);
    }

    return {
      ...user,
      wallet,
    };
  }
}
