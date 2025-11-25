import { PipeTransform, Injectable, ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { ZodError, ZodSchema } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: any, metadata: ArgumentMetadata) {
    try {
      return this.schema.parse(value);
    } catch (error) {
      if (error instanceof ZodError && error.errors) {
        // Extract the first error message for simplicity
        const firstError = error.errors[0];
        if (firstError.path.includes('email')) {
          throw new BadRequestException('邮箱格式无效');
        } else if (firstError.path.includes('password')) {
          throw new BadRequestException('密码长度至少6位');
        }
      }
      throw new BadRequestException('Validation failed');
    }
  }
}