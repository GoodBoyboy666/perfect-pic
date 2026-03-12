import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import {
  Activity,
  Cpu,
  GitCommit,
  HardDrive,
  Image as ImageIcon,
  Server,
  Tag,
  Users,
  Zap,
} from 'lucide-react'
import { motion } from 'motion/react'
import { fetchClient } from '../../../lib/api'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../components/ui/card'
import { Separator } from '../../../components/ui/separator'

export const Route = createFileRoute('/_admin/admin/overview')({
  component: AdminOverview,
})

function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return '0 Bytes'

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

function AdminOverview() {
  const appVersion = import.meta.env.VITE_APP_VERSION || 'Dev'
  const uiCommit = import.meta.env.VITE_UI_HASH || 'local'

  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadStats = async () => {
      try {
        const res = await fetchClient('/api/admin/stats')
        setStats(res)
      } catch (error) {
        console.error('Failed to load stats', error)
      } finally {
        setLoading(false)
      }
    }
    loadStats()
  }, [])

  if (loading) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        加载统计数据中...
      </div>
    )
  }

  if (!stats) {
    return <div className="p-8 text-center text-destructive">加载失败</div>
  }

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  }

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
  }

  return (
    <motion.div
      className="space-y-6"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={item}>
        <h2 className="text-3xl font-bold tracking-tight">系统概览</h2>
        <p className="text-muted-foreground">查看服务器状态和统计信息</p>
      </motion.div>

      <Separator />

      <div className="grid gap-4 md:grid-cols-3">
        <motion.div variants={item} className="contents">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">总用户数</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.user_count}</div>
              <p className="text-xs text-muted-foreground">注册用户总数</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={item} className="contents">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">图片总数</CardTitle>
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.image_count}</div>
              <p className="text-xs text-muted-foreground">全站上传图片数量</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={item} className="contents">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">存储占用</CardTitle>
              <HardDrive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatBytes(stats.storage_usage)}
              </div>
              <p className="text-xs text-muted-foreground">
                图片文件占用的总空间
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div
        variants={item}
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-7"
      >
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>服务器信息</CardTitle>
            <CardDescription>运行环境及硬件信息</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-purple-500" />
                  <span className="text-sm font-medium">后端版本</span>
                </div>
                <span className="text-sm font-mono">{appVersion}</span>
              </div>
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2">
                  <GitCommit className="h-4 w-4 text-orange-500" />
                  <span className="text-sm font-medium">UI 构建</span>
                </div>
                <span className="text-sm font-mono">{uiCommit}</span>
              </div>
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2">
                  <Server className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">操作系统</span>
                </div>
                <span className="text-sm font-mono">
                  {stats.system_info.os} ({stats.system_info.arch})
                </span>
              </div>
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm font-medium">Go 版本</span>
                </div>
                <span className="text-sm font-mono">
                  {stats.system_info.go_version}
                </span>
              </div>
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium">CPU 核心数</span>
                </div>
                <span className="text-sm font-mono">
                  {stats.system_info.num_cpu}
                </span>
              </div>
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">
                    协程数量 (Goroutines)
                  </span>
                </div>
                <span className="text-sm font-mono">
                  {stats.system_info.num_goroutine}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}
