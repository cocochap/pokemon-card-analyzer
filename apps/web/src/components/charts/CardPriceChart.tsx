'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  HistogramData,
  ColorType,
  CrosshairMode,
  LineSeries,
  CandlestickSeries,
  HistogramSeries,
} from 'lightweight-charts'
import { BarChart2, CandlestickChart, LineChart, Loader2, TrendingUp, ZoomIn } from 'lucide-react'
import { clsx } from 'clsx'
import { api } from '@/lib/api'
import { formatCurrency } from '@/lib/formatters'

type ChartType = 'line' | 'candle'
type TimeRange = '7d' | '30d' | '90d' | '1y' | 'all'

const TIME_RANGES: { label: string; value: TimeRange }[] = [
  { label: '7D', value: '7d' },
  { label: '30D', value: '30d' },
  { label: '90D', value: '90d' },
  { label: '1Y', value: '1y' },
  { label: 'ALL', value: 'all' },
]

interface CardPriceChartProps {
  cardId: string
}

export function CardPriceChart({ cardId }: CardPriceChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Line'> | ISeriesApi<'Candlestick'> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const maSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)

  const [chartType, setChartType] = useState<ChartType>('line')
  const [timeRange, setTimeRange] = useState<TimeRange>('30d')
  const [currentPrice, setCurrentPrice] = useState<number | null>(null)
  const [hoveredPrice, setHoveredPrice] = useState<number | null>(null)
  const [showMA, setShowMA] = useState(true)
  const [showVolume, setShowVolume] = useState(true)

  const { data, isLoading } = useQuery({
    queryKey: ['card-price-history', cardId, timeRange, chartType],
    queryFn: () => api.cards.getPriceHistory(cardId, { range: timeRange, type: chartType }),
    staleTime: 60_000,
  })

  const initChart = useCallback(() => {
    if (!chartContainerRef.current) return

    if (chartRef.current) {
      chartRef.current.remove()
      chartRef.current = null
    }

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: 'rgba(148, 163, 184, 0.8)',
        fontFamily: 'var(--font-geist-mono)',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.04)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.04)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: 'rgba(255, 203, 5, 0.3)',
          labelBackgroundColor: '#FFCB05',
        },
        horzLine: {
          color: 'rgba(255, 203, 5, 0.3)',
          labelBackgroundColor: '#FFCB05',
        },
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        scaleMargins: { top: 0.1, bottom: showVolume ? 0.25 : 0.05 },
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { mouseWheel: true, pinch: true },
    })

    chartRef.current = chart

    // Main price series
    if (chartType === 'candle') {
      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#22C55E',
        downColor: '#EF4444',
        borderUpColor: '#22C55E',
        borderDownColor: '#EF4444',
        wickUpColor: '#22C55E',
        wickDownColor: '#EF4444',
      })
      seriesRef.current = candleSeries as ISeriesApi<'Line'> | ISeriesApi<'Candlestick'>
    } else {
      const lineSeries = chart.addSeries(LineSeries, {
        color: '#FFCB05',
        lineWidth: 2,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 5,
        crosshairMarkerBackgroundColor: '#FFCB05',
        priceLineVisible: false,
      })
      seriesRef.current = lineSeries
    }

    // Volume histogram
    if (showVolume) {
      const volSeries = chart.addSeries(HistogramSeries, {
        color: 'rgba(255, 203, 5, 0.15)',
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
      })
      chart.priceScale('volume').applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      })
      volumeSeriesRef.current = volSeries
    }

    // Moving average
    if (showMA) {
      const ma = chart.addSeries(LineSeries, {
        color: 'rgba(61, 125, 202, 0.8)',
        lineWidth: 1,
        lineStyle: 2,
        crosshairMarkerVisible: false,
        priceLineVisible: false,
        lastValueVisible: false,
      })
      maSeriesRef.current = ma
    }

    // Crosshair price update
    chart.subscribeCrosshairMove((param) => {
      if (param.point && seriesRef.current) {
        const price = param.seriesData.get(seriesRef.current)
        if (price) {
          const val = typeof price === 'object' && 'close' in price ? price.close : (price as { value: number }).value
          setHoveredPrice(val)
        }
      } else {
        setHoveredPrice(null)
      }
    })

    // Auto-resize
    const resizeObserver = new ResizeObserver(() => {
      if (chartContainerRef.current && chart) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth })
      }
    })
    resizeObserver.observe(chartContainerRef.current)

    return () => resizeObserver.disconnect()
  }, [chartType, showVolume, showMA])

  useEffect(() => {
    const cleanup = initChart()
    return cleanup
  }, [initChart])

  useEffect(() => {
    if (!data || !seriesRef.current) return

    if (chartType === 'candle') {
      ;(seriesRef.current as ISeriesApi<'Candlestick'>).setData(data.candles as CandlestickData[])
    } else {
      ;(seriesRef.current as ISeriesApi<'Line'>).setData(data.prices)
    }

    if (data.prices.length > 0) {
      const last = data.prices[data.prices.length - 1]
      setCurrentPrice(last.value)
    }

    if (volumeSeriesRef.current && data.volumes) {
      volumeSeriesRef.current.setData(data.volumes as HistogramData[])
    }

    if (maSeriesRef.current && data.ma20) {
      maSeriesRef.current.setData(data.ma20)
    }

    chartRef.current?.timeScale().fitContent()
  }, [data, chartType])

  const displayPrice = hoveredPrice ?? currentPrice
  const priceChange = data?.priceChange ?? 0

  return (
    <div className="glass-card overflow-hidden">
      {/* Chart Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 border-b border-white/10">
        <div className="flex items-center gap-4">
          <div>
            <div className="text-2xl font-bold font-mono">
              {displayPrice !== null ? formatCurrency(displayPrice) : '—'}
            </div>
            <div
              className={clsx(
                'text-sm font-medium',
                priceChange >= 0 ? 'text-market-bull' : 'text-market-bear',
              )}
            >
              {priceChange >= 0 ? '+' : ''}
              {priceChange.toFixed(2)}%
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Time Range Selector */}
          <div className="flex rounded-lg overflow-hidden border border-white/10">
            {TIME_RANGES.map(({ label, value }) => (
              <button
                key={value}
                onClick={() => setTimeRange(value)}
                className={clsx(
                  'px-3 py-1.5 text-xs font-medium transition-colors',
                  timeRange === value
                    ? 'bg-pokemon-yellow/20 text-pokemon-yellow'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/5',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Chart Type Toggle */}
          <div className="flex rounded-lg overflow-hidden border border-white/10">
            <button
              onClick={() => setChartType('line')}
              className={clsx(
                'p-2 transition-colors',
                chartType === 'line' ? 'bg-pokemon-yellow/20 text-pokemon-yellow' : 'text-muted-foreground hover:bg-white/5',
              )}
            >
              <LineChart className="w-4 h-4" />
            </button>
            <button
              onClick={() => setChartType('candle')}
              className={clsx(
                'p-2 transition-colors',
                chartType === 'candle' ? 'bg-pokemon-yellow/20 text-pokemon-yellow' : 'text-muted-foreground hover:bg-white/5',
              )}
            >
              <CandlestickChart className="w-4 h-4" />
            </button>
          </div>

          {/* Indicators */}
          <button
            onClick={() => setShowMA(!showMA)}
            className={clsx(
              'px-3 py-1.5 text-xs rounded-lg border transition-colors',
              showMA
                ? 'border-pokemon-blue/50 bg-pokemon-blue/10 text-pokemon-blue'
                : 'border-white/10 text-muted-foreground hover:bg-white/5',
            )}
          >
            MA20
          </button>
          <button
            onClick={() => setShowVolume(!showVolume)}
            className={clsx(
              'px-3 py-1.5 text-xs rounded-lg border transition-colors flex items-center gap-1',
              showVolume
                ? 'border-pokemon-yellow/50 bg-pokemon-yellow/10 text-pokemon-yellow'
                : 'border-white/10 text-muted-foreground hover:bg-white/5',
            )}
          >
            <BarChart2 className="w-3 h-3" />
            VOL
          </button>
        </div>
      </div>

      {/* Chart Area */}
      <div className="relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10 backdrop-blur-sm">
            <Loader2 className="w-8 h-8 text-pokemon-yellow animate-spin" />
          </div>
        )}
        <div
          ref={chartContainerRef}
          className="w-full h-80"
          style={{ minHeight: '320px' }}
        />
      </div>

      {/* RSI Indicator Row */}
      {data?.rsi && (
        <div className="px-4 py-2 border-t border-white/10 flex items-center gap-4 text-xs">
          <span className="text-muted-foreground">RSI(14)</span>
          <span
            className={clsx(
              'font-mono font-medium',
              data.rsi > 70 ? 'text-market-bear' : data.rsi < 30 ? 'text-market-bull' : 'text-foreground',
            )}
          >
            {data.rsi.toFixed(2)}
          </span>
          <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className={clsx(
                'h-full rounded-full transition-all',
                data.rsi > 70 ? 'bg-market-bear' : data.rsi < 30 ? 'bg-market-bull' : 'bg-pokemon-yellow',
              )}
              style={{ width: `${data.rsi}%` }}
            />
          </div>
          <span className="text-muted-foreground">
            {data.rsi > 70 ? 'Overbought' : data.rsi < 30 ? 'Oversold' : 'Neutral'}
          </span>
        </div>
      )}
    </div>
  )
}
