import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MedicationService } from './medication.service';
import { MedicationController } from './medication.controller';
import { MedicationInfo } from './medication.entity';
import { MedicationSchedule } from './medication-schedule.entity';
import { MedicationScheduleService } from './medication-schedule.service';
import { MedicationScheduleController } from './medication-schedule.controller';
import { Patient } from '../patient/patient.entity';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MedicationInfo, MedicationSchedule, Patient]),
    NotificationModule,
  ],
  controllers: [MedicationController, MedicationScheduleController],
  providers: [MedicationService, MedicationScheduleService],
  exports: [MedicationService, MedicationScheduleService],
})
export class MedicationModule {}
