import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';

export interface SignupFormProps {
  className?: string;
  onSubmit?: (event: React.FormEvent<HTMLFormElement>) => Promise<void> | void;
  error?: string | null;
  isLoading?: boolean;
  onToggleMode?: () => void;
}

export function SignupForm({
  className,
  onSubmit,
  error,
  isLoading = false,
  onToggleMode,
  ...props
}: SignupFormProps) {
  return (
    <Card className={className} {...props}>
      <CardHeader>
        <CardTitle>Create an account</CardTitle>
        <CardDescription>
          Enter your information below to create your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="name">Full Name</FieldLabel>
              <Input
                id="name"
                name="name"
                type="text"
                placeholder="John Doe"
                required
                disabled={isLoading}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="m@example.com"
                required
                disabled={isLoading}
              />
              <FieldDescription>
                We'll use this to contact you. We will not share your email with
                anyone else.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input
                id="password"
                name="password"
                type="password"
                required
                disabled={isLoading}
              />
              <FieldDescription>
                Must be at least 6 characters long.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="confirm-password">
                Confirm Password
              </FieldLabel>
              <Input
                id="confirm-password"
                name="confirm-password"
                type="password"
                required
                disabled={isLoading}
              />
              <FieldDescription>Please confirm your password.</FieldDescription>
            </Field>
            {error && <div className="text-sm text-red-500">{error}</div>}
            <FieldGroup>
              <Field>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? 'Creating account...' : 'Create Account'}
                </Button>
                <Button variant="outline" type="button" disabled={isLoading}>
                  Sign up with Google
                </Button>
                <FieldDescription className="px-6 text-center">
                  Already have an account?
                  {onToggleMode ? (
                    <button
                      type="button"
                      onClick={onToggleMode}
                      className="underline underline-offset-4 hover:underline ml-1"
                    >
                      Sign in
                    </button>
                  ) : (
                    <span className="underline underline-offset-4 ml-1">
                      Sign in
                    </span>
                  )}
                </FieldDescription>
              </Field>
            </FieldGroup>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
