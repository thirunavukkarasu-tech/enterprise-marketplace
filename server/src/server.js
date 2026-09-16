import http from 'http';
import app from './app.js';
import { env } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import { logger } from './config/logger.js';
import { initSocket } from './sockets/index.js';

const httpServer = http.createServer(app);
const io = initSocket(httpServer);

async function start() {
  await connectDB();

  httpServer.listen(env.PORT, () => {
    logger.info(`MarketSphere API listening on port ${env.PORT} [${env.NODE_ENV}]`);
    logger.info(`Health check → http://localhost:${env.PORT}/api/${env.API_VERSION}/health`);
  });
}

async function shutdown(signal) {
  logger.info(`${signal} received — shutting down gracefully`);

  // Order matters: stop accepting new WS connections and close existing
  // ones before closing the HTTP server, so nothing is left half-open
  // during a deploy/restart. socket.io's close() closes its own attached
  // connections; it does not close httpServer itself.
  io.close();

  httpServer.close(async () => {
    await disconnectDB();
    process.exit(0);
  });

  // Force-exit if graceful shutdown hangs (e.g. a stuck connection)
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: reason?.message || reason });
  // Don't keep serving traffic on a process whose invariants may now be
  // broken — restart cleanly and let the platform bring it back up.
  process.exit(1);
});

start();
