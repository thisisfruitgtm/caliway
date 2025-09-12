export interface Event {
  id: string;
  companyId: string;
  title: string;
  description: string;
  startDateTime: Date;
  endDateTime: Date;
  location?: string;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}