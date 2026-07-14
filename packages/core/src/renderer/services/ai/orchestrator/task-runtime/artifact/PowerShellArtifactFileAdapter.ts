import { executeTerminal } from '../../../../ipc/electronApiAdapter';
import type { IFileSystemAdapter } from './IFileSystemAdapter';

export class PowerShellArtifactFileAdapter implements IFileSystemAdapter {
  /**
   * 셸 메타문자 차단 검증.
   */
  private validatePath(path: string): void {
    if (!path) throw new Error('Path is empty');
    if (/[\r\n&;|$\x60\x22\x27<>]/.test(path)) {
      throw new Error(`Path contains invalid shell meta-characters: ${path}`);
    }
  }

  public async stat(path: string): Promise<{ exists: boolean; size: number; isDirectory: boolean }> {
    this.validatePath(path);
    // [System.IO.File]::Exists('$path'), [System.IO.Directory]::Exists, [System.IO.FileInfo]::new('$path').Length
    const script = `
      $path = "${path}"
      $exists = [System.IO.File]::Exists($path) -or [System.IO.Directory]::Exists($path)
      $isDir = [System.IO.Directory]::Exists($path)
      $size = 0
      if ($exists -and -not $isDir) {
        $size = [System.IO.FileInfo]::new($path).Length
      }
      Write-Output "{\\"exists\\":$($exists.ToString().ToLower()),\\"size\\":$size,\\"isDirectory\\":$($isDir.ToString().ToLower())}"
    `;
    const b64 = Buffer.from(script, 'utf-8').toString('base64');
    const res = await executeTerminal(`powershell -NoProfile -EncodedCommand ${b64}`);
    if (res.stderr && res.stderr.trim().length > 0) {
      throw new Error(`stat error: ${res.stderr}`);
    }
    try {
      const parsed = JSON.parse(res.stdout.trim());
      return parsed;
    } catch (e) {
      throw new Error(`Failed to parse stat output: ${res.stdout}`);
    }
  }

  public async read(path: string): Promise<string | null> {
    this.validatePath(path);
    const script = `
      $path = "${path}"
      if ([System.IO.File]::Exists($path)) {
        [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
      } else {
        Write-Error "File not found"
      }
    `;
    const b64 = Buffer.from(script, 'utf-8').toString('base64');
    const res = await executeTerminal(`powershell -NoProfile -EncodedCommand ${b64}`);
    if (res.stderr && res.stderr.includes('File not found')) return null;
    if (res.stderr) throw new Error(`read error: ${res.stderr}`);
    return res.stdout;
  }

  public async write(path: string, content: string): Promise<void> {
    this.validatePath(path);
    const escapedContent = content.replace(/'/g, "''");
    const script = `
      $path = "${path}"
      $dir = [System.IO.Path]::GetDirectoryName($path)
      if (-not [System.IO.Directory]::Exists($dir)) {
        [System.IO.Directory]::CreateDirectory($dir) | Out-Null
      }
      Set-Content -Path $path -Value '${escapedContent}' -Encoding UTF8
    `;
    const b64 = Buffer.from(script, 'utf-8').toString('base64');
    const res = await executeTerminal(`powershell -NoProfile -EncodedCommand ${b64}`);
    if (res.stderr) throw new Error(`write error: ${res.stderr}`);
  }

  public async move(sourcePath: string, destPath: string, backupPath?: string): Promise<void> {
    this.validatePath(sourcePath);
    this.validatePath(destPath);
    if (backupPath) this.validatePath(backupPath);

    let script = `
      $src = "${sourcePath}"
      $dest = "${destPath}"
      if (-not [System.IO.File]::Exists($src)) {
        throw "Source file does not exist: $src"
      }
      $destDir = [System.IO.Path]::GetDirectoryName($dest)
      if (-not [System.IO.Directory]::Exists($destDir)) {
        [System.IO.Directory]::CreateDirectory($destDir) | Out-Null
      }
    `;

    if (backupPath) {
      script += `
        $backup = "${backupPath}"
        if ([System.IO.File]::Exists($dest)) {
           [System.IO.File]::Move($dest, $backup)
        }
      `;
    }

    script += `
      [System.IO.File]::Move($src, $dest)
    `;

    const b64 = Buffer.from(script, 'utf-8').toString('base64');
    const res = await executeTerminal(`powershell -NoProfile -EncodedCommand ${b64}`);
    if (res.stderr) throw new Error(`move error: ${res.stderr}`);
  }

  public async hash(path: string): Promise<string | null> {
    this.validatePath(path);
    const script = `
      $path = "${path}"
      if ([System.IO.File]::Exists($path)) {
        $stream = [System.IO.File]::OpenRead($path)
        $sha = [System.Security.Cryptography.SHA256]::Create()
        $hashBytes = $sha.ComputeHash($stream)
        $stream.Close()
        $hashString = [System.BitConverter]::ToString($hashBytes).Replace('-', '').ToLower()
        Write-Output $hashString
      } else {
        Write-Error "File not found"
      }
    `;
    const b64 = Buffer.from(script, 'utf-8').toString('base64');
    const res = await executeTerminal(`powershell -NoProfile -EncodedCommand ${b64}`);
    if (res.stderr && res.stderr.includes('File not found')) return null;
    if (res.stderr) throw new Error(`hash error: ${res.stderr}`);
    return res.stdout.trim() || null;
  }

  public async remove(path: string): Promise<void> {
    this.validatePath(path);
    const script = `
      $path = "${path}"
      if ([System.IO.File]::Exists($path)) {
        [System.IO.File]::Delete($path)
      }
    `;
    const b64 = Buffer.from(script, 'utf-8').toString('base64');
    const res = await executeTerminal(`powershell -NoProfile -EncodedCommand ${b64}`);
    if (res.stderr) throw new Error(`remove error: ${res.stderr}`);
  }

  public async list(path: string): Promise<string> {
    this.validatePath(path);
    const script = `
      $path = "${path}"
      if (-not [System.IO.Directory]::Exists($path)) {
        Write-Error "Directory not found"
      } else {
        Get-ChildItem -Path $path | Select-Object Name, Length, LastWriteTime | Format-Table -AutoSize | Out-String
      }
    `;
    const b64 = Buffer.from(script, 'utf-8').toString('base64');
    const res = await executeTerminal(`powershell -NoProfile -EncodedCommand ${b64}`);
    if (res.stderr && res.stderr.includes('Directory not found')) {
      throw new Error(`Directory not found: ${path}`);
    }
    if (res.stderr) throw new Error(`list error: ${res.stderr}`);
    return res.stdout.trim() || '(디렉토리가 비어있습니다)';
  }
}
