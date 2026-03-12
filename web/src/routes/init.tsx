import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { motion } from 'motion/react'
import { fetchClient } from '../lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export const Route = createFileRoute('/init')({
  component: InitComponent,
})

function InitComponent() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [initialized, setInitialized] = useState(false)
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    site_name: 'Perfect Pic',
    site_description: '记录与分享完美瞬间',
  })
  const [error, setError] = useState('')

  useEffect(() => {
    async function checkInit() {
      try {
        const res: any = await fetchClient('/api/init')
        if (res.initialized) {
          setInitialized(true)
        }
      } catch (e) {
        console.error('Failed to check init status', e)
      } finally {
        setLoading(false)
      }
    }
    checkInit()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await fetchClient('/api/init', {
        method: 'POST',
        body: formData,
      })
      toast.success('初始化成功，请登录')
      navigate({ to: '/login' })
    } catch (err: any) {
      setError(err.message || '初始化失败，请重试')
    }
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100">
        <div className="text-xl text-gray-600">检查系统状态中...</div>
      </div>
    )
  }

  if (initialized) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md"
        >
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-bold text-gray-800">
                系统已初始化
              </CardTitle>
              <CardDescription>
                该系统已经完成初始化配置，无需再次操作。
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center p-6 pt-0">
              <Button
                onClick={() => navigate({ to: '/login' })}
                className="w-full"
              >
                前往登录
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <motion.div
        className="w-full max-w-md"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-center text-3xl font-extrabold text-gray-900">
              系统初始化
            </CardTitle>
            <CardDescription className="text-center">
              配置管理员账号及站点信息
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 text-destructive text-sm text-center">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="username">管理员用户名</Label>
                <Input
                  id="username"
                  name="username"
                  type="text"
                  required
                  value={formData.username}
                  onChange={handleChange}
                  placeholder="请输入用户名"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">管理员密码</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="请输入密码"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="site_name">站点名称</Label>
                <Input
                  id="site_name"
                  name="site_name"
                  type="text"
                  required
                  value={formData.site_name}
                  onChange={handleChange}
                  placeholder="请输入站点名称"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="site_description">站点描述</Label>
                <Textarea
                  id="site_description"
                  name="site_description"
                  required
                  value={formData.site_description}
                  onChange={handleChange}
                  placeholder="请输入站点描述"
                  rows={3}
                />
              </div>
              <Button type="submit" className="w-full">
                完成初始化
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
