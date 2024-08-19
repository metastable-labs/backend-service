import { Transform } from 'class-transformer';
import { IsNumber, IsOptional } from 'class-validator';

export class PaginateDto {
  @IsOptional()
  @Transform(({ value }) =>
    parseInt(value.trim()) > 50 ? 50 : parseInt(value.trim()),
  )
  @IsNumber()
  take = 50;

  @IsOptional()
  @Transform(({ value }) => parseInt(value.trim()))
  @IsNumber()
  skip = 0;
}
