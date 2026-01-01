import axios from 'axios';

describe('/auth', () => {
  it('register a test user', async () => {
    const res = await axios.post(`http://localhost:3005/api/auth/register`,
      {
        email: `test_user@gmail.com`,
        password: 'abcd123',
        name: `test_user`
      }
    );
  })

  it('register-login-logout-unregister', async () => {
    // Register
    const res = await axios.post(`http://localhost:3005/api/auth/register`,
      {
        email: `test_mail_${Date.now()}@gmail.com`,
        password: 'abcd123',
        name: `test_user_${Date.now()}`
      }
    );
    expect(res.status).toBe(201);
    console.log('Register response:', JSON.stringify(res.data));

    const { accessToken, refreshToken } = res.data;

    // Login
    const loginRes = await axios.post(`http://localhost:3005/api/auth/login`,
      {
        email: res.data.user.email,
        password: 'abcd123'
      }
    );
    expect(loginRes.status).toBe(200);
    console.log('Login response:', JSON.stringify(loginRes.data));

    // Validate token
    const validateRes = await axios.get(`http://localhost:3005/api/auth/validate`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );
    expect(validateRes.status).toBe(200);
    console.log('Validate response:', JSON.stringify(validateRes.data));

    // Unregister - requires JWT token in Authorization header
    const unregisterRes = await axios.post(`http://localhost:3005/api/auth/unregister`,
      {},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );
    expect(unregisterRes.status).toBe(200);
    expect(unregisterRes.data.message).toBe('Unregister successfully');
    console.log('Unregister response:', JSON.stringify(unregisterRes.data));

  }, 60000);
});
