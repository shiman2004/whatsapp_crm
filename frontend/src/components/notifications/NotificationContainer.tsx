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

  const handleCardClick = (leadId: string) => {
    setSelectedLeadId(leadId);
    if (onNavigateToChat) {
      onNavigateToChat(leadId);
    }
  };

  return (
    <div 
      aria-live="polite"
      className="fixed bottom-4 right-4 z-[9999] flex flex-col-reverse gap-3 max-w-[370px] w-full pointer-events-none"
    >
      {desktopNotifications.slice(0, 3).map((item) => (
        <DesktopNotificationCard
          key={item.id}
          notification={item}
          onDismiss={dismissDesktopNotification}
          onClick={handleCardClick}
        />
      ))}
    </div>
  );
};
