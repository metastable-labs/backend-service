import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { chromium } from 'playwright';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '@privy-io/server-auth';
import { JwtService } from '@nestjs/jwt';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../../common/config/env';
import { SharedUser } from './entities/user.entity';
import { PrivyService } from '../../common/helpers/privy/privy.service';
import { IResponse } from '../../common/interfaces/response.interface';
import { ServiceError } from '../../common/errors/service.error';
import { successResponse } from '../../common/responses/success.helper';

@Injectable()
export class SharedService {
  constructor(
    @InjectRepository(SharedUser)
    private readonly sharedUserRepository: Repository<SharedUser>,
    private readonly privyService: PrivyService,
    private readonly jwtService: JwtService,
  ) {}

  private readonly logger = new Logger(SharedService.name);

  private readonly cache: { ethPrice: number; timestamp: number } = {
    ethPrice: 0,
    timestamp: 0,
  };

  async authenticate(privyUserId: string): Promise<IResponse | ServiceError> {
    try {
      const userExists = await this.sharedUserRepository.findOne({
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

      const newUser = this.sharedUserRepository.create({
        id: uuidv4(),
        reference: privyUserId,
        auth_id: identifier,
        auth_type: type,
        wallet_address: walletAddress,
        is_active: true,
        payload: privyUser,
      });

      await this.sharedUserRepository.save(newUser);

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

  async getEthPriceInUsd(): Promise<number> {
    const CACHE_DURATION = 5 * 60 * 1000; // Cache duration in milliseconds (5 minutes)
    const currentTime = Date.now();

    if (this.cache && currentTime - this.cache.timestamp < CACHE_DURATION) {
      return this.cache.ethPrice;
    }

    const ethPrice = await this.fetchEthPrice();
    this.cache.ethPrice = ethPrice;
    this.cache.timestamp = currentTime;

    return ethPrice;
  }

  private async fetchEthPrice(): Promise<number> {
    try {
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      await page.goto(env.blockchainPrice.url, {
        waitUntil: 'domcontentloaded',
      });

      const ethPrice = await page.$eval('.sc-bb87d037-10', (el) =>
        el.textContent ? el.textContent.trim() : '',
      );
      const ethPriceInNumber = parseFloat(ethPrice.replace(/[^0-9.-]+/g, ''));

      await browser.close();

      return ethPriceInNumber;
    } catch (error) {
      this.logger.error(
        `SharedService.getEthPriceInUsd: Error while fetching ETH price`,
        error,
      );

      return 0;
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
}
