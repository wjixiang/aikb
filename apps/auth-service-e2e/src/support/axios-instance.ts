import axios from 'axios';

// Configure axios for tests to use.
const host = process.env.HOST ?? 'localhost';
const port = process.env.PORT ?? '3000';

export const axiosInstance = axios.create({
  baseURL: `http://${host}:${port}`,
  headers: {
    'Content-Type': 'application/json',
  },
});

console.log(`Axios instance configured with baseURL: http://${host}:${port}`);
