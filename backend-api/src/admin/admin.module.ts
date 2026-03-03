import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { PatientModule } from '../patient/patient.module';
import { MedicationModule } from '../medication/medication.module';
import { NotificationModule } from '../notification/notification.module';
import { RolesGuard } from '../auth/roles.guard';

@Module({
  imports: [PatientModule, MedicationModule, NotificationModule],
  controllers: [AdminController],
  providers: [RolesGuard],
})
export class AdminModule {}
