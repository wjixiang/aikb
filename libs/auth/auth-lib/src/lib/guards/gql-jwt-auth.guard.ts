import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GqlExecutionContext } from '@nestjs/graphql';
import { JwtValidatedUser } from '../jwt.types';

/**
 * GqlJwtAuthGuard
 *
 * A custom JWT authentication guard designed for GraphQL resolvers.
 * Unlike the standard JwtAuthGuard which works with REST API routes,
 * this guard properly handles GraphQL's execution context.
 *
 * The guard extracts the request from the GraphQL context and uses
 * Passport's JWT strategy to validate the token.
 *
 * Usage:
 * @UseGuards(GqlJwtAuthGuard)
 * @Resolver()
 * export class MyResolver {
 *   // ...
 * }
 */
@Injectable()
export class GqlJwtAuthGuard extends AuthGuard('jwt') {
  /**
   * Get the request object from GraphQL execution context
   *
   * In GraphQL, the request is nested within the GqlExecutionContext,
   * unlike REST APIs where it's directly available in the ExecutionContext.
   */
  override getRequest(context: ExecutionContext) {
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext().req;
  }

  /**
   * Handle authentication errors
   *
   * This method is called when authentication fails.
   * We throw an UnauthorizedException which will be caught by NestJS's
   * exception filters and returned to the client.
   */
  override handleRequest(err: any, user: any, info: any): any {
    if (err || !user) {
      throw (
        err ||
        new UnauthorizedException(
          'Authentication failed. Please provide a valid JWT token.',
        )
      );
    }
    return user;
  }
}
