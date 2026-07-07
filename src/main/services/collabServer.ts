import { WebSocketServer, WebSocket } from 'ws'
import { networkInterfaces } from 'os'

export class CollabServerManager {
  static collabilationServer: WebSocketServer | null = null
  static activeConnections: Set<WebSocket> = new Set()
  static collabSessionToken: string | null = null

  static getLocalIPAddress() {
    const nets = networkInterfaces()
    for (const name of Object.keys(nets)) {
      const interfaces = nets[name]
      if (interfaces) {
        for (const net of interfaces) {
          if (net.family === 'IPv4' && !net.internal) {
            return net.address
          }
        }
      }
    }
    return 'localhost'
  }

  static async startServer(port: number, onStatus: (status: any) => void) {
    const localIp = this.getLocalIPAddress()
    if (this.collabilationServer) {
      onStatus({ running: true, port, ip: localIp, token: this.collabSessionToken })
      return { running: true, port, ip: localIp, token: this.collabSessionToken }
    }
    try {
      const { randomUUID } = await import('crypto')
      this.collabSessionToken = randomUUID()

      this.collabilationServer = new WebSocketServer({
        port,
        perMessageDeflate: {
          zlibDeflateOptions: { chunkSize: 1024, memLevel: 7, level: 4 },
          zlibInflateOptions: { chunkSize: 10 * 1024 },
          threshold: 1024,
        },
      })
      this.activeConnections = new Set()
      this.collabilationServer.on('connection', (ws, req) => {
        try {
          const reqUrl = new URL(req.url || '/', `http://localhost`)
          const clientToken = reqUrl.searchParams.get('token')
          if (!clientToken || clientToken !== this.collabSessionToken) {
            ws.close(1008, 'Unauthorized: invalid session token')
            return
          }
        } catch {
          ws.close(1008, 'Unauthorized: invalid request')
          return
        }

        this.activeConnections.add(ws)
        ws.on('message', (message, isBinary) => {
          for (const client of this.activeConnections) {
            if (client !== ws && client.readyState === 1) {
              client.send(message, { binary: isBinary })
            }
          }
        })
        ws.on('close', () => this.activeConnections.delete(ws))
        ws.on('error', () => this.activeConnections.delete(ws))
      })

      this.collabilationServer.on('error', (err: any) => {
        console.error('[collabServer] 런타임 오류:', err)
        onStatus({ running: false, error: err.message, ip: localIp })
        this.collabilationServer = null
        this.collabSessionToken = null
      })

      onStatus({ running: true, port, ip: localIp, token: this.collabSessionToken })
      return { running: true, port, ip: localIp, token: this.collabSessionToken }
    } catch (err: any) {
      console.error('[collabServer] 서버 시작 실패:', err)
      this.collabilationServer = null
      this.collabSessionToken = null
      onStatus({ running: false, error: err.message, ip: localIp })
      return { running: false, error: err.message }
    }
  }

  static stopServer(onStatus: (status: any) => void) {
    if (this.collabilationServer) {
      for (const ws of this.activeConnections) ws.close()
      this.activeConnections.clear()
      this.collabilationServer.close()
      this.collabilationServer = null
      this.collabSessionToken = null
    }
    onStatus({ running: false })
    return { running: false }
  }
}
