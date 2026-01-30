import { Module, Global } from '@nestjs/common';
import { S3ServiceProvider } from './s3.provider';

@Global()
@Module({
    providers: [S3ServiceProvider],
    exports: ['S3_SERVICE'],
})
export class S3Module { }
