'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

export default function ProfilePage() {
  const { data: session } = useSession();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('新密码与确认密码不一致');
      return;
    }
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || '修改密码失败');
      }
      // 清空表单
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setError('');
      alert('密码修改成功');
    } catch (err) {
      setError(err instanceof Error ? err.message : '修改密码时发生错误');
    }
  };

  console.log(session?.user);

  return (
    <ProtectedRoute>
      <div className="container max-w-4xl py-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold">个人资料</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col items-center gap-4">
              <div className="relative group">
                <Avatar className="h-24 w-24">
                  <AvatarImage
                    src={session?.user?.avatar || ''}
                    alt={session?.user?.name || '用户头像'}
                  />
                  <AvatarFallback className="text-3xl w-full">
                    {session?.user?.name?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                <label
                  htmlFor="avatarUpload"
                  className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full cursor-pointer"
                >
                  <span className="text-white text-sm">更换头像</span>
                  <input
                    id="avatarUpload"
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const formData = new FormData();
                        formData.append('file', file);
                        const response = await fetch('/api/avatar', {
                          method: 'POST',
                          body: formData,
                        });
                        if (response.ok) {
                          window.location.reload();
                        }
                      }
                    }}
                  />
                </label>
              </div>
              <div className="text-center">
                {session?.user?.name && (
                  <h2 className="text-xl font-semibold">{session.user.name}</h2>
                )}
                {session?.user?.email && (
                  <p className="text-muted-foreground">{session.user.email}</p>
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <h3 className="font-medium">注册时间</h3>
                <p className="text-sm text-muted-foreground">
                  {session?.user?.createdAt &&
                    format(
                      new Date(session.user.createdAt),
                      'yyyy年MM月dd日 HH:mm',
                      { locale: zhCN },
                    )}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-medium">修改密码</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label
                    className="text-sm font-medium"
                    htmlFor="currentPassword"
                  >
                    当前密码
                  </label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="newPassword">
                    新密码
                  </label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label
                    className="text-sm font-medium"
                    htmlFor="confirmPassword"
                  >
                    确认新密码
                  </label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90"
                >
                  修改密码
                </button>
              </form>
            </div>
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  );
}
