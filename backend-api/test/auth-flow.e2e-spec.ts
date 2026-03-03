import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('Auth Flow (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should register and login with phone number only', async () => {
    const uniquePhone = `+${Date.now()}`;
    const username = `user_${Date.now()}`;

    // Register with Phone Number
    await request(app.getHttpServer())
      .post('/patient/register')
      .send({
        username: username,
        full_names: 'Phone User',
        phone_number: uniquePhone,
        password: 'password123',
      })
      .expect(201);

    // Login with Phone Number
    const loginResponse = await request(app.getHttpServer())
      .post('/patient/login')
      .send({
        phone_number: uniquePhone,
        password: 'password123',
      })
      .expect(200);

    expect(loginResponse.body.access_token).toBeDefined();
    expect(loginResponse.body.patient.phone_number).toBe(uniquePhone);
  });

  it('should register with email and login with username', async () => {
    const email = `test-${Date.now()}@example.com`;
    const username = `user_email_${Date.now()}`;

    // Register with Email
    await request(app.getHttpServer())
      .post('/patient/register')
      .send({
        email,
        username,
        full_names: 'Email User',
        phone_number: `+${Date.now()}`, // Optional but testing mixed
        password: 'password123',
      })
      .expect(201);

    // Login with Username
    const loginResponse = await request(app.getHttpServer())
      .post('/patient/login')
      .send({
        username,
        password: 'password123',
      })
      .expect(200);

    expect(loginResponse.body.access_token).toBeDefined();
  });

  it('should login with email', async () => {
    const email = `test-login-${Date.now()}@example.com`;
    const username = `user_login_${Date.now()}`;

    await request(app.getHttpServer())
      .post('/patient/register')
      .send({
        email,
        username,
        full_names: 'Login User',
        password: 'password123',
      })
      .expect(201);

    const loginResponse = await request(app.getHttpServer())
      .post('/patient/login')
      .send({
        email,
        password: 'password123',
      })
      .expect(200);

    expect(loginResponse.body.access_token).toBeDefined();
  });
});
