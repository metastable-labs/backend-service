import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { env } from 'src/common/config/env';
import { MongoRepository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { ServiceError } from '../../common/errors/service.error';
import { ContractService } from '../../common/helpers/contract/contract.service';
import { IResponse } from '../../common/interfaces/response.interface';
import { successResponse } from '../../common/responses/success.helper';
import { generateCode } from '../../common/utils';
import { User } from '../user/entities/user.entity';
import { RegisterDto } from './dtos/earn.dto';
import { Activity } from './entities/activity.entity';
import { Multiplier } from './entities/multiplier.entity';
import { Referral } from './entities/referral.entity';
import { Transaction } from './entities/transaction.entity';
import {
  ActivitySlug,
  MultiplierSlug,
  TransactionStatus,
  TransactionType,
} from './enums/earn.enum';

@Injectable()
export class EarnService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: MongoRepository<User>,
    @InjectRepository(Activity)
    private readonly activityRepository: MongoRepository<Activity>,
    @InjectRepository(Referral)
    private readonly referralRepository: MongoRepository<Referral>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: MongoRepository<Transaction>,
    @InjectRepository(Multiplier)
    private readonly multiplierRepository: MongoRepository<Multiplier>,
    private readonly contractService: ContractService,
  ) { }

  async register(
    body: RegisterDto,
    ip: string,
  ): Promise<IResponse | ServiceError> {
    try {
      if (!body.referral_code) {
        const userExist = await this.userRepository.findOne({
          where: {
            connected_addressess: body.connected_address,
          },
        });

        if (userExist) {
          throw new ServiceError(
            'Address already registered',
            HttpStatus.BAD_REQUEST,
          );
        }

        const user = await this.userRepository.save({
          id: uuidv4(),
          github_id: Math.floor(Math.random() * 1000000),
          points_balance: 0,
          connected_addressess: [body.connected_address],
          ip_address: ip,
          referral_code: generateCode(6).toUpperCase(),
        });

        return successResponse({
          status: true,
          message: 'Successfully registered to earn',
          data: {
            ...user,
            _id: undefined,
          },
        });
      }

      const user = await this.userRepository.findOne({
        where: {
          referral_code: body.referral_code,
        },
      });

      if (!user) {
        throw new ServiceError('Invalid referral code', HttpStatus.BAD_REQUEST);
      }

      const userExist = await this.userRepository.findOne({
        where: {
          connected_addressess: body.connected_address,
        },
      });

      if (userExist) {
        throw new ServiceError(
          'Address already registered',
          HttpStatus.BAD_REQUEST,
        );
      }

      const newUser = await this.userRepository.save({
        id: uuidv4(),
        github_id: Math.floor(Math.random() * 1000000),
        points_balance: 0,
        connected_addressess: [body.connected_address],
        referral_code: generateCode(6).toUpperCase(),
        ip_address: ip,
      });

      await this.referralRepository.save({
        id: uuidv4(),
        referrer_user_id: user.id,
        referred_user_id: newUser.id,
        code: body.referral_code,
      });

      const activity = await this.activityRepository.findOne({
        where: {
          slug: ActivitySlug.REFERRAL,
        },
      });

      if (!activity) {
        throw new ServiceError('Activity not found', HttpStatus.NOT_FOUND);
      }

      await this.transactionRepository.save({
        id: uuidv4(),
        user_id: user.id,
        activity_id: activity.id,
        activity_slug: activity.slug,
        points: activity.points_value,
        description: 'Referral bonus',
        status: TransactionStatus.SUCCESS,
        type: TransactionType.EARN,
      });

      await this.userRepository.update(
        { id: user.id },
        {
          points_balance: user.points_balance + activity.points_value,
        },
      );

      return successResponse({
        status: true,
        message: 'Successfully registered to earn',
        data: {
          ...newUser,
          _id: undefined,
        },
      });
    } catch (error) {
      if (error instanceof ServiceError) {
        return error.toErrorResponse();
      }

      throw new ServiceError(
        'Error registering to earn',
        HttpStatus.INTERNAL_SERVER_ERROR,
      ).toErrorResponse();
    }
  }

  async getEarns(address: string): Promise<IResponse | ServiceError> {
    try {
      const user = await this.userRepository.findOne({
        where: {
          connected_addressess: address,
        },
      });

      if (!user) {
        throw new ServiceError('User not found', HttpStatus.NOT_FOUND);
      }

      const numberOfReferrals = await this.referralRepository.find({
        where: {
          referrer_user_id: user.id,
        },
      });

      const referralPoints = await this.getTotalReferralPoints(user.id);
      const totalPoints = await this.getTotalPointsInCirculation();

      const userRank = await this.getUserRankById(user.id);

      return successResponse({
        status: true,
        message: 'User earns fetched',
        data: {
          user,
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
        'Error getting user earns',
        HttpStatus.INTERNAL_SERVER_ERROR,
      ).toErrorResponse();
    }
  }

  async getLeaderboard(): Promise<IResponse | ServiceError> {
    try {
      const users = await this.getUsersRanked();

      return successResponse({
        status: true,
        message: 'Leaderboard fetched',
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
      const activities = await this.activityRepository.find({});

      for (const activity of activities) {
        const multipliers = await this.multiplierRepository.find({
          where: { activity_id: activity.id },
        });

        activity.multipliers = multipliers;
      }

      return successResponse({
        status: true,
        message: 'Activities fetched',
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

  async claimNFTEarnings(address: string): Promise<IResponse | ServiceError> {
    try {
      const user = await this.userRepository.findOne({
        where: {
          connected_addressess: address,
        },
      });

      if (!user) {
        throw new ServiceError('User not found', HttpStatus.NOT_FOUND);
      }

      const balance = await this.contractService.getBalance(address, env.contract.nftAddress);
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

      await this.transactionRepository.save({
        id: uuidv4(),
        user_id: user.id,
        activity_id: activity.id,
        activity_slug: activity.slug,
        points: activity.points_value,
        description: 'NFT earnings',
        status: TransactionStatus.SUCCESS,
        type: TransactionType.EARN,
      });

      await this.userRepository.update(
        { id: user.id },
        {
          points_balance: user.points_balance + activity.points_value,
        },
      );

      return successResponse({
        status: true,
        message: 'Successfully claimed NFT earnings',
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

  private async getUsersRanked() {
    const users = await this.userRepository.find({
      order: {
        points_balance: 'DESC',
      },
    });

    let rank = 1;
    let previousPoints = 0;
    let currentRank = 0;

    for (const user of users) {
      if (previousPoints !== user.points_balance) {
        currentRank = rank;
      }

      user.rank = currentRank;
      previousPoints = user.points_balance;
      rank++;
    }

    return users;
  }

  private async getUserRankById(userId: string) {
    const users = await this.userRepository.find({
      order: {
        points_balance: 'DESC',
      },
    });

    let rank = 1;
    let previousPoints = 0;
    let currentRank = 0;

    for (const user of users) {
      if (previousPoints !== user.points_balance) {
        currentRank = rank;
      }

      if (user.id === userId) {
        return currentRank;
      }

      previousPoints = user.points_balance;
      rank++;
    }
  }

  async getTotalReferralPoints(userId: string) {
    const activity_slug = ActivitySlug.REFERRAL;

    const referralPoints = await this.transactionRepository
      .aggregate([
        {
          $match: {
            user_id: userId,
            activity_slug: activity_slug,
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
      return referralPoints[0].totalPoints;
    } else {
      return 0;
    }
  }

  async getTotalPointsInCirculation() {
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

  async seedActivities() {
    const activities = [
      {
        id: uuidv4(),
        name: 'Referral',
        slug: ActivitySlug.REFERRAL,
        points_value: 250,
        description:
          'Users who refer their friends will get 10% of the points your referrals earn.',
        is_percentage_based: true,
        percentage_value: 10,
        is_active: true,
      },
      {
        id: uuidv4(),
        name: 'The Great Migration NFT',
        slug: ActivitySlug.NFT,
        points_value: 500,
        description:
          'Users who mint The Great Migration NFT will receive 500 Migrate points',
        is_percentage_based: false,
        percentage_value: 0,
        is_active: true,
      },
      {
        id: uuidv4(),
        name: 'Social Interaction',
        slug: ActivitySlug.SOCIAL,
        points_value: 250,
        description:
          'Users who follow Supermigrate twitter account will receive 250 Migrate Points.',
        is_percentage_based: false,
        percentage_value: 0,
        is_active: true,
      },
      {
        id: uuidv4(),
        name: 'Bridge on Supermigrate',
        slug: ActivitySlug.BRIDGE,
        points_value: 0,
        description:
          'All users on Supermigrate bridging through the bridge interface on supermigrate will earn points.',
        is_percentage_based: false,
        percentage_value: 0,
        is_active: true,
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

    await this.seedMultipliers();
  }

  async seedMultipliers() {
    const multipliers = [
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
    ];

    const multiplyPromises = multipliers.map(async (multiplier) => {
      const multiplierExist = await this.multiplierRepository.findOne({
        where: {
          slug: multiplier.slug,
        },
      });

      if (!multiplierExist) {
        const activity = await this.activityRepository.findOne({
          where: {
            slug: multiplier.activity_slug,
          },
        });

        if (!activity) {
          console.log(
            `Activity with slug ${multiplier.activity_slug} not found`,
          );

          return;
        }

        await this.multiplierRepository.save({
          id: multiplier.id,
          slug: multiplier.slug,
          description: multiplier.description,
          note: multiplier.note,
          multiplier: multiplier.multiplier,
          is_active: multiplier.is_active,
          activity_id: activity.id,
        });
      }
    });

    await Promise.all(multiplyPromises);
  }
}
