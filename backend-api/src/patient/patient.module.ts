import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { PatientService } from './patient.service';
import { PatientController } from './patient.controller';
import { Patient } from './patient.entity';
import { JwtStrategy } from '../auth/jwt.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([Patient]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') ?? 'supersecret',
        signOptions: { expiresIn: '1d' },
      }),
    }),
  ],
  controllers: [PatientController],
  providers: [PatientService, JwtStrategy],
  exports: [PatientService],
})
export class PatientModule {}
