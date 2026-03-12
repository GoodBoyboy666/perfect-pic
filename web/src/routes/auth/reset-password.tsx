import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import { fetchClient } from '../../lib/api'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../../components/ui/card'

export const Route = createFileRoute('/auth/reset-password')({
  component: ResetPasswordComponent,
  validateSearch: (search: Record<string, unknown>) => {
    return { token: (search.token as string) || '' }
  },
})

function ResetPasswordComponent() {
  const { token } = Route.useSearch()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [responseMessage, setResponseMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!token) {
      setError('缺少验证令牌，请重新点击邮件链接')
      return
    }

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致')
      return
    }

    try {
      const res: any = await fetchClient('/api/auth/password/reset', {
        method: 'POST',
        body: {
          token,
          new_password: password,
        },
      })
      setSuccess(true)
      setResponseMessage(res.message || '密码重置成功')
      toast.success(res.message || '密码重置成功')
      setTimeout(() => navigate({ to: '/login' }), 3000)
    } catch (err: any) {
      setError(err.message || '重置失败，链接可能已过期')
    }
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 dark:bg-zinc-950 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">错误</CardTitle>
            <CardDescription>无效的链接</CardDescription>
          </CardHeader>
          <CardContent>
            <p>链接中缺少必要的令牌信息。</p>
          </CardContent>
          <CardFooter>
            <Link to="/login">
              <Button variant="outline">返回登录</Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 dark:bg-zinc-950 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="w-full">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">
              设置新密码
            </CardTitle>
            <CardDescription className="text-center">
              请为您的账户设置一个新的安全密码
            </CardDescription>
          </CardHeader>
          <CardContent>
            {success ? (
              <div className="text-center py-4 space-y-4">
                <div className="text-green-600 font-medium text-lg">
                  {responseMessage}
                </div>
                <p className="text-muted-foreground">
                  您现在可以使用新密码登录了。
                </p>
                <Button
                  className="w-full mt-4"
                  onClick={() => navigate({ to: '/login' })}
                >
                  前往登录
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="text-destructive text-sm text-center font-medium">
                    {error}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="password">新密码</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="输入新密码"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">确认新密码</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="再次输入新密码"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full">
                  重置密码
                </Button>
              </form>
            )}
          </CardContent>
          {!success && (
            <CardFooter className="justify-center">
              <Link
                to="/login"
                className="text-sm text-muted-foreground hover:text-primary hover:underline"
              >
                返回登录
              </Link>
            </CardFooter>
          )}
        </Card>
      </motion.div>
    </div>
  )
}
