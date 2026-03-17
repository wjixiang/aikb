import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    timestamp: string;
    path: string;
    [key: string]: unknown;
  };
}

export interface PaginatedResponse<T> extends ApiResponse<T> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T>> {
    const request = context.switchToHttp().getRequest();
    const path = request.url;

    return next.handle().pipe(
      map((data: T) => {
        // If data is already wrapped (e.g., paginated), don't wrap again
        if (
          data &&
          typeof data === 'object' &&
          'success' in data &&
          'data' in data
        ) {
          return data as unknown as ApiResponse<T>;
        }

        const response: ApiResponse<T> = {
          success: true,
          data,
          meta: {
            timestamp: new Date().toISOString(),
            path,
          },
        };

        return response;
      }),
    );
  }
}

@Injectable()
export class PaginatedTransformInterceptor<T>
  implements NestInterceptor<T, PaginatedResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<PaginatedResponse<T>> {
    const request = context.switchToHttp().getRequest();
    const path = request.url;

    return next.handle().pipe(
      map((data: T) => {
        // Check if data has pagination info
        if (
          data &&
          typeof data === 'object' &&
          'data' in data &&
          'pagination' in data
        ) {
          const paginatedData = data as unknown as {
            data: T;
            pagination: PaginatedResponse<T>['pagination'];
          };

          return {
            success: true,
            data: paginatedData.data,
            pagination: paginatedData.pagination,
            meta: {
              timestamp: new Date().toISOString(),
              path,
            },
          };
        }

        // Fallback for non-paginated data
        return {
          success: true,
          data,
          pagination: {
            page: 1,
            limit: 0,
            total: 0,
            totalPages: 0,
            hasNext: false,
            hasPrev: false,
          },
          meta: {
            timestamp: new Date().toISOString(),
            path,
          },
        };
      }),
    );
  }
}
