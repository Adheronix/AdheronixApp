import { UserRole } from './user-role.enum';

export interface JwtPayload {
  patient_id: string;
  email: string;
  username: string;
  role: UserRole;
}
