export interface IWorkspaceStorage {
  /**
   * 파일 열기 대화상자를 띄우고 선택된 파일의 내용을 반환합니다.
   * @returns 파일 내용과 메타데이터, 취소 시 null
   */
  openFileDialog(): Promise<{ content: string; filePath: string; isBinary: boolean; } | null>;

  /**
   * 지정된 경로에 데이터를 저장합니다.
   * @param content 저장할 데이터 (마크다운 텍스트 또는 base64 인코딩된 바이너리)
   * @param path 저장할 경로 (웹의 경우 파일명으로 사용될 수 있음)
   * @param isBinary 바이너리(예: adc 패키지) 여부
   * @returns 실제 저장된 최종 경로 (다이얼로그에서 변경될 수 있음)
   */
  saveFile(content: string, path: string, isBinary?: boolean): Promise<string | null>;

  /**
   * 새 이름으로 저장 대화상자를 띄우고 지정된 데이터를 저장합니다.
   * @param content 저장할 데이터
   * @param defaultPath 기본 제안 경로
   */
  saveFileAs(content: string, defaultPath: string, isBinary?: boolean): Promise<string | null>;

  /**
   * 대용량 미디어 파일 감지 시 사용자에게 전용 포맷(.adc) 변환 여부를 묻는 확인창을 띄웁니다.
   */
  confirmMediaConversionPopup(): Promise<boolean>;
}
