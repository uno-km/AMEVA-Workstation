import { useState, useEffect, useCallback } from 'react'
import type { DocumentSnapshot } from '../../shared/types'

const DB_NAME = 'AMEVA_Markdown_Editor_DB'
const STORE_NAME = 'snapshots'
const DB_VERSION = 1

// Chromium C++ 네이티브 Deflate/Gzip 엔진 활용 초고속 압축 함수 (딜레이 제로 최적화)
async function compressText(text: string): Promise<Uint8Array> {
  const encoder = new TextEncoder()
  const rawBytes = encoder.encode(text)
  
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(rawBytes)
      controller.close()
    }
  })
  
  const compressionStream = stream.pipeThrough(new CompressionStream('gzip'))
  const response = new Response(compressionStream)
  const compressedBuffer = await response.arrayBuffer()
  return new Uint8Array(compressedBuffer)
}

// Chromium C++ 네이티브 Gzip 엔진 활용 초고속 압축해제 함수 (딜레이 제로 최적화)
async function decompressText(compressedBytes: Uint8Array): Promise<string> {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(compressedBytes)
      controller.close()
    }
  })
  
  const decompressionStream = stream.pipeThrough(new DecompressionStream('gzip'))
  const response = new Response(decompressionStream)
  const decompressedBuffer = await response.arrayBuffer()
  return new TextDecoder().decode(decompressedBuffer)
}

function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('documentId', 'documentId', { unique: false })
        store.createIndex('timestamp', 'timestamp', { unique: false })
      }
    }
  })
}

// IndexedDB에 압축되어 들어갈 가공 스냅샷 구조
interface CompressedSnapshot {
  id: string
  documentId: string
  timestamp: number
  compressedContent: Uint8Array // 압축 바이너리
  title: string
}

export function useHistory(documentId: string) {
  const [snapshots, setSnapshots] = useState<DocumentSnapshot[]>([])
  const [db, setDb] = useState<IDBDatabase | null>(null)

  useEffect(() => {
    initDB()
      .then((database) => {
        setDb(database)
        fetchSnapshots(database)
      })
      .catch((err) => console.error('IndexedDB init error:', err))
  }, [documentId])

  // 압축된 스냅샷들을 가져와 C++ Decompress 복원 후 렌더러 상태에 적재
  const fetchSnapshots = useCallback(
    async (database: IDBDatabase | null = db) => {
      if (!database) return
      const transaction = database.transaction(STORE_NAME, 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const index = store.index('documentId')
      const request = index.openCursor(IDBKeyRange.only(documentId), 'prev')

      // ① 커서 순회 중에는 await를 절대 사용하지 않음.
      //    IDB 트랜잭션은 마이크로태스크 경계에서 자동 닫히므로,
      //    압축 raw 값을 동기로만 수집하고 트랜잭션 종료 후 일괄 처리한다.
      const rawList: CompressedSnapshot[] = []

      const gatherPromise = new Promise<CompressedSnapshot[]>((resolve, reject) => {
        request.onsuccess = () => {
          const cursor = request.result
          if (cursor) {
            rawList.push(cursor.value as CompressedSnapshot) // ← 동기, await 없음
            cursor.continue()                                // ← 즉시 다음 커서로
          } else {
            resolve(rawList)                                 // ← 커서 끝에서 완료
          }
        }
        request.onerror = () => reject(request.error)
      })

      const compressed = await gatherPromise // ← 트랜잭션 종료 후

      // ② 트랜잭션 밖에서 비동기 decompress 일괄 실행 (TransactionInactiveError 없음)
      const decompressed = await Promise.all(
        compressed.map(async (val) => {
          try {
            const content = await decompressText(val.compressedContent)
            return { id: val.id, timestamp: val.timestamp, title: val.title, content } as DocumentSnapshot
          } catch (err) {
            console.error('Decompression failed for snapshot:', val.id, err)
            return null
          }
        })
      )

      setSnapshots(decompressed.filter((s): s is DocumentSnapshot => s !== null))
    },
    [db, documentId]
  )

  // C++ Gzip 압축 후 IndexedDB 영구 저장
  const createSnapshot = useCallback(
    async (title: string, content: string) => {
      if (!db) return

      // [SEC-W-024] 스냅샷 콘텐츠 크기 제한 (20MB)
      const MAX_SNAPSHOT_BYTES = 20 * 1024 * 1024
      if (new Blob([content]).size > MAX_SNAPSHOT_BYTES) {
        console.warn('[Snapshot] 콘텐츠가 너무 커서 스냅샷을 저장할 수 없습니다 (최대 20MB).')
        return
      }

      try {
        // C++ 네이티브 컴프레션
        const compressed = await compressText(content)

        const snapshot: CompressedSnapshot = {
          // [SEC-W-023] crypto.randomUUID()로 충돌 없는 고유 ID 생성
          id: `snap_${crypto.randomUUID()}`,
          documentId,
          timestamp: Date.now(),
          compressedContent: compressed,
          title: title || `무제 스냅샷 (${new Date().toLocaleTimeString()})`,
        }

        return new Promise<void>((resolve, reject) => {
          const transaction = db.transaction(STORE_NAME, 'readwrite')
          const store = transaction.objectStore(STORE_NAME)
          const request = store.add(snapshot)

          request.onsuccess = () => {
            fetchSnapshots(db)
            resolve()
          }
          request.onerror = () => reject(request.error)
        })
      } catch (err) {
        console.error('Snapshot compression failed:', err)
      }
    },
    [db, documentId, fetchSnapshots]
  )

  const deleteSnapshot = useCallback(
    async (id: string) => {
      if (!db) return
      return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite')
        const store = transaction.objectStore(STORE_NAME)
        const request = store.delete(id)

        request.onsuccess = () => {
          fetchSnapshots(db)
          resolve()
        }
        request.onerror = () => reject(request.error)
      })
    },
    [db, fetchSnapshots]
  )

  const getLineDiff = (oldText: string, newText: string) => {
    const oldLines = oldText.split('\n')
    const newLines = newText.split('\n')
    const diffs: { type: 'added' | 'removed' | 'unchanged'; value: string }[] = []

    let i = 0
    let j = 0

    while (i < oldLines.length || j < newLines.length) {
      if (i < oldLines.length && j < newLines.length) {
        if (oldLines[i] === newLines[j]) {
          diffs.push({ type: 'unchanged', value: oldLines[i] })
          i++
          j++
        } else {
          if (oldLines[i + 1] === newLines[j]) {
            diffs.push({ type: 'removed', value: oldLines[i] })
            i++
          } else if (oldLines[i] === newLines[j + 1]) {
            diffs.push({ type: 'added', value: newLines[j] })
            j++
          } else {
            diffs.push({ type: 'removed', value: oldLines[i] })
            diffs.push({ type: 'added', value: newLines[j] })
            i++
            j++
          }
        }
      } else if (i < oldLines.length) {
        diffs.push({ type: 'removed', value: oldLines[i] })
        i++
      } else if (j < newLines.length) {
        diffs.push({ type: 'added', value: newLines[j] })
        j++
      }
    }

    return diffs
  }

  return {
    snapshots,
    createSnapshot,
    deleteSnapshot,
    getLineDiff,
    fetchSnapshots: () => fetchSnapshots(db),
  }
}

// @ts-ignore
console.debug(event);