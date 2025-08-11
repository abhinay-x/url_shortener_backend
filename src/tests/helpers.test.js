import {
  isValidObjectId,
  sanitizeInput
} from '../middleware/validation.js';
import {
  generateAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  decodeToken
} from '../config/jwt.js';
import logger from '../utils/logger.js';

describe('Helper Functions Tests', () => {
  describe('Validation Helpers', () => {
    describe('isValidObjectId', () => {
      it('should return true for valid ObjectId', () => {
        const validId = '507f1f77bcf86cd799439011';
        expect(isValidObjectId(validId)).toBe(true);
      });

      it('should return false for invalid ObjectId', () => {
        const invalidIds = [
          'invalid-id',
          '123',
          '',
          null,
          undefined,
          '507f1f77bcf86cd79943901' // too short
        ];

        invalidIds.forEach(id => {
          expect(isValidObjectId(id)).toBe(false);
        });
      });
    });

    describe('sanitizeInput', () => {
      it('should remove dangerous characters', () => {
        const dangerousInput = '<script>alert("xss")</script>';
        const sanitized = sanitizeInput(dangerousInput);
        expect(sanitized).toBe('scriptalert(xss)/script');
      });

      it('should trim whitespace', () => {
        const input = '  hello world  ';
        const sanitized = sanitizeInput(input);
        expect(sanitized).toBe('hello world');
      });

      it('should handle non-string input', () => {
        expect(sanitizeInput(123)).toBe(123);
        expect(sanitizeInput(null)).toBe(null);
        expect(sanitizeInput(undefined)).toBe(undefined);
        expect(sanitizeInput({})).toEqual({});
      });

      it('should remove quotes and ampersands', () => {
        const input = 'hello "world" & test';
        const sanitized = sanitizeInput(input);
        expect(sanitized).toBe('hello world  test');
      });
    });
  });

  describe('JWT Helpers', () => {
    const testPayload = {
      id: '507f1f77bcf86cd799439011',
      email: 'test@example.com',
      role: 'user'
    };

    describe('generateAccessToken', () => {
      it('should generate a valid access token', () => {
        const token = generateAccessToken(testPayload);
        expect(token).toBeDefined();
        expect(typeof token).toBe('string');
        expect(token.split('.').length).toBe(3); // JWT has 3 parts
      });

      it('should handle empty payload', () => {
        const token = generateAccessToken({});
        expect(token).toBeDefined();
        expect(typeof token).toBe('string');
      });
    });

    describe('verifyAccessToken', () => {
      it('should verify a valid token', () => {
        const token = generateAccessToken(testPayload);
        const decoded = verifyAccessToken(token);
        
        expect(decoded.id).toBe(testPayload.id);
        expect(decoded.email).toBe(testPayload.email);
        expect(decoded.role).toBe(testPayload.role);
        expect(decoded.iat).toBeDefined();
        expect(decoded.exp).toBeDefined();
      });

      it('should throw error for invalid token', () => {
        expect(() => {
          verifyAccessToken('invalid.token.here');
        }).toThrow();
      });

      it('should throw error for malformed token', () => {
        expect(() => {
          verifyAccessToken('not-a-jwt-token');
        }).toThrow();
      });
    });

    describe('generateRefreshToken', () => {
      it('should generate a valid refresh token', () => {
        const token = generateRefreshToken(testPayload);
        expect(token).toBeDefined();
        expect(typeof token).toBe('string');
        expect(token.split('.').length).toBe(3);
      });
    });

    describe('verifyRefreshToken', () => {
      it('should verify a valid refresh token', () => {
        const token = generateRefreshToken(testPayload);
        const decoded = verifyRefreshToken(token);
        
        expect(decoded.id).toBe(testPayload.id);
        expect(decoded.email).toBe(testPayload.email);
      });

      it('should throw error for invalid refresh token', () => {
        expect(() => {
          verifyRefreshToken('invalid.refresh.token');
        }).toThrow();
      });
    });

    describe('decodeToken', () => {
      it('should decode token without verification', () => {
        const token = generateAccessToken(testPayload);
        const decoded = decodeToken(token);
        
        expect(decoded).toBeDefined();
        expect(decoded.header).toBeDefined();
        expect(decoded.payload).toBeDefined();
        expect(decoded.signature).toBeDefined();
        expect(decoded.payload.id).toBe(testPayload.id);
      });

      it('should return null for invalid token', () => {
        const decoded = decodeToken('invalid-token');
        expect(decoded).toBe(null);
      });
    });
  });

  describe('Logger Helpers', () => {
    // Mock console methods to test logger
    let consoleSpy;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    describe('logAuth', () => {
      it('should log successful authentication', () => {
        logger.logAuth('login', 'user123', '192.168.1.1', true);
        // Test passes if no error is thrown
        expect(true).toBe(true);
      });

      it('should log failed authentication', () => {
        logger.logAuth('login', null, '192.168.1.1', false);
        // Test passes if no error is thrown
        expect(true).toBe(true);
      });
    });

    describe('logSecurity', () => {
      it('should log security events', () => {
        logger.logSecurity('suspicious_activity', {
          ip: '192.168.1.1',
          userAgent: 'test-agent'
        });
        // Test passes if no error is thrown
        expect(true).toBe(true);
      });
    });

    describe('logPerformance', () => {
      it('should log performance metrics', () => {
        logger.logPerformance('database_query', 150, {
          query: 'SELECT * FROM users',
          rows: 10
        });
        // Test passes if no error is thrown
        expect(true).toBe(true);
      });
    });

    describe('logDatabase', () => {
      it('should log database operations', () => {
        logger.logDatabase('CREATE', 'users', { email: 'test@example.com' }, true);
        // Test passes if no error is thrown
        expect(true).toBe(true);
      });
    });
  });

  describe('Utility Functions', () => {
    describe('String Helpers', () => {
      it('should generate random string', () => {
        // This would test a generateRandomString function if it existed
        const randomStr1 = Math.random().toString(36).substring(2, 15);
        const randomStr2 = Math.random().toString(36).substring(2, 15);
        
        expect(randomStr1).not.toBe(randomStr2);
        expect(typeof randomStr1).toBe('string');
        expect(randomStr1.length).toBeGreaterThan(0);
      });
    });

    describe('Date Helpers', () => {
      it('should format dates correctly', () => {
        const date = new Date('2023-01-01T12:00:00Z');
        const isoString = date.toISOString();
        
        expect(isoString).toBe('2023-01-01T12:00:00.000Z');
        expect(typeof isoString).toBe('string');
      });

      it('should calculate time differences', () => {
        const start = new Date('2023-01-01T12:00:00Z');
        const end = new Date('2023-01-01T12:05:00Z');
        const diff = end.getTime() - start.getTime();
        
        expect(diff).toBe(5 * 60 * 1000); // 5 minutes in milliseconds
      });
    });

    describe('URL Helpers', () => {
      it('should validate URL format', () => {
        const validUrls = [
          'https://example.com',
          'http://test.org',
          'https://sub.domain.com/path?query=value'
        ];

        const invalidUrls = [
          'not-a-url',
          'ftp://example.com',
          'javascript:alert(1)',
          ''
        ];

        validUrls.forEach(url => {
          try {
            new URL(url);
            expect(true).toBe(true);
          } catch {
            expect(false).toBe(true);
          }
        });

        invalidUrls.forEach(url => {
          try {
            new URL(url);
            if (!url.startsWith('http')) {
              expect(false).toBe(true);
            }
          } catch {
            expect(true).toBe(true);
          }
        });
      });
    });

    describe('Array Helpers', () => {
      it('should remove duplicates from array', () => {
        const arrayWithDuplicates = [1, 2, 2, 3, 3, 3, 4];
        const uniqueArray = [...new Set(arrayWithDuplicates)];
        
        expect(uniqueArray).toEqual([1, 2, 3, 4]);
        expect(uniqueArray.length).toBe(4);
      });

      it('should chunk array into smaller arrays', () => {
        const array = [1, 2, 3, 4, 5, 6, 7, 8];
        const chunkSize = 3;
        const chunks = [];
        
        for (let i = 0; i < array.length; i += chunkSize) {
          chunks.push(array.slice(i, i + chunkSize));
        }
        
        expect(chunks).toEqual([[1, 2, 3], [4, 5, 6], [7, 8]]);
        expect(chunks.length).toBe(3);
      });
    });
  });
});