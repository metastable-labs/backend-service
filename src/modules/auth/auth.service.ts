import { HttpStatus, Injectable } from '@nestjs/common';
import { MongoRepository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { v4 as uuidv4 } from 'uuid';
import { GithubService } from '../../common/helpers/github/github.service';
import { IResponse } from '../../common/interfaces/response.interface';
import { ServiceError } from '../../common/errors/service.error';
import { User } from '../user/entities/user.entity';
import { successResponse } from '../../common/responses/success.helper';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: MongoRepository<User>,
    private readonly githubService: GithubService,
    private readonly jwtService: JwtService,
  ) {}

  async github(
    code: string,
    ipAddress: string,
  ): Promise<IResponse | ServiceError> {
    try {
      const user = await this.githubService.getUserByAuthCode(code);

      if (!user.data || user.status === false) {
        throw new ServiceError(
          'Invalid authentication code',
          HttpStatus.BAD_REQUEST,
        );
      }

      const userExists = await this.userRepository.findOne({
        where: {
          $or: [{ github_id: user.data.id }, { username: user.data.login }],
        },
      });

      if (userExists && userExists.avatar_url) {
        const { token, expire } = await this.generateToken(userExists.id);

        await this.userRepository.update(
          { id: userExists.id },
          {
            github_auth: user.auth,
            ip_address: ipAddress,
          },
        );

        return successResponse({
          status: true,
          message: 'Authenticated successfully',
          data: {
            token,
            expire,
            user: userExists,
          },
        });
      } else if (userExists && !userExists.avatar_url) {
        await this.userRepository.update(
          { id: userExists.id },
          {
            name: user.data.name as string,
            avatar_url: user.data.avatar_url,
            github_id: user.data.id,
            github_auth: user.auth,
            ip_address: ipAddress,
            metadata: user.data as Record<string, any>,
          },
        );

        const updatedUser = await this.userRepository.findOne({
          where: { github_id: user.data.id },
        });

        const { token, expire } = await this.generateToken(userExists.id);

        return successResponse({
          status: true,
          message: 'Authenticated successfully',
          data: {
            token,
            expire,
            user: updatedUser,
          },
        });
      }

      const newUser = this.userRepository.create({
        id: uuidv4(),
        github_id: user.data.id,
        name: user.data.name as string,
        username: user.data.login,
        avatar_url: user.data.avatar_url,
        ip_address: ipAddress,
        github_auth: user.auth,
        metadata: user.data,
      });
      await this.userRepository.save(newUser);

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
      if (error instanceof ServiceError) {
        return error.toErrorResponse();
      }

      throw new ServiceError(
        'Error occurred while trying to authenticate with Github',
        HttpStatus.INTERNAL_SERVER_ERROR,
      ).toErrorResponse();
    }
  }

  async getSession(id: string): Promise<IResponse | ServiceError> {
    try {
      const user = await this.userRepository.findOne({
        where: { id },
      });

      if (!user) {
        throw new ServiceError('User not found', HttpStatus.NOT_FOUND);
      }

      return successResponse({
        status: true,
        message: 'Auth session',
        data: user,
      });
    } catch (error) {
      if (error instanceof ServiceError) {
        return error.toErrorResponse();
      }

      throw new ServiceError(
        'Error occurred while trying to retrieve user session',
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
}
