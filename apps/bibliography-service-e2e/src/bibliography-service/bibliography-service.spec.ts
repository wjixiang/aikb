import axios from 'axios';

describe('GET /api', () => {
  it('should return a message', async () => {
    const res = await axios.get(`http://localhost:3000/api/library-items`);

    expect(res.status).toBe(200);
    
  });
});
