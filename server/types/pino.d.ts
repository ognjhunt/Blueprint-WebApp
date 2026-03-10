declare module "pino" {
  type PinoLogFn = (obj?: any, msg?: string, ...args: any[]) => void;

  interface PinoLogger {
    fatal: PinoLogFn;
    error: PinoLogFn;
    warn: PinoLogFn;
    info: PinoLogFn;
    debug: PinoLogFn;
    trace: PinoLogFn;
    child: (bindings: Record<string, unknown>) => PinoLogger;
  }

  interface PinoRedactOptions {
    paths: string[];
    censor?: string;
    remove?: boolean;
  }

  interface PinoOptions {
    level?: string;
    redact?: PinoRedactOptions;
    base?: Record<string, unknown>;
    timestamp?: boolean | (() => string);
    transport?: {
      target: string;
      options?: Record<string, unknown>;
    };
  }

  export default function pino(options?: PinoOptions): PinoLogger;
}
