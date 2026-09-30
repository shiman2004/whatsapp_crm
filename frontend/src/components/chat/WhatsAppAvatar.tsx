import React from 'react';
import { User as UserIcon } from 'lucide-react';

interface WhatsAppAvatarProps {
  name?: string;
  avatarUrl?: string;
  size?: 'sm' | 'md' | 'lg';
  isOnline?: boolean;
}

export const WhatsAppAvatar: React.FC<WhatsAppAvatarProps> = ({
  name = '',
  avatarUrl,
  size = 'md',
  isOnline = false
}) => {
  // Validate if avatarUrl is a real custom image (and not the old mock unsplash)
  const isRealImage = avatarUrl && !avatarUrl.includes('unsplash.com') && avatarUrl.startsWith('http');

  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base'
  };

  const getInitials = (str: string) => {
    if (!str) return '';
    const clean = str.replace(/[^a-zA-Z0-9 ]/g, '').trim();
    if (!clean) return str.slice(0, 2).toUpperCase();
    const parts = clean.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return clean.slice(0, 2).toUpperCase();
  };

  const initials = getInitials(name);

  return (
    <div className={`relative shrink-0 ${sizeClasses[size]} select-none`}>
      {isRealImage ? (
        <img
          src={avatarUrl}
          alt={name}
          className="w-full h-full rounded-full object-cover border border-slate-700 shadow"
          onError={(e) => {
            // If image fails to load, hide image element
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
      ) : (
        <div className="w-full h-full rounded-full bg-[#374248] text-slate-200 flex items-center justify-center font-bold border border-slate-700/60 shadow-sm">
          {initials ? (
            <span className="tracking-wider">{initials}</span>
          ) : (
            <UserIcon className="w-1/2 h-1/2 text-slate-400" />
          )}
        </div>
      )}

      {isOnline && (
        <span className="w-2.5 h-2.5 rounded-full bg-whatsapp border-2 border-[#111b21] absolute bottom-0 right-0"></span>
      )}
    </div>
  );
};
