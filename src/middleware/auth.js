import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import logger from '../utils/logger.js';

// Main authentication middleware (exported as both protect and authenticate)
const authenticate = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
        error: 'NO_TOKEN'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if user still exists and is active
    const user = await User.findOne({
      _id: decoded.userId,
      isActive: true
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive',
        error: 'USER_NOT_FOUND'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    logger.error(`Authentication error: ${error.message}`);
    return res.status(401).json({
      success: false,
      message: 'Invalid token',
      error: 'INVALID_TOKEN'
    });
  }
};

export { authenticate, authenticate as protect };

// Optional authentication middleware (doesn't fail if no token)
export const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    
    if (user && user.isActive) {
      req.user = { 
        id: decoded.userId,
        userId: decoded.userId,
        email: user.email,
        role: user.role,
        plan: user.plan
      };
      logger.logAuth(`Optional auth - User authenticated: ${user.email}`, req);
    } else {
      req.user = null;
    }
    
    next();
  } catch (error) {
    // For optional auth, we don't fail on invalid tokens
    req.user = null;
    next();
  }
};

// Admin role middleware
export const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.',
        error: 'PERMISSION_DENIED'
      });
    }
    next();
  };
};

// API key authentication middleware
export const authenticateApiKey = async (req, res, next) => {
  try {
    const apiKey = req.header('X-API-Key');
    
    if (!apiKey) {
      return res.status(401).json({
        success: false,
        message: 'API key required.',
        error: 'NO_API_KEY'
      });
    }

    const user = await User.findOne({ apiKey, isActive: true });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid API key.',
        error: 'INVALID_API_KEY'
      });
    }

    req.user = { 
      id: user._id,
      userId: user._id,
      email: user.email,
      role: user.role,
      plan: user.plan
    };
    
    logger.logAuth(`API key authenticated: ${user.email}`, req);
    next();
  } catch (error) {
    logger.error('API key auth error:', error);
    res.status(401).json({
      success: false,
      message: 'Authentication failed.',
      error: 'AUTH_ERROR'
    });
  }
};

export default authenticate;