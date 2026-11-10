import React from 'react';
import { useCrm } from '../../context/CrmContext';
import { DesktopNotificationCard } from './DesktopNotificationCard';

interface NotificationContainerProps {
  onNavigateToChat?: (leadId: string) => void;
}

export const NotificationContainer: React.FC<NotificationContainerProps> = ({
  onNavigateToChat
}) => {
  const { 
    desktopNotifications, 
    dismissDesktopNotification, 
    setSelectedLeadId,
    notificationSettings 
  } = useCrm();

  if (!notificationSettings.enabled || desktopNotifications.length === 0) {
    return null;
  }

  const handleCardClick = (leadId: string, notificationId?: string) => {
    if (notificationId) {
      dismissDesktopNotification(notificationId);
    }
    setSelectedLeadId(leadId);
    if (onNavigateToChat) {
      onNavigateToChat(leadId);
    }
  };

  return (
    <div 
      aria-live="polite"
      className="fixed bottom-16 right-3 z-50 flex w-[calc(100vw-24px)] max-w-[300px] flex-col-reverse gap-2 pointer-events-none md:bottom-3"
    >
      {desktopNotifications.slice(0, 2).map((item) => (
        <DesktopNotificationCard
          key={item.id}
          notification={item}
          onDismiss={dismissDesktopNotification}
          onClick={(leadId) => handleCardClick(leadId, item.id)}
        />
      ))}
    </div>
  );
};
