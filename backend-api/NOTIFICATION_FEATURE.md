# Notification Feature Documentation

## Overview

The notification feature provides a comprehensive system for sending and managing notifications to patients in the Medisafe Patient Backend. It supports scheduled notifications, medication reminders, and real-time alerts.

## Features

### 1. **Notification Types**
- `MEDICATION_REMINDER` - Reminders for medication intake
- `MEDICATION_UPDATE` - Updates about medication changes
- `MEDICATION_EXPIRY` - Warnings about expiring medications
- `SYSTEM_ALERT` - System-wide alerts
- `GENERAL` - General notifications

### 2. **Notification Status**
- `PENDING` - Notification is scheduled but not sent yet
- `SENT` - Notification has been sent
- `READ` - Patient has read the notification
- `FAILED` - Notification failed to send

### 3. **Scheduled Notifications**
- Notifications can be scheduled for future delivery
- Automatic processing via cron job (runs every minute)
- Supports medication reminders based on schedules

### 4. **Real-time Processing**
- Notifications without a schedule are sent immediately
- Background scheduler processes pending notifications

## Architecture

### Components

1. **Notification Entity** (`notification.entity.ts`)
   - Stores notification data in PostgreSQL
   - Linked to patients via foreign key
   - Supports metadata for additional context

2. **Notification Service** (`notification.service.ts`)
   - Core business logic for notifications
   - Handles creation, retrieval, and status updates
   - Integrates with push notification services (extensible)

3. **Notification Controller** (`notification.controller.ts`)
   - REST API endpoints for patients
   - Protected with JWT authentication
   - Patient-scoped operations

4. **Notification Scheduler** (`notification-scheduler.service.ts`)
   - Cron job that runs every minute
   - Processes pending scheduled notifications
   - Automatically sends notifications when due

## API Endpoints

### Patient Endpoints (Authenticated)

#### Create Notification
```http
POST /notifications
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Medication Reminder",
  "message": "Time to take your medication",
  "type": "medication_reminder",
  "metadata": {
    "medication_id": "uuid"
  },
  "scheduled_for": "2025-01-20T10:00:00Z" // Optional
}
```

#### Get All Notifications
```http
GET /notifications?unreadOnly=true
Authorization: Bearer <token>
```

#### Get Unread Count
```http
GET /notifications/unread/count
Authorization: Bearer <token>
```

#### Get Single Notification
```http
GET /notifications/:id
Authorization: Bearer <token>
```

#### Mark as Read
```http
PATCH /notifications/:id/read
Authorization: Bearer <token>
```

#### Mark All as Read
```http
PATCH /notifications/read-all
Authorization: Bearer <token>
```

#### Update Notification
```http
PATCH /notifications/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "read"
}
```

#### Delete Notification
```http
DELETE /notifications/:id
Authorization: Bearer <token>
```

### Admin Endpoints (Admin Role Required)

#### Broadcast Notification to All Patients
```http
POST /admin/notifications/broadcast
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "title": "System Maintenance",
  "message": "Scheduled maintenance on Jan 25",
  "type": "system_alert",
  "scheduled_for": "2025-01-25T00:00:00Z" // Optional
}
```

## Database Schema

```sql
CREATE TABLE notifications (
  notification_id UUID PRIMARY KEY,
  patient_id UUID REFERENCES auth_patient(patient_id) ON DELETE CASCADE,
  type VARCHAR NOT NULL,
  title VARCHAR NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB,
  status VARCHAR NOT NULL,
  scheduled_for TIMESTAMP,
  sent_at TIMESTAMP,
  read_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);
```

## Usage Examples

### Creating a Medication Reminder

```typescript
// In your medication service or controller
await notificationService.createMedicationReminder(
  patientId,
  medicationId,
  'Amoxicillin 500mg',
  new Date('2025-01-20T10:00:00Z')
);
```

### Sending Immediate Notification

```typescript
await notificationService.create(patientId, {
  title: 'Medication Updated',
  message: 'Your prescription has been updated',
  type: NotificationType.MEDICATION_UPDATE,
  metadata: { medication_id: medicationId }
});
```

### Admin Broadcast

```typescript
// Via API call
POST /admin/notifications/broadcast
{
  "title": "New Feature Available",
  "message": "Check out our new medication tracking feature!",
  "type": "general"
}
```

## Scheduling

The notification scheduler runs automatically using NestJS Schedule module:

- **Frequency**: Every minute
- **Task**: Checks for pending notifications with `scheduled_for <= now()`
- **Action**: Sends notifications and updates status to `SENT`

### Customizing Schedule

To change the schedule frequency, modify `notification-scheduler.service.ts`:

```typescript
@Cron(CronExpression.EVERY_30_SECONDS) // More frequent
// or
@Cron('0 */5 * * * *') // Every 5 minutes
```

## Push Notification Integration

The notification service includes a placeholder for push notification integration. To add Firebase Cloud Messaging (FCM) or OneSignal:

1. Install the required package:
```bash
npm install firebase-admin  # For FCM
# or
npm install onesignal-node  # For OneSignal
```

2. Update `notification.service.ts` in the `sendNotification` method:

```typescript
async sendNotification(notification: Notification) {
  try {
    // Send push notification
    await this.pushNotificationService.send({
      token: notification.patient.fcm_token,
      title: notification.title,
      body: notification.message,
      data: notification.metadata
    });

    notification.status = NotificationStatus.SENT;
    notification.sent_at = new Date();
    await this.notificationRepository.save(notification);
  } catch (error) {
    // Handle error
  }
}
```

3. Add FCM token field to Patient entity:
```typescript
@Column({ nullable: true })
fcm_token: string;
```

## Dependencies

Required packages (already included):
- `@nestjs/schedule` - For cron jobs
- `@nestjs/typeorm` - Database operations
- `@nestjs/common` - Core NestJS functionality

Optional (for push notifications):
- `firebase-admin` - Firebase Cloud Messaging
- `onesignal-node` - OneSignal push notifications

## Installation

1. Install the schedule module:
```bash
npm install @nestjs/schedule
```

2. The notification module is already integrated into `app.module.ts`

3. Database tables will be created automatically (if `synchronize: true`)

## Future Enhancements

1. **Push Notification Integration**
   - Firebase Cloud Messaging (FCM)
   - OneSignal
   - Apple Push Notification Service (APNS)

2. **Email Notifications**
   - Send email notifications as fallback
   - HTML email templates

3. **SMS Notifications**
   - Twilio integration
   - SMS reminders for critical medications

4. **Notification Preferences**
   - Patient preferences for notification types
   - Quiet hours
   - Frequency limits

5. **Advanced Scheduling**
   - Recurring notifications
   - Timezone support
   - Medication schedule parsing

6. **Analytics**
   - Notification delivery rates
   - Read rates
   - Engagement metrics

## Testing

### Manual Testing

1. Create a notification:
```bash
curl -X POST http://localhost:3000/notifications \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test",
    "message": "Test message"
  }'
```

2. Check pending notifications:
```bash
curl http://localhost:3000/notifications \
  -H "Authorization: Bearer <token>"
```

3. Mark as read:
```bash
curl -X PATCH http://localhost:3000/notifications/<id>/read \
  -H "Authorization: Bearer <token>"
```

## Troubleshooting

### Notifications Not Sending

1. Check scheduler is running:
   - Look for logs: `Checking for pending notifications...`
   - Verify `ScheduleModule` is imported in `app.module.ts`

2. Check notification status:
   - Query database: `SELECT * FROM notifications WHERE status = 'pending'`
   - Verify `scheduled_for` is in the past

3. Check logs for errors:
   - Look for `Error processing pending notifications` in logs

### Database Issues

1. Ensure notification table exists:
   - Check TypeORM logs during startup
   - Verify `autoLoadEntities: true` in TypeORM config

2. Check foreign key constraints:
   - Ensure patient exists before creating notification

## Security Considerations

1. **Authentication**: All endpoints require JWT authentication
2. **Authorization**: Patients can only access their own notifications
3. **Admin Access**: Broadcast endpoint requires admin role
4. **Input Validation**: DTOs validate all inputs using class-validator

## Performance

- **Indexing**: Consider adding indexes on:
  - `patient_id`
  - `status`
  - `scheduled_for`
  - `created_at`

- **Batch Processing**: Scheduler processes notifications in batches
- **Pagination**: Consider adding pagination to `findAllForPatient` for large datasets
