/**
 * @file googleAuthIpc.ts
 * @system AMEVA Workstation - Desktop Main process
 * @location src/main/ipc/googleAuthIpc.ts
 * @role Google OAuth 2.0 Secure Authentication and Google Drive integration IPC handler
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - 타사 로그인 수단을 배제하고 오직 구글 인증 및 구글 드라이브 통합만을 지원한다.
 * - 포트 대기하는 로컬 HTTP 서버 없이, Electron BrowserWindow의 리디렉션 감지 기법을 이용한 순수 인앱 OAuth 2.0 정공법 프로토콜을 통제한다.
 * - safeStorage를 활용한 토큰 암호화 격리 저장 및 갱신(Refresh) 매커니즘을 책임진다.
 */

import { app, ipcMain, safeStorage, BrowserWindow } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs'

// 구글 보안 토큰 보관소 경로
const authStorePath = join(app.getPath('userData'), 'google_auth.json')

// 🦾 [GOOGLE CLIENT ID DYNAMIC RESOLUTION] 키체인(credentials.json)으로부터 구글 Client ID 복호화 취득
function getGoogleClientIdFromKeychain(): string {
  try {
    const credentialsPath = join(app.getPath('userData'), 'credentials.json')
    if (existsSync(credentialsPath)) {
      const data = JSON.parse(readFileSync(credentialsPath, 'utf8'))
      const encryptedBase64 = data['google-client-id']
      if (encryptedBase64 && safeStorage.isEncryptionAvailable()) {
        const decrypted = safeStorage.decryptString(Buffer.from(encryptedBase64, 'base64'))
        if (decrypted && decrypted.trim() !== '') {
          return decrypted.trim()
        }
      } else if (encryptedBase64) {
        const plain = Buffer.from(encryptedBase64, 'base64').toString('utf8')
        if (plain && plain.trim() !== '') {
          return plain.trim()
        }
      }
    }
  } catch (err) {
    console.error('[googleAuth] 키체인 Google Client ID 로딩 실패:', err)
  }
  // 폴백 기본 데모 ID
  return process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '109283748293-abcdefg.apps.googleusercontent.com'
}

const REDIRECT_URI = 'http://localhost'

// 🦾 [SECURE KEYCHAIN HELPER] safeStorage 기반 암호화 파일 입출력
function saveEncryptedData(key: string, value: string): void {
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      console.warn('[googleAuth] OS 암호화 스토리지 비활성 상태로 일반 쓰기 진행')
      let data: Record<string, string> = {}
      if (existsSync(authStorePath)) {
        data = JSON.parse(readFileSync(authStorePath, 'utf8'))
      }
      data[key] = Buffer.from(value).toString('base64')
      writeFileSync(authStorePath, JSON.stringify(data), 'utf8')
      return
    }

    let data: Record<string, string> = {}
    if (existsSync(authStorePath)) {
      try {
        data = JSON.parse(readFileSync(authStorePath, 'utf8'))
      } catch {
        data = {}
      }
    }
    const encrypted = safeStorage.encryptString(value)
    data[key] = encrypted.toString('base64')
    writeFileSync(authStorePath, JSON.stringify(data), 'utf8')
  } catch (err) {
    console.error('[googleAuth] 암호화 데이터 저장 에러:', err)
  }
}

function getDecryptedData(key: string): string | null {
  try {
    if (!existsSync(authStorePath)) return null
    let data: Record<string, string> = {}
    try {
      data = JSON.parse(readFileSync(authStorePath, 'utf8'))
    } catch {
      return null
    }

    const encryptedBase64 = data[key]
    if (!encryptedBase64) return null

    if (!safeStorage.isEncryptionAvailable()) {
      return Buffer.from(encryptedBase64, 'base64').toString('utf8')
    }

    const buffer = Buffer.from(encryptedBase64, 'base64')
    return safeStorage.decryptString(buffer)
  } catch (err) {
    console.error('[googleAuth] 암호화 데이터 복호화 에러:', err)
    return null
  }
}

function clearAuthStore(): void {
  try {
    if (existsSync(authStorePath)) {
      unlinkSync(authStorePath)
    }
  } catch (err) {
    console.error('[googleAuth] 인증 저장소 소멸 에러:', err)
  }
}

// 🦾 [OAUTH TOKEN REFRESH HELPER] refresh_token을 이용한 access_token 자동 갱신
async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: getGoogleClientIdFromKeychain(),
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      })
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('[googleAuth] 토큰 리프레시 실패 응답:', errText)
      return null
    }

    const data: any = await res.json()
    if (data.access_token) {
      saveEncryptedData('access_token', data.access_token)
      return data.access_token
    }
    return null
  } catch (err) {
    console.error('[googleAuth] 토큰 리프레시 갱신 중 예외 에러:', err)
    return null
  }
}

// 🦾 [GOOGLE USER PROFILE HELPER] 구글 프로필 유저 정보 수신
async function fetchUserProfile(accessToken: string): Promise<any> {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
    if (!res.ok) return null
    return await res.json()
  } catch (err) {
    console.error('[googleAuth] 유저 프로필 수신 실패:', err)
    return null
  }
}

// 🤖 [IPC REGISTRY] 구글 인증 IPC 채널 일괄 바인딩 (BrowserWindow 리디렉션 가로채기 정공법)
export function registerGoogleAuthIpc() {
  // 구글 로그인 진행
  ipcMain.handle('google-auth:login', async (_event, connectDrive: boolean) => {
    return new Promise((resolve) => {
      // 1. 구글 인증 동의 URL 생성
      const scopes = [
        'openid',
        'profile',
        'email',
        ...(connectDrive ? ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive'] : [])
      ]
      
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${getGoogleClientIdFromKeychain()}&` +
        `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
        `response_type=code&` +
        `scope=${encodeURIComponent(scopes.join(' '))}&` +
        `access_type=offline&` +
        `prompt=consent`

      // 2. 작은 구글 로그인 전용 서브 윈도우 팝업
      const authWindow = new BrowserWindow({
        title: 'Google 로그인 - AMEVA Workstation',
        width: 500,
        height: 650,
        show: true,
        alwaysOnTop: true,
        autoHideMenuBar: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      })

      let resolved = false

      // 3. 리디렉션 주소 감지 및 토큰 교환 함수
      const handleCallback = async (url: string) => {
        if (!url.startsWith(REDIRECT_URI)) return

        const urlObj = new URL(url)
        const code = urlObj.searchParams.get('code')

        if (code) {
          resolved = true
          authWindow.close() // 인증용 BrowserWindow 즉각 파괴

          try {
            // 4. 인가 코드를 이용하여 액세스/리프레시 토큰 교환
            const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                code,
                client_id: getGoogleClientIdFromKeychain(),
                redirect_uri: REDIRECT_URI,
                grant_type: 'authorization_code'
              })
            })

            if (!tokenRes.ok) {
              const errText = await tokenRes.text()
              console.error('[googleAuth] 토큰 교환 응답 에러:', errText)
              resolve({ success: false, error: '구글 토큰 교환에 실패했습니다.' })
              return
            }

            const tokenData: any = await tokenRes.json()
            const { access_token, refresh_token } = tokenData

            if (!access_token) {
              resolve({ success: false, error: '유효한 액세스 토큰을 수신하지 못했습니다.' })
              return
            }

            // 토큰 안전 키체인 보관
            saveEncryptedData('access_token', access_token)
            if (refresh_token) {
              saveEncryptedData('refresh_token', refresh_token)
            }
            saveEncryptedData('is_drive_connected', connectDrive ? 'true' : 'false')

            // 5. 사용자 프로필 획득 후 결과 반환
            const profile = await fetchUserProfile(access_token)
            if (profile) {
              resolve({
                success: true,
                user: {
                  name: profile.name,
                  email: profile.email,
                  picture: profile.picture,
                  isDriveConnected: connectDrive
                }
              })
            } else {
              resolve({ success: false, error: '인증 완료 후 프로필 정보를 가져오는 데 실패했습니다.' })
            }
          } catch (err: any) {
            console.error('[googleAuth] OAuth 토큰 교환 중 에러:', err)
            resolve({ success: false, error: err.message })
          }
        }
      }

      // 리디렉션 진행 및 인가 코드 낚아채기용 웹 브라우저 네비게이션 감지 훅
      authWindow.webContents.on('will-navigate', (_event, url) => {
        handleCallback(url)
      })

      authWindow.webContents.on('will-redirect', (_event, url) => {
        handleCallback(url)
      })

      // 창이 닫혔을 때까지 인증 완료 처리가 안 되었다면 에러 리턴
      authWindow.on('closed', () => {
        if (!resolved) {
          resolve({ success: false, error: '구글 로그인이 취소되었습니다.' })
        }
      })

      // 🦾 [SEC-W-023] 구글 내장 브라우저 로그인 차단 회피용 User-Agent 위장 로드
      authWindow.loadURL(authUrl, {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      })
    })
  })

  // 구글 로그아웃 진행
  ipcMain.handle('google-auth:logout', async () => {
    clearAuthStore()
    return { success: true }
  })

  // 현재 구글 인증 로그인 및 구글 드라이브 연동 정보 상태 체크
  ipcMain.handle('google-auth:get-status', async () => {
    try {
      let accessToken = getDecryptedData('access_token')
      const refreshToken = getDecryptedData('refresh_token')
      const isDriveConnected = getDecryptedData('is_drive_connected') === 'true'

      if (!accessToken && !refreshToken) {
        return { success: false, message: '인증 상태가 확인되지 않았습니다.' }
      }

      // 1. 저장된 액세스 토큰으로 프로필 정보 확인 시도
      let profile = accessToken ? await fetchUserProfile(accessToken) : null

      // 2. 만료되었거나 에러가 났을 때, refresh_token이 있다면 백그라운드 자동 연장 갱신 기동
      if (!profile && refreshToken) {
        console.log('[googleAuth] 액세스 토큰 만료 감지 -> 리프레시 토큰 자동 갱신 수행 중...')
        const refreshedToken = await refreshAccessToken(refreshToken)
        if (refreshedToken) {
          accessToken = refreshedToken
          profile = await fetchUserProfile(accessToken)
        }
      }

      if (profile) {
        return {
          success: true,
          user: {
            name: profile.name,
            email: profile.email,
            picture: profile.picture,
            isDriveConnected
          }
        }
      } else {
        clearAuthStore()
        return { success: false, message: '세션 정보가 만료되어 연결이 끊어졌습니다.' }
      }
    } catch (err: any) {
      console.error('[googleAuth] 세션 연결 조회 에러:', err)
      return { success: false, error: err.message }
    }
  })
}
