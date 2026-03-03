import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Strategy, JwtFromRequestFunction } from 'passport-jwt';
import { Request } from 'express';
import { Repository } from 'typeorm';
import { Patient } from '../patient/patient.entity';
import { JwtPayload } from './jwt-payload.interface';

const jwtFromHeader: JwtFromRequestFunction = (request: Request) => {
  const authHeader = request?.headers?.authorization;
  if (!authHeader) {
    return null;
  }
  const [type, token] = authHeader.split(' ');
  return type === 'Bearer' ? (token ?? null) : null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
  ) {
    super({
      jwtFromRequest: jwtFromHeader,
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') ?? 'supersecret',
    });
  }

  async validate(payload: JwtPayload) {
    const patient = await this.patientRepository.findOne({
      where: { patient_id: payload.patient_id },
    });

    if (!patient) {
      throw new UnauthorizedException();
    }

    return {
      patient_id: patient.patient_id,
      email: patient.email,
      username: patient.username,
      role: patient.role,
    };
  }
}
