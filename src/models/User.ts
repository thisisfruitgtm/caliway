export interface User {
  id: string;
  username: string;
  passwordHash: string;
  companyId: string;
  createdAt: Date;
  lastLoginAt: Date;
}