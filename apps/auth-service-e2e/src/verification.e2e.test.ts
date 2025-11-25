import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { axiosInstance } from './support/axios-instance';

describe('Verification and Password Reset Endpoints', () => {
  let authToken: string;
  let testUserId: string;
  let verificationToken: string;
  let resetToken: string;

  beforeAll(async () => {
    // Create a test user and get auth token
    const registerResponse = await axiosInstance.post('/auth/register', {
      email: 'verification@example.com',
      password: 'password123',
      name: 'Verification Test'
    });

    authToken = registerResponse.data.accessToken;
    testUserId = registerResponse.data.user.id;
  });

  afterAll(async () => {
    // Cleanup test data if needed
  });

  describe('POST /verification/email/send', () => {
    it('should send email verification successfully', async () => {
      const response = await axiosInstance.post('/verification/email/send', {
        email: 'verification@example.com'
      });

      expect(response.status).toBe(201);
      expect(response.data.success).toBe(true);
      expect(response.data.message).toContain('验证邮件已发送');
      expect(response.data).toHaveProperty('token');
      expect(response.data).toHaveProperty('expiresAt');

      // Store token for verification test
      verificationToken = response.data.token;
    });

    it('should return success for already verified email', async () => {
      // First verify the email
      await axiosInstance.get(`/verification/email/verify/${verificationToken}`);

      // Then try to send verification again
      const response = await axiosInstance.post('/verification/email/send', {
        email: 'verification@example.com'
      });

      expect(response.status).toBe(201);
      expect(response.data.success).toBe(false);
      expect(response.data.message).toContain('邮箱已验证');
    });

    it('should return success for non-existent email (security)', async () => {
      const response = await axiosInstance.post('/verification/email/send', {
        email: 'nonexistent@example.com'
      });

      expect(response.status).toBe(201);
      // For security, should return success even for non-existent email
      expect(response.data.message).toContain('验证邮件已发送');
    });

    it('should return error for invalid email format', async () => {
      try {
        await axiosInstance.post('/verification/email/send', {
          email: 'invalid-email'
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(400);
      }
    });
  });

  describe('GET /verification/email/verify/:token', () => {
    let newVerificationToken: string;

    beforeAll(async () => {
      // Create a new verification token
      const response = await axiosInstance.post('/verification/email/send', {
        email: 'verifytest@example.com'
      });
      newVerificationToken = response.data.token;
    });

    it('should verify email successfully', async () => {
      const response = await axiosInstance.get(`/verification/email/verify/${newVerificationToken}`);

      expect(response.status).toBe(201);
      expect(response.data.success).toBe(true);
      expect(response.data.message).toContain('邮箱验证成功');
    });

    it('should return error for invalid token', async () => {
      try {
        await axiosInstance.get('/verification/email/verify/invalid-token');
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(200);
        expect(error.response.data.success).toBe(false);
        expect(error.response.data.message).toContain('验证令牌无效');
      }
    });

    it('should return error for expired token', async () => {
      // This test would require mocking an expired token
      // For now, we'll test with a non-existent token
      try {
        await axiosInstance.get('/verification/email/verify/expired-token-format');
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(200);
        expect(error.response.data.success).toBe(false);
      }
    });
  });

  describe('POST /verification/phone/verify', () => {
    it('should return not implemented message', async () => {
      const response = await axiosInstance.post('/verification/phone/verify', {
        phone: '+1234567890',
        code: '123456'
      }, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.status).toBe(201);
      expect(response.data.success).toBe(false);
      expect(response.data.message).toContain('手机验证功能暂未实现');
    });

    it('should return error without authentication', async () => {
      try {
        await axiosInstance.post('/verification/phone/verify', {
          phone: '+1234567890',
          code: '123456'
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(401);
      }
    });
  });

  describe('POST /password-reset/request', () => {
    it('should request password reset successfully', async () => {
      const response = await axiosInstance.post('/password-reset/request', {
        email: 'verification@example.com'
      });

      expect(response.status).toBe(201);
      expect(response.data.success).toBe(true);
      expect(response.data.message).toContain('密码重置链接已发送');
      expect(response.data).toHaveProperty('token');
      expect(response.data).toHaveProperty('expiresAt');

      // Store token for confirmation test
      resetToken = response.data.token;
    });

    it('should return success for non-existent email (security)', async () => {
      const response = await axiosInstance.post('/password-reset/request', {
        email: 'nonexistent@example.com'
      });

      expect(response.status).toBe(201);
      // For security, should return success even for non-existent email
      expect(response.data.message).toContain('如果邮箱存在，重置链接已发送');
    });

    it('should return error for invalid email format', async () => {
      try {
        await axiosInstance.post('/password-reset/request', {
          email: 'invalid-email'
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(400);
      }
    });
  });

  describe('POST /password-reset/confirm', () => {
    let newResetToken: string;
    let resetTestUser: any;

    beforeAll(async () => {
      // Create a test user for password reset
      const registerResponse = await axiosInstance.post('/auth/register', {
        email: 'resettest@example.com',
        password: 'password123',
        name: 'Reset Test User'
      });
      resetTestUser = registerResponse.data.user;
      
      // Create a new reset token
      const response = await axiosInstance.post('/password-reset/request', {
        email: 'resettest@example.com'
      });
      newResetToken = response.data.token;
    });

    it('should confirm password reset successfully', async () => {
      const response = await axiosInstance.post('/password-reset/confirm', {
        token: newResetToken,
        newPassword: 'newpassword456'
      });

      expect(response.status).toBe(201);
      expect(response.data.success).toBe(true);
      expect(response.data.message).toContain('密码重置成功');
    });

    it('should return error for invalid token', async () => {
      try {
        await axiosInstance.post('/password-reset/confirm', {
          token: 'invalid-reset-token',
          newPassword: 'newpassword456'
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(201);
        expect(error.response.data.success).toBe(false);
        expect(error.response.data.message).toContain('重置令牌无效');
      }
    });

    it('should return error for expired token', async () => {
      // This test would require mocking an expired token
      // For now, we'll test with a non-existent token
      try {
        await axiosInstance.post('/password-reset/confirm', {
          token: 'expired-token-format',
          newPassword: 'newpassword456'
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(201);
        expect(error.response.data.success).toBe(false);
      }
    });

    it('should return error for weak password', async () => {
      try {
        await axiosInstance.post('/password-reset/confirm', {
          token: newResetToken,
          newPassword: '123'
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(400);
      }
    });
  });
});