import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PatientModule } from '../patient/patient.module';
import { MedicationModule } from '../medication/medication.module';
import { NotificationModule } from '../notification/notification.module';
import { HealthScoreModule } from '../health-score/health-score.module';
import { Patient } from '../patient/patient.entity';
import { AiClientService } from './ai-client.service';
import { OpenRouterService } from './open-router.service';
import { DoctorAgentService } from './doctor-agent.service';
import { MonitoringCron } from './monitoring.cron';
import { AgentController } from './agent.controller';
import { AiController } from './ai.controller';
import { ContextAssemblerService } from './context-assembler.service';
import { ResponseFormatterService } from './response-formatter.service';
import { LanguageDetectionService } from './language-detection.service';
import { MiniMaxOrchestratorService } from './minimax-orchestrator.service';
import { HermesService } from './hermes.service';
import { QwenCoderService } from './qwen-coder.service';
import { LlamaFastService } from './llama-fast.service';
import { QwenKinyarwandaService } from './qwen-kinyarwanda.service';
import { RagService } from './rag.service';
import { OcrService } from './ocr.service';
import { EventRouterService } from './event-router.service';

@Module({
  imports: [
    PatientModule,
    MedicationModule,
    NotificationModule,
    HealthScoreModule,
    TypeOrmModule.forFeature([Patient]),
  ],
  controllers: [AgentController, AiController],
  providers: [
    AiClientService,
    OpenRouterService,
    DoctorAgentService,
    MonitoringCron,
    ContextAssemblerService,
    ResponseFormatterService,
    LanguageDetectionService,
    MiniMaxOrchestratorService,
    HermesService,
    QwenCoderService,
    LlamaFastService,
    QwenKinyarwandaService,
    RagService,
    OcrService,
    EventRouterService,
  ],
  exports: [
    AiClientService,
    OpenRouterService,
    DoctorAgentService,
    EventRouterService,
    RagService,
    HermesService,
    QwenCoderService,
    ContextAssemblerService,
    ResponseFormatterService,
    LanguageDetectionService,
    MiniMaxOrchestratorService,
    LlamaFastService,
    QwenKinyarwandaService,
    OcrService,
  ],
})
export class AgentModule {}
