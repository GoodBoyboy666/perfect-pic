import { Link, createFileRoute } from '@tanstack/react-router'
import { motion } from 'motion/react'
import { useSite } from '../context/SiteContext'
import { Button } from '../components/ui/button'

export const Route = createFileRoute('/')({
  component: App,
})

function App() {
  const { siteInfo } = useSite()

  return (
    <div className="animated-gradient flex min-h-screen flex-col text-white">
      <motion.header
        className="p-6 flex justify-between items-center"
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        <h1 className="text-3xl font-bold">{siteInfo.site_name}</h1>
        <nav className="flex gap-4">
          <Button
            variant="ghost"
            asChild
            className="text-white hover:bg-white/10 hover:text-white text-base"
          >
            <Link to="/login">登录</Link>
          </Button>
          <Button
            asChild
            className="bg-white text-blue-600 hover:bg-gray-100 text-base font-bold"
          >
            <Link to="/register">注册</Link>
          </Button>
        </nav>
      </motion.header>

      <main className="flex-1 flex flex-col items-center justify-center text-center p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        >
          <h2 className="text-5xl font-extrabold mb-6">
            {siteInfo.site_description}
          </h2>
        </motion.div>

        <motion.p
          className="text-xl max-w-2xl mb-10 opacity-90"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 0.9, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8 }}
        >
          存储、整理和分享高质量照片的最佳平台。 安全、快速、随处可用。
        </motion.p>

        <motion.div
          className="space-x-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.8 }}
        >
          <Link
            to="/register"
            className="px-8 py-3 bg-white text-blue-600 text-lg font-bold rounded-full hover:bg-gray-100 transition shadow-lg inline-block"
          >
            立即加入
          </Link>
          <Link
            to="/login"
            className="px-8 py-3 text-white border-2 border-white text-lg font-bold rounded-full hover:bg-white/10 transition inline-block"
          >
            用户登录
          </Link>
        </motion.div>
      </main>

      <motion.footer
        className="p-6 text-center opacity-60"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.6 }}
        transition={{ delay: 1, duration: 1 }}
      >
        &copy; {new Date().getFullYear()} {siteInfo.site_name}. All rights
        reserved.
      </motion.footer>
    </div>
  )
}
