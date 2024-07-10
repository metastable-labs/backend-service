import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEthereumAddress,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  ValidateNested
} from 'class-validator';
import { PeriodKey } from 'src/common/helpers/analytic/interfaces/analytic.interface';



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

  @IsOptional()
  @IsUrl({
    require_protocol: true,
  })
  telegram_url: string;

  @IsOptional()
  @IsUrl({
    require_protocol: true,
  })
  twitter_url: string;

  @IsNotEmpty()
  @IsString()
  chain: string;
}

export class UpdateDto {
  @IsOptional()
  @Type(() => SocialDto)
  @ValidateNested()
  socials: { [key: string]: SocialDto };


  @IsOptional()
  @IsUrl({
    require_protocol: true,
  })
  telegram_url: string;

  @IsOptional()
  @IsUrl({
    require_protocol: true,
  })
  twitter_url: string;

  @IsOptional()
  @IsBoolean()
  create_token_page: boolean;
}

export class ChainDto {
  @IsNotEmpty()
  @IsNumber()
  id: number;

  @IsNotEmpty()
  @IsString()
  name: string;

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

export class MetadataDTO {
  @IsString()
  @IsOptional()
  contract?: string;

  @IsString()
  @IsOptional()
  channel?: string;
}

export class ActionDTO {
  @IsNotEmpty()
  @IsString()
  id: string;

  @IsNotEmpty()
  @IsNumber()
  points: number;

  @IsNotEmpty()
  @IsObject()
  @ValidateNested()
  @Type(() => MetadataDTO)
  metadata: MetadataDTO;
}

export class ActionsArrayDTO {
  @ValidateNested({ each: true })
  @Type(() => ActionDTO)
  @IsArray()
  actions: ActionDTO[];
}


export class RemoveActionDTO {
  @IsNotEmpty()
  @IsString()
  action_id: string;
}


export class PlayDTO {
  @IsNotEmpty()
  @IsEthereumAddress()
  @Transform(({ value }) => value.trim())
  associated_address: string;


  @IsNotEmpty()
  farcaster_username: string
}
export class PriceAnalyticQueryDto {
  @IsNotEmpty()
  @IsString()
  period: PeriodKey;
}

class AppearanceDto {
  @IsNotEmpty()
  @IsString()
  primary_color: string;

  @IsNotEmpty()
  @IsString()
  secondary_color: string;
}

class NavigationDto {
  @IsNotEmpty()
  @IsUrl({
    require_protocol: true,
  })
  buy_url: string;

  logo_url: string | undefined;
}

class HeroSectionDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsString()
  description: string;

  image_url: string | undefined;
}

class AboutSectionDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsString()
  description: string;

  image_url: string | undefined;
}

class TokenomicsDto {
  [key: string]: string;
}

class FaqQuestionDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsString()
  answer: string;
}

class FaqDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsString()
  description: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FaqQuestionDto)
  questions: FaqQuestionDto[];
}

class FooterDto {
  @IsNotEmpty()
  @IsUrl({
    require_protocol: true,
  })
  twitter_url: string;

  @IsNotEmpty()
  @IsUrl({
    require_protocol: true,
  })
  farcaster_url: string;

  @IsNotEmpty()
  @IsUrl({
    require_protocol: true,
  })
  telegram_url: string;

  @IsNotEmpty()
  @IsUrl({
    require_protocol: true,
  })
  chain_explorer_url: string;
}

export class WebsiteBuilderDto {
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => AppearanceDto)
  @Transform(({ value }) =>
    typeof value === 'string' ? JSON.parse(value) : value,
  )
  appearance: AppearanceDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => NavigationDto)
  @Transform(({ value }) =>
    typeof value === 'string' ? JSON.parse(value) : value,
  )
  navigation: NavigationDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => HeroSectionDto)
  @Transform(({ value }) =>
    typeof value === 'string' ? JSON.parse(value) : value,
  )
  hero_section: HeroSectionDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => AboutSectionDto)
  @Transform(({ value }) =>
    typeof value === 'string' ? JSON.parse(value) : value,
  )
  about_section: AboutSectionDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => TokenomicsDto)
  @Transform(({ value }) =>
    typeof value === 'string' ? JSON.parse(value) : value,
  )
  tokenomics: TokenomicsDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => FaqDto)
  @Transform(({ value }) =>
    typeof value === 'string' ? JSON.parse(value) : value,
  )
  faq: FaqDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => FooterDto)
  @Transform(({ value }) =>
    typeof value === 'string' ? JSON.parse(value) : value,
  )
  footer: FooterDto;
}
