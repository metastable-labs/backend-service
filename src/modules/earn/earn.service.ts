import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MongoRepository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import BigNumber from 'bignumber.js';

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
  MultiplierSlug,
  TransactionStatus,
  TransactionType,
} from './enums/earn.enum';
import { SharedWallet } from '../shared/entities/wallet.entity';
import { RecordPoint } from './interfaces/earn.interface';
import { SharedUser } from '../shared/entities/user.entity';
import { PaginateDto } from './dtos/earn.dto';

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
    private readonly contractService: ContractService,
  ) {}

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
          user_id: user.id,
        },
      });

      const transactions = await this.transactionRepository.find({
        where: {
          user_id: user.id,
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
          user_id: user.id,
          activity_id: activity.id,
        },
      });

      if (transaction) {
        throw new ServiceError(
          'NFT earnings already claimed',
          HttpStatus.BAD_REQUEST,
        );
      }

      await this.recordActivityPoints(
        user.id,
        user.wallet.id,
        ActivitySlug.NFT,
      );

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

  private async getUsersRank() {
    const wallets = await this.walletRepository.find({
      order: {
        available_balance: 'DESC',
      },
    });

    let rank = 1;
    let previousPoints = null;
    let tiedCount = 0;

    for (const wallet of wallets) {
      if (previousPoints !== wallet.available_balance) {
        rank += tiedCount;
        tiedCount = 0;
      }

      wallet.rank = rank;
      previousPoints = wallet.available_balance;
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

  async recordActivityPoints(
    userId: string,
    walletId: string,
    activitySlug: ActivitySlug,
  ) {
    const activity = await this.activityRepository.findOne({
      where: {
        slug: activitySlug,
      },
    });

    if (!activity) {
      throw new ServiceError('Activity not found', HttpStatus.NOT_FOUND);
    }

    await this.recordPoints({
      userId,
      walletId,
      activityId: activity.id,
      description: activity.name,
      availableBalancePoints: activity.points,
      totalBalancePoints: activity.points,
      points: activity.points,
    });

    await this.recordReferralPoints(userId, activity.points);
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

    const wallet = await this.walletRepository.findOne({
      where: {
        user_id: referral.referrer_user_id,
      },
    });

    if (!wallet) {
      throw new ServiceError('Wallet not found', HttpStatus.NOT_FOUND);
    }

    const earnedPoints = BigNumber(points)
      .multipliedBy(activity.percentage)
      .div(100);

    await this.recordPoints({
      userId: referral.referrer_user_id,
      walletId: wallet.id,
      activityId: activity.id,
      description: activity.name,
      availableBalancePoints: earnedPoints.toNumber(),
      totalBalancePoints: earnedPoints.toNumber(),
      points: earnedPoints.toNumber(),
    });
  }

  private async recordPoints({
    userId,
    walletId,
    activityId,
    description,
    availableBalancePoints,
    totalBalancePoints,
    points,
  }: RecordPoint) {
    await this.walletRepository.updateOne(
      { id: walletId, user_id: userId },
      {
        $inc: {
          available_balance: availableBalancePoints,
          total_balance: totalBalancePoints,
        },
      },
    );

    await this.transactionRepository.save({
      id: uuidv4(),
      wallet_id: walletId,
      activity_id: activityId,
      points,
      description: `${points} points earned for ${description}`,
      status: TransactionStatus.SUCCESS,
      type: TransactionType.EARN,
    });
  }

  async seedActivities() {
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
        slug: ActivitySlug.LIQUIDITY,
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
            activity_slug: ActivitySlug.LIQUIDITY,
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
}
