// server/src/routes/urls.js
import express from 'express';
import UrlController from '../controllers/urlController.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { 
  validateUrl, 
  validateShortCode, 
  validatePagination,
  validateAnalyticsQuery 
} from '../middleware/validation.js';
import { 
  generalLimiter, 
  urlCreationLimiter, 
  urlAccessLimiter 
} from '../middleware/ratelimiter.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// Create short URL
router.post('/', 
  urlCreationLimiter,
  authenticate,
  validateUrl,
  asyncHandler(UrlController.shortenUrl)
);

// Get user's URLs with pagination
router.get('/',
  generalLimiter,
  authenticate,
  validatePagination,
  asyncHandler(UrlController.getUserUrls)
);

// Get URL details by short code
router.get('/:shortCode',
  generalLimiter,
  optionalAuth,
  validateShortCode,
  asyncHandler(UrlController.getUrlDetails)
);

// Update URL
router.put('/:shortCode',
  generalLimiter,
  authenticate,
  validateShortCode,
  validateUrl,
  asyncHandler(UrlController.updateUrl)
);

// Delete URL
router.delete('/:shortCode',
  generalLimiter,
  authenticate,
  validateShortCode,
  asyncHandler(UrlController.deleteUrl)
);

// Toggle URL active status
router.patch('/:shortCode/toggle',
  generalLimiter,
  authenticate,
  validateShortCode,
  asyncHandler(UrlController.toggleUrlStatus)
);

// Get URL analytics
router.get('/:shortCode/analytics',
  generalLimiter,
  authenticate,
  validateShortCode,
  validateAnalyticsQuery,
  asyncHandler(UrlController.getUrlAnalytics)
);

// Redirect endpoint (this should be at root level, but included for completeness)
router.get('/r/:shortCode',
  urlAccessLimiter,
  validateShortCode,
  asyncHandler(UrlController.redirectUrl)
);

// Bulk operations
router.post('/bulk/create',
  generalLimiter,
  authenticate,
  asyncHandler(UrlController.bulkCreateUrls)
);

router.delete('/bulk/delete',
  generalLimiter,
  authenticate,
  asyncHandler(UrlController.bulkDeleteUrls)
);

// Bulk shorten URLs
router.post('/bulk-shorten',
  generalLimiter,
  authenticate,
  asyncHandler(UrlController.bulkShorten)
);

// Export URLs
router.get('/export/csv',
  generalLimiter,
  authenticate,
  asyncHandler(UrlController.exportUrlsCsv)
);

router.get('/export/json',
  generalLimiter,
  authenticate,
  asyncHandler(UrlController.exportUrlsJson)
);

export default router;