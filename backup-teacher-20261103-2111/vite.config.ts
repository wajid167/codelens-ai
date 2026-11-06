import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

function codeLensCompilerPlugin(env: Record<string, string>) {
  const recentRequests = new Map<string, number[]>()

  return {
    name: 'codelens-jdoodle-compiler',
    configureServer(server: any) {
      server.middlewares.use('/api/execute', (req: any, res: any) => {
        const send = (status: number, payload: unknown) => {
          res.statusCode = status
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.setHeader('Cache-Control', 'no-store')
          res.end(JSON.stringify(payload))
        }

        if (req.method !== 'POST') {
          send(405, { error: 'Use POST to run code.' })
          return
        }

        const clientId = env.JDOODLE_CLIENT_ID
        const clientSecret = env.JDOODLE_CLIENT_SECRET

        if (!clientId || !clientSecret) {
          send(503, {
            error: 'Compiler is not configured yet. Add your JDoodle Client ID and Client Secret to .env.local, then restart the dev server.',
          })
          return
        }

        const ip = req.socket?.remoteAddress || 'local'
        const now = Date.now()
        const recent = (recentRequests.get(ip) || []).filter((time) => now - time < 60_000)
        if (recent.length >= 10) {
          send(429, { error: 'Too many runs in a short time. Please wait one minute and try again.' })
          return
        }
        recent.push(now)
        recentRequests.set(ip, recent)

        let body = ''
        let tooLarge = false

        req.on('data', (chunk: Buffer) => {
          body += chunk.toString('utf8')
          if (body.length > 40_000) {
            tooLarge = true
            send(413, { error: 'Your code and input are too large. Please keep them under 40 KB.' })
            req.destroy()
          }
        })

        req.on('end', async () => {
          if (tooLarge) return

          try {
            const parsed = JSON.parse(body || '{}')
            const code = typeof parsed.code === 'string' ? parsed.code : ''
            const stdin = typeof parsed.stdin === 'string' ? parsed.stdin : ''

            if (!code.trim()) {
              send(400, { error: 'Please write some C++ code before running it.' })
              return
            }
            if (code.length > 30_000 || stdin.length > 8_000) {
              send(413, { error: 'Code or input is too long. Reduce it and try again.' })
              return
            }

            const upstream = await fetch('https://api.jdoodle.com/v1/execute', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                clientId,
                clientSecret,
                script: code,
                stdin,
                language: 'cpp17',
                versionIndex: '0',
              }),
              signal: AbortSignal.timeout(35_000),
            })

            const result = await upstream.json().catch(() => ({}))

            if (!upstream.ok) {
              const message = typeof result.error === 'string'
                ? result.error
                : `JDoodle returned HTTP ${upstream.status}. Check your API credentials and daily allowance.`
              send(upstream.status === 429 ? 429 : 502, { error: message })
              return
            }

            send(200, {
              output: typeof result.output === 'string' ? result.output : '',
              statusCode: result.statusCode ?? null,
              cpuTime: result.cpuTime ?? null,
              memory: result.memory ?? null,
            })
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Unexpected compiler error.'
            send(500, { error: message })
          }
        })
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  // loadEnv with an empty prefix keeps JDoodle credentials server-side.
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), codeLensCompilerPlugin(env)],
  }
})
