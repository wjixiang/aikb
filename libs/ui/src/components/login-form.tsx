import { cn } from '../lib/utils';
import { Button } from './ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';

export interface LoginFormProps {
  className?: string;
  onSubmit?: (event: React.FormEvent<HTMLFormElement>) => Promise<void> | void;
  error?: string | null;
  isLoading?: boolean;
  onToggleMode?: () => void;
}

export function LoginForm({
  className,
  onSubmit,
  error,
  isLoading = false,
  onToggleMode,
  ...props
}: LoginFormProps) {
  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Login</CardTitle>
          <CardDescription>
            Enter your email below to login to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">Password</Label>
                  <a
                    href="#"
                    className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                  >
                    Forgot your password?
                  </a>
                </div>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  disabled={isLoading}
                />
              </div>
              {error && <div className="text-sm text-red-500">{error}</div>}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Logging in...' : 'Login'}
              </Button>
              <Button variant="outline" className="w-full" disabled={isLoading}>
                Login with Google
              </Button>
            </div>
            <div className="mt-4 text-center text-sm">
              Don't have an account?{' '}
              {onToggleMode ? (
                <button
                  type="button"
                  onClick={onToggleMode}
                  className="underline underline-offset-4 hover:underline"
                >
                  Sign up
                </button>
              ) : (
                <span className="underline underline-offset-4">Sign up</span>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
