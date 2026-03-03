import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Patient } from './patient.entity';
import { RegisterPatientDto } from './dto/register-patient.dto';
import { LoginPatientDto } from './dto/login-patient.dto';
import { UserRole } from '../auth/user-role.enum';
import { RegisterAdminDto } from '../admin/dto/register-admin.dto';

@Injectable()
export class PatientService {
  constructor(
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterPatientDto) {
    const patient = await this.createPatient(dto, UserRole.PATIENT);
    return this.buildAuthResponse(patient);
  }

  async registerAdmin(dto: RegisterAdminDto) {
    const adminKey = this.configService.get<string>('ADMIN_SETUP_KEY');
    if (!adminKey || dto.adminKey !== adminKey) {
      throw new ForbiddenException('Invalid admin setup key');
    }

    const admin = await this.createPatient(dto, UserRole.ADMIN);
    return this.buildAuthResponse(admin);
  }

  async login(dto: LoginPatientDto) {
    if (!dto.email && !dto.username && !dto.phone_number) {
      throw new BadRequestException(
        'Email, Username, or Phone Number must be provided',
      );
    }

    const query = dto.email
      ? { email: dto.email }
      : dto.username
        ? { username: dto.username }
        : { phone_number: dto.phone_number };

    const patient = await this.patientRepository.findOne({
      where: query,
    });

    if (!patient) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(dto.password, patient.password_hash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.buildAuthResponse(patient);
  }

  async findAll() {
    const patients = await this.patientRepository.find({
      relations: ['medications'],
      order: { created_at: 'DESC' },
    });
    return patients.map((patient) => this.sanitizePatient(patient));
  }

  async findById(patientId: string) {
    const patient = await this.patientRepository.findOne({
      where: { patient_id: patientId },
      relations: ['medications'],
    });
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }
    return this.sanitizePatient(patient);
  }

  async removePatient(patientId: string) {
    const patient = await this.patientRepository.findOne({
      where: { patient_id: patientId },
    });
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }
    await this.patientRepository.remove(patient);
    return { message: 'Patient removed' };
  }

  async updatePushToken(patientId: string, token: string) {
    const patient = await this.patientRepository.findOne({
      where: { patient_id: patientId },
    });
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }
    patient.fcm_token = token;
    return this.patientRepository.save(patient);
  }

  private async createPatient(
    dto: RegisterPatientDto,
    role: UserRole,
  ): Promise<Patient> {
    if (!dto.email && !dto.phone_number) {
      throw new BadRequestException(
        'Email or Phone Number is required for registration',
      );
    }

    if (dto.email) {
      const existingEmail = await this.patientRepository.findOne({
        where: { email: dto.email },
      });
      if (existingEmail) {
        throw new ConflictException('Email already registered');
      }
    }

    if (dto.phone_number) {
      const existingPhone = await this.patientRepository.findOne({
        where: { phone_number: dto.phone_number },
      });
      if (existingPhone) {
        throw new ConflictException('Phone number already registered');
      }
    }

    const existingUser = await this.patientRepository.findOne({
      where: { username: dto.username },
    });
    if (existingUser) {
      throw new ConflictException('Username already registered');
    }

    const password_hash = await bcrypt.hash(dto.password, 10);
    const patient = this.patientRepository.create({
      email: dto.email,
      username: dto.username,
      full_names: dto.full_names,
      phone_number: dto.phone_number,
      password_hash,
      role,
    });
    return this.patientRepository.save(patient);
  }

  private buildAuthResponse(patient: Patient) {
    const payload = {
      patient_id: patient.patient_id,
      email: patient.email,
      username: patient.username,
      role: patient.role,
    };

    return {
      access_token: this.jwtService.sign(payload),
      patient: this.sanitizePatient(patient),
    };
  }

  private sanitizePatient(patient: Patient) {
    const { password_hash, ...rest } = patient;
    void password_hash;
    return rest;
  }
}
