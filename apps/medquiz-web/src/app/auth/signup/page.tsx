'use client';

import { useState } from 'react';
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
import { AlertCircle, Loader2, User, Mail, Lock } from 'lucide-react';
import { useMediaQuery } from '@/hooks/use-media-query';

export default function SignUp() {
  const [name, setName] = useState('');
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
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || '注册失败');
      }

      router.push('/auth/signin');
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center p-4 bg-muted/40">
      <div className="w-full max-w-md mx-auto">
        <Card className="w-full shadow-lg border-muted">
          <CardHeader className="space-y-1 pb-2">
            <CardTitle className="text-2xl md:text-3xl font-bold text-center">
              注册账号
            </CardTitle>
            <CardDescription className="text-center text-sm md:text-base">
              创建您的账户以开始使用我们的服务
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            {error && (
              <Alert variant="destructive" className="mb-4 text-sm">
                <AlertCircle className="h-4 w-4 mr-2" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm md:text-base">
                  姓名
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="请输入您的姓名"
                    className="h-10 md:h-11 pl-10"
                    autoComplete="name"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm md:text-base">
                  邮箱
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="your@email.com"
                    className="h-10 md:h-11 pl-10"
                    autoComplete="email"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm md:text-base">
                  密码
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="至少6个字符"
                    className="h-10 md:h-11 pl-10"
                    autoComplete="new-password"
                    minLength={6}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  密码必须至少包含6个字符
                </p>
              </div>
              <Button
                type="submit"
                className="w-full h-10 md:h-11 mt-2 transition-all"
                disabled={isLoading}
                size={isMobile ? 'default' : 'lg'}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    注册中...
                  </>
                ) : (
                  '注册'
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4 pb-6 pt-2">
            <p className="text-center text-xs md:text-sm text-muted-foreground">
              点击&quot;注册&quot;，即表示您同意我们的
              <Link
                href="/terms"
                className="text-primary hover:underline transition-colors mx-1"
              >
                服务条款
              </Link>
              和
              <Link
                href="/privacy"
                className="text-primary hover:underline transition-colors mx-1"
              >
                隐私政策
              </Link>
            </p>
            <div className="text-center text-xs md:text-sm text-muted-foreground">
              已有账号？{' '}
              <Link
                href="/auth/signin"
                className="text-primary font-medium hover:underline transition-colors"
              >
                登录
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
