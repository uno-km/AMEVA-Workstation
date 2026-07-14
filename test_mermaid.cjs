const { app } = require('electron')
const fs = require('fs')
const path = require('path')

app.whenReady().then(async () => {
  try {
    const { BrowserWindow } = require('electron')
    let win = new BrowserWindow({ show: true, width: 800, height: 600, webPreferences: { contextIsolation: true } })
    
    // Read local mermaid.min.js
    const mermaidPath = path.join(__dirname, 'node_modules', 'mermaid', 'dist', 'mermaid.min.js')
    const mermaidScript = fs.readFileSync(mermaidPath, 'utf8')

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { margin: 0; padding: 20px; background: transparent; display: inline-block; }
          #container { background: white; border-radius: 8px; padding: 20px; display: inline-block; }
        </style>
      </head>
      <body>
        <div id="container">
          <pre class="mermaid">flowchart TD\nA-->B</pre>
        </div>
      </body>
      </html>
    `
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    
    // Test if executeJavaScript exposes mermaid
    await win.webContents.executeJavaScript(mermaidScript)
    
    const result = await win.webContents.executeJavaScript(`
      try {
        if (typeof mermaid === 'undefined') {
          'mermaid is undefined!'
        } else {
          mermaid.initialize({ startOnLoad: true, theme: 'default' });
          mermaid.run();
          'mermaid runs successfully'
        }
      } catch(e) {
        e.toString()
      }
    `)
    console.log('Result:', result)

    setTimeout(() => app.quit(), 2000)
  } catch(e) {
    console.error(e)
    app.quit()
  }
})
