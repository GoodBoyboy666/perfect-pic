import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { useAuth } from '../../../context/AuthContext'
import { fetchClient } from '../../../lib/api'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../../components/ui/card'
import { formatBytes } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'

export const Route = createFileRoute('/_user/dashboard/overview')({
  component: OverviewComponent,
})

function OverviewComponent() {
  const { user, refreshUser } = useAuth()
  const [count, setCount] = useState(0)
  const [systemQuota, setSystemQuota] = useState(0)

  useEffect(() => {
    // Ensure storage usage is fresh when entering Overview.
    void refreshUser()

    fetchClient('/api/user/images/count')
      .then((res: any) => {
        setCount(res.image_count || 0)
      })
      .catch(() => {})

    fetchClient('/api/default_storage_quota')
      .then((res: any) => setSystemQuota(res.default_storage_quota || 0))
      .catch(() => {})
  }, [refreshUser])

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
        <h2 className="text-3xl font-bold tracking-tight">概览</h2>
        <p className="text-muted-foreground">查看统计信息</p>
      </motion.div>
      <Separator className="my-6" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div variants={item} className="contents">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">用户信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                用户名:{' '}
                <span className="text-foreground font-medium">
                  {user?.username}
                </span>
              </p>
              <p>
                邮箱:{' '}
                <span className="text-foreground font-medium">
                  {user?.email || '未绑定'}
                </span>
              </p>
              <p>
                ID:{' '}
                <span className="text-foreground font-medium">{user?.id}</span>
              </p>
              <p>
                角色:{' '}
                <span className="text-foreground font-medium">
                  {user?.admin ? '管理员' : '普通用户'}
                </span>
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item} className="contents">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">快速统计</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <div className="text-2xl font-bold text-foreground">{count}</div>
              <p className="text-xs text-muted-foreground">已上传图片</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item} className="contents">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">存储空间</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <div className="text-2xl font-bold text-foreground">
                {user?.storage_used !== undefined
                  ? formatBytes(user.storage_used)
                  : '0 B'}
                <span className="text-sm font-normal text-muted-foreground mx-1">
                  /
                </span>
                {user?.storage_quota === null
                  ? formatBytes(systemQuota)
                  : user?.storage_quota !== undefined
                    ? formatBytes(user.storage_quota)
                    : '0 B'}
              </div>
              <p className="text-xs text-muted-foreground">
                已使用{' '}
                {(() => {
                  const quota =
                    user?.storage_quota === null
                      ? systemQuota
                      : user?.storage_quota
                  if (!quota) return '0'
                  return (((user?.storage_used || 0) / quota) * 100).toFixed(1)
                })()}
                %
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  )
}
