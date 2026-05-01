import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Adheronix Patient API')
    .setDescription(
      'Comprehensive API for the Adheronix mobile app, covering patient authentication, medication QR scanning, intake scheduling, and health notifications.',
    )
    .setVersion('1.1')
    .addBearerAuth()
    .addTag('patient', 'Patient account and profile management')
    .addTag('medications', 'QR-derived medication records')
    .addTag('medication-schedules', 'Daily dose tracking and adherence stats')
    .addTag('notifications', 'Push and system alerts')
    .addTag('admin', 'Administrative operations')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);
  SwaggerModule.setup('api-docs', app, document);

  await app.listen(process.env.PORT || 3000, '0.0.0.0');
}
bootstrap().catch((error) => {
  console.error('Failed to bootstrap Nest application', error);
  process.exitCode = 1;
});
