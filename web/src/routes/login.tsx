import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { useAuth } from '../context/AuthContext'
import { fetchClient } from '../lib/api'
import { runPasskeyAssertion } from '../lib/passkey'
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

export const Route = createFileRoute('/login')({
  component: LoginComponent,
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function unwrapResponseData(payload: unknown): Record<string, unknown> | null {
  if (!isRecord(payload)) return null
  if (isRecord(payload.data)) return payload.data
  return payload
}

function parsePasskeyStartPayload(payload: unknown) {
  const candidate = unwrapResponseData(payload)
  if (!candidate) {
    throw new Error('Passkey 登录初始化失败')
  }

  const sessionIdRaw = candidate.session_id ?? candidate.sessionId
  const assertionOptionsRaw =
    candidate.assertion_options ?? candidate.assertionOptions

  if (typeof sessionIdRaw !== 'string' || sessionIdRaw.trim() === '') {
    throw new Error('Passkey 会话无效')
  }
  if (assertionOptionsRaw === null || assertionOptionsRaw === undefined) {
    throw new Error('Passkey challenge 无效')
  }

  return {
    sessionId: sessionIdRaw,
    assertionOptions: assertionOptionsRaw,
  }
}

function parseToken(payload: unknown): string | null {
  const candidate = unwrapResponseData(payload)
  if (!candidate) return null

  const token = candidate.token
  if (typeof token !== 'string' || token.trim() === '') return null

  return token
}

function buildPasskeyStartBody(params: {
  username: string
  password: string
  captchaPayload: Record<string, string>
}) {
  const body: Record<string, string> = {
    ...params.captchaPayload,
  }

  const username = params.username.trim()
  if (username !== '') {
    body.username = username
  }
  if (params.password !== '') {
    body.password = params.password
  }

  return body
}

function LoginComponent() {
  const { login, refreshUser, user, isLoading } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false)
  const formRef = useRef<HTMLFormElement | null>(null)
  const captcha = useCaptcha()

  useEffect(() => {
    if (user && !isLoading) {
      navigate({ to: '/dashboard/overview' })
    }
  }, [user, isLoading, navigate])

  const getCredentialInputs = (form?: HTMLFormElement) => {
    const targetForm = form ?? formRef.current
    const formData = targetForm ? new FormData(targetForm) : null

    const usernameFromForm = formData?.get('username')
    const passwordFromForm = formData?.get('password')

    const resolvedUsername =
      typeof usernameFromForm === 'string' && usernameFromForm.trim() !== ''
        ? usernameFromForm
        : username
    const resolvedPassword =
      typeof passwordFromForm === 'string' && passwordFromForm !== ''
        ? passwordFromForm
        : password

    return {
      username: resolvedUsername,
      password: resolvedPassword,
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const credentials = getCredentialInputs(e.currentTarget as HTMLFormElement)
    try {
      await login({
        username: credentials.username,
        password: credentials.password,
        ...captcha.getSubmitPayload(),
      })
      // navigate is handled by useEffect
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '登录失败'
      setError(message)
      captcha.refresh() // Refresh captcha on failure
    }
  }

  const handlePasskeyLogin = async () => {
    const credentials = getCredentialInputs()

    setError('')
    setIsPasskeyLoading(true)
    try {
      const startRes = await fetchClient('/api/auth/passkey/login/start', {
        method: 'POST',
        body: buildPasskeyStartBody({
          username: credentials.username,
          password: credentials.password,
          captchaPayload: captcha.getSubmitPayload(),
        }),
      })
      const { sessionId, assertionOptions } = parsePasskeyStartPayload(startRes)
      const credential = await runPasskeyAssertion(assertionOptions)

      const finishRes = await fetchClient('/api/auth/passkey/login/finish', {
        method: 'POST',
        body: {
          session_id: sessionId,
          credential,
        },
      })

      const token = parseToken(finishRes)
      if (!token) {
        throw new Error('登录失败：服务端未返回 token')
      }

      localStorage.setItem('token', token)
      await refreshUser()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Passkey 登录失败'
      setError(message)
      captcha.refresh()
    } finally {
      setIsPasskeyLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 dark:bg-zinc-950 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="w-full">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">
              登录 Perfect Pic
            </CardTitle>
            <CardDescription className="text-center">
              输入您的凭据以访问控制台
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="text-destructive text-sm text-center font-medium">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="username">用户名</Label>
                <Input
                  id="username"
                  name="username"
                  type="text"
                  placeholder="您的用户名"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isPasskeyLoading}
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">密码</Label>
                  <Link
                    to="/forgot-password"
                    className="text-xs text-muted-foreground hover:text-primary hover:underline"
                  >
                    忘记密码?
                  </Link>
                </div>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isPasskeyLoading}
                  required
                />
              </div>
              <CaptchaField captcha={captcha} />
              <Button
                type="submit"
                className="w-full"
                disabled={isPasskeyLoading}
              >
                登录
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={isPasskeyLoading}
                onClick={handlePasskeyLogin}
              >
                {isPasskeyLoading ? 'Passkey 验证中...' : '使用 Passkey 登录'}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="justify-center">
            <p className="text-sm text-muted-foreground">
              没有账号?{' '}
              <Link to="/register" className="text-primary hover:underline">
                立即注册
              </Link>
            </p>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  )
}
