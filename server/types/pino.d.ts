declare module "pino" {
  interface PinoLogger {
    info: (obj?: any, msg?: string, ...args: any[]) => void;
    warn: (obj?: any, msg?: string, ...args: any[]) => void;
    error: (obj?: any, msg?: string, ...args: any[]) => void;
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
  }

  export default function pino(options?: PinoOptions): PinoLogger;
}

