import Analytics from '../models/Analytics.js';
import Url from '../models/Url.js';
import logger from '../utils/logger.js';

// Get analytics for a specific URL
export const getUrlAnalytics = async (req, res) => {
  try {
    const { shortCode } = req.params;
    const { timeframe = '7d' } = req.query;

    // Find the URL
    const url = await Url.findOne({ shortCode });
    if (!url) {
      return res.status(404).json({
        success: false,
        message: 'URL not found'
      });
    }

    // Check if user owns this URL (if authenticated)
    if (req.user && url.userId && url.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Calculate date range
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

    // Get analytics data
    const analytics = await Analytics.find({
      urlId: url._id,
      timestamp: { $gte: startDate, $lte: endDate }
    }).sort({ timestamp: -1 });

    // Aggregate data
    const totalClicks = analytics.length;
    const uniqueClicks = new Set(analytics.map(a => a.ipAddress)).size;
    
    // Group by date
    const clicksByDate = analytics.reduce((acc, click) => {
      const date = click.timestamp.toISOString().split('T')[0];
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {});

    // Group by country
    const clicksByCountry = analytics.reduce((acc, click) => {
      const country = click.country || 'Unknown';
      acc[country] = (acc[country] || 0) + 1;
      return acc;
    }, {});

    // Group by referrer
    const clicksByReferrer = analytics.reduce((acc, click) => {
      const referrer = click.referrer || 'Direct';
      acc[referrer] = (acc[referrer] || 0) + 1;
      return acc;
    }, {});

    // Group by device type
    const clicksByDevice = analytics.reduce((acc, click) => {
      const device = click.deviceType || 'Unknown';
      acc[device] = (acc[device] || 0) + 1;
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        url: {
          shortCode: url.shortCode,
          originalUrl: url.originalUrl,
          createdAt: url.createdAt
        },
        summary: {
          totalClicks,
          uniqueClicks,
          timeframe
        },
        charts: {
          clicksByDate,
          clicksByCountry,
          clicksByReferrer,
          clicksByDevice
        },
        recentClicks: analytics.slice(0, 10).map(click => ({
          timestamp: click.timestamp,
          country: click.country,
          referrer: click.referrer,
          deviceType: click.deviceType
        }))
      }
    });

  } catch (error) {
    logger.error('Error fetching URL analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get user's overall analytics
export const getUserAnalytics = async (req, res) => {
  try {
    const userId = req.user.id;
    const { timeframe = '30d' } = req.query;

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    
    switch (timeframe) {
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
        startDate.setDate(startDate.getDate() - 30);
    }

    // Get user's URLs
    const userUrls = await Url.find({ userId });
    const urlIds = userUrls.map(url => url._id);

    // Get analytics for all user URLs
    const analytics = await Analytics.find({
      urlId: { $in: urlIds },
      timestamp: { $gte: startDate, $lte: endDate }
    }).populate('urlId', 'shortCode originalUrl');

    // Calculate summary statistics
    const totalUrls = userUrls.length;
    const totalClicks = analytics.length;
    const uniqueClicks = new Set(analytics.map(a => a.ipAddress)).size;

    // Top performing URLs
    const urlClickCounts = analytics.reduce((acc, click) => {
      const shortCode = click.urlId.shortCode;
      acc[shortCode] = (acc[shortCode] || 0) + 1;
      return acc;
    }, {});

    const topUrls = Object.entries(urlClickCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([shortCode, clicks]) => {
        const url = userUrls.find(u => u.shortCode === shortCode);
        return {
          shortCode,
          originalUrl: url?.originalUrl,
          clicks
        };
      });

    // Clicks by date
    const clicksByDate = analytics.reduce((acc, click) => {
      const date = click.timestamp.toISOString().split('T')[0];
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        summary: {
          totalUrls,
          totalClicks,
          uniqueClicks,
          timeframe
        },
        topUrls,
        clicksByDate
      }
    });

  } catch (error) {
    logger.error('Error fetching user analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get system-wide analytics (admin only)
export const getSystemAnalytics = async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { timeframe = '30d' } = req.query;

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    
    switch (timeframe) {
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
        startDate.setDate(startDate.getDate() - 30);
    }

    // Get system statistics
    const totalUrls = await Url.countDocuments();
    const totalClicks = await Analytics.countDocuments({
      timestamp: { $gte: startDate, $lte: endDate }
    });
    const activeUrls = await Analytics.distinct('urlId', {
      timestamp: { $gte: startDate, $lte: endDate }
    }).then(ids => ids.length);

    // Get analytics data
    const analytics = await Analytics.find({
      timestamp: { $gte: startDate, $lte: endDate }
    });

    // Clicks by date
    const clicksByDate = analytics.reduce((acc, click) => {
      const date = click.timestamp.toISOString().split('T')[0];
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {});

    // Top countries
    const clicksByCountry = analytics.reduce((acc, click) => {
      const country = click.country || 'Unknown';
      acc[country] = (acc[country] || 0) + 1;
      return acc;
    }, {});

    const topCountries = Object.entries(clicksByCountry)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10);

    res.json({
      success: true,
      data: {
        summary: {
          totalUrls,
          totalClicks,
          activeUrls,
          timeframe
        },
        clicksByDate,
        topCountries
      }
    });

  } catch (error) {
    logger.error('Error fetching system analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};