/**
 * @file debug-sidecar/collectors/ConsoleCollector.ts
 * @system AMEVA OS Desktop Workstation
 */

import { CorrelationContext } from '../observability/CorrelationContext';
import { EventNormalizer } from '../observability/EventNormalizer';
import { MissionLogManager } from '../logging/MissionLogManager';
import { SecretRedactor } from '../security/SecretRedactor';

export class ConsoleCollector {
  private static originalConsole = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
    debug: console.debug
  };
  private static isPatched = false;
  private static logManager: MissionLogManager;

  public static initialize(logManager: MissionLogManager) {
    if (this.isPatched) return;
    this.logManager = logManager;
    
    // We replace global console methods, but ONLY intercept them
    // if there is an active CorrelationContext.
    const createInterceptor = (originalMethod: Function, level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG') => {
      return (...args: any[]) => {
        const ctx = CorrelationContext.current();
        
        // 1. Always call original to maintain existing behavior
        originalMethod.apply(console, args);

        // 2. If in context, capture the log for the sidecar
        if (ctx && ctx.mission_id) {
          const msg = args.map(a => typeof a === 'object' ? JSON.stringify(SecretRedactor.redactObject(a)) : String(a)).join(' ');
          const event = EventNormalizer.create(
            level,
            'SYSTEM',
            'Console',
            'CONSOLE_LOG',
            msg,
            { metadata: { args: args.map(a => SecretRedactor.createPreview(String(a))) } }
          );
          
          this.logManager.logEvent(event).catch(err => {
            // Failsafe so we don't crash the app if logging fails
            this.originalConsole.error('[ConsoleCollector] Failed to write event', err);
          });
        }
      };
    };

    console.log = createInterceptor(this.originalConsole.log, 'INFO');
    console.info = createInterceptor(this.originalConsole.info, 'INFO');
    console.warn = createInterceptor(this.originalConsole.warn, 'WARN');
    console.error = createInterceptor(this.originalConsole.error, 'ERROR');
    console.debug = createInterceptor(this.originalConsole.debug, 'DEBUG');
    
    this.isPatched = true;
  }

  public static restore() {
    if (!this.isPatched) return;
    console.log = this.originalConsole.log;
    console.info = this.originalConsole.info;
    console.warn = this.originalConsole.warn;
    console.error = this.originalConsole.error;
    console.debug = this.originalConsole.debug;
    this.isPatched = false;
  }
}
