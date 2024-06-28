import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEthereumAddress,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  ValidateNested,
} from 'class-validator';



export class SocialDto {
  @IsNotEmpty()
  @IsString()
  channel_id: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  description: string;

  @IsNotEmpty()
  @IsString()
  dapp_name: string;

  @IsNotEmpty()
  @IsUrl({
    require_protocol: true,
  })
  url: string;

  @IsNotEmpty()
  @IsUrl({
    require_protocol: true,
  })
  image_url: string;

  @IsNotEmpty()
  @IsNumber()
  follower_count: number;

  @IsNotEmpty()
  @IsArray()
  lead_ids: string[];

  @IsNotEmpty()
  @IsDateString()
  created_at: Date;
}

export class CreateDto {
  @IsNotEmpty()
  @IsString()
  @Transform(({ value }) => value.trim())
  token_name: string;

  @IsNotEmpty()
  @IsString()
  @Transform(({ value }) => value.trim())
  token_symbol: string;

  @IsNotEmpty()
  @IsString()
  token_decimals: string;

  @IsNotEmpty()
  @IsEthereumAddress()
  @Transform(({ value }) => value.trim())
  token_address: string;

  @IsNotEmpty()
  @IsEthereumAddress()
  @Transform(({ value }) => value.trim())
  exchange_address: string;

  @IsNotEmpty()
  @IsString()
  token_total_supply: string;

  @IsNotEmpty()
  @IsString()
  @Transform(({ value }) => value.trim().toLowerCase())
  create_token_page: string;

  @IsOptional()
  @IsString()
  socials: string;

  @IsOptional()
  @IsUrl({
    require_protocol: true,
  })
  website_url: string;

  @IsNotEmpty()
  @IsString()
  chain: string;
}

export class UpdateDto {
  @IsOptional()
  @Type(() => SocialDto)
  @ValidateNested()
  socials: { [key: string]: SocialDto };
}

export class ChainDto {
  @IsNotEmpty()
  @IsNumber()
  id: number;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsEthereumAddress()
  deployer_address: string;

  @IsString()
  @IsNotEmpty()
  transaction_hash: string;

  @IsNotEmpty()
  @IsNumber()
  block_number: number;
}

export class PaginateDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (parseInt(value.trim()) > 50 ? '50' : value.trim()))
  take = '50';

  @IsOptional()
  @IsString()
  skip = '0';

  @IsOptional()
  @IsEthereumAddress()
  @Transform(({ value }) => value.trim())
  deployer_address: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value.trim())
  search: string;

}


export class RankingPaginateDto {
  @IsNotEmpty()
  @IsNumber()
  @Transform(({ value }) => (parseInt(value.trim())))
  limit: number;

  @IsNotEmpty()
  @IsNumber()
  @Transform(({ value }) => (parseInt(value.trim())))
  page: number;
}

export class ActionDTO {
  @IsNotEmpty()
  @IsNumber()
  points: number;

  @IsNotEmpty()
  id: string

}


export class PlayDTO {
  @IsNotEmpty()
  @IsEthereumAddress()
  @Transform(({ value }) => value.trim())
  associated_address: string;


  @IsNotEmpty()
  farcaster_username: string
}