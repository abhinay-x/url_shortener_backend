import mongoose from 'mongoose';

const analyticsSchema = new mongoose.Schema({
  urlId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Url',
    required: true,
    index: true
  },
  ipAddress: {
    type: String,
    required: true,
    index: true
  },
  userAgent: {
    type: String,
    required: true
  },
  referrer: {
    type: String,
    default: null
  },
  country: {
    type: String,
    default: null,
    index: true
  },
  city: {
    type: String,
    default: null
  },
  region: {
    type: String,
    default: null
  },
  deviceType: {
    type: String,
    enum: ['desktop', 'mobile', 'tablet', 'unknown'],
    default: 'unknown',
    index: true
  },
  browser: {
    type: String,
    default: null
  },
  os: {
    type: String,
    default: null
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  sessionId: {
    type: String,
    default: null
  },
  isBot: {
    type: Boolean,
    default: false,
    index: true
  },
  language: {
    type: String,
    default: null
  },
  screenResolution: {
    width: Number,
    height: Number
  },
  timezone: {
    type: String,
    default: null
  }
}, {
  timestamps: true,
  collection: 'analytics'
});

// Compound indexes for better query performance
analyticsSchema.index({ urlId: 1, timestamp: -1 });
analyticsSchema.index({ timestamp: -1, country: 1 });
analyticsSchema.index({ urlId: 1, ipAddress: 1, timestamp: -1 });

// Static methods
analyticsSchema.statics.getUrlStats = async function(urlId, timeframe = '7d') {
  const endDate = new Date();
  const startDate = new Date();
  
  switch (timeframe) {
    case '24h':
      startDate.setHours(startDate.getHours() - 24);
      break;
    case '7d':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case '30d':
      startDate.setDate(startDate.getDate() - 30);
      break;
    case '90d':
      startDate.setDate(startDate.getDate() - 90);
      break;
    default:
      startDate.setDate(startDate.getDate() - 7);
  }

  const stats = await this.aggregate([
    {
      $match: {
        urlId: mongoose.Types.ObjectId(urlId),
        timestamp: { $gte: startDate, $lte: endDate },
        isBot: false
      }
    },
    {
      $group: {
        _id: null,
        totalClicks: { $sum: 1 },
        uniqueClicks: { $addToSet: '$ipAddress' },
        countries: { $addToSet: '$country' },
        devices: { $addToSet: '$deviceType' },
        browsers: { $addToSet: '$browser' }
      }
    },
    {
      $project: {
        totalClicks: 1,
        uniqueClicks: { $size: '$uniqueClicks' },
        uniqueCountries: { $size: '$countries' },
        uniqueDevices: { $size: '$devices' },
        uniqueBrowsers: { $size: '$browsers' }
      }
    }
  ]);

  return stats[0] || {
    totalClicks: 0,
    uniqueClicks: 0,
    uniqueCountries: 0,
    uniqueDevices: 0,
    uniqueBrowsers: 0
  };
};

analyticsSchema.statics.getTopCountries = async function(urlId, limit = 10) {
  return await this.aggregate([
    {
      $match: {
        urlId: mongoose.Types.ObjectId(urlId),
        country: { $ne: null },
        isBot: false
      }
    },
    {
      $group: {
        _id: '$country',
        count: { $sum: 1 }
      }
    },
    {
      $sort: { count: -1 }
    },
    {
      $limit: limit
    },
    {
      $project: {
        country: '$_id',
        count: 1,
        _id: 0
      }
    }
  ]);
};

analyticsSchema.statics.getClicksByDate = async function(urlId, timeframe = '7d') {
  const endDate = new Date();
  const startDate = new Date();
  
  switch (timeframe) {
    case '24h':
      startDate.setHours(startDate.getHours() - 24);
      break;
    case '7d':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case '30d':
      startDate.setDate(startDate.getDate() - 30);
      break;
    case '90d':
      startDate.setDate(startDate.getDate() - 90);
      break;
    default:
      startDate.setDate(startDate.getDate() - 7);
  }

  return await this.aggregate([
    {
      $match: {
        urlId: mongoose.Types.ObjectId(urlId),
        timestamp: { $gte: startDate, $lte: endDate },
        isBot: false
      }
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: '%Y-%m-%d',
            date: '$timestamp'
          }
        },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { '_id': 1 }
    },
    {
      $project: {
        date: '$_id',
        count: 1,
        _id: 0
      }
    }
  ]);
};

// Instance methods
analyticsSchema.methods.isUniqueVisitor = async function() {
  const existingVisit = await this.constructor.findOne({
    urlId: this.urlId,
    ipAddress: this.ipAddress,
    timestamp: {
      $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
    }
  });
  
  return !existingVisit;
};

// Pre-save middleware
analyticsSchema.pre('save', function(next) {
  // Set timezone if not provided
  if (!this.timezone) {
    this.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  }
  next();
});

const Analytics = mongoose.model('Analytics', analyticsSchema);

export default Analytics;