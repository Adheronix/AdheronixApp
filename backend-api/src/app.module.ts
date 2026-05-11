import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PatientModule } from './patient/patient.module';
import { MedicationModule } from './medication/medication.module';
import { AdminModule } from './admin/admin.module';
import { NotificationModule } from './notification/notification.module';
import { ensureDatabaseExists } from './database/ensure-database';
import { AgentModule } from './agent/agent.module';
import { HealthScoreModule } from './health-score/health-score.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      useFactory: async () => {
        await ensureDatabaseExists();

        return {
          type: 'postgres',
          host: process.env.DB_HOST,
          port: Number(process.env.DB_PORT),
          username: process.env.DB_USERNAME,
          password: process.env.DB_PASSWORD,
          database: process.env.DB_NAME,
          autoLoadEntities: true,
          synchronize: true,
          ssl:
            process.env.DB_SSL === 'true'
              ? { rejectUnauthorized: false }
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
