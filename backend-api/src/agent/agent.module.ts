import { Module } from '@nestjs/common';
import { PatientModule } from '../patient/patient.module';
import { MedicationModule } from '../medication/medication.module';
import { NotificationModule } from '../notification/notification.module';
import { AiClientService } from './ai-client.service';
import { DoctorAgentService } from './doctor-agent.service';
import { MonitoringCron } from './monitoring.cron';
import { AiController } from './ai.controller';

@Module({
  imports: [PatientModule, MedicationModule, NotificationModule],
  controllers: [AiController],
  providers: [AiClientService, DoctorAgentService, MonitoringCron],
  exports: [DoctorAgentService],
})
export class AgentModule {}
