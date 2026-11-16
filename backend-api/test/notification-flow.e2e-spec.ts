import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('Notification Flow (e2e)', () => {
  let app: INestApplication;
  let jwtToken: string;
  let patientId: string;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    // 1. Register a new patient
    const email = `test-${Date.now()}@example.com`;
    const registerResponse = await request(app.getHttpServer())
      .post('/patient/register')
      .send({
        email,
        username: `user_${Date.now()}`,
        full_names: 'Test User',
        phone_number: `+${Date.now()}`,
        password: 'password123',
      })
      .expect(201);

    jwtToken = registerResponse.body.access_token;
    patientId = registerResponse.body.patient.patient_id;
  });

  afterEach(async () => {
    await app.close();
  });

  it('should update push preferences and publish an in-app medication-created update', async () => {
    // 2. Update Push Token
    await request(app.getHttpServer())
      .patch('/patient/profile/push-token')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({ token: 'test-fcm-token-123' })
      .expect(200);

    // 3. Create Medication (should trigger notification)
    await request(app.getHttpServer())
      .post('/medications/scan-qr')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({
        prescription: {
          name: 'Amoxicillin',
          dosage: '500mg',
        },
        intake_recommendation: 'Take with food',
        period: '7 days',
        source: 'clinician',
        frequency: 1,
      })
      .expect(201);

    // 4. Verify Notification Protocol (Indirectly via Unread Count)
    // Since notifications are async and we are mocking the sender, we can check if a notification record was created.
    const notificationsResponse = await request(app.getHttpServer())
      .get('/notifications?unreadOnly=true')
      .set('Authorization', `Bearer ${jwtToken}`)
      .expect(200);

    const notifications = notificationsResponse.body;
    expect(notifications.length).toBeGreaterThan(0);
    const medicationReminder = notifications.find(
      (n) => n.type === 'medication_update',
    );
    expect(medicationReminder).toBeDefined();
    expect(medicationReminder.title).toContain('Medication added');
  });
});
