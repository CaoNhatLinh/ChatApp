import SockJS from 'sockjs-client';
import { Client, type IMessage, type StompHeaders, type StompSubscription } from '@stomp/stompjs';
import { logger } from '@/shared/lib/logger';

// WebSocket URL from environment or default
const WS_URL = String(import.meta.env.VITE_WS_URL || 'http://localhost:8084/ws');

let stompClient: Client | null = null;
const subscriptions = new Map<
  string,
  {
    subscription: StompSubscription | null;
    callbacks: Set<SubscribeCallback>;
  }
>();
let connectingPromise: Promise<Client> | null = null;

type ParsedPayload = Record<string | number | symbol, unknown>;
type SubscribeCallback = (message: ParsedPayload) => void;

/**
 * Kết nối WebSocket qua SockJS + STOMP.
 * Idempotent: nếu đã kết nối/đang kết nối, trả về promise hiện tại.
 */
export const connectWebSocket = (token: string): Promise<Client> => {
  if (stompClient?.active && stompClient?.connected) {
    return Promise.resolve(stompClient);
  }

  if (connectingPromise) {
    return connectingPromise;
  }

  connectingPromise = new Promise<Client>((resolve, reject) => {
    if (stompClient) {
      stompClient.deactivate().catch((err) => {
        logger.error('[WebSocket] Deactivate error:', err instanceof Error ? err.message : String(err));
      });
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
        subscriptions.forEach((_, destination) => {
          bindSubscription(destination);
        });
        notifyConnectionReady();
        if (stompClient) {
          resolve(stompClient);
        } else {
          reject(new Error('stompClient is null'));
        }
      },

      onStompError: (frame) => {
        connectingPromise = null;
        const errorMsg = typeof frame === 'string'
          ? frame
          : (frame && typeof frame === 'object' && 'headers' in frame && frame.headers
            ? String((frame.headers as Record<string, string>).message || 'Unknown STOMP error')
            : 'Unknown STOMP error');

        logger.error('[WebSocket] STOMP error:', errorMsg);
        reject(new Error(errorMsg));
      },

      onWebSocketClose: () => {
        logger.warn('[WebSocket] Connection closed');
        subscriptions.forEach((subInfo) => {
          subInfo.subscription = null;
        });
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
 * Bật callback vào một destination.
 * Trả về hàm unsubscribe có thể gọi lúc cleanup.
 */
export const subscribe = (
  destination: string,
  callback: SubscribeCallback
): (() => void) => {
  let state = subscriptions.get(destination);
  if (!state) {
    state = {
      subscription: null,
      callbacks: new Set()
    };
    subscriptions.set(destination, state);
  }

  state.callbacks.add(callback);

  if (stompClient?.active && stompClient?.connected) {
    bindSubscription(destination);
  } else {
    logger.warn('[WebSocket] Not connected, queued subscription for:', destination);
  }

  return () => {
    const entry = subscriptions.get(destination);
    if (!entry) return;

    entry.callbacks.delete(callback);
    if (entry.callbacks.size === 0) {
      if (entry.subscription) {
        entry.subscription.unsubscribe();
      }
      subscriptions.delete(destination);
      logger.debug(`[WebSocket] Unsubscribed from ${destination}`);
    }
  };
};

const bindSubscription = (destination: string): void => {
  const entry = subscriptions.get(destination);
  if (!entry || !entry.callbacks.size || !stompClient?.connected) {
    return;
  }

  if (entry.subscription) {
    return;
  }

  try {
    const subscription = stompClient.subscribe(
      destination,
      (message: IMessage) => {
        try {
          const body = JSON.parse(message.body) as ParsedPayload;
          entry.callbacks.forEach((cb) => cb(body));
        } catch (err) {
          logger.error('[WebSocket] Failed to parse message:', message.body, err instanceof Error ? err.message : String(err));
        }
      }
    );
    entry.subscription = subscription;
    logger.debug(`[WebSocket] Successfully subscribed to ${destination}`);
  } catch (error) {
    logger.error('[WebSocket] Failed to subscribe to:', destination, error instanceof Error ? error.message : error);
  }
};

/**
 * Hủy đăng ký 1 destination
 */
export const unsubscribe = (destination: string): void => {
  const subInfo = subscriptions.get(destination);
  if (!subInfo) return;

  if (subInfo.subscription) {
    subInfo.subscription.unsubscribe();
  }
  subscriptions.delete(destination);
  logger.debug(`[WebSocket] Unsubscribed from ${destination}`);
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

  if (!stompClient.active || !stompClient.connected) {
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
 * Ngắt kết nối WebSocket và cleanup toàn bộ subscription
 */
export const disconnectWebSocket = (): void => {
  connectingPromise = null;
  subscriptions.forEach((_, destination) => {
    unsubscribe(destination);
  });

  if (stompClient) {
    stompClient
      .deactivate()
      .then(() => {
        logger.info('[WebSocket] Disconnected');
        stompClient = null;
      })
      .catch((err) => {
        logger.error('[WebSocket] Disconnect error:', err instanceof Error ? err.message : String(err));
        stompClient = null;
      });
  }
};

/**
 * Kiểm tra WebSocket sẵn sàng
 */
export const isWebSocketReady = (): boolean => {
  return !!stompClient?.active && !!stompClient?.connected;
};

/**
 * Chờ WebSocket kết nối xong trước khi thực hiện action
 */
export const waitForConnection = (
  action: () => void,
  maxRetries: number = 20,
  retryDelay: number = 1000
): void => {
  let retries = 0;

  const checkConnection = () => {
    const clientState = stompClient
      ? { active: stompClient.active, connected: stompClient.connected, state: stompClient.state }
      : null;

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

    setTimeout(() => {
      if (!isWebSocketReady()) {
        clearTimeout(timeoutId);
        unsubscribe();
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
const persistentConnectionListeners = new Set<() => void>();

/**
 * Đăng ký listener cho sự kiện kết nối thành công (one-shot)
 */
export const onConnectionReady = (callback: () => void): (() => void) => {
  if (isWebSocketReady()) {
    callback();
  } else {
    connectionListeners.add(callback);
  }

  return () => {
    connectionListeners.delete(callback);
  };
};

/**
 * Đăng ký listener cho mọi lần reconnect thành công
 */
export const addConnectionListener = (callback: () => void): (() => void) => {
  persistentConnectionListeners.add(callback);
  if (isWebSocketReady()) {
    try {
      callback();
    } catch (error) {
      logger.error('[WebSocket] Error in persistent connection listener:', error instanceof Error ? error.message : error);
    }
  }
  return () => {
    persistentConnectionListeners.delete(callback);
  };
};

const notifyConnectionReady = (): void => {
  connectionListeners.forEach((callback) => {
    try {
      callback();
    } catch (error) {
      logger.error('[WebSocket] Error in connection listener:', error instanceof Error ? error.message : error);
    }
  });
  connectionListeners.clear();

  persistentConnectionListeners.forEach((callback) => {
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
