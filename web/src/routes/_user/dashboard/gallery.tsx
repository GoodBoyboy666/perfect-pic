import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, Copy, Search, Trash2 } from 'lucide-react'
import { motion } from 'motion/react'
import { fetchClient } from '../../../lib/api'
import { Button } from '../../../components/ui/button'
import { Checkbox } from '../../../components/ui/checkbox'
import { Input } from '../../../components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select'
import {
  Dialog,
  DialogContent,
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
import { Label } from '../../../components/ui/label'
import { Separator } from '@/components/ui/separator'

export const Route = createFileRoute('/_user/dashboard/gallery')({
  component: GalleryComponent,
})

interface Image {
  id: number
  filename: string
  path: string
  [key: string]: any
}

type MarqueeMode = 'replace' | 'add' | 'toggle'

function rectFromPoints(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): { left: number; top: number; right: number; bottom: number } {
  const left = Math.min(x1, x2)
  const right = Math.max(x1, x2)
  const top = Math.min(y1, y2)
  const bottom = Math.max(y1, y2)
  return { left, top, right, bottom }
}

function rectsIntersect(
  a: { left: number; top: number; right: number; bottom: number },
  b: { left: number; top: number; right: number; bottom: number },
) {
  return !(
    b.left > a.right ||
    b.right < a.left ||
    b.top > a.bottom ||
    b.bottom < a.top
  )
}

function GalleryComponent() {
  const [images, setImages] = useState<Array<Image>>([])
  const [loading, setLoading] = useState(true)
  const [imgPrefix, setImgPrefix] = useState('')
  const [selectedImage, setSelectedImage] = useState<Image | null>(null)

  // Pagination & Search
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)

  // Search Inputs
  const [filenameInput, setFilenameInput] = useState('')
  const [idInput, setIdInput] = useState('')

  // Active Filters (trigger reload)
  const [activeFilename, setActiveFilename] = useState('')
  const [activeId, setActiveId] = useState('')

  // Delete State
  const [itemToDelete, setItemToDelete] = useState<number | null>(null)

  // Batch Delete State
  const [selectedIds, setSelectedIds] = useState<Array<number>>([])
  const [showBatchDelete, setShowBatchDelete] = useState(false)

  const visibleIds = useMemo(() => images.map((img) => img.id), [images])
  const visibleIdSet = useMemo(() => new Set(visibleIds), [visibleIds])
  const visibleSelectedCount = useMemo(() => {
    if (visibleIds.length === 0 || selectedIds.length === 0) return 0
    let count = 0
    for (const id of visibleIds) {
      if (selectedIds.includes(id)) count++
    }
    return count
  }, [visibleIds, selectedIds])
  const allVisibleSelected =
    visibleIds.length > 0 && visibleSelectedCount === visibleIds.length

  const gridRef = useRef<HTMLDivElement | null>(null)
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const suppressOpenRef = useRef(false)
  const marqueeRef = useRef<{
    active: boolean
    dragging: boolean
    captured: boolean
    pointerId: number | null
    startX: number
    startY: number
    endX: number
    endY: number
    mode: MarqueeMode
    originSelected: Array<number>
  }>({
    active: false,
    dragging: false,
    captured: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0,
    mode: 'replace',
    originSelected: [],
  })
  const [marqueeBox, setMarqueeBox] = useState<{
    left: number
    top: number
    width: number
    height: number
    visible: boolean
  }>({ left: 0, top: 0, width: 0, height: 0, visible: false })

  // Load Prefix once
  useEffect(() => {
    fetchClient('/api/image_prefix')
      .then((res: any) => setImgPrefix(res.image_prefix || ''))
      .catch(() => {})
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: pageSize.toString(),
      })
      if (activeFilename) params.append('filename', activeFilename)
      if (activeId) params.append('id', activeId)

      const res: any = await fetchClient(
        `/api/user/images?${params.toString()}`,
      )

      const list = res.list || res.data || (Array.isArray(res) ? res : [])
      setImages(list)
      setTotal(res.total || 0)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [page, pageSize, activeFilename, activeId])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setActiveFilename(filenameInput)
    setActiveId(idInput)
    setPage(1)
  }

  const handleDelete = (e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    e.preventDefault()
    setItemToDelete(id)
  }

  const confirmDelete = async () => {
    if (!itemToDelete) return
    try {
      await fetchClient(`/api/user/images/${itemToDelete}`, {
        method: 'DELETE',
      })
      loadData()
      toast.success('删除成功')
    } catch (error: any) {
      toast.error(error.message || '删除失败')
    } finally {
      setItemToDelete(null)
    }
  }

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    )
  }

  const toggleSelectAllVisible = () => {
    if (visibleIds.length === 0) return
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allVisibleSelected) {
        for (const id of visibleIds) next.delete(id)
      } else {
        for (const id of visibleIds) next.add(id)
      }
      return Array.from(next)
    })
  }

  const clearSelection = () => setSelectedIds([])

  const handleBatchDeleteConfirm = async () => {
    if (selectedIds.length === 0) return
    try {
      await fetchClient('/api/user/images/batch', {
        method: 'DELETE',
        body: JSON.stringify({ ids: selectedIds }),
      })
      toast.success('批量删除成功')
      setSelectedIds([])
      setShowBatchDelete(false)
      loadData()
    } catch (error: any) {
      toast.error(error.message || '批量删除失败')
    }
  }

  const getFullUrl = (path: string) => {
    if (!path) return ''
    if (imgPrefix.startsWith('http')) {
      return `${imgPrefix}${path}`
    }
    return `${window.location.origin}${imgPrefix}${path}`
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success('已复制到剪贴板'))
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

  const computeIntersectedVisibleIds = (selection: {
    left: number
    top: number
    right: number
    bottom: number
  }) => {
    const intersected: Array<number> = []
    for (const [id, el] of itemRefs.current) {
      if (!visibleIdSet.has(id)) continue
      const r = el.getBoundingClientRect()
      const rect = {
        left: r.left,
        top: r.top,
        right: r.right,
        bottom: r.bottom,
      }
      if (rectsIntersect(selection, rect)) intersected.push(id)
    }
    return intersected
  }

  const applyMarqueeSelection = (
    intersected: Array<number>,
    mode: MarqueeMode,
    originSelected: Array<number>,
  ) => {
    const originSet = new Set(originSelected)
    const next = new Set(originSelected)

    if (mode === 'replace') {
      // Replace selection on the currently-visible page only (don't mutate off-page selection).
      for (const id of visibleIds) next.delete(id)
      for (const id of intersected) next.add(id)
      return Array.from(next)
    }

    if (mode === 'add') {
      for (const id of intersected) next.add(id)
      return Array.from(next)
    }

    // toggle
    for (const id of intersected) {
      if (originSet.has(id)) next.delete(id)
      else next.add(id)
    }
    return Array.from(next)
  }

  const handleMarqueePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return

    const target = e.target as HTMLElement | null
    if (
      target?.closest(
        '[data-marquee-ignore],button,a,input,textarea,select,label,[role="checkbox"]',
      )
    ) {
      return
    }

    const grid = gridRef.current
    if (!grid) return

    const mode: MarqueeMode =
      e.ctrlKey || e.metaKey ? 'toggle' : e.shiftKey ? 'add' : 'replace'

    marqueeRef.current.active = true
    marqueeRef.current.dragging = false
    marqueeRef.current.pointerId = e.pointerId
    marqueeRef.current.startX = e.clientX
    marqueeRef.current.startY = e.clientY
    marqueeRef.current.endX = e.clientX
    marqueeRef.current.endY = e.clientY
    marqueeRef.current.mode = mode
    marqueeRef.current.originSelected = selectedIds

    setMarqueeBox({ left: 0, top: 0, width: 0, height: 0, visible: false })
  }

  const handleMarqueePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const state = marqueeRef.current
    if (!state.active || state.pointerId !== e.pointerId) return

    const grid = gridRef.current
    if (!grid) return

    state.endX = e.clientX
    state.endY = e.clientY

    const dx = Math.abs(state.endX - state.startX)
    const dy = Math.abs(state.endY - state.startY)
    if (!state.dragging && dx + dy >= 8) {
      state.dragging = true
      // Only capture once we actually start marquee-dragging; otherwise normal click-to-preview breaks.
      if (!state.captured) {
        try {
          grid.setPointerCapture(e.pointerId)
          state.captured = true
        } catch {
          // ignore
        }
      }
      // Prevent native selection/drag behavior during marquee.
      e.preventDefault()
    }

    if (!state.dragging) return

    const gridRect = grid.getBoundingClientRect()
    const sel = rectFromPoints(
      state.startX,
      state.startY,
      state.endX,
      state.endY,
    )

    const left = sel.left - gridRect.left
    const top = sel.top - gridRect.top
    const width = sel.right - sel.left
    const height = sel.bottom - sel.top

    setMarqueeBox({ left, top, width, height, visible: true })

    const intersected = computeIntersectedVisibleIds(sel)
    const nextSelected = applyMarqueeSelection(
      intersected,
      state.mode,
      state.originSelected,
    )
    setSelectedIds(nextSelected)
  }

  const handleMarqueePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const state = marqueeRef.current
    if (!state.active || state.pointerId !== e.pointerId) return

    const grid = gridRef.current
    if (grid && state.captured) {
      try {
        grid.releasePointerCapture(e.pointerId)
      } catch {
        // ignore
      }
    }

    if (state.dragging) {
      suppressOpenRef.current = true
      setTimeout(() => {
        suppressOpenRef.current = false
      }, 0)
    }

    marqueeRef.current.active = false
    marqueeRef.current.dragging = false
    marqueeRef.current.captured = false
    marqueeRef.current.pointerId = null
    setMarqueeBox((prev) => ({ ...prev, visible: false }))
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
          <h2 className="text-3xl font-bold tracking-tight">我的画廊</h2>
          <p className="text-muted-foreground">查看和管理您上传的所有图片</p>
        </div>

        <div className="flex gap-2 items-center">
          {!loading && images.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={toggleSelectAllVisible}
              title={
                allVisibleSelected ? '取消选择当前页' : '全选当前页显示的图片'
              }
            >
              {allVisibleSelected ? '取消本页' : '全选本页'}
              <span className="ml-2 text-xs text-muted-foreground">
                {visibleSelectedCount}/{visibleIds.length}
              </span>
            </Button>
          )}
          {selectedIds.length > 0 && (
            <Button variant="outline" size="sm" onClick={clearSelection}>
              清空选择
            </Button>
          )}
          {selectedIds.length > 0 && (
            <Button
              variant="destructive"
              onClick={() => setShowBatchDelete(true)}
              size="sm"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              删除选中 ({selectedIds.length})
            </Button>
          )}
          <form
            onSubmit={handleSearch}
            className="flex flex-wrap gap-2 items-center w-full md:w-auto"
          >
            <Input
              type="text"
              placeholder="ID"
              value={idInput}
              onChange={(e) => setIdInput(e.target.value)}
              className="w-24"
            />
            <Input
              type="text"
              placeholder="文件名..."
              value={filenameInput}
              onChange={(e) => setFilenameInput(e.target.value)}
              className="w-48"
            />
            <Button type="submit">
              <Search className="mr-2 h-4 w-4" />
              搜索
            </Button>
          </form>
        </div>
      </motion.div>

      <motion.div variants={item}>
        <Separator className="my-6" />
      </motion.div>

      <motion.div variants={item}>
        {loading ? (
          <div className="text-center py-20 text-muted-foreground">
            加载中...
          </div>
        ) : images.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed rounded-lg">
            <p className="text-muted-foreground">未找到图片</p>
          </div>
        ) : (
          <div
            ref={gridRef}
            className="relative select-none"
            onPointerDown={handleMarqueePointerDown}
            onPointerMove={handleMarqueePointerMove}
            onPointerUp={handleMarqueePointerUp}
            onPointerCancel={handleMarqueePointerUp}
          >
            {marqueeBox.visible && (
              <div
                className="pointer-events-none absolute z-30 rounded border border-primary/60 bg-primary/10"
                style={{
                  left: marqueeBox.left,
                  top: marqueeBox.top,
                  width: marqueeBox.width,
                  height: marqueeBox.height,
                }}
              />
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {/* Image Grid Items */}
              {images.map((img) => (
                <motion.div
                  ref={(el) => {
                    if (el) itemRefs.current.set(img.id, el)
                    else itemRefs.current.delete(img.id)
                  }}
                  layoutId={`img-${img.id}`}
                  whileHover={{ scale: 1.02 }}
                  key={img.id}
                  className={`group relative aspect-square bg-muted/30 rounded-lg overflow-hidden border transition-all cursor-pointer ${
                    selectedIds.includes(img.id)
                      ? 'border-primary ring-2 ring-primary ring-offset-2'
                      : 'hover:border-primary/50'
                  }`}
                  onClick={() => {
                    if (suppressOpenRef.current) return
                    setSelectedImage(img)
                  }}
                >
                  <div
                    className="absolute top-2 left-2 z-20"
                    data-marquee-ignore
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={selectedIds.includes(img.id)}
                      onCheckedChange={() => toggleSelect(img.id)}
                      className="bg-white/80 backdrop-blur-sm data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                    />
                  </div>

                  <img
                    src={`${imgPrefix}${img.path}`}
                    alt={img.filename}
                    className="w-full h-full object-contain p-2 transition-transform group-hover:scale-105"
                    loading="lazy"
                    draggable={false}
                    onDragStart={(e) => e.preventDefault()}
                  />

                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                    <div className="text-white text-xs font-medium truncate mb-1">
                      {img.filename}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/80 text-[10px]">
                        ID: {img.id}
                      </span>
                      <Button
                        data-marquee-ignore
                        size="icon"
                        variant="destructive"
                        className="h-6 w-6"
                        onClick={(e) => handleDelete(e, img.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </motion.div>

      {/* Pagination */}
      <motion.div
        variants={item}
        className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t"
      >
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>每页显示</span>
          <Select
            value={pageSize.toString()}
            onValueChange={(v) => {
              setPageSize(Number(v))
              setPage(1)
            }}
          >
            <SelectTrigger className="w-25 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10条</SelectItem>
              <SelectItem value="20">20条</SelectItem>
              <SelectItem value="50">50条</SelectItem>
            </SelectContent>
          </Select>
          <span>
            {images.length > 0 ? (page - 1) * pageSize + 1 : 0} -{' '}
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
          <span className="text-sm font-medium">第 {page} 页</span>
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
      </motion.div>

      {/* Detail Dialog */}
      <Dialog
        open={!!selectedImage}
        onOpenChange={(open: boolean) => !open && setSelectedImage(null)}
      >
        <DialogContent className="sm:max-w-5xl w-full h-[80vh] p-0 overflow-hidden block">
          <DialogTitle className="sr-only">图片详情</DialogTitle>
          {selectedImage && (
            <div className="flex flex-col md:flex-row h-full w-full">
              {/* Left: Image */}
              <div className="flex-1 bg-muted/30 flex items-center justify-center border-r overflow-hidden relative group h-full">
                <img
                  src={`${imgPrefix}${selectedImage.path}`}
                  alt={selectedImage.filename}
                  className="w-full h-full object-contain"
                />
              </div>

              {/* Right: Info */}
              <div className="w-full md:w-87.5 flex flex-col h-full bg-background">
                <div className="p-6 border-b">
                  <h3
                    className="text-lg font-bold truncate mb-1"
                    title={selectedImage.filename}
                  >
                    {selectedImage.filename}
                  </h3>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>ID: {selectedImage.id}</span>
                    <span>{(selectedImage.size / 1024).toFixed(1)} KB</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {new Date(
                      selectedImage.uploaded_at * 1000,
                    ).toLocaleString()}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Direct Link</Label>
                      <div className="flex gap-2">
                        <Input
                          readOnly
                          value={getFullUrl(selectedImage.path)}
                          className="font-mono text-xs h-8"
                        />
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8 shrink-0"
                          onClick={() =>
                            copyToClipboard(getFullUrl(selectedImage.path))
                          }
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Markdown</Label>
                      <div className="flex gap-2">
                        <Input
                          readOnly
                          value={`![${selectedImage.filename}](${getFullUrl(selectedImage.path)})`}
                          className="font-mono text-xs h-8"
                        />
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8 shrink-0"
                          onClick={() =>
                            copyToClipboard(
                              `![${selectedImage.filename}](${getFullUrl(selectedImage.path)})`,
                            )
                          }
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>HTML</Label>
                      <div className="flex gap-2">
                        <Input
                          readOnly
                          value={`<img src="${getFullUrl(selectedImage.path)}" alt="${selectedImage.filename}" />`}
                          className="font-mono text-xs h-8"
                        />
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8 shrink-0"
                          onClick={() =>
                            copyToClipboard(
                              `<img src="${getFullUrl(selectedImage.path)}" alt="${selectedImage.filename}" />`,
                            )
                          }
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>BBCode</Label>
                      <div className="flex gap-2">
                        <Input
                          readOnly
                          value={`[img]${getFullUrl(selectedImage.path)}[/img]`}
                          className="font-mono text-xs h-8"
                        />
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8 shrink-0"
                          onClick={() =>
                            copyToClipboard(
                              `[img]${getFullUrl(selectedImage.path)}[/img]`,
                            )
                          }
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 border-t mt-auto">
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={(e) => {
                      handleDelete(e, selectedImage.id)
                      setSelectedImage(null)
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    永久删除图片
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!itemToDelete}
        onOpenChange={(open) => !open && setItemToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除?</AlertDialogTitle>
            <AlertDialogDescription>
              此操作无法撤销。这将永久删除该图片。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={showBatchDelete} onOpenChange={setShowBatchDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认批量删除?</AlertDialogTitle>
            <AlertDialogDescription>
              您即将删除选中的 {selectedIds.length} 张图片。此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleBatchDeleteConfirm}
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  )
}
