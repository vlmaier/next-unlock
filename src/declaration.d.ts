declare module '*.css' {
  const content: string;
  export default content;
}

declare var process: {
  env: Record<string, string | undefined>;
  cwd(): string;
};

declare var __dirname: string;

declare module 'child_process' {
  export function execFileSync(file: string, args?: string[], options?: any): string;
  export function execFile(file: string, args: string[], options: any, callback: (err: any, stdout: string, stderr: string) => void): void;
}

declare module 'path' {
  const path: {
    resolve(...paths: string[]): string;
    dirname(p: string): string;
    join(...paths: string[]): string;
  };
  export default path;
}

declare module 'fs' {
  const fs: {
    mkdtempSync(prefix: string): string;
    rmSync(path: string, options?: any): void;
    readFileSync(path: string, encoding: string): string;
    writeFileSync(path: string, data: string): void;
    mkdirSync(path: string, options?: any): void;
    existsSync(path: string): boolean;
  };
  export default fs;
}

declare module 'os' {
  const os: {
    tmpdir(): string;
  };
  export default os;
}
