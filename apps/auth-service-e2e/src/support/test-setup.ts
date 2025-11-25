/* eslint-disable */
import axios from 'axios';

export default async function () {
  // Configure axios for tests to use.
  const host = process.env.HOST ?? 'localhost';
  const port = process.env.PORT ?? '3000';
  axios.defaults.baseURL = `http://${host}:${port}`;
  
  // Set default headers for all requests
  axios.defaults.headers.common['Content-Type'] = 'application/json';
  
  console.log(`Test setup: Configured axios baseURL to http://${host}:${port}`);
}
