import request from 'supertest';
import mongoose from 'mongoose';
import app from '../app.js';
import User from '../models/User.js';
import Url from '../models/Url.js';
import Analytics from '../models/Analytics.js';

// Test database connection
const MONGODB_URI = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/url-shortener-test';

beforeAll(async () => {
  await mongoose.connect(MONGODB_URI);
});

beforeEach(async () => {
  await User.deleteMany({});
  await Url.deleteMany({});
  await Analytics.deleteMany({});
});

afterAll(async () => {
  await mongoose.connection.close();
});

describe('URL Tests', () => {
  let authToken;
  let userId;
  const testUser = {
    name: 'Test User',
    email: 'test@example.com',
    password: 'TestPass123!'
  };

  beforeEach(async () => {
    // Create and authenticate user for each test
    const response = await request(app)
      .post('/api/auth/register')
      .send(testUser);
    
    authToken = response.body.data.token;
    userId = response.body.data.user.id;
  });

  describe('POST /api/urls', () => {
    const validUrl = {
      originalUrl: 'https://example.com'
    };

    it('should create a short URL successfully', async () => {
      const response = await request(app)
        .post('/api/urls')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validUrl)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.url.originalUrl).toBe(validUrl.originalUrl);
      expect(response.body.data.url.shortCode).toBeDefined();
      expect(response.body.data.url.shortUrl).toBeDefined();
      expect(response.body.data.url.userId).toBe(userId);
    });

    it('should create URL with custom alias', async () => {
      const urlWithAlias = {
        ...validUrl,
        customAlias: 'my-custom-link'
      };

      const response = await request(app)
        .post('/api/urls')
        .set('Authorization', `Bearer ${authToken}`)
        .send(urlWithAlias)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.url.shortCode).toBe(urlWithAlias.customAlias);
    });

    it('should create URL with expiration date', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
      const urlWithExpiry = {
        ...validUrl,
        expiresAt: futureDate.toISOString()
      };

      const response = await request(app)
        .post('/api/urls')
        .set('Authorization', `Bearer ${authToken}`)
        .send(urlWithExpiry)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(new Date(response.body.data.url.expiresAt)).toEqual(futureDate);
    });

    it('should not create URL with invalid original URL', async () => {
      const invalidUrl = {
        originalUrl: 'not-a-valid-url'
      };

      const response = await request(app)
        .post('/api/urls')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidUrl)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('valid URL');
    });

    it('should not create URL with duplicate custom alias', async () => {
      const urlWithAlias = {
        ...validUrl,
        customAlias: 'duplicate-alias'
      };

      // First creation
      await request(app)
        .post('/api/urls')
        .set('Authorization', `Bearer ${authToken}`)
        .send(urlWithAlias)
        .expect(201);

      // Second creation with same alias
      const response = await request(app)
        .post('/api/urls')
        .set('Authorization', `Bearer ${authToken}`)
        .send(urlWithAlias)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already exists');
    });

    it('should not create URL without authentication', async () => {
      const response = await request(app)
        .post('/api/urls')
        .send(validUrl)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('token');
    });
  });

  describe('GET /api/urls', () => {
    beforeEach(async () => {
      // Create some test URLs
      await request(app)
        .post('/api/urls')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ originalUrl: 'https://example1.com' });
      
      await request(app)
        .post('/api/urls')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ originalUrl: 'https://example2.com' });
    });

    it('should get user URLs successfully', async () => {
      const response = await request(app)
        .get('/api/urls')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.urls).toHaveLength(2);
      expect(response.body.data.pagination).toBeDefined();
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/urls?page=1&limit=1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.urls).toHaveLength(1);
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(1);
    });

    it('should support sorting', async () => {
      const response = await request(app)
        .get('/api/urls?sortBy=createdAt&sortOrder=desc')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.urls).toHaveLength(2);
    });

    it('should not get URLs without authentication', async () => {
      const response = await request(app)
        .get('/api/urls')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('token');
    });
  });

  describe('GET /api/urls/:shortCode', () => {
    let shortCode;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/urls')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ originalUrl: 'https://example.com' });
      
      shortCode = response.body.data.url.shortCode;
    });

    it('should get URL details successfully', async () => {
      const response = await request(app)
        .get(`/api/urls/${shortCode}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.url.shortCode).toBe(shortCode);
      expect(response.body.data.url.originalUrl).toBe('https://example.com');
    });

    it('should not get URL details for non-existent short code', async () => {
      const response = await request(app)
        .get('/api/urls/nonexistent')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });

    it('should not get URL details without authentication', async () => {
      const response = await request(app)
        .get(`/api/urls/${shortCode}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('token');
    });
  });

  describe('PUT /api/urls/:shortCode', () => {
    let shortCode;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/urls')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ originalUrl: 'https://example.com' });
      
      shortCode = response.body.data.url.shortCode;
    });

    it('should update URL successfully', async () => {
      const updateData = {
        originalUrl: 'https://updated-example.com',
        isActive: false
      };

      const response = await request(app)
        .put(`/api/urls/${shortCode}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.url.originalUrl).toBe(updateData.originalUrl);
      expect(response.body.data.url.isActive).toBe(updateData.isActive);
    });

    it('should not update URL with invalid data', async () => {
      const response = await request(app)
        .put(`/api/urls/${shortCode}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ originalUrl: 'invalid-url' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('valid URL');
    });

    it('should not update non-existent URL', async () => {
      const response = await request(app)
        .put('/api/urls/nonexistent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ originalUrl: 'https://example.com' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });
  });

  describe('DELETE /api/urls/:shortCode', () => {
    let shortCode;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/urls')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ originalUrl: 'https://example.com' });
      
      shortCode = response.body.data.url.shortCode;
    });

    it('should delete URL successfully', async () => {
      const response = await request(app)
        .delete(`/api/urls/${shortCode}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted');
    });

    it('should not delete non-existent URL', async () => {
      const response = await request(app)
        .delete('/api/urls/nonexistent')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });

    it('should not delete URL without authentication', async () => {
      const response = await request(app)
        .delete(`/api/urls/${shortCode}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('token');
    });
  });

  describe('GET /:shortCode (Redirect)', () => {
    let shortCode;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/urls')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ originalUrl: 'https://example.com' });
      
      shortCode = response.body.data.url.shortCode;
    });

    it('should redirect to original URL', async () => {
      const response = await request(app)
        .get(`/${shortCode}`)
        .expect(302);

      expect(response.headers.location).toBe('https://example.com');
    });

    it('should create analytics record on redirect', async () => {
      await request(app)
        .get(`/${shortCode}`)
        .expect(302);

      // Check if analytics record was created
      const url = await Url.findOne({ shortCode });
      const analyticsCount = await Analytics.countDocuments({ urlId: url._id });
      expect(analyticsCount).toBe(1);
    });

    it('should return 404 for non-existent short code', async () => {
      const response = await request(app)
        .get('/nonexistent')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });

    it('should return 410 for expired URL', async () => {
      // Create URL with past expiration date
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      await Url.findOneAndUpdate(
        { shortCode },
        { expiresAt: pastDate }
      );

      const response = await request(app)
        .get(`/${shortCode}`)
        .expect(410);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('expired');
    });

    it('should return 410 for inactive URL', async () => {
      // Deactivate URL
      await Url.findOneAndUpdate(
        { shortCode },
        { isActive: false }
      );

      const response = await request(app)
        .get(`/${shortCode}`)
        .expect(410);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('inactive');
    });
  });

  describe('URL Model Tests', () => {
    it('should generate unique short codes', async () => {
      const url1 = new Url({
        originalUrl: 'https://example1.com',
        userId: new mongoose.Types.ObjectId()
      });
      
      const url2 = new Url({
        originalUrl: 'https://example2.com',
        userId: new mongoose.Types.ObjectId()
      });

      await url1.save();
      await url2.save();

      expect(url1.shortCode).toBeDefined();
      expect(url2.shortCode).toBeDefined();
      expect(url1.shortCode).not.toBe(url2.shortCode);
    });

    it('should validate URL format', async () => {
      const invalidUrl = new Url({
        originalUrl: 'not-a-url',
        userId: new mongoose.Types.ObjectId()
      });

      await expect(invalidUrl.save()).rejects.toThrow();
    });

    it('should check if URL is expired', async () => {
      const expiredUrl = new Url({
        originalUrl: 'https://example.com',
        userId: new mongoose.Types.ObjectId(),
        expiresAt: new Date(Date.now() - 1000) // 1 second ago
      });

      await expiredUrl.save();
      expect(expiredUrl.isExpired()).toBe(true);
    });

    it('should increment click count', async () => {
      const url = new Url({
        originalUrl: 'https://example.com',
        userId: new mongoose.Types.ObjectId()
      });

      await url.save();
      expect(url.clicks).toBe(0);

      await url.incrementClicks();
      expect(url.clicks).toBe(1);
    });
  });
});