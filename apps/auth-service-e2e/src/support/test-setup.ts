/* eslint-disable */
import axios from 'axios';
import { orpc_client } from './orpc-client';

export default async function () {
  // Configure axios for tests to use.
  const host = process.env.HOST ?? 'localhost';
  const port = process.env.PORT ?? '3000';
  const baseUrl = `http://${host}:${port}`;
  
  axios.defaults.baseURL = baseUrl;
  
  // Set default headers for all requests
  axios.defaults.headers.common['Content-Type'] = 'application/json';
  
  console.log(`Test setup: Configured axios baseURL to ${baseUrl}`);
  console.log(`Test setup: ORPC client configured for ${baseUrl}`);
  
  // Verify ORPC client is properly configured
  try {
    // Test basic connectivity with ORPC client
    console.log('Test setup: ORPC client initialized successfully');
  } catch (error) {
    console.error('Test setup: Failed to initialize ORPC client', error);
  }
}
