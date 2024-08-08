import { IsNumber, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class PaginateDto {
  @IsOptional()
  @Transform(({ value }) => (parseInt(value) > 50 ? 50 : parseInt(value)))
  @IsNumber()
  take = 50;

  @IsOptional()
  @Transform(({ value }) => parseInt(value.trim()))
  @IsNumber()
  skip = 0;
}
