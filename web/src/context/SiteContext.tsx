import React, { createContext, useContext, useEffect, useState } from 'react'
import { fetchClient } from '../lib/api'

interface SiteInfo {
  site_name: string
  site_description: string
  site_logo: string
  site_favicon: string
  [key: string]: string
}

interface SiteContextType {
  siteInfo: SiteInfo
  isLoading: boolean
}

const defaultSiteInfo: SiteInfo = {
  site_name: 'Perfect Pic',
  site_description: '记录与分享完美瞬间',
  site_logo: '',
  site_favicon: '',
}

const SiteContext = createContext<SiteContextType | undefined>(undefined)

export function SiteProvider({ children }: { children: React.ReactNode }) {
  const [siteInfo, setSiteInfo] = useState<SiteInfo>(defaultSiteInfo)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchClient('/api/webinfo')
      .then((data: any) => {
        // data is array of {key, value}
        if (Array.isArray(data)) {
          const info: any = { ...defaultSiteInfo }
          data.forEach((item: { key: string; value: string }) => {
            info[item.key] = item.value
          })
          setSiteInfo(info)

          // Update document title
          if (info.site_name) {
            document.title = info.site_name
          }
          // Could updates favicon here too if needed
        }
      })
      .catch((err) => {
        console.error('Failed to fetch site info', err)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  return (
    <SiteContext.Provider value={{ siteInfo, isLoading }}>
      {children}
    </SiteContext.Provider>
  )
}

export function useSite() {
  const context = useContext(SiteContext)
  if (context === undefined) {
    throw new Error('useSite must be used within a SiteProvider')
  }
  return context
}
