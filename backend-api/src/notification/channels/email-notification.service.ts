import { Injectable, Logger } from '@nestjs/common';

export interface EmailPayload {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface IEmailNotificationService {
  send(payload: EmailPayload): Promise<void>;
}

@Injectable()
export class EmailNotificationService implements IEmailNotificationService {
  private readonly logger = new Logger(EmailNotificationService.name);

  async send(payload: EmailPayload): Promise<void> {
    // In a real implementation, this would use nodemailer or SendGrid
    this.logger.log(`[MOCK EMAIL] Sending to ${payload.to}`);
    this.logger.log(`Subject: ${payload.subject}`);
    this.logger.log(`Body: ${payload.text}`);
  }
}
