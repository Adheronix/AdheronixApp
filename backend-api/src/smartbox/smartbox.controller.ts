import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import type { Response } from 'express';
import { GetPatient } from '../auth/decorator/get-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Patient } from '../patient/patient.entity';
import { DoseEventDto } from './dto/dose-event.dto';
import { SmartboxService } from './smartbox.service';

interface OptionalAuthRequest extends Request {
  user?: {
    patient_id: string;
  };
}

@ApiTags('smartbox')
@Controller('api/smartbox')
export class SmartboxController {
  constructor(private readonly smartboxService: SmartboxService) {}

  @Post('dose-event')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Receive verified Smart Box dose event from ESP32 device',
  })
  receiveDoseEvent(
    @Body() dto: DoseEventDto,
    @Headers('authorization') authorization?: string,
  ) {
    this.smartboxService.validateDeviceToken(authorization);
    return this.smartboxService.recordDoseEvent(dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('demo-dose')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Create a Smart Box demo dose for the logged-in patient',
  })
  recordDemoDose(@GetPatient() patient: Patient) {
    return this.smartboxService.recordDemoDose(patient.patient_id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('latest')
  @ApiOperation({
    summary: 'Get latest Smart Box event for the logged-in patient',
  })
  getLatest(@Req() req: OptionalAuthRequest) {
    return this.smartboxService.getLatestForPatient(req.user?.patient_id);
  }

  @Get(':deviceId/schedule')
  @ApiOperation({
    summary: 'Get current Smart Box display schedule for an ESP32 device',
  })
  async getDeviceSchedule(
    @Param('deviceId') deviceId: string,
    @Headers('authorization') authorization: string | undefined,
    @Res() res: Response,
  ) {
    this.smartboxService.validateDeviceToken(authorization);
    const schedule = await this.smartboxService.getDeviceSchedule(deviceId);
    res.type('text/plain').send(schedule);
  }
}
