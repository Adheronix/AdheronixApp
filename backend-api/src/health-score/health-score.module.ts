import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthScore } from './health-score.entity';
import { Patient } from '../patient/patient.entity';
import { HealthScoreService } from './health-score.service';

@Module({
  imports: [TypeOrmModule.forFeature([HealthScore, Patient])],
  providers: [HealthScoreService],
  exports: [HealthScoreService],
})
export class HealthScoreModule {}
