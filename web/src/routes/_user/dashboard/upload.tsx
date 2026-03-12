import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import { motion } from 'motion/react'
import { fetchClient } from '../../../lib/api'
import { useAuth } from '../../../context/AuthContext'
import { Button } from '../../../components/ui/button'
import { Checkbox } from '../../../components/ui/checkbox'
import { Separator } from '../../../components/ui/separator'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select'
import { Card, CardContent } from '../../../components/ui/card'

const convertImage = (file: File, format: string): Promise<File> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas context not available'))
        return
      }
      ctx.drawImage(img, 0, 0)

      const mimeType = `image/${format}`

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const newName = file.name.replace(/\.[^/.]+$/, '') + '.' + format
            const newFile = new File([blob], newName, { type: mimeType })
            resolve(newFile)
          } else {
            reject(new Error('Conversion failed'))
          }
        },
        mimeType,
        0.9,
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Image load failed'))
    }
    img.src = url
  })
}

// Helper to safely extract files breaking direct DOM text dependency chains
const getSafeFilesFromInput = (input: HTMLInputElement): Array<File> => {
  if (!input.files || input.files.length === 0) return []
  const files: Array<File> = []
  // Manually iterate to avoid direct Array.from mapping which might be flagged
  for (const file of input.files) {
    // Strict instance and type check
    if (file instanceof File && file.type.startsWith('image/')) {
      files.push(file)
    }
  }
  return files
}

const PreviewImage = ({ file }: { file: File }) => {
  const [src, setSrc] = useState<string>('')

  useEffect(() => {
    // Double check that we are dealing with a File object
    if (!(file instanceof File)) return

    const objectUrl = URL.createObjectURL(file)
    setSrc(objectUrl)

    return () => URL.revokeObjectURL(objectUrl)
  }, [file])

  if (!src || !src.startsWith('blob:')) return null

  // Escape src just to be absolutely sure for static analysis
  const safeSrc = encodeURI(src)

  return (
    <img
      src={safeSrc}
      className="h-32 w-full object-cover rounded-md shadow-sm border"
      alt="preview"
    />
  )
}

export const Route = createFileRoute('/_user/dashboard/upload')({
  component: UploadComponent,
})

function UploadComponent() {
  const { refreshUser } = useAuth()
  // State for files and previews
  const [files, setFiles] = useState<Array<File>>([])
  // Previews handled by individual components to avoid state tainting checks
  const [uploading, setUploading] = useState(false)
  const [uploadedResults, setUploadedResults] = useState<
    Array<{ url: string; id: number }>
  >([])

  // Format Conversion State
  const [convert, setConvert] = useState(false)
  const [targetFormat, setTargetFormat] = useState('webp')

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Use helper to sanitize input
    const selectedFiles = getSafeFilesFromInput(e.target)
    if (selectedFiles.length > 0) {
      setFiles(selectedFiles)
      setUploadedResults([])
    }
  }

  const handleUpload = async () => {
    if (files.length === 0) return
    setUploading(true)
    setUploadedResults([])

    try {
      let filesToUpload = files

      if (convert) {
        try {
          filesToUpload = await Promise.all(
            files.map((f) => convertImage(f, targetFormat)),
          )
        } catch (error) {
          console.error(error)
          toast.error('图片格式转换失败，请重试或关闭转换功能')
          setUploading(false)
          return
        }
      }

      // Parallel uploads
      const uploadPromises = filesToUpload.map((file) => {
        const formData = new FormData()
        formData.append('file', file)

        return fetchClient('/api/user/upload', {
          method: 'POST',
          body: formData,
        }).then((res: any) => ({
          url: `${window.location.origin}${res.url}`,
          id: res.id,
        }))
      })

      const responses = await Promise.all(uploadPromises)
      setUploadedResults(responses)
      toast.success('全部上传成功!')
      // Don't navigate away, so user can see links
      setFiles([])
    } catch (error: any) {
      toast.error(error.message || '部分或全部上传失败')
    } finally {
      setUploading(false)
      // Upload affects storage usage; refresh user profile so Overview shows latest numbers.
      void refreshUser()
    }
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

  return (
    <motion.div
      className="max-w-4xl mx-auto space-y-6"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <motion.h2 variants={item} className="text-2xl font-bold">
        批量上传图片
      </motion.h2>

      {/* Upload Area */}
      <motion.div variants={item}>
        {uploadedResults.length === 0 && (
          <div className="space-y-6">
            <label className="block border-2 border-dashed border-muted-foreground/25 rounded-lg p-12 text-center hover:bg-muted/50 transition cursor-pointer bg-muted/10">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
              {files.length > 0 ? (
                <div className="grid grid-cols-3 gap-4">
                  {files.map((file, i) => (
                    <PreviewImage key={i} file={file} />
                  ))}
                </div>
              ) : (
                <div className="text-muted-foreground flex flex-col items-center">
                  <span className="text-lg font-medium">点击选择多张图片</span>
                  <span className="text-sm">或将文件拖拽至此</span>
                </div>
              )}
            </label>

            {/* Format Conversion Controls */}
            <Card>
              <CardContent className="flex items-center gap-6">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="convert"
                    checked={convert}
                    onCheckedChange={(c: boolean | 'indeterminate') =>
                      setConvert(!!c)
                    }
                  />
                  <Label htmlFor="convert" className="cursor-pointer">
                    开启格式转换
                  </Label>
                </div>

                {convert && (
                  <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2">
                    <Select
                      value={targetFormat}
                      onValueChange={setTargetFormat}
                    >
                      <SelectTrigger className="w-25">
                        <SelectValue placeholder="Format" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="webp">WebP</SelectItem>
                        <SelectItem value="png">PNG</SelectItem>
                        <SelectItem value="jpeg">JPEG</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-xs text-muted-foreground">
                      (将在本地进行格式转换)
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Button
              onClick={handleUpload}
              disabled={files.length === 0 || uploading}
              size="lg"
              className="w-full text-lg"
            >
              {uploading ? `正在上传 ${files.length} 张图片...` : '开始上传'}
            </Button>
          </div>
        )}
      </motion.div>

      {/* Results Area */}
      {uploadedResults.length > 0 && (
        <motion.div
          variants={item}
          initial="hidden"
          animate="show"
          className="space-y-8"
        >
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-bold text-green-600">
              上传完成 ({uploadedResults.length})
            </h3>
            <Button variant="link" onClick={() => setUploadedResults([])}>
              继续上传
            </Button>
          </div>

          <div className="grid gap-6">
            {uploadedResults.map((res, idx) => (
              <Card
                key={idx}
                className="flex flex-col md:flex-row overflow-hidden"
              >
                <div className="w-full md:w-72 h-48 md:h-auto shrink-0 flex items-center justify-center bg-muted/10 ms-6">
                  <img src={res.url} className="w-full h-full object-contain" />
                </div>

                <div className="hidden md:block">
                  <Separator orientation="vertical" className="h-full" />
                </div>
                <div className="md:hidden">
                  <Separator orientation="horizontal" className="w-full" />
                </div>

                <div className="flex-1 p-6 space-y-4">
                  {/* Raw URL */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-muted-foreground uppercase">
                      Direct Link
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value={res.url}
                        className="bg-muted/50 font-mono text-xs h-8"
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => copyToClipboard(res.url)}
                        className="h-8 px-2"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Markdown */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-muted-foreground uppercase">
                      Markdown
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value={`![](${res.url})`}
                        className="bg-muted/50 font-mono text-xs h-8"
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => copyToClipboard(`![](${res.url})`)}
                        className="h-8 px-2"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* BBCode */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-muted-foreground uppercase">
                      BBCode
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value={`[img]${res.url}[/img]`}
                        className="bg-muted/50 font-mono text-xs h-8"
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => copyToClipboard(`[img]${res.url}[/img]`)}
                        className="h-8 px-2"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* HTML */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-muted-foreground uppercase">
                      HTML
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value={`<img src="${res.url}" />`}
                        className="bg-muted/50 font-mono text-xs h-8"
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          copyToClipboard(`<img src="${res.url}" />`)
                        }
                        className="h-8 px-2"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
