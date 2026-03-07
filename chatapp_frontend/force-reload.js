// Force reload presence system để xem logs
console.log('🔄 Forcing presence system reload...');

// Bắt buộc reload trang để áp dụng logger changes
if (window.location.href.includes('reload=true')) {
  console.log('✅ Page already reloaded, checking logs...');
  
  setTimeout(() => {
    console.log('🔍 Checking for presence logs...');
    
    // Kiểm tra xem có chatWebSocketService không
    if (window.chatWebSocketService) {
      console.log('✅ chatWebSocketService available');
      console.log('🔗 Connection status:', window.chatWebSocketService.isConnected());
      console.log('📡 Active subscriptions:', window.chatWebSocketService.getActiveSubscriptions());
      
      // Force gọi lại presence functions
      console.log('🔧 Forcing presence system initialization...');
      
      if (window.chatWebSocketService.isConnected()) {
        // Gọi lại subscribeToPresenceEvents
        window.chatWebSocketService.subscribeToPresenceEvents();
        
        // Gọi lại các hàm khác
        window.chatWebSocketService.subscribeToPresenceUpdates((update) => {
          console.log('📨 Presence update received:', update);
        });
        
        window.chatWebSocketService.subscribeToOnlineStatus((status) => {
          console.log('📨 Online status received:', status);
        });
        
        window.chatWebSocketService.requestOnlineStatus(['test-user-1', 'test-user-2']);
        
        window.chatWebSocketService.sendHeartbeat();
        
        console.log('✅ All presence functions called');
      } else {
        console.log('❌ WebSocket not connected');
      }
    } else {
      console.log('❌ chatWebSocketService not available');
    }
  }, 2000);
  
} else {
  console.log('🔄 Reloading page to apply logger changes...');
  window.location.href = window.location.href + '?reload=true';
}
