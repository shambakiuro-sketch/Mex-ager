'use client';

import { useIsMobile } from '../lib/useIsMobile';
import ChatWindowMobile from './ChatWindowMobile';
import ChatWindowDesktop from './ChatWindowDesktop';

/**
 * Smart router that renders the appropriate ChatWindow component
 * based on screen size
 * 
 * Mobile (< 768px): ChatWindowMobile
 * Desktop (>= 768px): ChatWindowDesktop
 */
export default function ChatWindow({ 
  selectedUser, 
  currentUser, 
  darkMode, 
  onMessageNotification 
}) {
  const isMobile = useIsMobile();

  return isMobile ? (
    <ChatWindowMobile 
      selectedUser={selectedUser}
      currentUser={currentUser}
      darkMode={darkMode}
      onMessageNotification={onMessageNotification}
    />
  ) : (
    <ChatWindowDesktop 
      selectedUser={selectedUser}
      currentUser={currentUser}
      darkMode={darkMode}
      onMessageNotification={onMessageNotification}
    />
  );
}
