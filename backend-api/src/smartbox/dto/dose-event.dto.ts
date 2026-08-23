import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class DoseEventDto {
  @IsString()
  deviceId: string;

  @IsNumber()
  @Min(0)
  @Max(31)
  binIndex: number;

  @IsOptional()
  @IsString()
  timestamp?: string;

  @IsBoolean()
  confirmed: boolean;

  @IsOptional()
  @IsBoolean()
  verified?: boolean;

  @IsOptional()
  @IsNumber()
  weightBefore?: number;

  @IsOptional()
  @IsNumber()
  weightAfter?: number;

  @IsNumber()
  weightLeftG: number;

  @IsOptional()
  @IsNumber()
  scoreImpact?: number;

  @IsOptional()
  @IsString()
  patientId?: string;

  @IsOptional()
  @IsString()
  medicine?: string;

  @IsOptional()
  @IsString()
  dosage?: string;

  @IsOptional()
  @IsString()
  condition?: string;

  @IsOptional()
  @IsString()
  scheduledTime?: string;

  @IsOptional()
  @IsNumber()
  pillsRemaining?: number;
}
