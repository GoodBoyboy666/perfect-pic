import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Check,
  KeyRound,
  Lock,
  Mail,
  Pencil,
  Trash2,
  Upload,
  User,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { motion } from 'motion/react'
import { fetchClient } from '../../../lib/api'
import { runPasskeyRegistration } from '../../../lib/passkey'
import { useAuth } from '../../../context/AuthContext'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../components/ui/card'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '../../../components/ui/avatar'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../../../components/ui/alert-dialog'
import { Separator } from '../../../components/ui/separator'

export const Route = createFileRoute('/_user/dashboard/profile')({
  component: ProfileComponent,
})

interface PasskeyItem {
  id: string
  credentialId: string
  name: string
  createdAtUnix: number | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function unwrapResponseData(payload: unknown): Record<string, unknown> | null {
  if (!isRecord(payload)) return null
  if (isRecord(payload.data)) return payload.data
  return payload
}

function parsePasskeyRegisterStartPayload(payload: unknown) {
  const candidate = unwrapResponseData(payload)
  if (!candidate) {
    throw new Error('Passkey 初始化失败')
  }

  const sessionIdRaw = candidate.session_id ?? candidate.sessionId
  const creationOptionsRaw =
    candidate.creation_options ?? candidate.creationOptions

  if (typeof sessionIdRaw !== 'string' || sessionIdRaw.trim() === '') {
    throw new Error('Passkey 会话无效')
  }
  if (creationOptionsRaw === null || creationOptionsRaw === undefined) {
    throw new Error('Passkey challenge 无效')
  }

  return {
    sessionId: sessionIdRaw,
    creationOptions: creationOptionsRaw,
  }
}

function parsePasskeyList(payload: unknown): Array<PasskeyItem> {
  const candidate = unwrapResponseData(payload)
  if (!candidate || !Array.isArray(candidate.list)) return []

  const parsed: Array<PasskeyItem> = []
  for (const item of candidate.list) {
    if (!isRecord(item)) continue

    const idRaw = item.ID ?? item.id
    if (typeof idRaw !== 'number' && typeof idRaw !== 'string') continue

    const credentialIdRaw =
      item.CredentialID ?? item.credential_id ?? item.credentialId
    const nameRaw = item.name ?? item.Name
    const createdAtRaw = item.created_at ?? item.createdAt ?? item.CreatedAt

    const createdAtNumber =
      typeof createdAtRaw === 'number'
        ? createdAtRaw
        : typeof createdAtRaw === 'string' && createdAtRaw.trim() !== ''
          ? Number(createdAtRaw)
          : Number.NaN

    parsed.push({
      id: String(idRaw),
      credentialId: typeof credentialIdRaw === 'string' ? credentialIdRaw : '',
      name: typeof nameRaw === 'string' ? nameRaw : '',
      createdAtUnix: Number.isFinite(createdAtNumber) ? createdAtNumber : null,
    })
  }

  return parsed
}

function formatDateTimeFromUnix(value: number | null): string {
  if (value === null) return '-'
  const timeMs = value > 1_000_000_000_000 ? value : value * 1000
  const date = new Date(timeMs)
  if (Number.isNaN(date.getTime())) return String(value)

  return date.toLocaleString('zh-CN', { hour12: false })
}

function maskCredentialId(value: string): string {
  if (!value) return '-'
  if (value.length <= 20) return value
  return `${value.slice(0, 12)}...${value.slice(-8)}`
}

function ProfileComponent() {
  const { user, refreshUser } = useAuth()
  const [username, setUsername] = useState(user?.username || '')
  const [email, setEmail] = useState(user?.email || '')
  const [emailPassword, setEmailPassword] = useState('')
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passkeys, setPasskeys] = useState<Array<PasskeyItem>>([])
  const [passkeysLoading, setPasskeysLoading] = useState(false)
  const [isRegisteringPasskey, setIsRegisteringPasskey] = useState(false)
  const [deletingPasskeyId, setDeletingPasskeyId] = useState<string | null>(
    null,
  )
  const [editingPasskeyId, setEditingPasskeyId] = useState<string | null>(null)
  const [editingPasskeyName, setEditingPasskeyName] = useState('')
  const [renamingPasskeyId, setRenamingPasskeyId] = useState<string | null>(
    null,
  )
  const [confirmDeletePasskeyId, setConfirmDeletePasskeyId] = useState<
    string | null
  >(null)
  const [avatarPrefix, setAvatarPrefix] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadPasskeys = useCallback(async () => {
    setPasskeysLoading(true)
    try {
      const res = await fetchClient('/api/user/passkeys')
      setPasskeys(parsePasskeyList(res))
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : '获取 Passkey 列表失败'
      toast.error(message)
    } finally {
      setPasskeysLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user) {
      setUsername(user.username || '')
      setEmail(user.email || '')
    }
  }, [user])

  useEffect(() => {
    fetchClient('/api/avatar_prefix')
      .then((res: any) => setAvatarPrefix(res.avatar_prefix))
      .catch(() => {})
  }, [])

  useEffect(() => {
    void loadPasskeys()
  }, [loadPasskeys])

  const getAvatarUrl = () => {
    if (!user?.avatar || avatarPrefix === null) return null
    return `${avatarPrefix}${user.id}/${user.avatar}`
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return

    const file = e.target.files[0]
    const formData = new FormData()
    formData.append('file', file)

    try {
      await fetchClient('/api/user/avatar', {
        method: 'PATCH',
        body: formData,
      })
      await refreshUser()
      toast.success('头像上传成功')
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (error: any) {
      toast.error(error.message || '上传失败')
    }
  }

  const handleUpdateUsername = async () => {
    try {
      await fetchClient('/api/user/username', {
        method: 'PATCH',
        body: { username },
      })
      await refreshUser()
      toast.success('用户名修改成功')
    } catch (e: any) {
      toast.error(e.message || '修改失败')
    }
  }

  const handleUpdateEmail = async () => {
    try {
      const res: any = await fetchClient('/api/user/email', {
        method: 'POST',
        body: {
          new_email: email,
          password: emailPassword,
        },
      })
      await refreshUser()
      setEmailPassword('')
      toast.success(res.message || '邮箱修改成功')
    } catch (e: any) {
      toast.error(e.message || '修改失败')
    }
  }

  const handleUpdatePassword = async () => {
    try {
      await fetchClient('/api/user/password', {
        method: 'PATCH',
        body: {
          old_password: oldPassword,
          new_password: newPassword,
        },
      })
      setOldPassword('')
      setNewPassword('')
      toast.success('密码修改成功')
    } catch (e: any) {
      toast.error(e.message || '修改失败')
    }
  }

  const handleRegisterPasskey = async () => {
    setIsRegisteringPasskey(true)
    try {
      const startRes = await fetchClient('/api/user/passkeys/register/start', {
        method: 'POST',
      })
      const { sessionId, creationOptions } =
        parsePasskeyRegisterStartPayload(startRes)
      const credential = await runPasskeyRegistration(creationOptions)

      await fetchClient('/api/user/passkeys/register/finish', {
        method: 'POST',
        body: {
          session_id: sessionId,
          credential,
        },
      })

      toast.success('Passkey 添加成功')
      await loadPasskeys()
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Passkey 添加失败'
      toast.error(message)
    } finally {
      setIsRegisteringPasskey(false)
    }
  }

  const handleDeletePasskey = async (id: string) => {
    setDeletingPasskeyId(id)
    try {
      await fetchClient(`/api/user/passkeys/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      toast.success('Passkey 删除成功')
      setConfirmDeletePasskeyId(null)
      await loadPasskeys()
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Passkey 删除失败'
      toast.error(message)
    } finally {
      setDeletingPasskeyId(null)
    }
  }

  const beginRenamePasskey = (passkey: PasskeyItem) => {
    setEditingPasskeyId(passkey.id)
    setEditingPasskeyName(passkey.name)
  }

  const cancelRenamePasskey = () => {
    setEditingPasskeyId(null)
    setEditingPasskeyName('')
  }

  const handleRenamePasskey = async (id: string) => {
    const normalizedName = editingPasskeyName.trim()
    if (normalizedName.length > 64) {
      toast.error('Passkey 名称最长 64 字符')
      return
    }

    setRenamingPasskeyId(id)
    try {
      await fetchClient(`/api/user/passkeys/${encodeURIComponent(id)}/name`, {
        method: 'PATCH',
        body: {
          name: normalizedName,
        },
      })
      toast.success('Passkey 名称修改成功')
      setEditingPasskeyId(null)
      setEditingPasskeyName('')
      await loadPasskeys()
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Passkey 名称修改失败'
      toast.error(message)
    } finally {
      setRenamingPasskeyId(null)
    }
  }

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
        className="space-y-0.5"
      >
        <h2 className="text-2xl font-bold tracking-tight">编辑资料</h2>
        <p className="text-muted-foreground">管理您的个人信息和账户安全设置</p>
      </motion.div>
      <Separator className="my-6" />

      <div className="max-w-4xl mx-auto w-full space-y-6">
        {/* Avatar Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>修改头像</CardTitle>
              <CardDescription>
                点击上传新头像，支持 JPG, PNG, GIF
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-6">
              <Avatar
                className="h-24 w-24 border cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => fileInputRef.current?.click()}
              >
                {getAvatarUrl() ? (
                  <AvatarImage src={getAvatarUrl()!} className="object-cover" />
                ) : null}
                <AvatarFallback className="text-2xl font-bold">
                  {user?.username.slice(0, 2).toUpperCase() || 'USER'}
                </AvatarFallback>
              </Avatar>

              <div className="flex flex-col gap-3">
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handleAvatarChange}
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  选择图片
                </Button>
                <p className="text-xs text-muted-foreground">
                  建议尺寸 200x200 像素
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Username Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>基本信息</CardTitle>
              <CardDescription>更新您的公开用户名</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">用户名</Label>
                <div className="flex gap-4">
                  <div className="relative flex-1">
                    <User className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Button onClick={handleUpdateUsername}>更新</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Email Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>邮箱设置</CardTitle>
              <CardDescription>绑定或修改您的邮箱地址</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">邮箱地址</Label>
                <div className="relative">
                  <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9"
                    placeholder="name@example.com"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email-password">确认密码</Label>
                <div className="relative">
                  <Lock className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email-password"
                    type="password"
                    placeholder="输入当前密码以确认修改"
                    value={emailPassword}
                    onChange={(e) => setEmailPassword(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <Button onClick={handleUpdateEmail}>更新邮箱</Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Password Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>安全设置</CardTitle>
              <CardDescription>修改您的登录密码</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="old-pass">旧密码</Label>
                <div className="relative">
                  <Lock className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="old-pass"
                    type="password"
                    placeholder="••••••"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-pass">新密码</Label>
                <div className="relative">
                  <Lock className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="new-pass"
                    type="password"
                    placeholder="••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="pt-2">
                <Button onClick={handleUpdatePassword}>修改密码</Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Passkey Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Passkey 设置</CardTitle>
              <CardDescription>
                绑定设备生物识别或安全密钥，用于无密码登录
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  已绑定 {passkeys.length} 个 Passkey
                </p>
                <Button
                  onClick={handleRegisterPasskey}
                  disabled={
                    isRegisteringPasskey ||
                    deletingPasskeyId !== null ||
                    renamingPasskeyId !== null
                  }
                >
                  <KeyRound className="mr-2 h-4 w-4" />
                  {isRegisteringPasskey ? '添加中...' : '添加 Passkey'}
                </Button>
              </div>

              {passkeysLoading ? (
                <p className="text-sm text-muted-foreground">
                  正在加载 Passkey...
                </p>
              ) : passkeys.length === 0 ? (
                <p className="text-sm text-muted-foreground">暂无 Passkey</p>
              ) : (
                <div className="space-y-3">
                  {passkeys.map((passkey) => {
                    const isDeleting = deletingPasskeyId === passkey.id
                    const isEditing = editingPasskeyId === passkey.id
                    const isRenaming = renamingPasskeyId === passkey.id
                    return (
                      <div
                        key={passkey.id}
                        className="rounded-md border p-3 flex items-start justify-between gap-3"
                      >
                        <div className="min-w-0 space-y-1">
                          <p className="text-sm font-medium break-all">
                            名称: {passkey.name || '(未命名)'}
                          </p>
                          <p className="text-xs text-muted-foreground break-all">
                            Credential: {maskCredentialId(passkey.credentialId)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            创建时间:{' '}
                            {formatDateTimeFromUnix(passkey.createdAtUnix)}
                          </p>
                          {isEditing && (
                            <div className="pt-2 space-y-2 max-w-sm">
                              <Input
                                value={editingPasskeyName}
                                onChange={(e) =>
                                  setEditingPasskeyName(
                                    e.target.value.slice(0, 64),
                                  )
                                }
                                maxLength={64}
                                placeholder="输入 Passkey 名称"
                                disabled={isRenaming}
                              />
                              <p className="text-xs text-muted-foreground">
                                {editingPasskeyName.length}/64
                              </p>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-2 shrink-0">
                          {isEditing ? (
                            <>
                              <Button
                                size="icon-sm"
                                variant="outline"
                                disabled={
                                  isRenaming ||
                                  isDeleting ||
                                  isRegisteringPasskey
                                }
                                onClick={() => handleRenamePasskey(passkey.id)}
                                aria-label="保存 Passkey 名称"
                                title="保存名称"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon-sm"
                                disabled={isRenaming || isDeleting}
                                onClick={cancelRenamePasskey}
                                aria-label="取消重命名"
                                title="取消"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="outline"
                              size="icon-sm"
                              disabled={
                                deletingPasskeyId !== null ||
                                renamingPasskeyId !== null ||
                                isRegisteringPasskey
                              }
                              onClick={() => beginRenamePasskey(passkey)}
                              aria-label="重命名 Passkey"
                              title="重命名"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}

                          <AlertDialog
                            open={confirmDeletePasskeyId === passkey.id}
                            onOpenChange={(open) =>
                              setConfirmDeletePasskeyId(
                                open ? passkey.id : null,
                              )
                            }
                          >
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="destructive"
                                size="icon-sm"
                                disabled={
                                  isDeleting ||
                                  isRegisteringPasskey ||
                                  renamingPasskeyId !== null
                                }
                                aria-label="删除 Passkey"
                                title="删除"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent size="sm">
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  确认删除 Passkey？
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  删除后该设备将无法继续使用此 Passkey 登录。
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel disabled={isDeleting}>
                                  取消
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  variant="destructive"
                                  disabled={isDeleting}
                                  onClick={() =>
                                    handleDeletePasskey(passkey.id)
                                  }
                                >
                                  {isDeleting ? '删除中...' : '确认删除'}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  )
}
