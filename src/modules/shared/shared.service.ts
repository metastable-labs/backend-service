import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '@privy-io/server-auth';
import { JwtService } from '@nestjs/jwt';
import { v4 as uuidv4 } from 'uuid';
import { User as SharedUser } from './entities/user.entity';
import { PrivyService } from '../../common/helpers/privy/privy.service';
import { IResponse } from '../../common/interfaces/response.interface';
import { ServiceError } from '../../common/errors/service.error';
import { successResponse } from '../../common/responses/success.helper';
import { generateCode } from '../../common/utils';
import { Referral } from './entities/referral.entity';
import { EarnService } from '../earn/earn.service';
import { ActivitySlug } from '../earn/enums/earn.enum';
import { Wallet } from './entities/wallet.entity';
import { GithubService } from '../../common/helpers/github/github.service';

@Injectable()
export class SharedService {
  constructor(
    @InjectRepository(SharedUser)
    private readonly userRepository: Repository<SharedUser>,
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    @InjectRepository(Referral)
    private readonly referralRepository: Repository<Referral>,
    private readonly privyService: PrivyService,
    private readonly jwtService: JwtService,
    private readonly earnService: EarnService,
    private readonly githubService: GithubService,
  ) {}

  private readonly logger = new Logger(SharedService.name);

  async authenticate(
    privyUserId: string,
    referralCode: string,
  ): Promise<IResponse | ServiceError> {
    try {
      let referrerUser: SharedUser | undefined;
      if (referralCode) {
        const user = await this.userRepository.findOne({
          where: {
            referral_code: referralCode,
          },
        });

        if (!user) {
          throw new ServiceError(
            'invalid referral code',
            HttpStatus.BAD_REQUEST,
          );
        }

        const wallet = await this.walletRepository.findOne({
          where: {
            user_id: user.id,
          },
        });

        if (!wallet) {
          throw new ServiceError(
            'invalid referral code',
            HttpStatus.BAD_REQUEST,
          );
        }

        referrerUser = {
          ...user,
          wallet,
        };
      }

      const userExists = await this.userRepository.findOne({
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

      const newUser = this.userRepository.create({
        id: uuidv4(),
        reference: privyUserId,
        auth_id: identifier,
        auth_type: type,
        wallet_address: walletAddress,
        is_active: true,
        referral_code: generateCode(6).toUpperCase(),
        metadata: privyUser,
      });

      await this.userRepository.save(newUser);
      await this.createWallet(newUser.id, walletAddress);

      if (referrerUser) {
        await this.referralRepository.save({
          id: uuidv4(),
          referrer_user_id: referrerUser.id,
          referred_user_id: newUser.id,
          code: referralCode,
        });

        await this.earnService.recordActivityPoints({
          userId: referrerUser.id,
          walletId: referrerUser.wallet.id,
          walletAddress: referrerUser.wallet_address,
          activitySlug: ActivitySlug.REFERRAL,
        });
      }

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
      this.logger.error(
        'An error occurred while authenticating.',
        error.stack,
        'authenticate',
      );

      if (error instanceof ServiceError) {
        return error.toErrorResponse();
      }

      throw new ServiceError(
        'An error occurred while authenticating.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      ).toErrorResponse();
    }
  }

  async github(
    user: SharedUser,
    code: string,
    ipAddress: string,
  ): Promise<IResponse | ServiceError> {
    try {
      const githubUser = await this.githubService.getUserByAuthCode(code);

      if (!githubUser.data || githubUser.status === false) {
        throw new ServiceError(
          'Invalid github authentication code',
          HttpStatus.BAD_REQUEST,
        );
      }

      const userExists = await this.userRepository.findOne({
        where: {
          id: user.id,
          github_id: githubUser.data.id,
        },
      });

      if (userExists) {
        await this.userRepository.update(
          { id: userExists.id },
          {
            github_auth: githubUser.auth,
            ip_address: ipAddress,
          },
        );

        return successResponse({
          status: true,
          message: 'Github authenticated successfully',
          data: userExists,
        });
      }

      await this.userRepository.update(
        { id: user.id },
        {
          name: githubUser.data.name as string,
          username: githubUser.data.login,
          avatar_url: githubUser.data.avatar_url,
          github_id: githubUser.data.id,
          github_auth: githubUser.auth,
          ip_address: ipAddress,
          metadata: githubUser.data as Record<string, any>,
        },
      );

      return successResponse({
        status: true,
        message: 'Github authenticated successfully',
      });
    } catch (error) {
      if (error instanceof ServiceError) {
        return error.toErrorResponse();
      }

      throw new ServiceError(
        'Error occurred while trying to authenticate with Github',
        HttpStatus.INTERNAL_SERVER_ERROR,
      ).toErrorResponse();
    }
  }

  async authSession(user: SharedUser): Promise<IResponse | ServiceError> {
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

  private async createWallet(
    userId: string,
    walletAddress: string,
  ): Promise<Wallet> {
    const wallet = await this.walletRepository.findOne({
      where: {
        user_id: userId,
      },
    });

    if (!wallet) {
      const newWallet = this.walletRepository.create({
        id: uuidv4(),
        user_id: userId,
        wallet_address: walletAddress,
        total_balance: 0,
        pending_balance: 0,
        is_active: true,
      });

      await this.walletRepository.save(newWallet);

      return newWallet;
    }

    return wallet;
  }
}
