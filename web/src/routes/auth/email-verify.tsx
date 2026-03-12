import { Link, createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { fetchClient } from '../../lib/api'
import { Button } from '../../components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../../components/ui/card'

export const Route = createFileRoute('/auth/email-verify')({
  component: EmailVerifyComponent,
  validateSearch: (search: Record<string, unknown>) => {
    return { token: (search.token as string) || '' }
  },
})

function EmailVerifyComponent() {
  const { token } = Route.useSearch()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    'loading',
  )
  const [message, setMessage] = useState('正在验证您的邮箱...')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('无效的验证链接：缺少令牌')
      return
    }

    const verify = async () => {
      try {
        const res: any = await fetchClient('/api/auth/email-verify', {
          method: 'POST',
          body: { token },
        })
        setStatus('success')
        setMessage(res.message || '邮箱验证成功！')
      } catch (err: any) {
        setStatus('error')
        setMessage(err.message || '验证失败，链接可能已过期')
      }
    }

    // Add a small delay for better UX so the loading spinner doesn't just flicker
    setTimeout(verify, 500)
  }, [token])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 dark:bg-zinc-950 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="w-full text-center">
          <CardHeader>
            <div className="flex justify-center mb-4">
              {status === 'loading' && (
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
              )}
              {status === 'success' && (
                <CheckCircle2 className="h-12 w-12 text-green-500" />
              )}
              {status === 'error' && (
                <XCircle className="h-12 w-12 text-destructive" />
              )}
            </div>
            <CardTitle className="text-2xl font-bold">
              {status === 'loading'
                ? '验证中'
                : status === 'success'
                  ? '验证成功'
                  : '验证失败'}
            </CardTitle>
            <CardDescription>
              {status === 'loading' ? '请稍候...' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p
              className={
                status === 'error'
                  ? 'text-destructive'
                  : 'text-muted-foreground'
              }
            >
              {message}
            </p>
          </CardContent>
          <CardFooter className="justify-center">
            <Link to="/login">
              <Button variant={status === 'loading' ? 'ghost' : 'default'}>
                {status === 'success' ? '前往登录' : '返回登录'}
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  )
}
