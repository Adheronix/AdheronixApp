import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Patient } from '../../patient/patient.entity';

export const GetPatient = createParamDecorator(
  (_data, ctx: ExecutionContext): Patient => {
    const req = ctx.switchToHttp().getRequest();
    return req.user;
  },
);
