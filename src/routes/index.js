import express from 'express';
import authRoutes from './auth.js';
import urlRoutes from './urls.js';
import analyticsRoutes from './analytics.js';
import { generalLimiter } from '../middleware/ratelimiter.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Apply general rate limiting to all routes
router.use(generalLimiter);

// Log all API requests
router.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.logRequest(req, res, duration);
  });
  
  next();
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'URL Shortener API is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API version info
router.get('/version', (req, res) => {
  res.status(200).json({
    success: true,
    version: '1.0.0',
    api: 'URL Shortener API',
    documentation: '/api/docs'
  });
});

// Mount route modules
router.use('/auth', authRoutes);
router.use('/urls', urlRoutes);
router.use('/analytics', analyticsRoutes);

// API documentation endpoint (placeholder)
router.get('/docs', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API Documentation',
    endpoints: {
      auth: {
        'POST /api/auth/register': 'Register a new user',
        'POST /api/auth/login': 'Login user',
        'GET /api/auth/profile': 'Get user profile',
        'PUT /api/auth/profile': 'Update user profile',
        'PUT /api/auth/password': 'Change password',
        'POST /api/auth/logout': 'Logout user'
      },
      urls: {
        'POST /api/urls': 'Create a short URL',
        'GET /api/urls': 'Get user URLs',
        'GET /api/urls/:shortCode': 'Get URL details',
        'PUT /api/urls/:shortCode': 'Update URL',
        'DELETE /api/urls/:shortCode': 'Delete URL',
        'GET /:shortCode': 'Redirect to original URL'
      },
      analytics: {
        'GET /api/analytics/url/:shortCode': 'Get URL analytics',
        'GET /api/analytics/user': 'Get user analytics',
        'GET /api/analytics/system': 'Get system analytics (admin only)'
      }
    }
  });
});

export default router;