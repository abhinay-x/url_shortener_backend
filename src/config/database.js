import mongoose from 'mongoose';
import logger from '../utils/logger.js';

const connectDB = async () => {
  try {
    console.log('🔄 Connecting to MongoDB...');
    
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      retryWrites: true,
      w: 'majority',
      serverSelectionTimeoutMS: 10000, // 10 seconds timeout
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000
    });
    
    console.log('✅ MongoDB Connected:', conn.connection.host);
    logger.info(`MongoDB Connected: ${conn.connection.host}`);
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed through app termination');
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    logger.error('Database connection failed:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      codeName: error.codeName,
      connectionString: process.env.MONGODB_URI?.replace(/\/\/.*@/, '//***:***@') // Hide credentials in logs
    });
    process.exit(1);
  }
};

export default connectDB;