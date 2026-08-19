import { useCallback } from 'react'
import * as ipc from '../../services/ipc/electronApiAdapter'
import { getPlatformAdapter } from '../../../shared/adapters/platformAdapter'
import { convertMediaSchemaToLocalPaths, convertJupyterToCodeBlocks } from '../../utils/markdownUtils'
import { packMarkdownToADC } from '../../utils/adcPackager'
import { convertMarkdownToBinary, convertMarkdownToIpynb, triggerBrowserDownload, arrayBufferToBase64 } from '../../utils/fileConverters'
import type { AmevaEditor as AppEditor } from '../../editor/amevaBlockSchema'

export function useFileSave(
  editor: AppEditor | null,
  filePath: string | null,
  setFilePath: (path: string | null) => void,
  setOriginalContent: (content: string) => void,
  setLastSavedTime: (time: Date | null) => void,
  createSnapshot: (name: string, content: string) => void
) {

  const handleSaveFile = useCallback(async () => {
    if (document.activeElement && (document.activeElement as HTMLElement).blur) {
      (document.activeElement as HTMLElement).blur()
      window.dispatchEvent(new CustomEvent('AMEVA_FORCE_SAVE_BLOCKS'))
      await new Promise(resolve => setTimeout(resolve, 150))
    }
    if (!editor) return

    const path = filePath || 'document.adc'
    const ext = path.split('.').pop()?.toLowerCase() || 'md'
    
    const rawBlocks = convertJupyterToCodeBlocks(editor.document)
    const rawMarkdown = await editor.blocksToMarkdownLossy(rawBlocks)
    const markdown = convertMediaSchemaToLocalPaths(rawMarkdown)

    const hasMedia = 
      markdown.includes('data:video/') || 
      markdown.includes('data:audio/') || 
      markdown.includes('media://') || 
      markdown.includes('type: "presentation"') ||
      markdown.includes('type: "youtube"')
    
    if (hasMedia && ['md', 'markdown', 'txt'].includes(ext)) {
      if (getPlatformAdapter().isNative) {
        const boxRes = await ipc.showMessageBox({
          type: 'question',
          buttons: ['예 (권장)', '아니오'],
          defaultId: 0,
          title: '아메바 문서 포맷 변환 권장',
          message: '문서에 대용량 미디어 파일(동영상/오디오)이 감지되었습니다.\n미디어 공유가 완벽하게 지원되고 용량이 절감되는 아메바 문서 포맷(.adc)으로 변환하여 저장하시겠습니까?\n\n(아니오를 선택하시면 일반 마크다운 형식으로 저장이 계속 진행됩니다.)',
        })
        
        if (boxRes.response === 0) {
          const defaultAdcPath = filePath ? filePath.split('.').slice(0, -1).join('.') + '.adc' : 'document.adc'
          const saveResult = await ipc.saveFile('', defaultAdcPath)
          
          if (saveResult && saveResult.success && saveResult.filePath) {
            let savedPath = saveResult.filePath
            if (!savedPath.toLowerCase().endsWith('.adc')) {
              savedPath = savedPath.split('.').slice(0, -1).join('.') + '.adc'
            }

            const blob = await packMarkdownToADC(markdown, undefined, editor.document)
            const arrayBuffer = await blob.arrayBuffer()
            const contentToSave = await arrayBufferToBase64(arrayBuffer)

            if ((window as any).electronAPI?.writeBinary) {
              await (window as any).electronAPI.writeBinary(savedPath, contentToSave)
            } else {
              await ipc.saveFile(contentToSave, savedPath)
            }
            setFilePath(savedPath)
            setOriginalContent(rawMarkdown)
            setLastSavedTime(new Date())
            if (createSnapshot) {
              createSnapshot('Ameva Document 저장본', contentToSave)
            }
            return
          } else {
            return
          }
        }
      } else {
        const confirmSave = window.confirm("문서에 동영상 또는 오디오 파일이 포함되어 있습니다. 아메바 전용 포맷(.adc)으로 저장하시겠습니까?")
        if (confirmSave) {
          const blob = await packMarkdownToADC(markdown, undefined, editor.document)
          triggerBrowserDownload(blob, (filePath ? filePath.split('.').slice(0, -1).join('.') : 'document') + '.adc')
          return
        }
      }
    }

    const isBinarySave = ['docx', 'pdf', 'hwpx', 'xlsx', 'xls', 'adc'].includes(ext)
    let contentToSave: string

    if (ext === 'ipynb') {
      contentToSave = convertMarkdownToIpynb(markdown)
    } else if (isBinarySave) {
      contentToSave = await convertMarkdownToBinary(editor, path)
    } else {
      contentToSave = markdown
    }

    if (getPlatformAdapter().isNative) {
      let savedPath = filePath

      if (!savedPath) {
        const promptResult = await ipc.saveFile('', undefined)
        if (promptResult && promptResult.success && promptResult.filePath) {
          savedPath = promptResult.filePath
        } else {
          return
        }
      }

      if (ext === 'adc' && !savedPath.toLowerCase().endsWith('.adc')) {
        savedPath = savedPath.split('.').slice(0, -1).join('.') + '.adc'
      }

      let saveSuccess = false
      if (isBinarySave && (window as any).electronAPI?.writeBinary) {
        const writeRes = await (window as any).electronAPI.writeBinary(savedPath, contentToSave)
        saveSuccess = writeRes.success
      } else {
        const saveRes = await ipc.saveFile(contentToSave, savedPath)
        saveSuccess = saveRes.success
      }

      if (saveSuccess) {
        setFilePath(savedPath)
        setOriginalContent(rawMarkdown)
        setLastSavedTime(new Date())
        createSnapshot(`저장본 (${new Date().toLocaleTimeString()})`, contentToSave)
      }
    } else if ((window as any).Capacitor && (window as any).Capacitor.isNativePlatform()) {
      try {
        const adapter = getPlatformAdapter();
        const targetPath = filePath || 'Documents/document.' + ext;
        await adapter.fs.writeFile(targetPath, contentToSave);
        setFilePath(targetPath);
        setOriginalContent(rawMarkdown);
        setLastSavedTime(new Date());
        createSnapshot(`모바일 저장본 (${new Date().toLocaleTimeString()})`, contentToSave);
      } catch (err: any) {
        console.error('[Mobile Save] 실패:', err);
        alert('모바일 문서 저장 실패: ' + err.message);
      }
    } else {
      if (ext === 'adc') {
        const blob = await packMarkdownToADC(markdown, undefined, editor?.document)
        const dlName = filePath ? (filePath.includes('.') ? filePath.split(/[\\/]/).pop()! : filePath.split(/[\\/]/).pop() + '.adc') : 'document.adc'
        triggerBrowserDownload(blob, dlName)
      } else {
        triggerBrowserDownload(contentToSave, filePath ? filePath.split(/[\\/]/).pop()! : 'document.' + ext)
      }
      createSnapshot('웹 브라우저 저장본', contentToSave)
    }
  }, [editor, filePath, setFilePath, setOriginalContent, setLastSavedTime, createSnapshot])


  const handleSaveAsFile = useCallback(async () => {
    if (!editor) return

    const rawMarkdown = await editor.blocksToMarkdownLossy(convertJupyterToCodeBlocks(editor.document))
    const markdown = convertMediaSchemaToLocalPaths(rawMarkdown)
    const blob = await packMarkdownToADC(markdown, undefined, editor.document)

    if (getPlatformAdapter().isNative) {
      const arrayBuffer = await blob.arrayBuffer()
      const contentToSave = await arrayBufferToBase64(arrayBuffer)

      const saveResult = await ipc.saveFile('', undefined)
      if (saveResult && saveResult.success && saveResult.filePath) {
        let savedPath = saveResult.filePath
        if (!savedPath.toLowerCase().endsWith('.adc')) {
          savedPath = savedPath.split('.').slice(0, -1).join('.') + '.adc'
        }

        if ((window as any).electronAPI?.writeBinary) {
          await (window as any).electronAPI.writeBinary(savedPath, contentToSave)
        } else {
          await ipc.saveFile(contentToSave, savedPath)
        }

        setFilePath(savedPath)
        setOriginalContent(rawMarkdown)
        setLastSavedTime(new Date())
        createSnapshot('다른 이름으로 저장본', contentToSave)
      }
    } else if ((window as any).Capacitor && (window as any).Capacitor.isNativePlatform()) {
      try {
        const adapter = getPlatformAdapter();
        const targetPath = prompt("저장할 파일 경로를 입력하세요:", filePath || 'Documents/document_new.adc');
        if (targetPath) {
          await adapter.fs.writeFile(targetPath, markdown);
          setFilePath(targetPath);
          setOriginalContent(markdown);
          setLastSavedTime(new Date());
          createSnapshot('모바일 다른 이름으로 저장본', markdown);
        }
      } catch (err: any) {
        console.error('[Mobile SaveAs] 실패:', err);
        alert('모바일 다른 이름 저장 실패: ' + err.message);
      }
    } else {
      const wantOther = window.confirm(
        '브라우저에서는 파일 저장 대화상자가 지원되지 않습니다.\n' +
        'Markdown(.md) 파일로 다운로드하시겠습니까?\n' +
        '(Excel, PDF 등 다른 형식은 상단 [내보내기] 메뉴를 사용하세요)'
      )

      if (wantOther) {
        triggerBrowserDownload(markdown, 'document_new.md')
      }
    }
  }, [editor, setFilePath, setOriginalContent, setLastSavedTime, createSnapshot])

  return { handleSaveFile, handleSaveAsFile }
}