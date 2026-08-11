import { Router } from 'express';
import mongoose from 'mongoose';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

const MONGO_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const dbState = MONGO_STATES[mongoose.connection.readyState] ?? 'unknown';

    new ApiResponse(200, {
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      database: dbState,
      timestamp: new Date().toISOString(),
    }, 'MarketSphere API is healthy').send(res);
  })
);

export default router;
