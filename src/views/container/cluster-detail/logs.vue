<!-- 日志采集 -->
<template>
  <ElCard shadow="never" class="art-table-card logs-page">
    <template #header>
      <div class="page-hd-row">
        <div class="page-hd-main">
          <div class="page-hd">日志采集</div>
          <ElButton plain class="page-hd-main__action" @click="openCreateDatasourceDialog">
            添加数据�?          </ElButton>
        </div>
        <div class="page-hd-actions">
          <div class="page-hd-actions__stack">
            <template v-if="datasourceRows.length">
              <div class="logs-toolbar-datasource">
                <span class="logs-toolbar-datasource__label">数据�?/span>
                <ElSelect
                  :model-value="selectedDatasourceId ?? undefined"
                  placeholder="请选择数据�?
                  class="logs-toolbar-datasource__select"
                  @change="handleDatasourceChange"
                >
                  <ElOption
                    v-for="item in datasourceRows"
                    :key="item.id"
                    :label="buildDatasourceOptionLabel(item)"
                    :value="item.id"
                  />
                </ElSelect>
                <template v-if="selectedDatasource">
                  <span class="logs-datasource-type-tag">
                    {{ getDatasourceTypeLabel(selectedDatasource.type) }}
                  </span>
                  <span v-if="selectedDatasource.isDefault" class="logs-datasource-badge"
                    >默认</span
                  >
                  <span class="logs-toolbar-datasource__url">{{ selectedDatasource.url }}</span>
                  <ElButton size="small" plain @click="openEditDatasourceDialog"
                    >编辑数据�?/ElButton
                  >
                  <ElButton
                    size="small"
                    text
                    type="danger"
                    :loading="deletingDatasourceId === selectedDatasource.id"
                    @click="removeDatasource(selectedDatasource)"
                  >
                    删除数据�?                  </ElButton>
                  <ElButton
                    v-if="!selectedDatasource.isDefault"
                    size="small"
                    :loading="settingDefaultId === selectedDatasource.id"
                    @click="setDatasourceAsDefault(selectedDatasource.id)"
                  >
                    设为默认
                  </ElButton>
                </template>
              </div>
            </template>
            <div class="page-hd-actions__right">
              <template v-if="logAccessReady">
                <MetricsTimeRangePicker v-model="timeRange" class="logs-time-range" />
                <ElInputNumber
                  v-model="lineLimit"
                  :min="10"
                  :max="10000"
                  :step="100"
                  controls-position="right"
                  class="logs-limit-input"
                />
                <ElButton :loading="loading" :disabled="!canQuery" @click="loadLogs">查询</ElButton>
              </template>
            </div>
          </div>
        </div>
      </div>
    </template>

    <div v-if="!detectResolved" class="logs-loading-state">
      <div
        class="logs-loading-card"
        v-loading="true"
        element-loading-text="正在加载日志数据�?.."
      ></div>
    </div>

    <div v-else-if="!logAccessReady" class="logs-unavailable-state">
      <div class="logs-unavailable-card">
        <div class="logs-unavailable-icon">!</div>
        <div class="logs-unavailable-title">{{ logUnavailableTitle }}</div>
        <div class="logs-unavailable-desc">{{ logUnavailableDescription }}</div>

        <div class="logs-unavailable-guide">
          <template v-if="!datasourceReady">
            <div>请先完成下面两步�?/div>
            <div>1. 添加至少一个可用的日志数据�?/div>
            <div>2. 至少保证其中一个数据源类型�?Loki</div>
          </template>
          <template v-else>
            <div
              >当前检索数据源类型�?              <code>{{ getDatasourceTypeLabel(activeDatasourceType) }}</code></div
            >
            <div>请先完成下面两项标记�?/div>
            <div><code>namespace</code> 需要打标签�?code>pixiu-loki=true</code></div>
            <div>
              Loki 网关对应�?<code>Service</code> 需要打标签�?              <code>pixiu-loki-gateway=true</code>
            </div>
          </template>
        </div>
      </div>
    </div>

    <template v-else>
      <div class="logs-builder">
        <div class="logs-builder__header">
          <div class="logs-builder__title">标签过滤</div>
          <ElButton size="small" plain @click="addFilter">添加条件</ElButton>
        </div>

        <div v-if="filters.length" class="logs-filter-list">
          <div v-for="filter in filters" :key="filter.id" class="logs-filter-row">
            <ElSelect
              v-model="filter.key"
              placeholder="标签"
              class="logs-filter-key"
              filterable
              @change="onFilterKeyChange(filter)"
            >
              <ElOption v-for="item in labelKeys" :key="item" :label="item" :value="item" />
            </ElSelect>

            <ElSelect v-model="filter.operator" class="logs-filter-operator">
              <ElOption v-for="item in operatorOptions" :key="item" :label="item" :value="item" />
            </ElSelect>

            <ElSelect
              v-model="filter.value"
              placeholder="标签�?
              class="logs-filter-value"
              filterable
              allow-create
              default-first-option
              :loading="filter.loading"
              @visible-change="(visible) => visible && ensureFilterValues(filter)"
            >
              <ElOption
                v-for="item in filter.options"
                :key="`${filter.key}-${item}`"
                :label="item"
                :value="item"
              />
            </ElSelect>

            <ElButton text type="danger" @click="removeFilter(filter.id)">删除</ElButton>
          </div>
        </div>
        <div v-else class="logs-builder__empty">未设置标签条件，默认查询全部日志�?/div>

        <div class="logs-query-row">
          <ElInput
            v-model="keyword"
            placeholder="日志内容关键字（可选）"
            clearable
            class="logs-search"
            @keyup.enter="loadLogs"
            @clear="loadLogs"
          />
          <div class="logs-query-editor-wrap">
            <ElInput
              v-model="queryDraft"
              placeholder="支持手写 LogQL 查询"
              class="logs-query-editor"
              @input="handleQueryDraftInput"
              @keyup.enter="loadLogs"
            />
            <ElButton
              v-if="queryDirty"
              text
              type="primary"
              class="logs-query-reset"
              @click="resetQueryDraft"
            >
              恢复生成
            </ElButton>
          </div>
        </div>
      </div>

      <ElTable
        v-loading="loading"
        :data="logs"
        :row-key="getLogRowKey"
        :expand-row-keys="expandedRowKeys"
        stripe
        size="small"
        class="logs-table"
        @expand-change="handleExpandChange"
      >
        <template #empty>
          <div class="logs-empty">{{ emptyText }}</div>
        </template>
        <ElTableColumn type="expand" width="44">
          <template #default="{ row }">
            <div class="logs-inline-detail">
              <div class="logs-inline-detail__section">
                <div class="logs-inline-detail__title">字段</div>
                <div class="logs-field-list">
                  <div
                    v-for="item in getLogFieldEntries(row as LogTableRow)"
                    :key="`${(row as LogTableRow).id}-${item.key}`"
                    class="logs-field-item"
                  >
                    <span class="logs-field-item__key">{{ item.key }}</span>
                    <span class="logs-field-item__value">{{ item.value }}</span>
                  </div>
                </div>
              </div>

              <div class="logs-inline-detail__section">
                <div class="logs-inline-detail__title">日志内容</div>
                <pre class="logs-detail-code">{{
                  formatStructuredText((row as LogTableRow).raw)
                }}</pre>
              </div>
            </div>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="time" label="时间" width="180" />
        <ElTableColumn prop="ns" label="命名空间" width="140" />
        <ElTableColumn prop="pod" label="Pod" min-width="220" show-overflow-tooltip />
        <ElTableColumn prop="container" label="容器" width="180" show-overflow-tooltip />
        <ElTableColumn prop="msg" label="摘要" min-width="420" show-overflow-tooltip />
        <ElTableColumn label="操作" width="90" fixed="right">
          <template #default="{ row }">
            <ElButton link type="primary" @click="toggleLogDetail(row as LogTableRow)">
              {{ isExpanded(row as LogTableRow) ? '收起' : '详情' }}
            </ElButton>
          </template>
        </ElTableColumn>
      </ElTable>
    </template>
  </ElCard>

  <ElDialog
    v-model="createDialogVisible"
    :title="editingDatasourceId == null ? '添加日志数据�? : '编辑日志数据�?"
    width="680px"
    destroy-on-close
  >
    <ElForm ref="createFormRef" :model="createForm" :rules="createRules" label-width="96px">
      <ElFormItem label="名称" prop="name">
        <ElInput v-model="createForm.name" placeholder="例如：集群日�? />
      </ElFormItem>
      <ElFormItem label="类型" prop="type">
        <ElSelect v-model="createForm.type" class="logs-form-type">
          <ElOption
            v-for="item in datasourceTypeOptions"
            :key="item.value"
            :label="item.enabled ? item.label : `${item.label}（暂未开放）`"
            :value="item.value"
            :disabled="!item.enabled"
          />
        </ElSelect>
        <div class="logs-form-tip">当前仅开�?Loki，后续可扩展 Elasticsearch 等类型�?/div>
      </ElFormItem>
      <ElFormItem label="地址" prop="url">
        <ElInput
          v-model="createForm.url"
          placeholder="只允许填写基础地址，例如：http://loki-distributed-gateway.loki:3100"
        />
        <div class="logs-form-tip">
          只允许填�?`http://` �?`https://` 开头的基础地址，可带端口，例如
          `http://loki-distributed-gateway.loki:3100`�?        </div>
      </ElFormItem>
      <ElFormItem label="用户�?>
        <ElInput v-model="createForm.username" placeholder="可�? />
      </ElFormItem>
      <ElFormItem label="密码">
        <ElInput v-model="createForm.password" type="password" show-password placeholder="可�? />
      </ElFormItem>
      <ElFormItem label="请求�?>
        <div class="logs-header-editor">
          <div v-for="(header, index) in createForm.headers" :key="index" class="logs-header-row">
            <ElInput v-model="header.key" placeholder="Header Key" />
            <ElInput v-model="header.value" placeholder="Header Value" />
            <ElButton text type="danger" @click="removeCreateHeader(index)">删除</ElButton>
          </div>
          <ElButton plain size="small" @click="addCreateHeader">添加请求�?/ElButton>
        </div>
      </ElFormItem>
      <ElFormItem label="描述">
        <ElInput v-model="createForm.description" type="textarea" :rows="3" placeholder="可�? />
      </ElFormItem>
      <ElFormItem>
        <ElCheckbox v-model="createForm.isDefault">创建后设为默认数据源</ElCheckbox>
      </ElFormItem>
    </ElForm>

    <template #footer>
      <ElButton @click="createDialogVisible = false">取消</ElButton>
      <ElButton type="primary" :loading="creatingDatasource" @click="submitCreateDatasource">
        {{ editingDatasourceId == null ? '创建' : '保存' }}
      </ElButton>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
  import { computed, inject, reactive, ref, watch } from 'vue'
  import MetricsTimeRangePicker from '@/components/container/metrics-time-range-picker.vue'
  import { PixiuApiError } from '@/api/container'
  import {
    createLogDatasource,
    DEFAULT_LOG_DATASOURCE_TYPE,
    deleteLogDatasource,
    pickPreferredLogDatasource,
    pickPreferredLokiDatasource,
    detectDefaultLogDatasource,
    getDatasourceTypeLabel,
    LOG_DATASOURCE_TYPE_OPTIONS,
    normalizeLogDatasourceUrl,
    setDefaultLogDatasource,
    updateLogDatasource,
    type LogDatasourceHeader,
    type LogDatasourceItem,
    type LogDatasourceType,
    type UpdateLogDatasourcePayload
  } from '@/api/kubernetes/log-datasource'
  import {
    detectLokiAvailability,
    fetchLokiLabelValues,
    fetchLokiQueryRange,
    type LokiLabelFilter,
    type LokiLabelOperator
  } from '@/api/kubernetes/loki'
  import { formatNodeCreationTime } from '@/utils/kubernetes/nodeDisplay'
  import { getDefaultMetricsTimeRange, type MetricsTimeRange } from '@/utils/metrics/time-range'
  import { clusterDetailContextKey } from './context'

  defineOptions({ name: 'ClusterDetailLogs' })

  interface LogTableRow {
    id: string
    time: string
    ns: string
    pod: string
    container: string
    msg: string
    raw: string
    labels: Record<string, string>
  }

  interface FilterRow {
    id: number
    key: string
    operator: LokiLabelOperator
    value: string
    options: string[]
    loading: boolean
  }

  interface CreateDatasourceForm {
    name: string
    type: LogDatasourceType
    url: string
    username: string
    password: string
    headers: LogDatasourceHeader[]
    description: string
    isDefault: boolean
  }

  const ctxRef = inject(clusterDetailContextKey)!

  const operatorOptions: LokiLabelOperator[] = ['=', '!=', '=~', '!~']
  const datasourceTypeOptions = LOG_DATASOURCE_TYPE_OPTIONS
  const timeRange = ref<MetricsTimeRange>(getDefaultMetricsTimeRange())
  const lineLimit = ref(1000)
  const keyword = ref('')
  const loading = ref(false)
  const detectingState = ref(false)
  const creatingDatasource = ref(false)
  const settingDefaultId = ref<number | null>(null)
  const deletingDatasourceId = ref<number | null>(null)
  const createDialogVisible = ref(false)
  const editingDatasourceId = ref<number | null>(null)
  const logs = ref<LogTableRow[]>([])
  const expandedRowKeys = ref<string[]>([])
  const labelKeys = ref<string[]>([])
  const filters = ref<FilterRow[]>([])
  const filterSeed = ref(1)
  const labelValueCache = ref<Record<string, string[]>>({})
  const queryDraft = ref('')
  const queryDirty = ref(false)
  const datasourceReady = ref(true)
  const datasourceUnavailableReason = ref('')
  const datasourceRows = ref<LogDatasourceItem[]>([])
  const selectedDatasourceId = ref<number | null>(null)
  const activeDatasourceType = ref<LogDatasourceType>(DEFAULT_LOG_DATASOURCE_TYPE)
  const lokiAvailable = ref(true)
  const lokiUnavailableReason = ref('')
  const detectResolved = ref(false)
  const createFormRef = ref<FormInstance>()

  function validateDatasourceUrl(_rule: unknown, value: string, callback: (error?: Error) => void) {
    const raw = String(value ?? '').trim()
    if (!raw) {
      callback(new Error('����������Դ��ַ'))
      return
    }

    try {
      const parsed = new URL(raw)
      const isValid =
        (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
        Boolean(parsed.hostname) &&
        parsed.hostname.includes('.') &&
        !parsed.hostname.startsWith('.') &&
        !parsed.hostname.endsWith('.') &&
        !parsed.username &&
        !parsed.password &&
        !parsed.search &&
        !parsed.hash &&
        (parsed.pathname === '' || parsed.pathname === '/')

      if (!isValid) {
        callback(new Error('ֻ������д http:// �� https:// ��ͷ�Ļ�����ַ���ɴ��˿ڣ����� https://xxx.xxx:3100'))
        return
      }

      callback()
    } catch {
      callback(new Error('��ַ��ʽ����ȷ��ֻ������д http:// �� https:// ��ͷ�Ļ�����ַ���ɴ��˿ڣ����� https://xxx.xxx:3100'))
    }
  }

  const createForm = reactive<CreateDatasourceForm>({
    name: '',
    type: DEFAULT_LOG_DATASOURCE_TYPE,
    url: '',
    username: '',
    password: '',
    headers: [],
    description: '',
    isDefault: true
  })

  const createRules: FormRules<CreateDatasourceForm> = {
    name: [{ required: true, message: '请输入数据源名称', trigger: 'blur' }],
    type: [{ required: true, message: '请选择数据源类�?, trigger: 'change' }],
    url: [{ validator: validateDatasourceUrl, trigger: ['blur', 'change'] }]
  }

  const selectedDatasource = computed(() =>
    pickPreferredLogDatasource(datasourceRows.value, selectedDatasourceId.value)
  )
  const selectedDatasourceName = computed(() => selectedDatasource.value?.name || '')
  const logAccessReady = computed(() => datasourceReady.value && lokiAvailable.value)
  const hasEffectiveFilters = computed(() => buildRequestFilters().length > 0)
  const canQuery = computed(() => logAccessReady.value && hasEffectiveFilters.value)

  const queryPreview = computed(() => {
    const selectorParts = filters.value
      .map((item) => ({
        key: item.key.trim(),
        operator: item.operator,
        value: item.value.trim()
      }))
      .filter((item) => item.key && item.value)
      .map(
        (item) =>
          `${item.key}${item.operator}"${item.value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
      )

    if (!selectorParts.length) return ''

    const selector = `{${selectorParts.join(', ')}}`
    const text = keyword.value.trim()
    return text ? `${selector} |= "${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` : selector
  })

  const emptyText = computed(() => {
    if (!datasourceReady.value) return '当前集群未配置可用于检索的 Loki 数据�?
    if (!lokiAvailable.value) return '当前所选数据源对应�?Loki 暂不可用'
    if (!hasEffectiveFilters.value) return '请选择至少一个标签条件后手动查询'
    if (loading.value) return '加载日志�?..'
    if (filters.value.length || keyword.value.trim()) return '没有匹配到日�?
    return '暂无日志'
  })

  const logUnavailableTitle = computed(() =>
    !datasourceReady.value
      ? '当前集群缺少可用于检索的 Loki 数据源，日志检索暂不可�?
      : '当前所选数据源暂不可用于日志检�?
  )

  const logUnavailableDescription = computed(() => {
    if (!datasourceReady.value) {
      const reason = datasourceUnavailableReason.value.trim()
      return reason || '请先添加至少一�?Loki 类型的数据源，再进入日志页面�?
    }
    const reason = lokiUnavailableReason.value.trim()
    return (
      reason ||
      `请检查当前所选数据源 ${selectedDatasourceName.value || ''} �?Loki 网关状态后重试。`
    )
  })

  function buildDatasourceOptionLabel(item: LogDatasourceItem) {
    const labels = [item.name, getDatasourceTypeLabel(item.type)]
    if (item.isDefault) labels.push('默认')
    return labels.join(' / ')
  }

  function resetCreateForm() {
    editingDatasourceId.value = null
    createForm.name = ''
    createForm.type = DEFAULT_LOG_DATASOURCE_TYPE
    createForm.url = ''
    createForm.username = ''
    createForm.password = ''
    createForm.headers = []
    createForm.description = ''
    createForm.isDefault = datasourceRows.value.length === 0
  }

  function openCreateDatasourceDialog() {
    resetCreateForm()
    createDialogVisible.value = true
  }

  function openEditDatasourceDialog() {
    if (!selectedDatasource.value) return
    editingDatasourceId.value = selectedDatasource.value.id
    createForm.name = selectedDatasource.value.name
    createForm.type = selectedDatasource.value.type
    createForm.url = selectedDatasource.value.url
    createForm.username = selectedDatasource.value.username
    createForm.password = ''
    createForm.headers = selectedDatasource.value.headers.map((item) => ({ ...item }))
    createForm.description = selectedDatasource.value.description
    createForm.isDefault = selectedDatasource.value.isDefault
    createDialogVisible.value = true
  }

  function addCreateHeader() {
    createForm.headers.push({ key: '', value: '' })
  }

  function removeCreateHeader(index: number) {
    createForm.headers.splice(index, 1)
  }

  function buildRequestFilters(): LokiLabelFilter[] {
    return filters.value
      .map((item) => ({
        key: item.key.trim(),
        operator: item.operator,
        value: item.value.trim()
      }))
      .filter((item) => item.key && item.value)
  }

  function currentTimeParams() {
    return {
      start: timeRange.value.start.toISOString(),
      end: timeRange.value.end.toISOString()
    }
  }

  function createFilter(): FilterRow {
    return {
      id: filterSeed.value++,
      key: '',
      operator: '=',
      value: '',
      options: [],
      loading: false
    }
  }

  function addFilter() {
    filters.value.push(createFilter())
  }

  function removeFilter(id: number) {
    filters.value = filters.value.filter((item) => item.id !== id)
  }

  async function ensureFilterValues(filter: FilterRow) {
    const cluster = ctxRef.value.name
    const key = filter.key.trim()
    if (!cluster || !key || !logAccessReady.value) return

    const cacheKey = `${key}::${timeRange.value.start.toISOString()}::${timeRange.value.end.toISOString()}::${queryPreview.value}`
    if (labelValueCache.value[cacheKey]) {
      filter.options = labelValueCache.value[cacheKey]
      return
    }

    filter.loading = true
    try {
      const values = await fetchLokiLabelValues(cluster, key, {
        filters: buildRequestFilters(),
        ...currentTimeParams()
      })
      labelValueCache.value[cacheKey] = values
      filter.options = values
    } catch (error: unknown) {
      if (error instanceof PixiuApiError && error.notified) return
      ElMessage.error(error instanceof Error ? error.message : '加载标签值失�?)
    } finally {
      filter.loading = false
    }
  }

  function onFilterKeyChange(filter: FilterRow) {
    filter.value = ''
    filter.options = []
    void ensureFilterValues(filter)
  }

  function handleQueryDraftInput(value: string | number) {
    queryDirty.value = String(value) !== queryPreview.value
  }

  function resetQueryDraft() {
    queryDraft.value = queryPreview.value
    queryDirty.value = false
  }

  function formatStructuredText(raw: string | undefined) {
    const text = raw?.trim()
    if (!text) return '-'
    try {
      return JSON.stringify(JSON.parse(text), null, 2)
    } catch {
      return raw ?? '-'
    }
  }

  function getLogRowKey(row: LogTableRow) {
    return row.id
  }

  function isExpanded(row: LogTableRow) {
    return expandedRowKeys.value.includes(row.id)
  }

  function toggleLogDetail(row: LogTableRow) {
    expandedRowKeys.value = isExpanded(row) ? [] : [row.id]
  }

  function handleExpandChange(row: LogTableRow, expanded: LogTableRow[] | boolean) {
    const isRowExpanded = Array.isArray(expanded)
      ? expanded.some((item) => item.id === row.id)
      : expanded
    expandedRowKeys.value = isRowExpanded ? [row.id] : []
  }

  function getLogFieldEntries(row: LogTableRow) {
    const fixedEntries = [
      { key: 'time', value: row.time },
      { key: 'namespace', value: row.ns },
      { key: 'pod', value: row.pod },
      { key: 'container', value: row.container }
    ]

    const labelEntries = Object.entries(row.labels ?? {})
      .filter(([key, value]) => !['namespace', 'pod', 'container'].includes(key) && Boolean(value))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => ({ key, value }))

    return [...fixedEntries, ...labelEntries]
  }

  async function selectDatasource(datasourceId: number) {
    if (selectedDatasourceId.value === datasourceId) return
    selectedDatasourceId.value = datasourceId
    labelValueCache.value = {}
    queryDirty.value = false
    await detectAndPrepareLoki()
  }

  async function handleDatasourceChange(value: string | number) {
    const datasourceId = Number(value)
    if (!Number.isFinite(datasourceId)) return
    await selectDatasource(datasourceId)
  }

  async function testDatasourceBeforeSubmit() {
    createForm.url = normalizeLogDatasourceUrl(createForm.type, createForm.url)
  }

  /*
  async function submitCreateDatasource() {
    const clusterName = ctxRef.value.name
    if (!clusterName) return

    const valid = await createFormRef.value?.validate().catch(() => false)
    if (!valid) return

    await testDatasourceBeforeSubmit()
    if (
      !datasourceTestPassed.value ||
      datasourceTestSignature.value !== createFormSignature.value
    ) {
      return
    }

    creatingDatasource.value = true
    try {
      const result = await testLogDatasourceConnection({
        clusterId,
        type: createForm.type,
        url: createForm.url.trim(),
        username: createForm.username.trim() || undefined,
        password: createForm.password || undefined,
        headers: createForm.headers
          .map((item) => ({ key: item.key.trim(), value: item.value.trim() }))
          .filter((item) => item.key)
      })

      datasourceTestPassed.value = result.available
      datasourceTestMessage.value = result.available
        ? '数据源测试通过'
        : result.reason || '数据源测试失�?
      datasourceTestSignature.value = result.available ? createFormSignature.value : ''

      if (result.available) {
        createForm.url = normalizeLogDatasourceUrl(createForm.type, createForm.url)
        ElMessage.success('数据源测试通过')
      } else {
        ElMessage.error(datasourceTestMessage.value)
      }
    } catch (error: unknown) {
      datasourceTestPassed.value = false
      datasourceTestSignature.value = ''
      datasourceTestMessage.value = error instanceof Error ? error.message : '数据源测试失�?
      ElMessage.error(datasourceTestMessage.value)
    } finally {
      testingDatasource.value = false
    }
  }

  */
  async function submitCreateDatasource() {
    const clusterName = ctxRef.value.name
    if (!clusterName) return

    const valid = await createFormRef.value?.validate().catch(() => false)
    if (!valid) return

    await testDatasourceBeforeSubmit()

    creatingDatasource.value = true
    try {
      const payload = {
        name: createForm.name.trim(),
        type: createForm.type,
        url: createForm.url.trim(),
        username: createForm.username.trim() || undefined,
        password: createForm.password || undefined,
        headers: createForm.headers
          .map((item) => ({ key: item.key.trim(), value: item.value.trim() }))
          .filter((item) => item.key),
        is_default: createForm.isDefault,
        description: createForm.description.trim() || undefined
      }

      if (editingDatasourceId.value == null) {
        await createLogDatasource(clusterName, payload)
      } else {
        const currentDatasource = selectedDatasource.value
        if (!currentDatasource || currentDatasource.id !== editingDatasourceId.value) {
          throw new Error('未找到要更新的数据源信息，请刷新后重�?)
        }

        const updatePayload: UpdateLogDatasourcePayload = {
          ...payload,
          resource_version: currentDatasource.resourceVersion
        }
        await updateLogDatasource(clusterName, editingDatasourceId.value, updatePayload)
      }

      createDialogVisible.value = false
      ElMessage.success(editingDatasourceId.value == null ? '日志数据源已创建' : '日志数据源已更新')
      editingDatasourceId.value = null
      await detectAndPrepareLoki()
    } catch (error: unknown) {
      if (error instanceof PixiuApiError && error.notified) return
      ElMessage.error(
        error instanceof Error
          ? error.message
          : editingDatasourceId.value == null
            ? '创建日志数据源失�?
            : '更新日志数据源失�?
      )
    } finally {
      creatingDatasource.value = false
    }
  }

  async function setDatasourceAsDefault(datasourceId: number) {
    const clusterName = ctxRef.value.name
    if (!clusterName) return

    settingDefaultId.value = datasourceId
    try {
      await setDefaultLogDatasource(clusterName, datasourceId)
      ElMessage.success('默认日志数据源已更新')
      await detectAndPrepareLoki()
    } catch (error: unknown) {
      if (error instanceof PixiuApiError && error.notified) return
      ElMessage.error(error instanceof Error ? error.message : '设置默认日志数据源失�?)
    } finally {
      settingDefaultId.value = null
    }
  }

  async function removeDatasource(datasource: LogDatasourceItem) {
    const clusterName = ctxRef.value.name
    if (!clusterName) return

    try {
      await ElMessageBox.confirm(`确认删除数据源�?{datasource.name}”吗？`, '删除数据�?, {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消'
      })
    } catch {
      return
    }

    deletingDatasourceId.value = datasource.id
    try {
      await deleteLogDatasource(clusterName, datasource.id)
      ElMessage.success('数据源已删除')

      if (selectedDatasourceId.value === datasource.id) {
        selectedDatasourceId.value = null
      }

      await detectAndPrepareLoki()
    } catch (error: unknown) {
      if (error instanceof PixiuApiError && error.notified) return
      ElMessage.error(error instanceof Error ? error.message : '删除数据源失�?)
    } finally {
      deletingDatasourceId.value = null
    }
  }

  async function loadLogs() {
    const cluster = ctxRef.value.name
    if (!cluster || !logAccessReady.value) {
      logs.value = []
      return
    }

    loading.value = true
    try {
      const rows = await fetchLokiQueryRange(cluster, {
        filters: buildRequestFilters(),
        query: keyword.value,
        rawQuery: queryDirty.value ? queryDraft.value.trim() : undefined,
        limit: lineLimit.value,
        ...currentTimeParams()
      })
      expandedRowKeys.value = []
      logs.value = rows.map((item, index) => ({
        id: `${item.timestamp}-${item.pod}-${item.container}-${index}`,
        time: formatNodeCreationTime(item.timestamp),
        ns: item.namespace,
        pod: item.pod,
        container: item.container,
        msg: item.message,
        raw: item.raw,
        labels: item.labels
      }))
    } catch (error: unknown) {
      logs.value = []
      if (error instanceof PixiuApiError && error.notified) return
      ElMessage.error(error instanceof Error ? error.message : '加载日志失败')
    } finally {
      loading.value = false
    }
  }

  async function detectAndPrepareLoki() {
    const cluster = ctxRef.value.name

    if (!cluster) {
      detectResolved.value = false
      datasourceReady.value = true
      datasourceUnavailableReason.value = ''
      datasourceRows.value = []
      selectedDatasourceId.value = null
      activeDatasourceType.value = DEFAULT_LOG_DATASOURCE_TYPE
      lokiAvailable.value = true
      lokiUnavailableReason.value = ''
      labelKeys.value = []
      logs.value = []
      expandedRowKeys.value = []
      return
    }

    detectResolved.value = false
    detectingState.value = true
    try {
      const datasourceResult = await detectDefaultLogDatasource(cluster)
      datasourceRows.value = datasourceResult.datasourceList
      const currentDatasource = pickPreferredLogDatasource(
        datasourceResult.datasourceList,
        selectedDatasourceId.value
      )
      const availableLokiDatasource = pickPreferredLokiDatasource(datasourceResult.datasourceList)

      selectedDatasourceId.value = currentDatasource?.id ?? null
      datasourceReady.value = Boolean(currentDatasource || availableLokiDatasource)
      datasourceUnavailableReason.value = currentDatasource
        ? ''
        : datasourceResult.datasourceList.length
          ? '当前集群已有日志数据源，但没有可选中的检索数据源�?
          : '当前集群还没有日志数据源，请先添加至少一�?Loki 类型的数据源�?
      activeDatasourceType.value = currentDatasource?.type || DEFAULT_LOG_DATASOURCE_TYPE

      if (!currentDatasource) {
        lokiAvailable.value = true
        lokiUnavailableReason.value = ''
        labelKeys.value = []
        logs.value = []
        expandedRowKeys.value = []
        return
      }

      if (currentDatasource.type !== 'loki') {
        lokiAvailable.value = false
        lokiUnavailableReason.value = `当前选择的数据源类型�?${getDatasourceTypeLabel(currentDatasource.type)}，该页面暂未接入对应查询能力。`
        labelKeys.value = []
        logs.value = []
        expandedRowKeys.value = []
        return
      }

      const result = await detectLokiAvailability(cluster, currentTimeParams())
      lokiAvailable.value = result.available
      lokiUnavailableReason.value = result.reason || ''
      labelKeys.value = result.labels

      if (!result.available) {
        logs.value = []
        expandedRowKeys.value = []
        return
      }
    } catch (error: unknown) {
      datasourceReady.value = false
      datasourceUnavailableReason.value = '日志数据源状态加载失败，请刷新后重试�?
      lokiAvailable.value = false
      lokiUnavailableReason.value = ''
      labelKeys.value = []
      if (error instanceof PixiuApiError && error.notified) return
      ElMessage.error(error instanceof Error ? error.message : '加载日志能力状态失�?)
      return
    } finally {
      detectResolved.value = true
      detectingState.value = false
    }

    logs.value = []
    expandedRowKeys.value = []
  }

  watch(
    () => [ctxRef.value.id, ctxRef.value.name] as const,
    async () => {
      filters.value = []
      labelValueCache.value = {}
      queryDirty.value = false
      selectedDatasourceId.value = null
      await detectAndPrepareLoki()
    },
    { immediate: true }
  )

  watch(
    queryPreview,
    (value) => {
      if (!queryDirty.value || !queryDraft.value.trim()) {
        queryDraft.value = value
        queryDirty.value = false
      }
    },
    { immediate: true }
  )

  watch(timeRange, async () => {
    labelValueCache.value = {}
    for (const filter of filters.value) {
      filter.options = []
    }
    await detectAndPrepareLoki()
  })

  watch(canQuery, (value) => {
    if (!value) {
      logs.value = []
      expandedRowKeys.value = []
    }
  })
</script>

<style scoped>
  .logs-page {
    min-height: 100%;
  }

  .logs-unavailable-state {
    min-height: 420px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px 0;
  }

  .logs-loading-state {
    min-height: 220px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px 0;
  }

  .logs-loading-card {
    width: 100%;
    min-height: 160px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 16px;
    background: linear-gradient(180deg, #fffaf0 0%, #fffdf8 100%);
  }

  .logs-unavailable-card {
    width: min(820px, 100%);
    padding: 32px 28px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 16px;
    background: linear-gradient(180deg, #fffaf0 0%, #fffdf8 100%);
    box-shadow: 0 10px 30px rgb(0 0 0 / 4%);
    text-align: center;
  }

  .logs-unavailable-icon {
    width: 52px;
    height: 52px;
    margin: 0 auto 16px;
    border-radius: 999px;
    background: #fff1cc;
    color: #d97706;
    font-size: 28px;
    font-weight: 700;
    line-height: 52px;
  }

  .logs-unavailable-title {
    font-size: 22px;
    font-weight: 600;
    color: #b45309;
  }

  .logs-unavailable-desc {
    margin-top: 12px;
    font-size: 14px;
    line-height: 1.7;
    color: #92400e;
    word-break: break-word;
  }

  .logs-unavailable-guide {
    margin-top: 20px;
    padding: 18px 20px;
    border-radius: 12px;
    background: rgb(255 255 255 / 72%);
    color: #7c2d12;
    text-align: left;
    line-height: 1.8;
  }

  .logs-unavailable-guide code {
    padding: 2px 6px;
    border-radius: 6px;
    background: #fff3d6;
    color: #9a3412;
    font-family: Consolas, 'Courier New', monospace;
  }

  .page-hd {
    font-size: 15px;
    font-weight: 600;
  }

  .page-hd-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 24px;
    flex-wrap: wrap;
  }

  .page-hd-main {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    flex: 0 0 auto;
  }

  .page-hd-main__action {
    margin-top: 14px;
  }

  .page-hd-actions {
    display: flex;
    align-items: flex-start;
    justify-content: flex-end;
    flex: 1 1 720px;
    min-width: 0;
  }

  .page-hd-actions__stack {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
    margin-left: auto;
    min-width: 0;
  }

  .page-hd-actions__right {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    justify-content: flex-end;
    margin-left: auto;
  }

  .logs-toolbar-datasource {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    min-width: 0;
    justify-content: flex-end;
  }

  .logs-toolbar-datasource__label {
    font-size: 13px;
    color: var(--el-text-color-secondary);
    white-space: nowrap;
  }

  .logs-toolbar-datasource__select {
    width: 240px;
    max-width: 100%;
  }

  .logs-toolbar-datasource__url {
    max-width: 260px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
    color: #92400e;
  }

  .logs-time-range {
    min-width: 280px;
  }

  :deep(.logs-time-range.metrics-time-range-picker) {
    width: 360px;
    min-width: 360px;
    max-width: none;
    flex: 0 0 360px;
  }

  .logs-limit-input {
    width: 148px;
  }

  .logs-datasource-type-tag {
    padding: 1px 8px;
    border-radius: 999px;
    font-size: 12px;
    border: 1px solid #f3d5a2;
    background: #fff7e8;
    color: #92400e;
  }

  .logs-datasource-badge {
    padding: 1px 8px;
    border-radius: 999px;
    font-size: 12px;
    background: #d97706;
    color: #fff;
  }

  .logs-builder {
    padding: 14px 14px 12px;
    margin-bottom: 12px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
    background: color-mix(in srgb, var(--el-fill-color-light) 60%, transparent);
  }

  .logs-builder__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
  }

  .logs-builder__title {
    font-size: 13px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .logs-builder__empty {
    padding: 8px 0 12px;
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  .logs-filter-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .logs-filter-row {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .logs-filter-key {
    width: 180px;
  }

  .logs-filter-operator {
    width: 100px;
  }

  .logs-filter-value {
    width: 260px;
    max-width: 100%;
  }

  .logs-query-row {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    margin-top: 14px;
  }

  .logs-search {
    width: 360px;
    max-width: 100%;
  }

  .logs-query-editor-wrap {
    flex: 1;
    min-width: 280px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .logs-query-editor {
    flex: 1;
  }

  .logs-query-editor :deep(.el-input__wrapper) {
    padding: 8px 12px;
    min-height: 36px;
    font-family: Consolas, 'Courier New', monospace;
    font-size: 12px;
    line-height: 1.5;
    color: var(--el-color-success);
    background: var(--el-fill-color-darker);
  }

  .logs-query-editor :deep(input) {
    color: var(--el-color-success);
  }

  .logs-query-reset {
    flex: none;
  }

  .logs-empty {
    padding: 18px 0;
    color: var(--el-text-color-secondary);
    font-size: 13px;
  }

  .logs-table :deep(.el-table__expanded-cell) {
    padding: 0;
    background: #131a22;
  }

  .logs-inline-detail {
    padding: 16px 18px;
    border-left: 3px solid #73bf69;
    background: linear-gradient(180deg, rgba(20, 26, 33, 0.98) 0%, rgba(15, 20, 26, 0.98) 100%);
  }

  .logs-inline-detail__section + .logs-inline-detail__section {
    margin-top: 16px;
  }

  .logs-inline-detail__title {
    margin-bottom: 10px;
    font-size: 13px;
    font-weight: 600;
    color: #c7d0d9;
  }

  .logs-field-list {
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.02);
  }

  .logs-field-item {
    display: grid;
    grid-template-columns: 180px minmax(0, 1fr);
    gap: 12px;
    padding: 8px 12px;
    font-size: 12px;
    line-height: 1.6;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .logs-field-item:first-child {
    border-top: none;
  }

  .logs-field-item__key {
    color: #8fa2b7;
    font-family: Consolas, 'Courier New', monospace;
  }

  .logs-field-item__value {
    color: #e6edf3;
    word-break: break-word;
  }

  .logs-detail-code {
    margin: 0;
    padding: 12px;
    white-space: pre-wrap;
    word-break: break-word;
    font-size: 12px;
    line-height: 1.6;
    color: #e6edf3;
    font-family: Consolas, 'Courier New', monospace;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.02);
  }

  .logs-header-editor {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
  }

  .logs-header-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
    gap: 10px;
    width: 100%;
  }

  .logs-form-type {
    width: 100%;
  }

  .logs-form-tip {
    margin-top: 6px;
    font-size: 12px;
    line-height: 1.5;
    color: var(--el-text-color-secondary);
  }

  .logs-datasource-test {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .logs-datasource-test__message {
    font-size: 12px;
    line-height: 1.5;
  }

  .logs-datasource-test__message--success {
    color: var(--el-color-success);
  }

  .logs-datasource-test__message--error {
    color: var(--el-color-danger);
  }

  @media (max-width: 768px) {
    .page-hd-main {
      width: 100%;
    }

    .page-hd-actions__stack {
      width: 100%;
      align-items: stretch;
      margin-left: 0;
    }

    .page-hd-actions {
      width: 100%;
      flex: 1 1 100%;
    }

    .page-hd-actions__right {
      justify-content: flex-start;
      margin-left: 0;
    }

    .logs-toolbar-datasource {
      align-items: stretch;
      justify-content: flex-start;
    }

    .logs-toolbar-datasource__select {
      width: 100%;
    }

    .logs-toolbar-datasource__url {
      max-width: 100%;
    }

    .logs-header-row {
      grid-template-columns: 1fr;
    }
  }
</style>

