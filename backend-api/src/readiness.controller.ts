import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Controller()
export class ReadinessController {
  constructor(private readonly database: DataSource) {}

  @Get('ready')
  async ready() {
    try {
      await this.database.query('SELECT 1');
      return { status: 'ok', database: 'ready' };
    } catch {
      throw new ServiceUnavailableException('The care service is not ready.');
    }
  }
}
