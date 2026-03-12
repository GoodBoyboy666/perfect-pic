import axios from 'axios'

export const api = axios.create({
  baseURL: '/', // Vite proxy will handle api redirects
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => {
    if (response.data && response.data.error) {
      return Promise.reject(new Error(response.data.error))
    }
    return response.data
  },
  (error) => {
    if (error.response && error.response.data && error.response.data.error) {
      return Promise.reject(new Error(error.response.data.error))
    }
    return Promise.reject(error)
  },
)

export async function fetchClient(path: string, options: any = {}) {
  // Keeping this signature for compatibility but using axios under the hood
  const method = options.method || 'GET'
  const data = options.body
    ? typeof options.body === 'string'
      ? JSON.parse(options.body)
      : options.body
    : undefined
  const headers = options.headers

  // If request contains FormData (e.g. upload), don't parse body as JSON and let axios handle it
  const isFormData = options.body instanceof FormData

  return api({
    url: path,
    method,
    data: isFormData ? options.body : data,
    headers,
  })
}
