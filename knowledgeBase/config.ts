import dotenv from 'dotenv';
dotenv.config();

export interface AppConfig {
  fastapiEndPoint: string;
}

if (!process.env.FASTAPI_ENDPOINT)
  throw new Error(`env: FASTAPI_ENDPOINT miss`);

export const app_config: AppConfig = {
  fastapiEndPoint: process.env.FASTAPI_ENDPOINT as string,
};
