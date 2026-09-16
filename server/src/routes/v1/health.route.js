import { Router } from 'express';
import mongoose from 'mongoose';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { env } from '../../config/env.js';

const router = Router();

const MONGO_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const dbState = MONGO_STATES[mongoose.connection.readyState] ?? 'unknown';

    // Deliberately always 200, unchanged from Phase 1 — this is a
    // backward-compatibility choice, not an oversight: external tooling
    // (a load balancer, an uptime monitor) may already depend on this
    // endpoint returning 200 whenever the process itself is alive.
    // `database` already told the caller whether Mongo is connected;
    // changing the status code on top of that would be a second,
    // separate signal this phase doesn't have a documented consumer for.
    new ApiResponse(200, {
      status: 'ok',
      environment: env.NODE_ENV,
      uptimeSeconds: Math.round(process.uptime()),
      database: dbState,
      timestamp: new Date().toISOString(),
    }, 'MarketSphere API is healthy').send(res);
  })
);

export default router;
