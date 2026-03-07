// src/services/websocketService.ts
import SockJS from 'sockjs-client';
import { Client, type IMessage, type StompHeaders, type StompSubscription } from '@stomp/stompjs';
import { logger } from '../utils/logger';

// 🌐 WebSocket URL from environment or default
const WS_URL = String(import.meta.env.VITE_WS_URL || 'http://localhost:8084/ws');

let stompClient: Client | null = null;
const subscriptions = new Map<string, { subscription: StompSubscription; callback: SubscribeCallback }>();
let connectingPromise: Promise<Client> | null = null;

type SubscribeCallback = (message: Record<string, string | number | boolean | null | Record<string, string | number | boolean | null>>) => void;

/**
 * Kết nối tới WebSocket server qua SockJS + STOMP.
 * Idempotent: nếu đã kết nối hoặc đang kết nối, trả về promise hiện tại.
 */
export const connectWebSocket = (token: string): Promise<Client> => {
  // Already connected — return immediately
  if (stompClient?.active && stompClient?.connected) {
    return Promise.resolve(stompClient);
  }

  // Connection already in progress — return existing promise
  if (connectingPromise) {
    return connectingPromise;
  }

  connectingPromise = new Promise<Client>((resolve, reject) => {
    if (stompClient) {
      stompClient.deactivate()
        .catch(err => logger.error('[WebSocket] Deactivate error:', err instanceof Error ? err.message : String(err)));
      stompClient = null;
    }

    stompClient = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      connectHeaders: {
        Authorization: `Bearer ${token}`
      },
      debug: (str) => logger.debug('[WebSocket]', str),
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,

      onConnect: () => {
        logger.info('[WebSocket] Connected');
        connectingPromise = null;
        // Khôi phục các subscription cũ
        subscriptions.forEach((subInfo, destination) => {
          subscribe(destination, subInfo.callback);
        });
        // Thông báo connection ready
        notifyConnectionReady();
        if (stompClient) {
          resolve(stompClient);
        } else {
          reject(new Error('stompClient is null'));
        }
      },

      onStompError: (frame) => {
        connectingPromise = null;
        const errorMsg = typeof frame === 'string' ? frame :
          (frame && typeof frame === 'object' && 'headers' in frame && frame.headers ?
            String((frame.headers as Record<string, string>).message || 'Unknown STOMP error') : 'Unknown STOMP error');

        logger.error('[WebSocket] STOMP error:', errorMsg);
        reject(new Error(errorMsg));
      },

      onWebSocketClose: (event) => {
        logger.warn('[WebSocket] Connection closed', event);
      },

      onDisconnect: () => {
        logger.info('[WebSocket] Disconnected');
        connectingPromise = null;
      }
    });

    stompClient.activate();
  });

  return connectingPromise;
};

/**
 * Lấy instance stomp client
 */
export const getStompClient = (): Client | null => {
  return stompClient;
};

/**
 * Đăng ký nhận dữ liệu từ 1 topic
 */
export const subscribe = (
  destination: string,
  callback: SubscribeCallback
): void => {
  if (!stompClient) {
    logger.warn('[WebSocket] Cannot subscribe, stompClient is null:', destination);
    return;
  }

  if (!stompClient.active) {
    logger.warn('[WebSocket] Not connected, cannot subscribe to:', destination);
    // Store the subscription for later when connection is re-established
    subscriptions.set(destination, {
      subscription: null as unknown as StompSubscription,
      callback
    });
    return;
  }

  // Kiểm tra nếu đã đăng ký trước đó
  if (subscriptions.has(destination)) {
    logger.debug(`[WebSocket] Already subscribed to ${destination}`);
    return;
  }

  try {
    const subscription = stompClient.subscribe(
      destination,
      (message: IMessage) => {
        try {
          // Parse message body safely
          const body = JSON.parse(message.body) as Record<string, string | number | boolean | null | Record<string, string | number | boolean | null>>;
          callback(body);
        } catch (err) {
          logger.error('[WebSocket] Failed to parse message:', message.body, err instanceof Error ? err.message : String(err));
        }
      }
    );

    // Lưu subscription để quản lý
    subscriptions.set(destination, {
      subscription,
      callback
    });

    logger.debug(`[WebSocket] Successfully subscribed to ${destination}`);
  } catch (error) {
    logger.error('[WebSocket] Failed to subscribe to:', destination, error instanceof Error ? error.message : error);
  }
};

/**
 * Hủy đăng ký từ một topic
 */
export const unsubscribe = (destination: string): void => {
  const subInfo = subscriptions.get(destination);
  if (subInfo) {
    if (subInfo.subscription) {
      subInfo.subscription.unsubscribe();
    }
    subscriptions.delete(destination);
    logger.debug(`[WebSocket] Unsubscribed from ${destination}`);
  }
};

/**
 * Gửi dữ liệu tới server qua destination
 */
export const send = (
  destination: string,
  payload: object,
  headers: StompHeaders = {}
): void => {
  if (!stompClient) {
    logger.warn('[WebSocket] Cannot send, stompClient is null');
    return;
  }

  if (!stompClient.active) {
    logger.warn('[WebSocket] Cannot send, not connected to:', destination);
    return;
  }

  if (!stompClient.connected) {
    logger.warn('[WebSocket] Cannot send, STOMP not connected to:', destination);
    return;
  }

  try {
    stompClient.publish({
      destination,
      headers,
      body: JSON.stringify(payload)
    });
    logger.debug(`[WebSocket] Message sent to ${destination}`);
  } catch (error) {
    logger.error('[WebSocket] Failed to send message:', error instanceof Error ? error.message : error);
  }
};

/**
 * Ngắt kết nối WebSocket và dọn dẹp
 */
export const disconnectWebSocket = (): void => {
  connectingPromise = null;
  if (stompClient) {
    // Hủy tất cả subscriptions
    subscriptions.forEach((_, destination) => {
      unsubscribe(destination);
    });

    stompClient.deactivate()
      .then(() => {
        logger.info('[WebSocket] Disconnected');
        stompClient = null;
      })
      .catch(err => {
        logger.error('[WebSocket] Disconnect error:', err instanceof Error ? err.message : String(err));
        stompClient = null;
      });
  }
};

/**
 * Kiểm tra xem WebSocket có sẵn sàng để gửi tin nhắn không
 */
export const isWebSocketReady = (): boolean => {
  return !!stompClient?.active && !!stompClient?.connected;
};

/**
 * Chờ cho WebSocket kết nối xong trước khi thực hiện action
 */
export const waitForConnection = (
  action: () => void,
  maxRetries: number = 20,
  retryDelay: number = 1000
): void => {
  let retries = 0;

  const checkConnection = () => {
    const clientState = stompClient ? {
      active: stompClient.active,
      connected: stompClient.connected,
      state: stompClient.state
    } : null;

    logger.debug(`[WebSocket] Connection check (${retries}/${maxRetries}):`, clientState);

    if (isWebSocketReady()) {
      logger.debug('[WebSocket] Connection ready, executing action');
      action();
    } else if (retries < maxRetries) {
      retries++;
      logger.debug(`[WebSocket] Waiting for connection... (${retries}/${maxRetries})`);
      setTimeout(checkConnection, retryDelay);
    } else {
      logger.error('[WebSocket] Failed to establish connection after maximum retries');
      logger.error('[WebSocket] Final state:', clientState);
    }
  };

  checkConnection();
};

/**
 * Promise-based approach to wait for connection
 */
export const waitForConnectionPromise = (timeout: number = 10000): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (isWebSocketReady()) {
      resolve();
      return;
    }

    const timeoutId = setTimeout(() => {
      reject(new Error('[WebSocket] Connection timeout'));
    }, timeout);

    const unsubscribe = onConnectionReady(() => {
      clearTimeout(timeoutId);
      resolve();
    });

    // Cleanup timeout if connection fails
    const cleanup = () => {
      clearTimeout(timeoutId);
      unsubscribe();
    };

    // Handle connection failure
    setTimeout(() => {
      if (!isWebSocketReady()) {
        cleanup();
        reject(new Error('[WebSocket] Connection failed'));
      }
    }, timeout);
  });
};

/**
 * Improved send with promise-based waiting
 */
export const sendWithConnectionWait = async (
  destination: string,
  payload: object,
  headers: StompHeaders = {},
  timeout: number = 10000
): Promise<void> => {
  try {
    await waitForConnectionPromise(timeout);
    send(destination, payload, headers);
  } catch (error) {
    logger.error('[WebSocket] Failed to send after waiting for connection:', error instanceof Error ? error.message : error);
    throw error;
  }
};

// Connection state listeners
const connectionListeners = new Set<() => void>();

/** Persistent connection listeners — survive reconnects (not cleared after notify) */
const persistentConnectionListeners = new Set<() => void>();

/**
 * Đăng ký listener cho sự kiện kết nối thành công (one-shot: cleared after first connect)
 */
export const onConnectionReady = (callback: () => void): (() => void) => {
  if (isWebSocketReady()) {
    callback();
  } else {
    connectionListeners.add(callback);
  }

  // Return unsubscribe function
  return () => {
    connectionListeners.delete(callback);
  };
};

/**
 * Register a persistent connection listener that fires on EVERY connect/reconnect.
 * Unlike onConnectionReady, these listeners are NOT cleared after firing.
 * Returns an unsubscribe function.
 */
export const addConnectionListener = (callback: () => void): (() => void) => {
  persistentConnectionListeners.add(callback);
  // If already connected, fire immediately
  if (isWebSocketReady()) {
    try { callback(); } catch (e) {
      logger.error('[WebSocket] Error in persistent connection listener:', e instanceof Error ? e.message : e);
    }
  }
  return () => { persistentConnectionListeners.delete(callback); };
};

/**
 * Thông báo cho các listener rằng kết nối đã sẵn sàng
 */
const notifyConnectionReady = (): void => {
  // One-shot listeners
  connectionListeners.forEach(callback => {
    try {
      callback();
    } catch (error) {
      logger.error('[WebSocket] Error in connection listener:', error instanceof Error ? error.message : error);
    }
  });
  connectionListeners.clear();

  // Persistent listeners (survive reconnects)
  persistentConnectionListeners.forEach(callback => {
    try {
      callback();
    } catch (error) {
      logger.error('[WebSocket] Error in persistent connection listener:', error instanceof Error ? error.message : error);
    }
  });
};

/**
 * Get detailed connection diagnostics
 */
export const getConnectionDiagnostics = (): object => {
  if (!stompClient) {
    return { status: 'no_client', stompClient: null };
  }

  return {
    status: 'client_exists',
    active: stompClient.active,
    connected: stompClient.connected,
    state: stompClient.state,
    subscriptionsCount: subscriptions.size,
    isReady: isWebSocketReady()
  };
};