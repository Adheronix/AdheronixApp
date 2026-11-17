import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class WeightReportDto {
  @IsString()
  deviceId: string;

  @IsNumber()
  @Min(0)
  @Max(20000)
  weightG: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5000)
  pillsEst?: number;

  @IsOptional()
  @IsString()
  source?: string;
}
