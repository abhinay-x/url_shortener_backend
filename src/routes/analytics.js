import express from 'express';
import {
  getUrlAnalytics,
  getUserAnalytics,
  getSystemAnalytics
} from '../controllers/analyticsControllers.js';
import { protect, restrictTo } from '../middleware/auth.js';
import {
  validateShortCode,
  validateAnalyticsQuery
} from '../middleware/validation.js';
import { analyticsLimiter } from '../middleware/ratelimiter.js';

const router = express.Router();

// Apply rate limiting to all analytics routes
router.use(analyticsLimiter);

// Get analytics for a specific URL
// GET /api/analytics/url/:shortCode
router.get(
  '/url/:shortCode',
  validateShortCode,
  validateAnalyticsQuery,
  getUrlAnalytics
);

// Get dashboard summary analytics (requires authentication)
// GET /api/analytics/dashboard
router.get(
  '/dashboard',
  protect,
  getUserAnalytics
);

// Get user's overall analytics (requires authentication)
// GET /api/analytics/user
router.get(
  '/user',
  protect,
  validateAnalyticsQuery,
  getUserAnalytics
);

// Get system-wide analytics (admin only)
// GET /api/analytics/system
router.get(
  '/system',
  protect,
  restrictTo('admin'),
  validateAnalyticsQuery,
  getSystemAnalytics
);

export default router;