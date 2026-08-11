import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

/**
 * Socket.IO is initialized in Phase 1 so the HTTP/WS server split is
 * decided once, up front — but no business events are wired yet. Real-time
 * delivery tracking (Phase 8) and order-status push (Phase 7) will
 * register their own namespaces/handlers here instead of touching
 * server.js again.
 */
export function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: env.CLIENT_URL,
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    logger.debug(`Socket connected: ${socket.id}`);

    socket.on('disconnect', () => {
      logger.debug(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
}
