import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { ReadinessController } from './readiness.controller';
import { AppService } from './app.service';
import { PatientModule } from './patient/patient.module';
import { MedicationModule } from './medication/medication.module';
import { AdminModule } from './admin/admin.module';
import { NotificationModule } from './notification/notification.module';
import { ensureDatabaseExists } from './database/ensure-database';
import { AgentModule } from './agent/agent.module';
import { HealthScoreModule } from './health-score/health-score.module';
import { SmartboxModule } from './smartbox/smartbox.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      useFactory: async () => {
        if (process.env.NODE_ENV !== 'production') {
          await ensureDatabaseExists();
        }

        return {
          type: 'postgres',
          host: process.env.DB_HOST,
          port: Number(process.env.DB_PORT),
          username: process.env.DB_USERNAME,
          password: process.env.DB_PASSWORD,
          database: process.env.DB_NAME,
          autoLoadEntities: true,
          synchronize: process.env.NODE_ENV !== 'production',
          ssl:
            process.env.DB_SSL === 'true'
              ? { rejectUnauthorized: true }
              : false,
        };
      },
    }),
    PatientModule,
    MedicationModule,
    AdminModule,
    NotificationModule,
    AgentModule,
    HealthScoreModule,
    SmartboxModule,
  ],
  controllers: [AppController, ReadinessController],
  providers: [AppService],
})
export class AppModule {}
