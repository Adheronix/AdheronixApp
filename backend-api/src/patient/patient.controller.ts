import {
  Body,
  Controller,
  Post,
  Patch,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PatientService } from './patient.service';
import { RegisterPatientDto } from './dto/register-patient.dto';
import { LoginPatientDto } from './dto/login-patient.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetPatient } from '../auth/decorator/get-user.decorator';
import { Patient } from './patient.entity';

@ApiTags('patient')
@Controller('patient')
export class PatientController {
  constructor(private readonly patientService: PatientService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new patient account' })
  @ApiCreatedResponse({ description: 'Patient registered successfully' })
  register(@Body() dto: RegisterPatientDto) {
    return this.patientService.register(dto);
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Authenticate an existing patient' })
  @ApiOkResponse({ description: 'Patient logged in successfully' })
  login(@Body() dto: LoginPatientDto) {
    return this.patientService.login(dto);
  }

  @Patch('profile/push-token')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update push notification token' })
  @ApiOkResponse({ description: 'Token updated successfully', type: Patient })
  updatePushToken(
    @GetPatient() patient: Patient,
    @Body('token') token: string,
  ) {
    return this.patientService.updatePushToken(patient.patient_id, token);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update patient profile information' })
  @ApiOkResponse({ description: 'Profile updated successfully', type: Patient })
  updateProfile(
    @GetPatient() patient: Patient,
    @Body() updateData: Partial<Patient>,
  ) {
    return this.patientService.updateProfile(patient.patient_id, updateData);
  }
}
