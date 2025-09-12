export interface WidgetConfig {
  companyId: string;
  theme: 'light' | 'dark' | 'auto';
  primaryColor: string;
  showUpcomingOnly: boolean;
  maxEvents: number;
  dateFormat: string;
}