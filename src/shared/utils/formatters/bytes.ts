/**
 * 파일 크기 또는 메모리 바이트(Bytes)를 인간이 읽기 쉬운 문자열 형태로 변환합니다.
 * 
 * @param bytes 변환할 원본 바이트 크기
 * @returns MB 또는 GB 단위로 포맷팅된 문자열 (예: "1.2GB", "800MB")
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(0)}MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
}
