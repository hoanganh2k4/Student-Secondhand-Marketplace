import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../prisma/prisma.service'

// Endpoints that are noise — don't log them
const NO_LOG_PATHS = new Set(['/health', '/stats'])

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name)

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private get baseUrl(): string {
    const url = this.config.get<string>('AI_SERVICE_URL', 'http://localhost:8000')
    return url.replace(/\/$/, '')
  }

  private async call<T>(path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const t0  = Date.now()
    let output: T | undefined
    let error: string | undefined

    try {
      const res = await fetch(url, {
        method:  body ? 'POST' : 'GET',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body:    body ? JSON.stringify(body) : undefined,
        signal:  AbortSignal.timeout(15_000),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new ServiceUnavailableException(`AI service error ${res.status}: ${text}`)
      }
      output = await res.json()
      return output as T
    } catch (err: any) {
      error = err?.message ?? String(err)
      if (err instanceof ServiceUnavailableException) throw err
      this.logger.error(`AI service unreachable at ${url}: ${error}`)
      throw new ServiceUnavailableException('AI service is unreachable')
    } finally {
      if (!NO_LOG_PATHS.has(path)) {
        const latencyMs = Date.now() - t0
        this.prisma.aiCallLog.create({
          data: {
            endpoint:   path,
            inputData:  (body ?? {}) as any,
            outputData: output as any ?? undefined,
            latencyMs,
            error,
          },
        }).catch(() => null) // fire-and-forget, never block the response
      }
    }
  }

  health() {
    return this.call('/health')
  }

  stats() {
    return this.call('/stats')
  }

  parseQuery(query: string) {
    return this.call('/stage0/parse', { query })
  }

  extractKeywords(text: string, top_n = 6) {
    return this.call('/stage0/keywords', { text, top_n })
  }

  search(query: string, top_k = 10) {
    return this.call('/search', { query, top_k })
  }

  retrieve(query: string, top_k = 20) {
    return this.call('/stage2/retrieve', { query, top_k })
  }

  scorePairs(query: string, candidates: Array<{ id: string; text: string }>) {
    return this.call('/score-pairs', { query, candidates })
  }

  visionFilter(image_urls: string[], query: string, threshold = 0.20) {
    return this.call('/vision/filter', { image_urls, query, threshold })
  }

  visionScore(image_urls: string[], query: string) {
    return this.call('/vision/score', { image_urls, query, threshold: 0 })
  }

  visionExtract(image_url: string, tasks = ['caption', 'ocr']) {
    return this.call('/vision/extract', { image_url, tasks })
  }

  visionListingContext(image_urls: string[]) {
    return this.call('/vision/listing-context', { image_urls })
  }
}
