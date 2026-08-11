import winston from 'winston';
import { isProd } from './env.js';

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

const devFormat = combine(
  colorize(),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp: ts, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${ts} ${level}: ${stack || message}${metaStr}`;
  })
);

export const logger = winston.createLogger({
  level: isProd ? 'info' : 'debug',
  format: isProd ? combine(timestamp(), errors({ stack: true }), json()) : devFormat,
  transports: [new winston.transports.Console()],
  // In production this is where a file/managed-log transport (CloudWatch,
  // Datadog, etc.) would be added — kept out of Phase 1 since there's no
  // real infra behind it yet.
});
