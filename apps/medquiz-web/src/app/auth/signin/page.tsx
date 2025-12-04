'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useMediaQuery } from '@/hooks/use-media-query';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const isMobile = useMediaQuery('(max-width: 640px)');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const result = await signIn('credentials', {
        redirect: false,
        email,
        password,
      });

      if (result?.error) {
        console.log(error);
        throw new Error('邮箱或密码错误');
      }

      router.push('/');
      router.refresh();
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center p-4 bg-muted/40">
      <div className="w-full max-w-md mx-auto">
        <Card className="w-full shadow-lg border-muted my-12">
          <CardHeader className="space-y-1 pb-2">
            <CardTitle className="text-2xl md:text-3xl font-bold text-center">
              登录
            </CardTitle>
            <CardDescription className="text-center text-sm md:text-base">
              输入您的邮箱和密码登录账户
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4 px-4 md:px-6">
            {error && (
              <Alert variant="destructive" className="mb-4 text-sm">
                <AlertCircle className="h-4 w-4 mr-2" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm md:text-base">
                  邮箱
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="your@email.com"
                  className="h-10 md:h-11"
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm md:text-base">
                    密码
                  </Label>
                  <Link
                    href="/auth/forgot-password"
                    className="text-xs md:text-sm text-primary hover:underline transition-colors"
                  >
                    忘记密码?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-10 md:h-11"
                  autoComplete="current-password"
                />
              </div>
              <Button
                type="submit"
                className="w-full h-10 md:h-11 mt-6 transition-all"
                disabled={isLoading}
                size={isMobile ? 'default' : 'lg'}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    登录中...
                  </>
                ) : (
                  '登录'
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex justify-center pb-6 pt-2">
            <p className="text-center text-xs md:text-sm text-muted-foreground">
              没有账号？{' '}
              <Link
                href="/auth/signup"
                className="text-primary font-medium hover:underline transition-colors"
              >
                注册
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
