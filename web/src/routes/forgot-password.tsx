import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import { fetchClient } from '../lib/api'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { CaptchaField } from '../components/CaptchaField'
import { useCaptcha } from '../hooks/use-captcha'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../components/ui/card'

export const Route = createFileRoute('/forgot-password')({
  component: ForgotPasswordComponent,
})

function ForgotPasswordComponent() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const captcha = useCaptcha()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    try {
      const res: any = await fetchClient('/api/auth/password/reset/request', {
        method: 'POST',
        body: {
          email,
          ...captcha.getSubmitPayload(),
        },
      })
      setSuccess(true)
      toast.success(res.message || '密码重置邮件已发送，请检查您的邮箱')
    } catch (err: any) {
      setError(err.message || '请求失败，请稍后重试')
      captcha.refresh() // Refresh captcha
    }
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
              重置密码
            </CardTitle>
            <CardDescription className="text-center">
              输入您的注册邮箱以获取重置链接
            </CardDescription>
          </CardHeader>
          <CardContent>
            {success ? (
              <div className="text-center py-4 space-y-4">
                <div className="text-green-600 font-medium text-lg">
                  邮件发送成功！
                </div>
                <p className="text-muted-foreground">
                  请检查您的邮箱收件箱（包括垃圾邮件文件夹），并按照邮件中的说明重置密码。
                </p>
                <Button
                  className="w-full mt-4"
                  onClick={() => navigate({ to: '/login' })}
                >
                  返回登录
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
                  <Label htmlFor="email">邮箱</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="输入您的注册邮箱"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <CaptchaField captcha={captcha} />
                <Button type="submit" className="w-full">
                  发送重置链接
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
