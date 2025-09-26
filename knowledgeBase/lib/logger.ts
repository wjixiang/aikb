import winston from 'winston';

const createLoggerWithPrefix = (prefix: string) => {
  return winston.createLogger({
    format: winston.format.combine(
      winston.format.label({ label: prefix }),
      winston.format.timestamp(),
      winston.format.prettyPrint(),
    ),
    transports: [
      new winston.transports.Console(),
      new winston.transports.File({ filename: 'combined.log' }),
    ],
  });
};

export default createLoggerWithPrefix;
