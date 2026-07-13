/**
 * @file debug-sidecar/cli.ts
 * @system AMEVA OS Desktop Workstation
 */

import * as http from 'node:http';

const port = process.env.SIDECAR_PORT || '11554';
const baseUrl = `http://127.0.0.1:${port}/api/debug/v1`;

const args = process.argv.slice(2);
const command = args[0];

function request(method: string, path: string, body?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = http.request(baseUrl + path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {}
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  if (command === 'run') {
    const promptIdx = args.indexOf('--prompt');
    const prompt = promptIdx !== -1 ? args[promptIdx + 1] : 'Test mission';
    
    console.log('[CLI] Creating mission...');
    const createRes = await request('POST', '/missions', { prompt });
    const missionId = createRes.mission_id;
    console.log(`[CLI] Mission created: ${missionId}`);
    
    await request('POST', `/missions/${missionId}/run`, { prompt, runtimeMode: 'legacy' });
    console.log(`[CLI] Mission ${missionId} started.`);
  } else if (command === 'cancel') {
    const missionId = args[1];
    if (!missionId) return console.error('Missing mission_id');
    await request('POST', `/missions/${missionId}/cancel`);
    console.log(`[CLI] Mission ${missionId} cancelled.`);
  } else if (command === 'watch') {
    const missionId = args[1];
    if (!missionId) return console.error('Missing mission_id');
    
    console.log(`[CLI] Watching mission ${missionId}...`);
    http.get(`${baseUrl}/missions/${missionId}/stream`, (res) => {
      res.on('data', chunk => {
        const lines = chunk.toString().split('\n');
        lines.forEach((line: string) => {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.substring(6));
            console.log(`[${data.timestamp}] [${data.level}] [${data.component}] ${data.event_type}: ${data.message}`);
          }
        });
      });
    });
  } else {
    console.log('Usage: npx tsx cli.ts <run|cancel|watch> [args]');
  }
}

main().catch(console.error);
