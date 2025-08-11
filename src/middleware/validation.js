import { body, param, query, validationResult } from 'express-validator';
import { AppError } from './errorHandler.js';
import validator from 'validator';

// Validation result handler
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => error.msg);
    return next(new AppError(errorMessages.join('. '), 400));
  }
  next();
};

// URL validation
export const validateUrl = [
  body('originalUrl')
    .notEmpty()
    .withMessage('Original URL is required')
    .custom((value) => {
      if (!validator.isURL(value, {
        protocols: ['http','https'],
        require_protocol: true
      })) {
        throw new Error('Invalid URL format');
      }
      return true;
    }),
  handleValidationErrors
];

// Short code validation
export const validateShortCode = [
  param('shortCode')
    .notEmpty()
    .withMessage('Short code is required')
    .isLength({ min: 3, max: 20 })
    .withMessage('Short code must be between 3-20 characters')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Short code can only contain letters, numbers, underscores and hyphens'),
  handleValidationErrors
];

// Analytics query validation
export const validateAnalyticsQuery = [
  query('timeframe')
    .optional()
    .isIn(['24h', '7d', '30d', 'all'])
    .withMessage('Invalid timeframe'),
  handleValidationErrors
];

// Pagination validation
export const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'updatedAt', 'clicks', 'originalUrl'])
    .withMessage('SortBy must be one of: createdAt, updatedAt, clicks, originalUrl'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('SortOrder must be either asc or desc'),
  handleValidationErrors
];

// Custom validation helpers
export const isValidObjectId = (value) => {
  return /^[0-9a-fA-F]{24}$/.test(value);
};

export const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  return input.trim().replace(/[<>"'&]/g, '');
};