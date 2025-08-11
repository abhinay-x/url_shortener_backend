import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white'
};

// Tell winston that you want to link the colors
winston.addColors(colors);

// Define which transports the logger must use
const transports = [
  // Console transport
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
      winston.format.colorize({ all: true }),
      winston.format.printf(
        (info) => `${info.timestamp} ${info.level}: ${info.message}`
      )
    )
  }),
  
  // File transport for errors
  new winston.transports.File({
    filename: path.join(__dirname, '../../logs/error.log'),
    level: 'error',
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
      winston.format.json()
    )
  }),
  
  // File transport for all logs
  new winston.transports.File({
    filename: path.join(__dirname, '../../logs/combined.log'),
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
      winston.format.json()
    )
  })
];

// Create the logger
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'warn',
  levels,
  transports,
  exitOnError: false
});

// Create a stream object with a 'write' function that will be used by morgan
logger.stream = {
  write: (message) => {
    logger.http(message.trim());
  }
};

// Add request logging helper
logger.logRequest = (req, res, responseTime) => {
  const { method, url, ip } = req;
  const { statusCode } = res;
  const contentLength = res.get('Content-Length') || 0;
  
  logger.http(
    `${method} ${url} ${statusCode} ${contentLength} - ${responseTime}ms - ${ip}`
  );
};

// Add error logging helper
logger.logError = (error, req = null) => {
  const errorInfo = {
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  };
  
  if (req) {
    errorInfo.request = {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body,
      params: req.params,
      query: req.query,
      ip: req.ip
    };
  }
  
  logger.error('Application Error', errorInfo);
};

// Add database logging helper
logger.logDatabase = (operation, collection, query = null, result = null) => {
  logger.debug(`DB ${operation} on ${collection}`, {
    query,
    result: result ? 'Success' : 'Failed'
  });
};

// Add authentication logging helper
logger.logAuth = (action, userId = null, ip = null, success = true) => {
  const level = success ? 'info' : 'warn';
  logger[level](`Auth ${action}`, {
    userId,
    ip,
    success,
    timestamp: new Date().toISOString()
  });
};

// Add performance logging helper
logger.logPerformance = (operation, duration, metadata = {}) => {
  logger.info(`Performance: ${operation} took ${duration}ms`, metadata);
};

// Add security logging helper
logger.logSecurity = (event, details = {}) => {
  logger.warn(`Security Event: ${event}`, {
    ...details,
    timestamp: new Date().toISOString()
  });
};

export default logger;