import puppeteer from 'puppeteer';
import { spawn } from 'child_process';
import path from 'path';

console.log("==================================================================");
console.log("   AMEVA OS Headless Browser & Network Diagnostic Tool");
console.log("==================================================================");

(async () => {
  // Let's resolve the path to MCP-Wasm-Toolkit
  // In the user's setup, AMEVA-Workstation and MCP-Wasm-Toolkit are sibling folders.
  // We assume MCP-Wasm-Toolkit is at the sibling path.
  const mcpToolkitDir = path.resolve(process.cwd(), '../MCP-Wasm-Toolkit');

  console.log(`\n[Step 0] Starting AMEVA Proxy Server in background from: ${mcpToolkitDir}...`);
  const proxyProcess = spawn("node", ["mcp_proxy.js", "--no-open"], {
    cwd: mcpToolkitDir,
    stdio: "pipe"
  });

  // Wait for the proxy to start listening
  await new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => {
      proxyProcess.kill();
      reject(new Error("Timeout waiting for proxy to start. Make sure MCP-Wasm-Toolkit exists as a sibling directory."));
    }, 5000);

    proxyProcess.stderr.on('data', (data) => {
      const line = data.toString();
      output += line;
      if (line.includes("listening on")) {
        clearTimeout(timeout);
        console.log("✔ Proxy server is running and listening.");
        resolve();
      }
    });

    proxyProcess.on('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error(`Proxy exited unexpectedly with code ${code}. Output:\n${output}`));
    });
  });

  console.log("\n[Step 1] Launching Headless Chromium via Puppeteer...");
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--allow-file-access-from-files',
        '--disable-web-security',
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ]
    });
    console.log("✔ Headless browser launched successfully.");
  } catch (err) {
    console.error("✖ Failed to launch Puppeteer browser:", err.message);
    proxyProcess.kill();
    process.exit(1);
  }

  const page = await browser.newPage();
  
  // Forward page console.log and errors to terminal
  page.on('console', msg => console.log(`  [Browser Console] ${msg.text()}`));
  page.on('pageerror', err => console.error(`  [Browser PageError] ${err.toString()}`));

  console.log("\n[Step 2] Navigating to AMEVA OS Frontend...");
  const targetUrl = "http://127.0.0.1:9000/frontend/ameva_os.html";
  try {
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    console.log(`✔ Navigated to ${targetUrl}`);
  } catch (err) {
    console.error(`✖ Failed to navigate to ${targetUrl}:`, err.message);
    await browser.close();
    proxyProcess.kill();
    process.exit(1);
  }

  console.log("\n[Step 3] Testing IndexedDB capabilities inside the active frontend origin...");
  try {
    const dbTestResult = await page.evaluate(async () => {
      return new Promise((resolve) => {
        try {
          const req = indexedDB.open("diag_real_db", 1);
          req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains("diag_store")) {
              db.createObjectStore("diag_store");
            }
          };
          req.onsuccess = (e) => {
            const db = e.target.result;
            try {
              const tx = db.transaction("diag_store", "readwrite");
              const store = tx.objectStore("diag_store");
              store.put("REAL_VALUE", "REAL_KEY");
              tx.oncomplete = () => {
                const txRead = db.transaction("diag_store", "readonly");
                const getReq = txRead.objectStore("diag_store").get("REAL_KEY");
                getReq.onsuccess = () => {
                  if (getReq.result === "REAL_VALUE") {
                    resolve({ success: true, message: "IndexedDB Read/Write successfully verified in page origin." });
                  } else {
                    resolve({ success: false, message: "IndexedDB read mismatch: " + getReq.result });
                  }
                };
                getReq.onerror = (err) => resolve({ success: false, message: "IndexedDB read error: " + err });
              };
              tx.onerror = (err) => resolve({ success: false, message: "IndexedDB transaction failed: " + err });
            } catch (err) {
              resolve({ success: false, message: "IndexedDB transaction exception: " + err.message });
            }
          };
          req.onerror = (e) => {
            resolve({ success: false, message: "IndexedDB open request error: " + e.target.error });
          };
        } catch (e) {
          resolve({ success: false, message: "IndexedDB exception: " + e.message });
        }
      });
    });

    if (dbTestResult.success) {
      console.log(`✔ ${dbTestResult.message}`);
    } else {
      console.error(`✖ ${dbTestResult.message}`);
    }
  } catch (err) {
    console.error("✖ IndexedDB evaluation crashed:", err.message);
  }

  console.log("\n[Step 4] Testing Network Fetch (GitHub Raw) inside the active frontend origin...");
  console.log("Target URL: https://raw.githubusercontent.com/uno-km/MCP-Utils-Toolkit/main/mcp_manifest.json");
  try {
    const startTime = Date.now();
    const fetchResult = await page.evaluate(async () => {
      try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 6000); // 6s timeout
        
        const res = await fetch("https://raw.githubusercontent.com/uno-km/MCP-Utils-Toolkit/main/mcp_manifest.json", {
          signal: controller.signal
        });
        clearTimeout(id);
        
        if (res.ok) {
          const json = await res.json();
          return { success: true, name: json.name, toolsCount: json.tools ? json.tools.length : 0 };
        } else {
          return { success: false, status: res.status, statusText: res.statusText };
        }
      } catch (e) {
        return { success: false, error: e.message };
      }
    });

    const elapsed = Date.now() - startTime;
    if (fetchResult.success) {
      console.log(`✔ Fetch succeeded in ${elapsed}ms.`);
      console.log(`  - Manifest Name: ${fetchResult.name}`);
      console.log(`  - Registered Tools Count: ${fetchResult.toolsCount}`);
    } else {
      console.error("CRITICAL NETWORK FAILED!");
      console.error(`✖ Fetch failed or timed out (Elapsed: ${elapsed}ms).`);
      console.error("  - Reason / Error Details:", fetchResult.error || `HTTP Status ${fetchResult.status} ${fetchResult.statusText}`);
      console.error("\n==========================================================");
      console.error("  ⚠️  WARNING: Headless Chromium cannot access GitHub!  ");
      console.error("  This indicates a proxy/firewall block or TLS issue inside the Chrome sandbox.");
      console.error("  Action Required: Change 'git.adapter' to 'local' in mcp.wasm.config.json.");
      console.error("==========================================================\n");
    }
  } catch (err) {
    console.error("✖ Network fetch evaluation crashed:", err.message);
  }

  console.log("\n==========================================================");
  console.log("   Diagnostics Complete. Closing browser & proxy...");
  console.log("==========================================================");
  await browser.close();
  proxyProcess.kill();
  process.exit(0);
})();
