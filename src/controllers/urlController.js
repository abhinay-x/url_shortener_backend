// server/src/controllers/urlController.js
import Url from '../models/Url.js';
import generateShortCode from '../utils/generateShortCode.js';
import validateUrl from '../utils/validateUrl.js';
// Optional geoip import - gracefully handle if not installed
let geoip = null;

// Initialize geoip asynchronously
const initGeoip = async () => {
  try {
    const geoipModule = await import('geoip-lite');
    geoip = geoipModule.default || geoipModule;
  } catch (error) {
    console.warn('geoip-lite not installed - geolocation features disabled');
  }
};

// Initialize immediately
initGeoip();

class UrlController {
  // Create short URL
  static async shortenUrl(req, res, next) {
    try {
      const { originalUrl, customCode, title, description, expiresAt } = req.body;

      // Validate URL
      if (!validateUrl(originalUrl)) {
        return res.status(400).json({ 
          message: 'Invalid URL format',
          error: 'INVALID_URL'
        });
      }

      // Check if custom code is available
      if (customCode) {
        const existingCustom = await Url.findOne({ 
          $or: [{ shortCode: customCode }, { customCode }] 
        });
        if (existingCustom) {
          return res.status(409).json({ 
            message: 'Custom code already taken',
            error: 'CODE_TAKEN'
          });
        }
      }

      // Generate short code
      let shortCode = customCode || generateShortCode();
      
      // Ensure uniqueness
      while (await Url.findOne({ shortCode })) {
        shortCode = generateShortCode();
      }

      // Generate short URL
      const baseUrl = process.env.BASE_URL || 'http://localhost:5052';
      const shortUrl = `${baseUrl}/${shortCode}`;

      // Create URL document
      const urlData = {
        originalUrl,
        shortCode,
        shortUrl,
        customCode: customCode || null,
        userId: req.user?._id || null,
        title,
        description,
        expiresAt: expiresAt ? new Date(expiresAt) : null
      };

      const url = await Url.create(urlData);

      res.status(201).json({
        message: 'URL shortened successfully',
        data: {
          id: url._id,
          originalUrl: url.originalUrl,
          shortCode: url.shortCode,
          shortUrl: url.shortUrl,
          qrCodeUrl: url.qrCodeUrl,
          title: url.title,
          createdAt: url.createdAt,
          expiresAt: url.expiresAt
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Bulk shorten URLs
  static async bulkShorten(req, res, next) {
    try {
      const { urls } = req.body;
      if (!Array.isArray(urls) || urls.length === 0) {
        return next(new Error('Please provide an array of URLs to shorten', 400));
      }

      // Limit to 50 URLs at a time
      if (urls.length > 50) {
        return next(new Error('Maximum 50 URLs allowed for bulk shortening', 400));
      }

      const userId = req.user._id;
      const shortenedUrls = [];

      // Process each URL
      for (const url of urls) {
        if (!url || typeof url !== 'string') continue;

        try {
          // Validate URL
          if (!validateUrl(url)) {
            continue;
          }

          const shortCode = generateShortCode();
          const shortenedUrl = `${process.env.BASE_URL}/${shortCode}`;

          const newUrl = await Url.create({
            originalUrl: url,
            shortCode,
            shortUrl: shortenedUrl,
            userId: userId,
            title: url.length > 50 ? `${url.substring(0, 50)}...` : url
          });

          shortenedUrls.push(newUrl);
        } catch (err) {
          console.error(`Error processing URL ${url}:`, err);
          continue;
        }
      }

      res.status(201).json({
        status: 'success',
        message: `Processed ${shortenedUrls.length} out of ${urls.length} URLs`,
        data: shortenedUrls
      });
    } catch (err) {
      console.error('Error in bulkShorten:', err);
      next(new Error('Failed to process bulk URL shortening', 500));
    }
  }

  // Redirect to original URL
  static async redirectUrl(req, res, next) {
    try {
      const { shortCode } = req.params;

      const url = await Url.findOne({ 
        shortCode,
        isActive: true,
        $or: [
          { expiresAt: null },
          { expiresAt: { $gt: new Date() } }
        ]
      });

      if (!url) {
        return res.status(404).json({ 
          message: 'Short URL not found or expired',
          error: 'URL_NOT_FOUND'
        });
      }

      // Track click analytics
      const ip = req.ip || req.connection.remoteAddress;
      const geo = geoip.lookup(ip);
      
      const clickData = {
        timestamp: new Date(),
        ip,
        userAgent: req.get('User-Agent'),
        referer: req.get('Referer'),
        country: geo?.country || 'Unknown',
        city: geo?.city || 'Unknown'
      };

      // Update click count and history
      await Url.findByIdAndUpdate(url._id, {
        $inc: { clicks: 1 },
        $push: { clickHistory: clickData }
      });

      // Redirect
      res.redirect(301, url.originalUrl);
    } catch (error) {
      next(error);
    }
  }

  // Get user URLs
  static async getUserUrls(req, res, next) {
    try {
      const { page = 1, limit = 10 } = req.query;
      const skip = (page - 1) * limit;

      console.time('getUserUrlsQuery');
      
      const urls = await Url.find({
        userId: req.user.id,
        isActive: true
      })
      .maxTimeMS(30000) // 30s timeout
      .select('originalUrl shortCode shortUrl title createdAt clicks isActive expiresAt qrCode') // Only needed fields
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

      console.timeEnd('getUserUrlsQuery');

      const total = await Url.countDocuments({ 
        userId: req.user.id,
        isActive: true 
      });

      res.json({
        data: urls,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('getUserUrls error:', error);
      next(error);
    }
  }

  // Get URL analytics
  static async getUrlAnalytics(req, res, next) {
    try {
      const { id } = req.params;
      const { timeframe = '30d' } = req.query;

      const url = await Url.findOne({ 
        _id: id,
        $or: [
          { userId: req.user.id },
          { userId: null }
        ]
      });

      if (!url) {
        return res.status(404).json({ 
          message: 'URL not found',
          error: 'URL_NOT_FOUND'
        });
      }

      // Calculate timeframe
      const now = new Date();
      let startDate;
      switch (timeframe) {
        case '24h':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(url.createdAt);
      }

      // Filter click history
      const filteredClicks = url.clickHistory.filter(
        click => click.timestamp >= startDate
      );

      // Aggregate analytics data
      const analytics = {
        totalClicks: url.clicks,
        recentClicks: filteredClicks.length,
        countries: {},
        cities: {},
        dailyClicks: {},
        hourlyClicks: {},
        referrers: {},
        devices: {}
      };

      filteredClicks.forEach(click => {
        // Countries
        analytics.countries[click.country] = 
          (analytics.countries[click.country] || 0) + 1;

        // Cities
        analytics.cities[click.city] = 
          (analytics.cities[click.city] || 0) + 1;

        // Daily clicks
        const date = click.timestamp.toISOString().split('T')[0];
        analytics.dailyClicks[date] = 
          (analytics.dailyClicks[date] || 0) + 1;

        // Hourly clicks
        const hour = click.timestamp.getHours();
        analytics.hourlyClicks[hour] = 
          (analytics.hourlyClicks[hour] || 0) + 1;

        // Referrers
        const referrer = click.referer || 'Direct';
        analytics.referrers[referrer] = 
          (analytics.referrers[referrer] || 0) + 1;

        // Device detection
        const ua = click.userAgent || '';
        const device = ua.includes('Mobile') ? 'Mobile' : 'Desktop';
        analytics.devices[device] = 
          (analytics.devices[device] || 0) + 1;
      });

      res.json({
        url: {
          id: url._id,
          originalUrl: url.originalUrl,
          shortUrl: url.shortUrl,
          title: url.title,
          createdAt: url.createdAt
        },
        timeframe,
        analytics
      });
    } catch (error) {
      next(error);
    }
  }

  // Delete URL
  static async deleteUrl(req, res, next) {
    try {
      const { id } = req.params;

      const url = await Url.findOneAndUpdate(
        { 
          _id: id,
          userId: req.user.id 
        },
        { isActive: false },
        { new: true }
      );

      if (!url) {
        return res.status(404).json({ 
          message: 'URL not found',
          error: 'URL_NOT_FOUND'
        });
      }

      res.json({ 
        message: 'URL deleted successfully',
        data: { id: url._id }
      });
    } catch (error) {
      next(error);
    }
  }
}

export default UrlController;
