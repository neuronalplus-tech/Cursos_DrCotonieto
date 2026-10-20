import { getReportData } from '../services/pasmuService'
import useServiceData from '../hooks/useServiceData'
import { useEffect, useMemo, useRef, useState } from 'react'
import { hasPermission } from '../lib/permissions'
import {
  getPreviousMonthComparison,
  getTargetProgress,
  summarizeMeasurements
} from '../lib/indicatorAnalytics'

function formatNumber(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'

  return new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(number)
}

function escapeCsv(value) {
  const text = String(value ?? '')
  const safeText = typeof value === 'string' && /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text
  return `"${safeText.replaceAll('"', '""')}"`
}

function downloadMeasurements(rows, seriesRows, scope) {
  const columns = [
    'Indicador',
    'Periodo',
    'Unidad PASMU',
    'Programa visible',
    'Valor',
    'Unidad de medida',
    'Meta',
    'Avance valor/meta',
    'Variación vs mes anterior',
    'Generado en'
  ]
  const generatedAt = new Date().toISOString()
  const csvRows = rows.map((item) => {
    const progress = getTargetProgress(item)
    const comparison = getPreviousMonthComparison(seriesRows, item)
    return [
      item.categoria,
      item.periodo,
      scope.unit,
      scope.program,
      item.total,
      item.unidadMedida,
      item.meta,
      progress.status === 'calculable' ? `${formatNumber(progress.percentage)}%` : '',
      comparison
        ? `${comparison.previousPeriod}: ${comparison.difference > 0 ? '+' : ''}${comparison.difference}`
        : '',
      generatedAt
    ]
  })
  const content = `\uFEFF${[columns, ...csvRows].map((row) => row.map(escapeCsv).join(',')).join('\r\n')}`
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'mediciones-pasmu.csv'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export default function Reportes({ user }) {
  const [refreshKey, setRefreshKey] = useState(0)
  const { data, loading, error } = useServiceData(getReportData, user, refreshKey)
  const [additionalPagesState, setAdditionalPagesState] = useState([])
  const [loadingMore, setLoadingMore] = useState(false)
  const [pageError, setPageError] = useState('')
  const pageRequestId = useRef(0)
  const loadingMoreRef = useRef(false)
  const contextKey = [
    user?.authUserId || user?.name || 'anonymous',
    user?.membershipId ?? '',
    user?.roleId ?? user?.role ?? '',
    user?.unitId ?? '',
    user?.programId ?? '',
    refreshKey
  ].join(':')
  const additionalPages = additionalPagesState
    .filter((page) => page.contextKey === contextKey)
    .map((page) => page.data)
  const reportesTablas = useMemo(
    () => [...(data?.tables || []), ...additionalPages.flatMap((page) => page.tables)],
    [data, additionalPagesState, contextKey]
  )
  const indicadores = data?.indicators
  const queryLimits = data?.limits
  const lastPage = additionalPages.at(-1)
  const hasMore = lastPage?.page.hasMore ?? data?.page?.hasMore ?? false
  const maxRowsPerPage = queryLimits?.maxRows
    ?? additionalPages[0]?.limits?.maxRows
    ?? 200
  const [periodFilter, setPeriodFilter] = useState('todos')
  const [indicatorSearch, setIndicatorSearch] = useState('')
  const [catalogSearch, setCatalogSearch] = useState('')
  const [exportMessage, setExportMessage] = useState('')
  const periods = useMemo(
    () => [...new Set(reportesTablas.map((item) => item.periodo).filter(Boolean))],
    [reportesTablas]
  )
  useEffect(() => {
    if (!periods.includes(periodFilter)) setPeriodFilter('todos')
  }, [periods, periodFilter])
  useEffect(() => {
    pageRequestId.current += 1
    loadingMoreRef.current = false
    setAdditionalPagesState([])
    setPageError('')
    setLoadingMore(false)
  }, [refreshKey, contextKey])
  const visibleRows = useMemo(() => reportesTablas.filter((item) => {
    const matchesPeriod = periodFilter === 'todos' || item.periodo === periodFilter
    const matchesIndicator = item.categoria.toLocaleLowerCase('es-MX')
      .includes(indicatorSearch.trim().toLocaleLowerCase('es-MX'))
    return matchesPeriod && matchesIndicator
  }), [reportesTablas, periodFilter, indicatorSearch])
  const indicatorSummary = useMemo(() => summarizeMeasurements(visibleRows), [visibleRows])
  const visibleIndicators = Array.isArray(indicadores)
    ? indicadores.filter((item) => `${item.nombre} ${item.codigo}`
      .toLocaleLowerCase('es-MX')
      .includes(catalogSearch.trim().toLocaleLowerCase('es-MX')))
    : []
  const clearFilters = () => {
    setPeriodFilter('todos')
    setIndicatorSearch('')
    setCatalogSearch('')
  }
  const exportVisibleRows = () => {
    try {
      downloadMeasurements(visibleRows, reportesTablas, {
        unit: user?.unit || 'No especificada',
        program: user?.program || 'Ámbito de unidad autorizado'
      })
      setExportMessage(`${visibleRows.length} mediciones visibles exportadas.`)
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'error del navegador'
      setExportMessage(`No se pudo generar el CSV: ${detail}`)
    }
  }
  const loadMore = async () => {
    if (loadingMoreRef.current) return

    const requestId = ++pageRequestId.current
    const requestedContextKey = contextKey
    const requestedOffset = reportesTablas.length
    loadingMoreRef.current = true
    setLoadingMore(true)
    setPageError('')
    try {
      const page = await getReportData(user, { offset: requestedOffset })
      if (requestId !== pageRequestId.current || requestedContextKey !== contextKey) return
      setAdditionalPagesState((current) => [...current, { contextKey: requestedContextKey, data: page }])
    } catch (loadError) {
      if (requestId !== pageRequestId.current || requestedContextKey !== contextKey) return
      const detail = loadError instanceof Error ? loadError.message : 'error inesperado'
      setPageError(`No se pudo cargar la siguiente página: ${detail}`)
    } finally {
      if (requestId === pageRequestId.current) {
        loadingMoreRef.current = false
        setLoadingMore(false)
      }
    }
  }

  return (
    <section>
      <h1>Reportes institucionales</h1>
      <div className="toolbar">
        <span className="tag">Unidad: {user?.unit || 'No especificada'}{user?.program ? ` · Programa: ${user.program}` : ''}</span>
        <button
          type="button"
          className="secondary-btn"
          onClick={() => setRefreshKey((current) => current + 1)}
          disabled={loading || loadingMore}
        >
          {loading ? 'Actualizando…' : 'Actualizar reportes'}
        </button>
      </div>
      {loading && <p role="status">Cargando reportes…</p>}
      {error && <p className="form-error" role="alert">No se pudieron cargar los reportes: {error}</p>}
      {data && !error && <div className="cards">
        <div className="card">
          <span>Mediciones visibles</span>
          <strong>{indicatorSummary.measurements}</strong>
          <small>{periodFilter === 'todos' ? 'En los periodos consultados' : `Periodo ${periodFilter}`}</small>
        </div>
        <div className="card">
          <span>Indicadores medidos</span>
          <strong>{indicatorSummary.indicators}</strong>
          <small>Dentro de los filtros actuales</small>
        </div>
        <div className="card">
          <span>Mediciones sin meta</span>
          <strong>{indicatorSummary.withoutTarget}</strong>
          <small>Requieren definir o revisar la meta del periodo</small>
        </div>
        <div className="card">
          <span>Capturas repetidas posibles</span>
          <strong>{indicatorSummary.duplicateGroups}</strong>
          <small>Indicador y periodo repetidos en el contexto visible</small>
        </div>
        {Array.isArray(indicadores) && (
          <div className="card">
            <span>Indicadores activos</span>
            <strong>{indicadores.length}</strong>
            <small>En el catálogo visible para tu sesión</small>
          </div>
        )}
      </div>}

      {visibleRows.length > 0 && (
        <div className="panel indicator-quality" aria-labelledby="indicator-quality-heading">
          <h3 id="indicator-quality-heading">Control de calidad de las mediciones visibles</h3>
          <p>
            Estas señales ayudan a priorizar una revisión; no modifican datos ni confirman por sí solas que una captura sea incorrecta.
          </p>
          {indicatorSummary.duplicateDetails.length > 0 ? (
            <ul>
              {indicatorSummary.duplicateDetails.map((item) => (
                <li key={item.key}>
                  {item.indicator} · {item.period}: {item.count} capturas; verificar si corresponden a registros distintos o a una repetición.
                </li>
              ))}
            </ul>
          ) : (
            <p role="status">No se detectaron capturas repetidas para el mismo indicador y periodo entre las filas visibles.</p>
          )}
          {indicatorSummary.withoutTarget > 0 && (
            <p role="note">
              Hay {indicatorSummary.withoutTarget} mediciones sin una meta asociada al periodo y contexto visibles.
            </p>
          )}
          {indicatorSummary.nonComputableTargets > 0 && (
            <p role="note">
              Hay {indicatorSummary.nonComputableTargets} mediciones con meta igual o menor a cero; el porcentaje valor/meta no se calcula.
            </p>
          )}
        </div>
      )}

      <div className="panel">
        <h3>Mediciones por indicador y periodo</h3>
        <div className="filter-row">
          <label>
            Buscar indicador
            <input
              type="search"
              value={indicatorSearch}
              onChange={(event) => setIndicatorSearch(event.target.value)}
              placeholder="Nombre del indicador"
              aria-label="Buscar mediciones por nombre de indicador"
            />
          </label>
          <label>
            Periodo
            <select
              value={periodFilter}
              onChange={(event) => setPeriodFilter(event.target.value)}
              aria-label="Filtrar mediciones por periodo"
            >
              <option value="todos">Todos los periodos consultados</option>
              {periods.map((period) => <option key={period} value={period}>{period}</option>)}
            </select>
          </label>
        </div>
        {(periodFilter !== 'todos' || indicatorSearch) && (
          <button
            type="button"
            className="secondary-btn"
            onClick={clearFilters}
          >
            Limpiar filtros
          </button>
        )}
        {hasPermission(user, 'reportes.exportar') && visibleRows.length > 0 && (
          <button type="button" className="secondary-btn" onClick={exportVisibleRows}>
            Exportar filas visibles (CSV)
          </button>
        )}
        {exportMessage && <p className="form-hint" role="status">{exportMessage}</p>}
        {visibleRows.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Indicador</th><th>Periodo</th><th>Valor</th><th>Meta</th><th>Avance valor/meta</th><th>Variación mensual</th></tr>
              </thead>
              <tbody>
                {visibleRows.map((item, index) => (
                  <tr key={`${item.indicadorId ?? item.categoria}-${item.periodo || 'sin-periodo'}-${index}`}>
                    <td>{item.categoria}</td>
                    <td>{item.periodo || '—'}</td>
                    <td>{formatNumber(item.total)}{item.unidadMedida ? ` ${item.unidadMedida}` : ''}</td>
                    <td>{item.meta === null || item.meta === undefined
                      ? '—'
                      : `${formatNumber(item.meta)}${item.unidadMedida ? ` ${item.unidadMedida}` : ''}`}</td>
                    <td>
                      {(() => {
                        const progress = getTargetProgress(item)
                        if (progress.status === 'sin-meta') return 'Sin meta'
                        if (progress.status === 'meta-no-positiva') return 'No calculable (meta ≤ 0)'
                        if (progress.status !== 'calculable') return 'Dato no numérico'
                        return (
                          <div className="indicator-progress">
                            <progress
                              max="100"
                              value={Math.max(0, Math.min(100, progress.percentage))}
                              aria-label={`${formatNumber(progress.percentage)} por ciento del valor de la meta`}
                            />
                            <span>{formatNumber(progress.percentage)}%</span>
                          </div>
                        )
                      })()}
                    </td>
                    <td>{(() => {
                      const comparison = getPreviousMonthComparison(reportesTablas, item)
                      if (!comparison) return 'Sin captura previa comparable en datos cargados'
                      const sign = comparison.difference > 0 ? '+' : ''
                      return `${comparison.previousPeriod}: ${sign}${formatNumber(comparison.difference)}${item.unidadMedida ? ` ${item.unidadMedida}` : ''}`
                    })()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : !loading && !error && (
          <div className="empty-state" role="status">
            <strong>{reportesTablas.length
              ? 'No hay mediciones que coincidan con estos filtros.'
              : 'No hay mediciones visibles para esta sesión.'}</strong>
            <p>
              {!reportesTablas.length
                ? 'Puede que aún no se hayan capturado datos en la unidad o programa autorizado. Este resultado no indica si existen registros en otros ámbitos. Si esperabas ver información, pide verificar el periodo, la unidad, el programa y el permiso de reportes.'
                : 'Prueba con otro periodo o elimina el texto de búsqueda.'}
            </p>
          </div>
        )}
        {visibleRows.length > 0 && (
          <p className="form-hint">
            El avance es una razón matemática valor/meta, no una calificación de desempeño. La variación solo compara meses consecutivos YYYY-MM con una captura única por mes; un cambio positivo no implica mejora sin definir la dirección deseada del indicador.
          </p>
        )}
        {((queryLimits && (queryLimits.targetsReached || queryLimits.measurementsReached)) ||
          additionalPages.some((page) => page.limits.measurementsReached || page.limits.targetsReached)) && (
          <p className="form-hint" role="note">
            Se alcanzó el máximo de {maxRowsPerPage} filas para al menos una consulta de mediciones o metas.
            La paginación permite continuar con las mediciones visibles para tu sesión.
          </p>
        )}
        {pageError && <p className="form-error" role="alert">{pageError}</p>}
        {additionalPages.length > 0 && (
          <p className="form-hint" role="status">
            Mostrando {reportesTablas.length} mediciones cargadas para tu sesión.
          </p>
        )}
        {hasMore && (
          <button
            type="button"
            className="secondary-btn"
            onClick={loadMore}
            disabled={loadingMore || loading}
          >
            {loadingMore ? 'Cargando…' : 'Cargar más mediciones'}
          </button>
        )}
      </div>

      {Array.isArray(indicadores) && (
        <div className="panel">
          <h3>Catálogo de indicadores activos</h3>
          <div className="filter-row">
            <label>
              Buscar en el catálogo
              <input
                type="search"
                value={catalogSearch}
                onChange={(event) => setCatalogSearch(event.target.value)}
                placeholder="Nombre o código"
                aria-label="Buscar indicadores activos por nombre o código"
              />
            </label>
          </div>
          {(catalogSearch || periodFilter !== 'todos' || indicatorSearch) && (
            <button type="button" className="secondary-btn" onClick={clearFilters}>
              Limpiar todos los filtros
            </button>
          )}
          {visibleIndicators.length > 0 ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Indicador</th><th>Código</th><th>Tipo</th><th>Unidad de medida</th><th>Descripción</th></tr>
                </thead>
                <tbody>
                  {visibleIndicators.map((indicador) => (
                    <tr key={indicador.id}>
                      <td>{indicador.nombre}</td>
                      <td>{indicador.codigo}</td>
                      <td>{indicador.tipo || '—'}</td>
                      <td>{indicador.unidadMedida || '—'}</td>
                      <td>{indicador.descripcion || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : !loading && !error && (
            <p className="empty-state" role="status">
              {indicadores.length
                ? 'No hay indicadores que coincidan con la búsqueda. Prueba con otro nombre o código.'
                : 'No hay indicadores activos visibles para esta sesión. Si esperabas ver el catálogo, verifica que existan indicadores activos y que tu rol tenga permiso de reportes.'}
            </p>
          )}
          {queryLimits?.indicatorsReached && (
            <p className="form-hint" role="note">
              Se alcanzó el máximo de {queryLimits.maxRows} indicadores consultados; el catálogo podría tener más.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
