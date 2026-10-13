export interface NotificationSettings {
  enabled: boolean;
  sound: boolean;
  nativeBrowser: boolean;
  showPreview: boolean;
  autoDismissSeconds: number; // 0 for persistent, default 8
}

export interface DesktopNotificationItem {
  id: string;
  leadId: string;
  customerId: string;
  contactName: string;
  contactPhone: string;
  avatarUrl?: string;
  messageText: string;
  timestamp: string;
  timeDisplay: string;
  unreadCount?: number;
  company?: string;
  mediaType?: string;
}
