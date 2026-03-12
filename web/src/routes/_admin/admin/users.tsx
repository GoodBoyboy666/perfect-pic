import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
} from 'lucide-react'
import { motion } from 'motion/react'
import { fetchClient } from '../../../lib/api'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Checkbox } from '../../../components/ui/checkbox'
import { Label } from '../../../components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../components/ui/alert-dialog'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '../../../components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { formatBytes } from '@/lib/utils'

export const Route = createFileRoute('/_admin/admin/users')({
  component: AdminUsersComponent,
})

function AdminUsersComponent() {
  const [users, setUsers] = useState<Array<any>>([])
  const [total, setTotal] = useState(0)

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [keyword, setKeyword] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [showDeleted, setShowDeleted] = useState(false)

  // Modal State
  const [showModal, setShowModal] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [currentId, setCurrentId] = useState<number | null>(null)
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    email_verified: false,
    password: '',
    avatar: '',
    status: 1,
    storage_quota: 0,
    use_system_quota: true,
  })
  const [originalData, setOriginalData] = useState<any>(null)

  // Avatar upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [removeAvatar, setRemoveAvatar] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [hardDelete, setHardDelete] = useState(false)
  const [avatarPrefix, setAvatarPrefix] = useState('')
  const [systemQuota, setSystemQuota] = useState(0)

  useEffect(() => {
    fetchClient('/api/avatar_prefix')
      .then((res: any) => setAvatarPrefix(res.avatar_prefix))
      .catch(() => {})
    fetchClient('/api/default_storage_quota')
      .then((res: any) => setSystemQuota(res.default_storage_quota || 0))
      .catch(() => {})
  }, [])

  const loadUsers = async () => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: pageSize.toString(),
        keyword,
        show_deleted: showDeleted.toString(),
        order: 'asc',
      })
      const res: any = await fetchClient(
        `/api/admin/users?${params.toString()}`,
      )
      setUsers(res.data || [])
      setTotal(res.total || 0)
    } catch (error: any) {
      toast.error(error.message || '加载用户失败')
    }
  }

  useEffect(() => {
    loadUsers()
  }, [page, pageSize, keyword, showDeleted])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    setKeyword(searchInput)
  }

  // Action Handlers
  const handleCreateOpen = () => {
    setModalMode('create')
    setFormData({
      username: '',
      email: '',
      email_verified: false,
      password: '',
      avatar: '',
      status: 1,
      storage_quota: 0,
      use_system_quota: true,
    })
    setSelectedFile(null)
    setRemoveAvatar(false)
    setPreviewUrl(null)
    setShowModal(true)
  }

  const handleEditOpen = (user: any) => {
    setModalMode('edit')
    setCurrentId(user.id)
    setFormData({
      username: user.username,
      email: user.email || '',
      email_verified: user.email_verified || false,
      password: '',
      avatar: user.avatar || '',
      status: user.status || 1,
      storage_quota: user.storage_quota || 0,
      use_system_quota: user.storage_quota === null,
    })
    setSelectedFile(null)
    setRemoveAvatar(false)
    setPreviewUrl(null)
    setOriginalData(user)
    setShowModal(true)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setRemoveAvatar(false)
      // Create preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (modalMode === 'create') {
        const payload: any = { ...formData }
        if (formData.use_system_quota) {
          payload.storage_quota = null
        }
        delete payload.use_system_quota

        await fetchClient('/api/admin/users', {
          method: 'POST',
          body: payload,
        })
        toast.success('用户创建成功')
      } else {
        // 1. Handle regular field updates
        const payload: any = {}
        if (formData.username !== originalData.username)
          payload.username = formData.username
        if (formData.email !== originalData.email)
          payload.email = formData.email
        if (formData.email_verified !== originalData.email_verified)
          payload.email_verified = formData.email_verified
        if (formData.password) payload.password = formData.password
        if (formData.status !== originalData.status)
          payload.status = formData.status

        // Handle storage_quota update logic
        const originalQuota = originalData.storage_quota
        const newQuota = formData.use_system_quota ? -1 : formData.storage_quota

        // Check if we need to update quota
        // Only update if:
        // 1. Quota changed from custom to system (system is -1 in payload)
        // 2. Quota changed from system (null) to custom
        // 3. Custom quota value changed

        let shouldUpdateQuota = false
        if (formData.use_system_quota) {
          // If we want system quota, and current is not system (null), we need update (-1)
          if (originalQuota !== null) shouldUpdateQuota = true
        } else {
          // If we want custom quota, check if it's diff from original
          if (newQuota !== originalQuota) shouldUpdateQuota = true
        }

        if (shouldUpdateQuota) {
          payload.storage_quota = newQuota
        }

        // Note: We don't update 'avatar' string via PATCH anymore, we use the specific endpoints below

        if (Object.keys(payload).length > 0) {
          await fetchClient(`/api/admin/users/${currentId}`, {
            method: 'PATCH',
            body: payload,
          })
        }

        // 2. Handle Avatar updates
        if (removeAvatar) {
          await fetchClient(`/api/admin/users/${currentId}/avatar`, {
            method: 'DELETE',
          })
        } else if (selectedFile) {
          const fd = new FormData()
          fd.append('file', selectedFile)
          await fetchClient(`/api/admin/users/${currentId}/avatar`, {
            method: 'POST',
            body: fd,
          })
        }

        toast.success('用户更新成功')
      }
      setShowModal(false)
      loadUsers()
    } catch (error: any) {
      toast.error(error.message || '操作失败')
    }
  }

  const handleDeleteClick = (user: any) => {
    setDeleteTarget(user)
    setHardDelete(false)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await fetchClient(
        `/api/admin/users/${deleteTarget.id}?hard_delete=${hardDelete}`,
        { method: 'DELETE' },
      )
      setDeleteTarget(null)
      loadUsers()
    } catch (error: any) {
      toast.error(error.message || '删除失败')
    }
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
      <motion.div
        variants={item}
        className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
      >
        <div>
          <h2 className="text-3xl font-bold tracking-tight">用户管理</h2>
          <p className="text-muted-foreground">管理系统注册用户及权限</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
          <Button onClick={handleCreateOpen} className="shrink-0">
            <Plus className="mr-2 h-4 w-4" />
            新增用户
          </Button>
          <form
            onSubmit={handleSearch}
            className="flex gap-2 items-center w-full md:w-auto"
          >
            <div className="flex items-center gap-2 mr-2">
              <Checkbox
                id="showDeleted"
                checked={showDeleted}
                onCheckedChange={(c) => setShowDeleted(!!c)}
              />
              <Label
                htmlFor="showDeleted"
                className="cursor-pointer whitespace-nowrap"
              >
                显示已删除
              </Label>
            </div>
            <div className="flex gap-2 w-full">
              <Input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="搜索用户..."
                className="w-full md:w-64"
              />
              <Button type="submit" variant="secondary">
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </div>
      </motion.div>
      <Separator className="my-6" />
      <motion.div variants={item} className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">ID</TableHead>
              <TableHead>用户</TableHead>
              <TableHead>邮箱</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>存储使用</TableHead>
              <TableHead>角色</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.id}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      {u.avatar && (
                        <AvatarImage
                          src={`${avatarPrefix}${u.id}/${u.avatar}`}
                        />
                      )}
                      <AvatarFallback>
                        {u.username?.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="font-medium flex items-center gap-2">
                        {u.username}
                        {u.deleted_at && (
                          <Badge
                            variant="destructive"
                            className="text-[10px] px-1 py-0 h-4"
                          >
                            已删除
                          </Badge>
                        )}
                      </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="text-sm">{u.email || '-'}</span>
                    {u.email && (
                      <Badge
                        variant={u.email_verified ? 'default' : 'secondary'}
                        className={`w-fit text-[10px] px-1 py-0 h-4 mt-1 ${
                          u.email_verified
                            ? 'bg-green-100 text-green-700 hover:bg-green-100'
                            : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100'
                        }`}
                      >
                        {u.email_verified ? '已验证' : '未验证'}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {u.status === 2 ? (
                    <Badge variant="destructive">封禁</Badge>
                  ) : u.status === 3 ? (
                    <Badge
                      variant="secondary"
                      className="bg-gray-100 text-gray-500 hover:bg-gray-100"
                    >
                      已删除
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="bg-green-50 text-green-700 border-green-200"
                    >
                      正常
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    <span className="font-medium">
                      {formatBytes(u.storage_used || 0)}
                    </span>
                    <span className="text-muted-foreground mx-1">/</span>
                    <span className="text-muted-foreground">
                      {u.storage_quota === null ? (
                        <span title="系统默认配额">
                          {formatBytes(systemQuota)} (默认)
                        </span>
                      ) : (
                        formatBytes(u.storage_quota)
                      )}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  {u.admin ? (
                    <Badge
                      variant="default"
                      className="bg-green-600 hover:bg-green-700"
                    >
                      管理员
                    </Badge>
                  ) : (
                    <Badge variant="secondary">普通用户</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {!u.deleted_at ? (
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditOpen(u)}
                      >
                        <Pencil className="h-4 w-4 text-muted-foreground hover:text-primary" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteClick(u)}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm italic">
                      已归档
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {users.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-24 text-center text-muted-foreground"
                >
                  暂无用户数据
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-4 border-t">
          <div className="flex items-center gap-2 text-sm text-muted-foreground w-full sm:w-auto justify-between sm:justify-start">
            <div className="flex items-center gap-2">
              <span>每页</span>
              <Select
                value={pageSize.toString()}
                onValueChange={(v) => {
                  setPageSize(Number(v))
                  setPage(1)
                }}
              >
                <SelectTrigger className="w-16 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
              <span>条</span>
            </div>
            <span className="ml-2">
              {users.length > 0 ? (page - 1) * pageSize + 1 : 0} -{' '}
              {Math.min(page * pageSize, total)} 共 {total} 条
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              上一页
            </Button>
            <div className="text-sm font-medium w-16 text-center">
              第 {page} 页
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={page * pageSize >= total}
              onClick={() => setPage((p) => p + 1)}
            >
              下一页
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Edit/Create Dialog */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-106.25">
          <DialogHeader>
            <DialogTitle>
              {modalMode === 'create' ? '新增用户' : '编辑用户'}
            </DialogTitle>
            <DialogDescription>
              {modalMode === 'create'
                ? '填写下方表单创建一个新用户账号'
                : '修改用户的个人信息'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="username">用户名</Label>
              <Input
                id="username"
                value={formData.username}
                onChange={(e) =>
                  setFormData({ ...formData, username: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">邮箱</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="email_verified"
                checked={formData.email_verified}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, email_verified: !!checked })
                }
              />
              <Label htmlFor="email_verified">邮箱已验证</Label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">
                密码{' '}
                {modalMode === 'edit' && (
                  <span className="text-muted-foreground text-xs font-normal">
                    (留空不修改)
                  </span>
                )}
              </Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                required={modalMode === 'create'}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">状态</Label>
              <Select
                value={formData.status.toString()}
                onValueChange={(v) =>
                  setFormData({ ...formData, status: parseInt(v) })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">正常</SelectItem>
                  <SelectItem value="2">封禁</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 border p-3 rounded-md">
              <div className="flex items-center justify-between mb-2">
                <Label>存储配额</Label>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="use_system_quota"
                    checked={formData.use_system_quota}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, use_system_quota: !!checked })
                    }
                  />
                  <Label
                    htmlFor="use_system_quota"
                    className="font-normal text-xs cursor-pointer"
                  >
                    使用系统默认
                  </Label>
                </div>
              </div>

              {formData.use_system_quota ? (
                <div className="text-sm text-muted-foreground bg-muted p-2 rounded">
                  当前系统默认: {formatBytes(systemQuota)}
                </div>
              ) : (
                <div className="space-y-2">
                  <Input
                    id="storage_quota"
                    type="number"
                    value={formData.storage_quota}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        storage_quota: parseInt(e.target.value) || 0,
                      })
                    }
                    placeholder="输入配额 (Bytes)"
                  />
                  <p className="text-xs text-muted-foreground">
                    自定义配额: {formatBytes(formData.storage_quota || 0)}
                  </p>
                </div>
              )}
            </div>
            {modalMode === 'edit' && (
              <div className="space-y-3">
                <Label>头像设置</Label>
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16 border">
                    {previewUrl ? (
                      <AvatarImage
                        src={previewUrl || undefined}
                        className="object-cover"
                      />
                    ) : !removeAvatar && formData.avatar ? (
                      <AvatarImage
                        src={`${avatarPrefix}${currentId}/${formData.avatar}`}
                        className="object-cover"
                      />
                    ) : null}
                    <AvatarFallback>
                      {formData.username.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          document.getElementById('avatar-upload')?.click()
                        }
                      >
                        <Upload className="h-3 w-3 mr-2" />
                        更换头像
                      </Button>
                      <Input
                        id="avatar-upload"
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={handleFileChange}
                      />
                    </div>
                    {(formData.avatar || previewUrl) && !removeAvatar && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 justify-start px-2 text-destructive hover:text-destructive"
                        onClick={() => {
                          setRemoveAvatar(true)
                          setSelectedFile(null)
                          setPreviewUrl(null)
                        }}
                      >
                        <Trash2 className="h-3 w-3 mr-2" />
                        移除头像
                      </Button>
                    )}
                    {removeAvatar && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 justify-start px-2 text-muted-foreground"
                        onClick={() => setRemoveAvatar(false)}
                      >
                        撤销移除
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowModal(false)}
              >
                取消
              </Button>
              <Button type="submit">保存</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              确认删除?
            </AlertDialogTitle>
            <AlertDialogDescription>
              您确定要删除用户{' '}
              <span className="font-bold text-foreground">
                {deleteTarget?.username}
              </span>{' '}
              吗? 此操作可能有后续影响。
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="flex items-center space-x-2 py-4">
            <Checkbox
              id="hardDelete"
              checked={hardDelete}
              onCheckedChange={(c) => setHardDelete(!!c)}
              className="data-[state=checked]:bg-destructive data-[state=checked]:border-destructive"
            />
            <Label
              htmlFor="hardDelete"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-destructive"
            >
              彻底删除 (Hard Delete) - 数据无法恢复
            </Label>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  )
}
