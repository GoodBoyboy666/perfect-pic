import * as React from 'react'

import { fetchClient } from '../lib/api'

export type CaptchaProvider =
  | ''
  | 'image'
  | 'turnstile'
  | 'recaptcha'
  | 'hcaptcha'
  | 'geetest'
  | (string & {})

export type CaptchaPublicConfig = Record<string, unknown>

export interface CaptchaMeta {
  provider?: CaptchaProvider | null
  public_config?: CaptchaPublicConfig
}

export interface CaptchaImageMeta {
  captcha_id?: string
  captcha_image?: string
}

export interface CaptchaRuntimeState {
  provider: CaptchaProvider
  enabled: boolean
  supported: boolean
  loading: boolean
  publicConfig: CaptchaPublicConfig | null
  siteKey: string | null
}

export interface CaptchaImageState {
  captchaId: string
  captchaImage: string
  captchaAnswer: string
  setCaptchaAnswer: (value: string) => void
}

export interface CaptchaTokenState {
  captchaToken: string
  setCaptchaToken: (value: string) => void
}

export interface CaptchaActions {
  refreshIndex: number
  refresh: () => void
}

export interface CaptchaSubmit {
  getSubmitPayload: () => Record<string, string>
}

export type UseCaptchaResult = CaptchaRuntimeState &
  CaptchaImageState &
  CaptchaTokenState &
  CaptchaActions &
  CaptchaSubmit

const PROVIDER_PUBLIC_CONFIG_KEYS: Readonly<
  Record<string, ReadonlyArray<string> | undefined>
> = {
  turnstile: ['turnstile_site_key'],
  recaptcha: ['recaptcha_site_key'],
  hcaptcha: ['hcaptcha_site_key'],
  geetest: ['geetest_captcha_id'],
}

function readFirstString(
  config: CaptchaPublicConfig | null,
  keys: Array<string>,
) {
  if (!config) return null
  for (const key of keys) {
    const v = config[key]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return null
}

function normalizePublicConfig(v: unknown): CaptchaPublicConfig | null {
  if (!v) return null
  if (typeof v !== 'object') return null
  if (Array.isArray(v)) return null
  return v as CaptchaPublicConfig
}

function getSiteKey(
  provider: CaptchaProvider,
  publicConfig: CaptchaPublicConfig | null,
) {
  if (!provider || provider === 'image') return null

  const knownKeys = PROVIDER_PUBLIC_CONFIG_KEYS[provider]
  if (knownKeys) {
    return readFirstString(publicConfig, [...knownKeys])
  }

  return null
}

function isSupportedProvider(provider: CaptchaProvider) {
  return (
    provider === '' ||
    provider === 'image' ||
    provider === 'turnstile' ||
    provider === 'recaptcha' ||
    provider === 'hcaptcha' ||
    provider === 'geetest'
  )
}

export function useCaptcha(): UseCaptchaResult {
  const [loading, setLoading] = React.useState(false)
  const [provider, setProvider] = React.useState<CaptchaProvider>('')
  const [publicConfig, setPublicConfig] =
    React.useState<CaptchaPublicConfig | null>(null)
  const [captchaId, setCaptchaId] = React.useState('')
  const [captchaImage, setCaptchaImage] = React.useState('')
  const [captchaAnswer, setCaptchaAnswer] = React.useState('')
  const [captchaToken, setCaptchaToken] = React.useState('')
  const [refreshIndex, setRefreshIndex] = React.useState(0)

  const refresh = React.useCallback(() => {
    setCaptchaAnswer('')
    setCaptchaToken('')
    setRefreshIndex((i) => i + 1)
  }, [])

  React.useEffect(() => {
    const state: { cancelled: boolean } = { cancelled: false }
    setLoading(true)

    const run = async () => {
      try {
        const res = (await fetchClient('/api/captcha')) as CaptchaMeta
        if (state.cancelled) return

        setCaptchaAnswer('')
        setCaptchaToken('')

        const resolvedProvider: CaptchaProvider =
          typeof res.provider === 'string' ? res.provider : ''

        setProvider(resolvedProvider)
        setPublicConfig(normalizePublicConfig(res.public_config))

        if (resolvedProvider === 'image') {
          const imageRes = (await fetchClient(
            '/api/captcha/image',
          )) as CaptchaImageMeta
          // eslint can't model the async unmount race here.
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          if (state.cancelled) return

          setCaptchaId(imageRes.captcha_id ?? '')
          setCaptchaImage(imageRes.captcha_image ?? '')
        } else {
          setCaptchaId('')
          setCaptchaImage('')
        }
      } catch {
        if (state.cancelled) return
        // 拉取失败时不阻塞登录/注册流程，但前端将无法展示验证码
        setProvider('')
        setPublicConfig(null)
        setCaptchaId('')
        setCaptchaImage('')
      } finally {
        if (!state.cancelled) setLoading(false)
      }
    }

    void run()
    return () => {
      state.cancelled = true
    }
  }, [refreshIndex])

  const enabled = provider !== ''
  const supported = isSupportedProvider(provider)
  const siteKey = React.useMemo(
    () => getSiteKey(provider, publicConfig),
    [provider, publicConfig],
  )

  const getSubmitPayload = React.useCallback((): Record<string, string> => {
    const payload: Record<string, string> = {}
    if (!provider) return payload

    if (provider === 'image') {
      payload.captcha_id = captchaId
      payload.captcha_answer = captchaAnswer
      return payload
    }

    payload.captcha_token = captchaToken
    return payload
  }, [provider, captchaId, captchaAnswer, captchaToken])

  return {
    provider,
    enabled,
    supported,
    loading,
    publicConfig,
    siteKey,
    captchaId,
    captchaImage,
    captchaAnswer,
    setCaptchaAnswer,
    captchaToken,
    setCaptchaToken,
    refreshIndex,
    refresh,
    getSubmitPayload,
  }
}
