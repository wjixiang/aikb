import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
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
        } else if (firstError.path.includes('phone')) {
          throw new BadRequestException('手机号格式无效');
        } else if (firstError.path.includes('password')) {
          throw new BadRequestException('密码长度至少6位');
        } else if (firstError.path.includes('userIds')) {
          if (firstError.code === 'too_small') {
            throw new BadRequestException('用户ID数组不能为空');
          } else if (firstError.code === 'invalid_string') {
            throw new BadRequestException('用户ID格式无效');
          }
        } else if (firstError.path.includes('action')) {
          throw new BadRequestException('操作类型无效');
        }
      }
      throw new BadRequestException('Validation failed');
    }
  }
}
