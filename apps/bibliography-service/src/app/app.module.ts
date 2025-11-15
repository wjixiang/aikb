import { Module } from '@nestjs/common';
import { LibraryItemController } from './library-item/library-item.controller';
import { LibraryItemService } from './library-item/library-item.service';
import { S3ServiceProvider } from './s3/s3.provider';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';

@Module({
  imports: [
    RabbitMQModule.forRoot({
      exchanges: [
        {
          name: 'library',
          type: 'topic'
        }
      ],
      uri: `amqp://${process.env['RABBITMQ_USERNAME']}:${process.env['RABBITMQ_PASSWORD']}@${process.env['RABBITMQ_HOSTNAME']}:${process.env['RABBITMQ_AMQP_PORT']}/${process.env['RABBITMQ_VHOST']}`,
      connectionInitOptions: {
        timeout: 30000
      }
    })
  ],
  controllers: [LibraryItemController],
  providers: [LibraryItemService, S3ServiceProvider],
})
export class AppModule {}
