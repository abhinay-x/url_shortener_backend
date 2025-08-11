import mongoose from 'mongoose';
import { nanoid } from 'nanoid';
import validator from 'validator';

const urlSchema = new mongoose.Schema({
  originalUrl: {
    type: String,
    required: [true, 'Original URL is required'],
    validate: {
      validator: function(url) {
        return validator.isURL(url, {
          protocols: ['http', 'https'],
          require_protocol: true
        });
      },
      message: 'Please provide a valid URL with http:// or https://'
    },
    trim: true
  },
  shortCode: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: [3, 'Short code must be at least 3 characters'],
    maxlength: [20, 'Short code cannot exceed 20 characters'],
    match: [/^[a-zA-Z0-9_-]+$/, 'Short code can only contain letters, numbers, hyphens, and underscores'],
    index: true
  },
  shortUrl: {
    type: String,
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false, // Allow anonymous URL creation
    index: true
  },
  title: {
    type: String,
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  clicks: {
    type: Number,
    default: 0,
    min: [0, 'Clicks cannot be negative']
  },
  uniqueClicks: {
    type: Number,
    default: 0,
    min: [0, 'Unique clicks cannot be negative']
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  expiresAt: {
    type: Date,
    default: null,
    validate: {
      validator: function(date) {
        return !date || date > new Date();
      },
      message: 'Expiration date must be in the future'
    },
    index: true
  },
  password: {
    type: String,
    default: null,
    minlength: [4, 'Password must be at least 4 characters']
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: [50, 'Tag cannot exceed 50 characters']
  }],
  category: {
    type: String,
    trim: true,
    maxlength: [100, 'Category cannot exceed 100 characters'],
    index: true
  },
  customDomain: {
    type: String,
    default: null,
    validate: {
      validator: function(domain) {
        return !domain || validator.isFQDN(domain);
      },
      message: 'Please provide a valid domain name'
    }
  },
  qrCode: {
    type: String, // Base64 encoded QR code
    default: null
  },
  lastAccessedAt: {
    type: Date,
    default: null,
    index: true
  },
  lastAccessedBy: {
    ipAddress: String,
    userAgent: String,
    country: String,
    city: String
  },
  metadata: {
    favicon: String,
    ogTitle: String,
    ogDescription: String,
    ogImage: String
  },
  analytics: {
    totalClicks: { type: Number, default: 0 },
    uniqueVisitors: { type: Number, default: 0 },
    topCountries: [{
      country: String,
      count: Number
    }],
    topReferrers: [{
      referrer: String,
      count: Number
    }],
    deviceTypes: {
      desktop: { type: Number, default: 0 },
      mobile: { type: Number, default: 0 },
      tablet: { type: Number, default: 0 },
      unknown: { type: Number, default: 0 }
    }
  },
  settings: {
    trackClicks: { type: Boolean, default: true },
    showPreview: { type: Boolean, default: false },
    requirePassword: { type: Boolean, default: false },
    enableComments: { type: Boolean, default: false }
  }
}, {
  timestamps: true,
  collection: 'urls'
});

// Indexes for better query performance
urlSchema.index({ userId: 1, createdAt: -1 });
urlSchema.index({ originalUrl: 1 });
urlSchema.index({ isActive: 1, expiresAt: 1 });
urlSchema.index({ createdAt: -1 });
urlSchema.index({ clicks: -1 });
urlSchema.index({ tags: 1 });

// Pre-save middleware to generate short code and short URL
urlSchema.pre('save', async function(next) {
  // Generate short code if not provided
  if (!this.shortCode) {
    let shortCode;
    let isUnique = false;
    
    while (!isUnique) {
      shortCode = nanoid(8); // Generate 8-character short code
      const existingUrl = await this.constructor.findOne({ shortCode });
      if (!existingUrl) {
        isUnique = true;
      }
    }
    
    this.shortCode = shortCode;
  }
  
  // Generate short URL
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  this.shortUrl = `${baseUrl}/${this.shortCode}`;
  
  next();
});

// Pre-save middleware to hash password if provided
urlSchema.pre('save', async function(next) {
  if (this.password && this.isModified('password')) {
    const bcrypt = await import('bcryptjs');
    this.password = await bcrypt.default.hash(this.password, 12);
  }
  next();
});

// Instance methods
urlSchema.methods.incrementClicks = async function() {
  this.clicks += 1;
  this.analytics.totalClicks += 1;
  this.lastAccessedAt = new Date();
  return await this.save();
};

urlSchema.methods.incrementUniqueClicks = async function() {
  this.uniqueClicks += 1;
  this.analytics.uniqueVisitors += 1;
  return await this.save();
};

urlSchema.methods.isExpired = function() {
  return this.expiresAt && this.expiresAt < new Date();
};

urlSchema.methods.isAccessible = function() {
  return this.isActive && !this.isExpired();
};

urlSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return true; // No password required
  const bcrypt = await import('bcryptjs');
  return bcrypt.default.compare(candidatePassword, this.password);
};

urlSchema.methods.updateLastAccess = async function(accessInfo = {}) {
  this.lastAccessedAt = new Date();
  if (accessInfo.ipAddress || accessInfo.userAgent || accessInfo.country || accessInfo.city) {
    this.lastAccessedBy = {
      ipAddress: accessInfo.ipAddress,
      userAgent: accessInfo.userAgent,
      country: accessInfo.country,
      city: accessInfo.city
    };
  }
  return await this.save();
};

urlSchema.methods.addTag = async function(tag) {
  if (!this.tags.includes(tag)) {
    this.tags.push(tag);
    return await this.save();
  }
  return this;
};

urlSchema.methods.removeTag = async function(tag) {
  this.tags = this.tags.filter(t => t !== tag);
  return await this.save();
};

urlSchema.methods.generateQRCode = async function() {
  try {
    const QRCode = await import('qrcode');
    const qrCodeDataURL = await QRCode.default.toDataURL(this.shortUrl, {
      width: 200,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    this.qrCode = qrCodeDataURL;
    return await this.save();
  } catch (error) {
    console.error('Error generating QR code:', error);
    return this;
  }
};

// Static methods
urlSchema.statics.findByShortCode = function(shortCode) {
  return this.findOne({ shortCode, isActive: true });
};

urlSchema.statics.findUserUrls = function(userId, options = {}) {
  const {
    page = 1,
    limit = 10,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    category,
    tags,
    isActive
  } = options;
  
  const query = { userId };
  
  if (category) query.category = category;
  if (tags && tags.length > 0) query.tags = { $in: tags };
  if (typeof isActive === 'boolean') query.isActive = isActive;
  
  const sort = {};
  sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
  
  return this.find(query)
    .sort(sort)
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .populate('userId', 'name email');
};

urlSchema.statics.getPopularUrls = function(limit = 10) {
  return this.find({ isActive: true })
    .sort({ clicks: -1 })
    .limit(limit)
    .populate('userId', 'name');
};

urlSchema.statics.getRecentUrls = function(limit = 10) {
  return this.find({ isActive: true })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('userId', 'name');
};

urlSchema.statics.searchUrls = function(searchTerm, userId = null) {
  const query = {
    $or: [
      { originalUrl: { $regex: searchTerm, $options: 'i' } },
      { title: { $regex: searchTerm, $options: 'i' } },
      { description: { $regex: searchTerm, $options: 'i' } },
      { tags: { $regex: searchTerm, $options: 'i' } },
      { category: { $regex: searchTerm, $options: 'i' } }
    ],
    isActive: true
  };
  
  if (userId) {
    query.userId = userId;
  }
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .populate('userId', 'name');
};

urlSchema.statics.getExpiredUrls = function() {
  return this.find({
    expiresAt: { $lt: new Date() },
    isActive: true
  });
};

urlSchema.statics.cleanupExpiredUrls = async function() {
  const result = await this.updateMany(
    { expiresAt: { $lt: new Date() } },
    { isActive: false }
  );
  return result.modifiedCount;
};

urlSchema.statics.getUrlStats = async function(userId = null) {
  const matchStage = userId ? { userId: mongoose.Types.ObjectId(userId) } : {};
  
  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalUrls: { $sum: 1 },
        activeUrls: {
          $sum: {
            $cond: [{ $eq: ['$isActive', true] }, 1, 0]
          }
        },
        totalClicks: { $sum: '$clicks' },
        averageClicks: { $avg: '$clicks' },
        expiredUrls: {
          $sum: {
            $cond: [
              { $and: [
                { $ne: ['$expiresAt', null] },
                { $lt: ['$expiresAt', new Date()] }
              ]},
              1,
              0
            ]
          }
        }
      }
    }
  ]);
  
  return stats[0] || {
    totalUrls: 0,
    activeUrls: 0,
    totalClicks: 0,
    averageClicks: 0,
    expiredUrls: 0
  };
};

// Virtual for formatted creation date
urlSchema.virtual('formattedCreatedAt').get(function() {
  return this.createdAt.toLocaleDateString();
});

// Virtual for click rate (clicks per day since creation)
urlSchema.virtual('clickRate').get(function() {
  const daysSinceCreation = Math.max(1, Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24)));
  return Math.round(this.clicks / daysSinceCreation * 100) / 100;
});

// Virtual for status
urlSchema.virtual('status').get(function() {
  if (!this.isActive) return 'inactive';
  if (this.isExpired()) return 'expired';
  return 'active';
});

// Ensure virtual fields are serialized
urlSchema.set('toJSON', { virtuals: true });
urlSchema.set('toObject', { virtuals: true });

const Url = mongoose.model('Url', urlSchema);

export default Url;