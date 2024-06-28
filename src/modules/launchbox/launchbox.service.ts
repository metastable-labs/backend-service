import { HttpService } from '@nestjs/axios';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';

import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { LessThan, MongoRepository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import validator from 'validator';
import { env } from '../../common/config/env';
import { ServiceError } from '../../common/errors/service.error';
import { CloudinaryService } from '../../common/helpers/cloudinary/cloudinary.service';
import { ContractService } from '../../common/helpers/contract/contract.service';
import { FarcasterService } from '../../common/helpers/farcaster/farcaster.service';
import { IResponse } from '../../common/interfaces/response.interface';
import { successResponse } from '../../common/responses/success.helper';
import {
  ActionDTO,
  ChainDto,
  CreateDto,
  PaginateDto,
  PlayDTO,
  RankingPaginateDto,
  SocialDto,
  UpdateDto
} from './dtos/launchbox.dto';
import {
  IncentiveAction,
  IncentiveChannel,
  LaunchboxToken,
  LaunchboxTokenHolder,
  LaunchboxTokenLeaderboard,
  LaunchboxTokenTransaction,
  LeaderboardParticipant,
  TokenConfiguredAction
} from './entities/launchbox.entity';
import { ChannelSlug, FarcasterActions, NFTActions } from './enums/leaderboard.enum';
import { Chain, IIncentiveChannel, ILaunchboxTokenLeaderboard } from './interfaces/launchbox.interface';


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

    @InjectRepository(LaunchboxTokenLeaderboard)
    private readonly leaderboardRepository: MongoRepository<LaunchboxTokenLeaderboard>,


    @InjectRepository(IncentiveChannel)
    private readonly incentiveChannelRespository: MongoRepository<IncentiveChannel>,

    @InjectRepository(LeaderboardParticipant)
    private readonly leaderboardParticipantRepository: MongoRepository<LeaderboardParticipant>,


    @InjectRepository(TokenConfiguredAction)
    private readonly tokenConfiguredActionRepository: MongoRepository<TokenConfiguredAction>,

    @InjectRepository(IncentiveAction)
    private readonly incentiveActionRepository: MongoRepository<IncentiveAction>
  ) { }



  private logger = new Logger(LaunchboxService.name);

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
      console.log(error);

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
      const totalTokens = await this.launchboxTokenRepository.count();

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
        skip: Number(query.skip),
        take: Number(query.take),
        order: {
          created_at: 'DESC',
        },
      });

      return successResponse({
        status: true,
        message: 'Tokens fetched successfully',
        data: launchboxTokens,
        meta: {
          take: Number(query.take),
          skip: Number(query.skip),
          totalCount: totalTokens,
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
      const launchbox = await this.launchboxTokenRepository.findOne({
        where: isUuid ? { id: reference } : { token_address: reference },
      });

      if (!launchbox) {
        throw new ServiceError('Token not found', HttpStatus.NOT_FOUND);
      }

      return successResponse({
        status: true,
        message: 'Token fetched successfully',
        data: launchbox,
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
      const token = await this.launchboxTokenRepository.findOne({
        where: { id },
      });

      if (!token) {
        throw new ServiceError('Token not found', HttpStatus.NOT_FOUND);
      }

      const holdersCount = await this.launchboxTokenHolderRepository.count({
        where: {
          token_id: id,
        },
      });

      const holders = await this.launchboxTokenHolderRepository.find({
        where: {
          token_id: id,
          skip: Number(query.skip),
          take: Number(query.take),
        },
      });

      return successResponse({
        status: true,
        message: 'Token holders fetched successfully',
        data: holders,
        meta: {
          take: Number(query.take),
          skip: Number(query.skip),
          totalCount: holdersCount,
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

      return successResponse({
        status: true,
        message: 'Token casts fetched successfully',
        data: casts,
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
          where: {
            token_id: id,
          },
        });

      const transactions = await this.launchboxTokenTransactionRepository.find({
        where: {
          token_id: id,
          skip: Number(query.skip),
          take: Number(query.take),
        },
      });

      return successResponse({
        status: true,
        message: 'Token transactions fetched successfully',
        data: transactions,
        meta: {
          take: Number(query.take),
          skip: Number(query.skip),
          totalCount: transactionsCount,
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

  async getCoinPrice({
    coin,
    currency,
  }: {
    coin: string;
    currency: string;
  }): Promise<IResponse | ServiceError> {
    try {
      const response = await this.httpService.axiosRef.get(
        `${env.coingecko.url}/coins/markets?vs_currency=${currency}&ids=${coin}`,
      );

      return successResponse({
        status: true,
        message: 'Get current coin price',
        data: {
          name: response.data[0].name,
          symbol: response.data[0].symbol,
          price: response.data[0].current_price,
          currency,
          last_updated: response.data[0].last_updated,
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

  async seedTokenHolders(): Promise<IResponse | ServiceError> {
    try {
      const tokens = await this.launchboxTokenRepository.find();

      for (const token of tokens) {
        const tokenHolder = await this.launchboxTokenHolderRepository.findOne({
          where: {
            token_id: token.id,
          },
          order: {
            block_number: 'DESC',
          },
        });

        const holders = await this.contractService.getTokenHolders(
          token.token_address,
          tokenHolder?.block_number ?? token.chain.block_number ?? 0,
        );

        if (!holders) {
          continue;
        }

        const holderEntries = Object.entries(holders);

        for (const [address, { balance, blockNumber }] of holderEntries) {
          if (balance.eq(0)) {
            await this.launchboxTokenHolderRepository.deleteOne({
              where: { address, token_id: token.id },
            });
          } else {
            const holder = await this.launchboxTokenHolderRepository.findOne({
              where: { address, token_id: token.id },
            });

            if (holder) {
              await this.launchboxTokenHolderRepository.updateOne(
                { token_id: token.id, address },
                {
                  $set: {
                    balance: balance.toString(),
                  },
                },
              );
            } else {
              const newHolder = this.launchboxTokenHolderRepository.create({
                id: uuidv4(),
                balance: balance.toString(),
                address,
                block_number: blockNumber,
                token_id: token.id,
              });

              await this.launchboxTokenHolderRepository.save(newHolder);
            }
          }
        }
      }

      return successResponse({
        status: true,
        message: 'Tokens holders seeded successfully',
      });
    } catch (error) {
      this.logger.error(
        'An error occurred while seeding the token holders.',
        error,
      );

      if (error instanceof ServiceError) {
        return error.toErrorResponse();
      }

      throw new ServiceError(
        'An error occurred while seeding the token holders. Please try again later.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      ).toErrorResponse();
    }
  }

  async seedTokenTransactions(): Promise<IResponse | ServiceError> {
    try {
      const tokens = await this.launchboxTokenRepository.find();

      for (const token of tokens) {
        const tokenTransactions =
          await this.launchboxTokenTransactionRepository.findOne({
            where: {
              token_id: token.id,
            },
            order: {
              block_number: 'DESC',
            },
          });

        const transactions = await this.contractService.getTokenTransactions(
          token.token_address,
          tokenTransactions?.block_number ?? token.chain.block_number ?? 0,
        );

        if (!transactions) {
          continue;
        }

        for (const transaction of transactions) {
          const newTransaction =
            this.launchboxTokenTransactionRepository.create({
              id: uuidv4(),
              address: transaction.address,
              token_value: transaction.tokenValue,
              eth_value: transaction.ethValue,
              fee: transaction.fee,
              type: transaction.type,
              transaction_hash: transaction.transactionHash,
              block_number: transaction.blockNumber,
              token_id: token.id,
            });

          await this.launchboxTokenTransactionRepository.save(newTransaction);
        }
      }

      return successResponse({
        status: true,
        message: 'Tokens transactions seeded successfully',
      });
    } catch (error) {
      this.logger.error(
        'An error occurred while seeding the token transactions.',
        error,
      );

      if (error instanceof ServiceError) {
        return error.toErrorResponse();
      }

      throw new ServiceError(
        'An error occurred while seeding the token transactions. Please try again later.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      ).toErrorResponse();
    }
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
      } else if (!token.socials?.warpcast?.channel?.url) {
        throw new ServiceError(
          'Token does not have a connected channel',
          HttpStatus.BAD_REQUEST,
        );
      }

      let leaderboard = await this.leaderboardRepository.findOne({
        where: {
          token_id: token.id
        }
      })

      if (!leaderboard) {
        await this.leaderboardRepository.save(this.leaderboardRepository.create({
          is_active: true,
          token_id: token.id,
          id: uuidv4(),
          incentives: []
        }))
      }

      leaderboard = await this.leaderboardRepository.findOne({
        where: {
          token_id: token.id
        },
        relations: ['participants', "incentives"]
      })
      const { _id, ...data } = leaderboard!;

      let response: ILaunchboxTokenLeaderboard = {
        ...data,
        incentives: []
      }

      if (data.incentives && data.incentives.length >= 1) {
        const channels = await this.getSystemChannels();
        response.incentives = data.incentives.map((cfg) => {
          const channel = channels.find(ch => ch.actions.some(ac => ac.id === cfg.action_id));
          if (channel) {
            const action = channel.actions.find(ac => ac.id === cfg.action_id);
            if (action) {
              // FIX: do this at entity level
              const { _id, ...clean } = channel
              return {
                ...clean,
                actions: [action]
              };
            }
          }
          return null;
        }).filter(i => i !== null) as unknown as IIncentiveChannel[];
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

  async activateLeaderboard(token_id: string): Promise<IResponse | ServiceError> {
    try {
      const lbToken = await this.launchboxTokenRepository.findOne({
        where: {
          id: token_id
        }
      });

      if (!lbToken) {
        throw new ServiceError('Token not found', HttpStatus.NOT_FOUND);
      }

      let leaderboard = await this.leaderboardRepository.findOne({
        where: {
          token_id
        }
      });

      if (!leaderboard) {
        leaderboard = await this.leaderboardRepository.save(this.leaderboardRepository.create({
          token_id,
          is_active: true
        }));
      }

      if (!leaderboard.is_active) {
        await this.leaderboardRepository.updateOne({ token_id },
          {
            $set: {
              is_active: true,
            },
          });
      }
      return successResponse({
        status: true,
        message: 'Token casts fetched successfully',
        data: leaderboard,
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

  async earnPoints(token_id: string, user: PlayDTO): Promise<IResponse | ServiceError> {
    try {
      const lbToken = await this.launchboxTokenRepository.findOne({
        where: {
          id: token_id
        }
      });

      if (!lbToken) {
        throw new ServiceError('Token not found', HttpStatus.NOT_FOUND);
      }


      let leaderboard = await this.leaderboardRepository.findOne({
        where: {
          token_id
        }
      });


      if (!leaderboard) {
        throw new ServiceError('Leaderboard not active for token', HttpStatus.NOT_FOUND);
      }

      let rank = await this.leaderboardParticipantRepository.findOne({
        where: {
          leaderboard_id: leaderboard.id,
          associated_address: user.associated_address
        }
      })

      if (!rank) {
        const { associated_address, farcaster_username } = user
        rank = new LeaderboardParticipant(leaderboard.id, farcaster_username, associated_address)

        if (!leaderboard.participants) {
          leaderboard.participants = [rank]
        } else {
          leaderboard.participants.push(rank)
        }
        await this.leaderboardRepository.updateOne({ id: leaderboard.id }, {
          $set: {
            participants: [...leaderboard.participants]
          }
        })
      } else {
        return successResponse({
          status: true,
          statusCode: 409,
          message: 'success',
          data: { rank },
        })
      }

      return successResponse({
        status: true,
        message: 'success',
        data: { rank },
      })
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

  async getRank(address: string, token_id: string): Promise<IResponse | ServiceError> {
    try {
      const leaderboard = await this.leaderboardRepository.findOne({
        where: { token_id },
        relations: ['participants', 'incentives'],
      });

      if (!leaderboard) {
        throw new ServiceError('Leaderboard not found', HttpStatus.NOT_FOUND);
      }

      const participant = leaderboard.participants.find((p) => p.associated_address === address);

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
      const participantPoints = participant.completed_actions.reduce((acc, actionId) => {
        const action = leaderboard.incentives.find((a) => a.action_id === actionId);
        return acc + (action ? action.points : 0);
      }, 0);

      const sortedParticipants = await Promise.all(
        leaderboard.participants.map(async (p) => {
          const points = p.completed_actions.reduce((acc, actionId) => {
            const action = leaderboard.incentives.find((a) => a.action_id === actionId);
            return acc + (action ? action.points : 0);
          }, 0);
          return { ...p, points };
        })
      );

      sortedParticipants.sort((a, b) => b.points - a.points);

      const rank = sortedParticipants.findIndex(p => p.associated_address === address) + 1;

      return successResponse({
        status: true,
        message: 'Rank fetched successfully',
        data: {
          total_points: participantPoints,
          rank: rank,
        },
      });
    } catch (error) {
      this.logger.error('An error occurred while fetching the rank.', error.stack);

      if (error instanceof ServiceError) {
        return error.toErrorResponse();
      }

      throw new ServiceError(
        'An error occurred while fetching the rank. Please try again later.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      ).toErrorResponse();
    }
  }


  async getAllRanking(token_id: string, paginate: RankingPaginateDto): Promise<IResponse | ServiceError> {
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
          message: "success",
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
              const action = leaderboard.incentives.find((a) => a.action_id === actionId);
              return acc + (action ? action.points : 0);
            }, 0);
            return { ...p, points };
          }

          return { ...p, points: 0 };
        })
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
        paginate.page * paginate.limit
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
      this.logger.error('An error occurred while fetching the ranking.', error.stack);

      if (error instanceof ServiceError) {
        return error.toErrorResponse();
      }

      throw new ServiceError(
        'An error occurred while fetching the ranking. Please try again later.',
        HttpStatus.INTERNAL_SERVER_ERROR
      ).toErrorResponse();
    }
  }


  async addIncentiveAction(token_id: string, action: ActionDTO): Promise<IResponse | ServiceError> {
    try {
      const leaderboard = await this.leaderboardRepository.findOne({
        where: {
          token_id
        },
        relations: ["incentives"]
      });

      if (!leaderboard) {
        throw new ServiceError('Leaderboard not found', HttpStatus.NOT_FOUND);
      }

      const newAction = new TokenConfiguredAction();
      newAction.id = uuidv4();
      newAction.action_id = action.id;
      newAction.points = action.points;
      newAction.is_active = true;


      const updates = leaderboard.incentives ? [...leaderboard.incentives, newAction] : [newAction]
      await this.leaderboardRepository.updateOne({ id: leaderboard.id }, {
        $set: {
          incentives: updates
        }
      })

      return successResponse({
        status: true,
        message: 'Action added successfully',
        data: leaderboard,
      });
    } catch (error) {
      this.logger.error(
        'An error occurred while adding the incentive action.',
        error.stack,
      );

      if (error instanceof ServiceError) {
        return error.toErrorResponse();
      }

      throw new ServiceError(
        'An error occurred while adding the incentive action. Please try again later.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      ).toErrorResponse();
    }
  }


  async removeIncentiveAction(token_id: string, action_id: string): Promise<IResponse | ServiceError> {
    try {
      const leaderboard = await this.leaderboardRepository.findOne({
        where: {
          token_id
        }
      });

      if (!leaderboard) {
        throw new ServiceError('Leaderboard not found', HttpStatus.NOT_FOUND);
      }

      leaderboard.incentives = leaderboard.incentives.filter(action => action.action_id !== action_id);
      await this.leaderboardRepository.save(leaderboard);

      return successResponse({
        status: true,
        message: 'Action removed successfully',
        data: leaderboard,
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
      console.log(error);
      throw new ServiceError('something went wrong', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async seedSystemChannels() {
    const channels = [
      {
        id: uuidv4(),
        name: 'NFT',
        slug: ChannelSlug.NFT,
        info:
          'Users hold the project NFT earn points.',
        actions: [
          {
            id: uuidv4(),
            name: "OWN",
            description: "User must own the channel NFT",
            slug: NFTActions.OWN
          },
        ]
      },
      {
        id: uuidv4(),
        name: 'FARCASTER',
        slug: ChannelSlug.FARCASTER,
        info:
          'Users who participate in project Channel earn points.',
        actions: [
          {
            id: uuidv4(),
            name: "CAST",
            description: "User must cast in channel",
            slug: FarcasterActions.CAST
          },
          {
            id: uuidv4(),
            name: "FOLLOW",
            description: "User must follow",
            slug: FarcasterActions.FOLLOW_CHAN
          },
        ]
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




  @Cron('45 * * * * *')
  async calculateRanks() {
    try {
      const fourMinutesAgo = new Date(Date.now() - 4 * 60 * 1000);

      const hotLeaderboards = await this.leaderboardRepository.find({
        where: {
          updated_at: LessThan(fourMinutesAgo),
        },
      });

      this.logger.debug('Calculate Rewards');

      const channels = await this.getSystemChannels();

      const configuredChannels = hotLeaderboards.map((ldb) => {
        const configuredChannels = ldb.incentives.map((cfg) => {
          const channel = channels.find(ch => ch.actions.some(ac => ac.id === cfg.action_id));
          if (channel) {
            const action = channel.actions.find(ac => ac.id === cfg.action_id);
            if (action) {
              // FIX: do this at entity level
              const { _id, ...clean } = channel
              return {
                ...clean,
                actions: [action]
              };
            }
          }
          return null;
        }).filter(i => i !== null) as unknown as IIncentiveChannel[];

        return {
          leaderboard: ldb.id,
          channels: configuredChannels
        }
      })




      for (const leaderboard of hotLeaderboards) {

      }


    } catch (error) {
      this.logger.error('Error calculating ranks', error.stack);
    }
  }

}
