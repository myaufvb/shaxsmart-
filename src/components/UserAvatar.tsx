import React from 'react';

interface UserAvatarProps {
  avatar?: string;
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showBadge?: boolean;
}

export const isVideoAvatar = (url?: string): boolean => {
  if (!url) return false;
  return url.startsWith('data:video/') || 
         url.endsWith('.mp4') || 
         url.endsWith('.webm') || 
         url.endsWith('.mov') ||
         url.includes('.mp4?') ||
         url.includes('.webm?');
};

export const isAnimatedAvatar = (url?: string): boolean => {
  if (!url) return false;
  return isVideoAvatar(url) || 
         url.endsWith('.gif') || 
         url.includes('.gif?') || 
         url.startsWith('data:image/gif');
};

export const UserAvatar: React.FC<UserAvatarProps> = ({
  avatar,
  name,
  size = 'md',
  className = ''
}) => {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs rounded-xl',
    md: 'w-10 h-10 text-sm rounded-xl',
    lg: 'w-14 h-14 text-xl rounded-2xl',
    xl: 'w-20 h-20 text-3xl rounded-3xl'
  };

  const isVideo = isVideoAvatar(avatar);

  const containerClass = `${sizeClasses[size]} relative overflow-hidden flex-shrink-0 flex items-center justify-center font-black ${className}`;

  return (
    <div className={containerClass}>
      {avatar ? (
        isVideo ? (
          <video
            src={avatar}
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <img
            src={avatar}
            alt={name}
            className="w-full h-full object-cover"
          />
        )
      ) : (
        <div className="w-full h-full bg-indigo-600 text-white flex items-center justify-center font-black">
          {name ? name[0]?.toUpperCase() : 'U'}
        </div>
      )}
    </div>
  );
};
