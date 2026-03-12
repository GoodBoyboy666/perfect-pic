import { Link } from '@tanstack/react-router'
import { motion } from 'motion/react'
import { Button } from '@/components/ui/button'

export function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 text-center relative">
      <motion.h1
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 0.1, scale: 1 }}
        transition={{ duration: 0.8 }}
        className="text-9xl font-bold text-primary select-none"
      >
        404
      </motion.h1>
      <div className="absolute flex flex-col items-center gap-2 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="flex flex-col items-center gap-2"
        >
          <h2 className="text-3xl font-bold tracking-tight">页面未找到</h2>
          <p className="text-muted-foreground max-w-[500px] px-4">
            抱歉，我们找不到您要查找的页面。它可能已被移除、重命名或暂时不可用。
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="flex gap-4 mt-6"
        >
          <Button asChild>
            <Link to="/">返回首页</Link>
          </Button>
          <Button variant="outline" onClick={() => window.history.back()}>
            返回上一页
          </Button>
        </motion.div>
      </div>
    </div>
  )
}
