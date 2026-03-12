import * as React from 'react'

import { Input } from './ui/input'
import { Label } from './ui/label'
import type { CaptchaProvider, UseCaptchaResult } from '../hooks/use-captcha'

declare global {
  interface Window {
    turnstile?: any
    hcaptcha?: any
    grecaptcha?: any
    initGeetest4?: any
  }
}

function loadScriptOnce(src: string, id: string) {
  const existing = document.getElementById(id) as HTMLScriptElement | null
  if (existing) {
    if (existing.dataset.loaded === 'true') return Promise.resolve()
    return new Promise<void>((resolve, reject) => {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('load error')))
    })
  }

  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.id = id
    script.src = src
    script.async = true
    script.defer = true
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true'
      resolve()
    })
    script.addEventListener('error', () => reject(new Error('load error')))
    document.head.appendChild(script)
  })
}

function base64EncodeUtf8(input: string) {
  const bytes = new TextEncoder().encode(input)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

function CaptchaWidget({
  provider,
  siteKey,
  refreshIndex,
  onToken,
}: {
  provider: CaptchaProvider
  siteKey: string
  refreshIndex: number
  onToken: (token: string) => void
}) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const [loadError, setLoadError] = React.useState(false)

  React.useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.innerHTML = ''
    onToken('')
    setLoadError(false)

    let cancelled = false
    let cleanup: (() => void) | undefined

    const setCleanup = (fn: (() => void) | undefined) => {
      cleanup = fn
      if (cancelled) cleanup?.()
    }

    const run = async () => {
      try {
        if (provider === 'turnstile') {
          await loadScriptOnce(
            'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',
            'pp-turnstile-js',
          )
          if (cancelled) return
          if (typeof window.turnstile?.render !== 'function') {
            throw new Error('turnstile missing')
          }
          const widgetId = window.turnstile.render(el, {
            sitekey: siteKey,
            callback: (token: string) => onToken(token),
            'expired-callback': () => onToken(''),
            'error-callback': () => onToken(''),
          })
          setCleanup(() => {
            try {
              if (widgetId != null) window.turnstile?.remove(widgetId)
            } catch {
              // ignore
            }
          })
          return
        }

        if (provider === 'hcaptcha') {
          await loadScriptOnce(
            'https://hcaptcha.com/1/api.js?render=explicit',
            'pp-hcaptcha-js',
          )
          if (cancelled) return
          if (typeof window.hcaptcha?.render !== 'function') {
            throw new Error('hcaptcha missing')
          }
          const widgetId = window.hcaptcha.render(el, {
            sitekey: siteKey,
            callback: (token: string) => onToken(token),
            'expired-callback': () => onToken(''),
            'error-callback': () => onToken(''),
          })
          setCleanup(() => {
            try {
              if (widgetId != null) window.hcaptcha?.remove(widgetId)
            } catch {
              // ignore
            }
          })
          return
        }

        if (provider === 'recaptcha') {
          await loadScriptOnce(
            'https://www.google.com/recaptcha/api.js?render=explicit',
            'pp-recaptcha-js',
          )
          if (cancelled) return
          if (typeof window.grecaptcha?.render !== 'function') {
            throw new Error('recaptcha missing')
          }
          const widgetId = window.grecaptcha.render(el, {
            sitekey: siteKey,
            callback: (token: string) => onToken(token),
            'expired-callback': () => onToken(''),
            'error-callback': () => onToken(''),
          })
          setCleanup(() => {
            try {
              if (widgetId != null) window.grecaptcha?.reset(widgetId)
            } catch {
              // ignore
            }
          })
          return
        }

        if (provider === 'geetest') {
          await loadScriptOnce(
            'https://static.geetest.com/v4/gt4.js',
            'pp-geetest-js',
          )
          if (cancelled) return
          if (typeof window.initGeetest4 !== 'function') {
            throw new Error('initGeetest4 missing')
          }

          window.initGeetest4(
            {
              captchaId: siteKey,
              // Use an embedded/visible widget. "bind" usually requires an explicit trigger element.
              product: 'float',
              language: 'zho',
            },
            (captchaObj: any) => {
              try {
                if (cancelled) {
                  try {
                    captchaObj.destroy?.()
                  } catch {
                    // ignore
                  }
                  return
                }
                captchaObj.appendTo(el)
                captchaObj.showCaptcha?.()
                captchaObj.onSuccess(() => {
                  const v = captchaObj.getValidate?.()
                  if (!v) return

                  const payload = {
                    lot_number: v.lot_number,
                    captcha_output: v.captcha_output,
                    pass_token: v.pass_token,
                    gen_time: v.gen_time,
                  }
                  onToken(base64EncodeUtf8(JSON.stringify(payload)))
                })
                captchaObj.onError?.((..._args: Array<any>) => {
                  onToken('')
                })
                captchaObj.onClose?.(() => onToken(''))

                setCleanup(() => {
                  try {
                    captchaObj.destroy?.()
                  } catch {
                    // ignore
                  }
                })
              } catch {
                setLoadError(true)
              }
            },
          )
          return
        }
      } catch {
        if (!cancelled) setLoadError(true)
      }
    }

    void run()

    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [provider, siteKey, refreshIndex])

  return (
    <div className="space-y-2">
      {loadError && (
        <div className="text-sm text-destructive">验证码加载失败</div>
      )}
      <div ref={containerRef} />
    </div>
  )
}

export function CaptchaField({
  captcha,
  required = true,
}: {
  captcha: UseCaptchaResult
  required?: boolean
}) {
  if (!captcha.enabled) return null

  if (captcha.provider === 'image') {
    return (
      <div className="space-y-2">
        <Label htmlFor="captcha">验证码</Label>
        <div className="flex gap-2">
          <Input
            id="captcha"
            type="text"
            placeholder="输入验证码"
            value={captcha.captchaAnswer}
            onChange={(e) => captcha.setCaptchaAnswer(e.target.value)}
            required={required}
          />
          {captcha.captchaImage ? (
            <img
              src={captcha.captchaImage}
              alt="验证码"
              className="h-9 w-24 rounded border cursor-pointer object-cover bg-white"
              onClick={captcha.refresh}
              title="点击刷新验证码"
            />
          ) : (
            <div className="h-9 w-24 bg-muted rounded animate-pulse" />
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>验证码</Label>
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-primary hover:underline"
          onClick={captcha.refresh}
        >
          刷新
        </button>
      </div>

      {!captcha.supported ? (
        <div className="text-sm text-destructive">
          不支持的验证码 provider：{captcha.provider}
        </div>
      ) : !captcha.siteKey ? (
        <div className="text-sm text-destructive">验证码配置缺失</div>
      ) : (
        <>
          <CaptchaWidget
            provider={captcha.provider}
            siteKey={captcha.siteKey}
            refreshIndex={captcha.refreshIndex}
            onToken={captcha.setCaptchaToken}
          />
          {required && (
            <input
              value={captcha.captchaToken}
              readOnly
              required
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
            />
          )}
        </>
      )}
    </div>
  )
}
