import { pixiuAxios } from '@/api/container'

export type DatasourceType = 0 | 1
export type DatasourceSubType = 'loki' | 'es' | 'prometheus'

export interface DatasourceHeader {
  key: string
  value: string
}

export interface DatasourceLogConfig {
  url?: string
  userName?: string
  password?: string
}

export interface DatasourceConfig {
  headers: DatasourceHeader[]
  log?: DatasourceLogConfig
}

export interface DatasourceItem {
  id: number
  resourceVersion: number
  clusterName: string
  name: string
  type: DatasourceType
  subType: DatasourceSubType
  config: DatasourceConfig
  isDefault: boolean
  description: string
  gmtCreate: string
  gmtModified: string
}

export function resolveDatasourceUrl(item: Pick<DatasourceItem, 'config'>): string {
  return item.config.log?.url?.trim() || ''
}

interface BackendDatasourceHeader {
  key?: string
  value?: string
}

interface BackendDatasourceLogConfig {
  url?: string
  user_name?: string
  password?: string
}

interface BackendDatasourceConfig {
  headers?: BackendDatasourceHeader[] | null
  log?: BackendDatasourceLogConfig | null
}

interface BackendDatasourceItem {
  id: number
  resource_version: number
  cluster_name: string
  name: string
  type: DatasourceType
  sub_type: DatasourceSubType
  config?: BackendDatasourceConfig | null
  is_default: boolean
  description: string
  gmt_create: string
  gmt_modified: string
}

interface BackendDatasourceListResponse {
  page: number
  limit: number
  total: number
  items: BackendDatasourceItem[] | null
}

export interface DatasourceListParams {
  page?: number
  limit?: number
  nameSelector?: string
}

export interface CreateDatasourcePayload {
  clusterName: string
  name: string
  type: DatasourceType
  subType: DatasourceSubType
  url: string
  config?: {
    headers?: DatasourceHeader[]
    log?: {
      url?: string
      userName?: string
      password?: string
    }
  }
  isDefault?: boolean
  description?: string
}

function normalizeConfig(config?: BackendDatasourceConfig | null): DatasourceConfig {
  const headers = (config?.headers ?? [])
    .map((item) => ({
      key: item?.key ?? '',
      value: item?.value ?? ''
    }))
    .filter((item) => item.key || item.value)

  const log = config?.log
    ? {
        url: config.log.url ?? '',
        userName: config.log.user_name ?? '',
        password: config.log.password ?? ''
      }
    : undefined

  return {
    headers,
    log
  }
}

function toDatasourceItem(item: BackendDatasourceItem): DatasourceItem {
  return {
    id: item.id,
    resourceVersion: item.resource_version ?? 0,
    clusterName: item.cluster_name ?? '',
    name: item.name ?? '',
    type: item.type ?? 0,
    subType: item.sub_type ?? 'loki',
    config: normalizeConfig(item.config),
    isDefault: Boolean(item.is_default),
    description: item.description ?? '',
    gmtCreate: item.gmt_create ?? '',
    gmtModified: item.gmt_modified ?? ''
  }
}

export async function fetchDatasourceList(
  params: DatasourceListParams = {}
): Promise<{ total: number; items: DatasourceItem[] }> {
  const res = await pixiuAxios.get('/pixiu/datasources', {
    params: {
      page: params.page ?? 1,
      limit: params.limit ?? 100,
      nameSelector: params.nameSelector ?? undefined
    }
  })
  const { code, result, message } = res.data
  if (code !== 200) throw new Error(message || '获取数据源列表失败')
  const data = result as BackendDatasourceListResponse
  return {
    total: data?.total ?? 0,
    items: (data?.items ?? []).map(toDatasourceItem)
  }
}

export async function fetchDatasourceDetail(id: number): Promise<DatasourceItem> {
  const res = await pixiuAxios.get(`/pixiu/datasources/${id}`)
  const { code, result, message } = res.data
  if (code !== 200) throw new Error(message || '获取数据源详情失败')
  return toDatasourceItem(result as BackendDatasourceItem)
}

export async function fetchCreateDatasource(payload: CreateDatasourcePayload): Promise<void> {
  const res = await pixiuAxios.post('/pixiu/datasources', {
    cluster_name: payload.clusterName,
    name: payload.name,
    type: payload.type,
    sub_type: payload.subType,
    url: payload.url,
    config: {
      headers: payload.config?.headers ?? [],
      log: {
        url: payload.config?.log?.url ?? payload.url,
        user_name: payload.config?.log?.userName ?? '',
        password: payload.config?.log?.password ?? ''
      }
    },
    is_default: payload.isDefault ?? false,
    description: payload.description ?? ''
  })
  const { code, message } = res.data
  if (code !== 200) throw new Error(message || '创建数据源失败')
}

export async function fetchDeleteDatasource(id: number): Promise<void> {
  const res = await pixiuAxios.delete(`/pixiu/datasources/${id}`)
  const { code, message } = res.data
  if (code !== 200) throw new Error(message || '删除数据源失败')
}
