import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Save, Send } from 'lucide-react'
import { toast } from 'sonner'
import { motion } from 'motion/react'
import { fetchClient } from '../../../lib/api'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select'
import { Label } from '../../../components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../components/ui/card'
import { Separator } from '../../../components/ui/separator'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../../../components/ui/tabs'
import { CaptchaField } from '../../../components/CaptchaField'
import { useCaptcha } from '../../../hooks/use-captcha'

export const Route = createFileRoute('/_admin/admin/settings')({
  component: AdminSettingsComponent,
})

const SENSITIVE_PLACEHOLDER = '******'

type AdminSetting = {
  Key: string
  Value: string
  Desc: string
  Category?: string
  Sensitive?: boolean
  Placeholder?: string
}

function CaptchaTestPanel() {
  const captcha = useCaptcha()
  const hasToken = !!captcha.captchaToken

  return (
    <Card>
      <CardHeader>
        <CardTitle>验证码测试</CardTitle>
        <CardDescription>
          用于验证当前系统配置的验证码是否能在前端正常加载显示。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground">
          Provider:{' '}
          <span className="font-mono">{captcha.provider || '(关闭)'}</span>
        </div>
        <div className="text-sm text-muted-foreground">
          状态:{' '}
          {captcha.enabled ? (
            <span className="font-mono">
              enabled, {captcha.supported ? 'supported' : 'unsupported'}
              {captcha.siteKey ? `, siteKey ok` : ''}
              {hasToken ? `, token ok` : ''}
            </span>
          ) : (
            <span className="font-mono">disabled</span>
          )}
        </div>

        <CaptchaField captcha={captcha} required={false} />

        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={captcha.refresh}
            disabled={!captcha.enabled}
          >
            刷新验证码
          </Button>
        </div>

        {captcha.provider !== 'image' && captcha.enabled && (
          <div className="grid gap-2">
            <Label>captcha token（前端采集结果）</Label>
            <Input
              value={captcha.captchaToken}
              readOnly
              placeholder="完成验证码后这里会自动出现 token"
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function AdminSettingsComponent() {
  const [settings, setSettings] = useState<Array<AdminSetting>>([])
  const [originalSettings, setOriginalSettings] = useState<Array<AdminSetting>>(
    [],
  )
  const [testEmail, setTestEmail] = useState('')
  const [sendingTest, setSendingTest] = useState(false)

  const normalizeSettings = (data: Array<AdminSetting>) =>
    data.map((setting) => {
      if (!setting.Sensitive) return setting
      return {
        ...setting,
        Placeholder: setting.Value || SENSITIVE_PLACEHOLDER,
        Value: '',
      }
    })

  const loadSettings = async () => {
    try {
      const res = await fetchClient('/api/admin/settings')
      const data = Array.isArray(res) ? res : []
      const normalizedData = normalizeSettings(data)
      setSettings(normalizedData)
      // Deep copy to avoid reference issues
      setOriginalSettings(JSON.parse(JSON.stringify(normalizedData)))
    } catch (error: any) {
      toast.error(error.message || '加载设置失败')
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      // Only send changed settings
      const changedSettings = settings.filter((s) => {
        const original = originalSettings.find((os) => os.Key === s.Key)
        return original && original.Value !== s.Value
      })

      if (changedSettings.length === 0) {
        toast.info('没有需要保存的更改')
        return
      }

      const payload = changedSettings.map((s) => ({
        key: s.Key,
        value: s.Value,
      }))

      await fetchClient('/api/admin/settings', {
        method: 'PATCH',
        body: payload,
      })
      toast.success('设置已更新')
      loadSettings()
    } catch (error: any) {
      toast.error(error.message || '更新失败')
    }
  }

  const handleChange = (key: string, val: string) => {
    setSettings((prev) =>
      prev.map((s) => (s.Key === key ? { ...s, Value: val } : s)),
    )
  }

  const handleTestEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!testEmail) {
      toast.error('请输入接收测试邮件的邮箱地址')
      return
    }
    setSendingTest(true)
    try {
      const res: any = await fetchClient('/api/admin/email/test', {
        method: 'POST',
        body: { to_email: testEmail },
      })
      toast.success(res.message || '测试邮件已发送')
    } catch (error: any) {
      toast.error(error.message || '发送失败')
    } finally {
      setSendingTest(false)
    }
  }

  useEffect(() => {
    loadSettings()
  }, [])

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <h2 className="text-3xl font-bold tracking-tight">系统设置</h2>
        <p className="text-muted-foreground">配置网站全局参数</p>
      </motion.div>

      <Separator className="my-6" />

      {settings.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-center text-muted-foreground">
            暂无可用设置
          </CardContent>
        </Card>
      ) : (
        <form
          onSubmit={handleUpdate}
          className="space-y-6 max-w-4xl mx-auto w-full"
        >
          <Tabs
            defaultValue={settings[0]?.Category || '通用设置'}
            className="w-full"
          >
            <TabsList className="w-full justify-start h-auto flex-wrap gap-2">
              {Array.from(
                new Set(settings.map((s) => s.Category || '通用设置')),
              ).map((category) => (
                <TabsTrigger key={category} value={category}>
                  {category}
                </TabsTrigger>
              ))}
              <TabsTrigger value="email_test">邮件测试</TabsTrigger>
              <TabsTrigger value="captcha_test">验证码测试</TabsTrigger>
            </TabsList>
            {Object.entries(
              settings.reduce(
                (acc, setting) => {
                  const category = setting.Category || '通用设置'
                  const list = acc[category]
                  if (!list) {
                    acc[category] = [setting]
                  } else {
                    list.push(setting)
                  }
                  return acc
                },
                {} as Record<string, typeof settings | undefined>,
              ),
            ).map(([category, items]) => {
              if (!items) return null
              return (
                <TabsContent key={category} value={category}>
                  <Card>
                    <CardHeader>
                      <CardTitle>{category}</CardTitle>
                      <CardDescription>
                        {category === '通用设置' ? '修改后请点击保存' : ''}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {items.map((setting, index) => (
                        <div key={setting.Key} className="grid gap-2">
                          <Label className="text-base font-semibold select-text">
                            {setting.Desc || setting.Key}
                            {setting.Sensitive ? (
                              <span className="text-xs text-muted-foreground font-normal">
                                （敏感信息不会返回至前端）
                              </span>
                            ) : null}
                          </Label>

                          {/* Simple heuristic for boolean-like values */}
                          {setting.Value === 'true' ||
                          setting.Value === 'false' ? (
                            <Select
                              value={setting.Value}
                              onValueChange={(val) =>
                                handleChange(setting.Key, val)
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="true">
                                  开启 (True)
                                </SelectItem>
                                <SelectItem value="false">
                                  关闭 (False)
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              type={setting.Sensitive ? 'password' : 'text'}
                              placeholder={
                                setting.Sensitive
                                  ? setting.Placeholder || SENSITIVE_PLACEHOLDER
                                  : undefined
                              }
                              autoComplete={
                                setting.Sensitive ? 'new-password' : undefined
                              }
                              value={setting.Value}
                              onChange={(e) =>
                                handleChange(setting.Key, e.target.value)
                              }
                            />
                          )}
                          <p className="text-[10px] text-muted-foreground font-mono">
                            Key: {setting.Key}
                          </p>
                          {index < items.length - 1 && (
                            <Separator className="my-2" />
                          )}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </TabsContent>
              )
            })}
            <TabsContent value="email_test">
              <Card>
                <CardHeader>
                  <CardTitle>邮件发送测试</CardTitle>
                  <CardDescription>
                    发送一封测试邮件以验证 SMTP 配置是否正确
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4 max-w-md items-end">
                    <div className="grid w-full gap-2">
                      <Label htmlFor="test-email">收信人邮箱</Label>
                      <Input
                        id="test-email"
                        placeholder="recipient@example.com"
                        value={testEmail}
                        onChange={(e) => setTestEmail(e.target.value)}
                        type="email"
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={handleTestEmail}
                      disabled={sendingTest}
                    >
                      {sendingTest ? (
                        '发送中...'
                      ) : (
                        <>
                          <Send className="mr-2 h-4 w-4" />
                          发送
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="captcha_test">
              <CaptchaTestPanel />
            </TabsContent>
          </Tabs>

          <Button type="submit" className="w-full sm:w-auto">
            <Save className="mr-2 h-4 w-4" />
            保存更改
          </Button>
        </form>
      )}
    </motion.div>
  )
}
