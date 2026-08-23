import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthScoreModule } from '../health-score/health-score.module';
import { MedicationInfo } from '../medication/medication.entity';
import { MedicationSchedule } from '../medication/medication-schedule.entity';
import { NotificationModule } from '../notification/notification.module';
import { Patient } from '../patient/patient.entity';
import { SmartboxDoseEvent } from './smartbox-dose-event.entity';
import { SmartboxController } from './smartbox.controller';
import { SmartboxService } from './smartbox.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SmartboxDoseEvent,
      Patient,
      MedicationInfo,
      MedicationSchedule,
    ]),
    HealthScoreModule,
    NotificationModule,
  ],
  controllers: [SmartboxController],
  providers: [SmartboxService],
  exports: [SmartboxService],
})
export class SmartboxModule {}
