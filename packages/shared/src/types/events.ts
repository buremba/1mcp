/**
 * Event types for streaming execution (spec §17)
 */

/**
 * NDJSON events streamed during execution
 */
export type ExecutionEvent =
  | ProgressEvent
  | StdoutEvent
  | StderrEvent
  | ExitEvent
  | ErrorEvent;

export interface ProgressEvent {
  type: "progress";
  phase:
    | "build-capsule"
    | "load-runtime"
    | "mount-fs"
    | "executing"
    | "cleanup";
  message?: string;
}

export interface StdoutEvent {
  type: "stdout";
  chunk: string; // base64-encoded
}

export interface StderrEvent {
  type: "stderr";
  chunk: string; // base64-encoded
}

export interface ExitEvent {
  type: "exit";
  exitCode: number;
  usage: {
    wallMs: number;
    memPeakMb: number;
  };
}

export interface ErrorEvent {
  type: "error";
  error: string;
  code?:
    | "ValidationError"
    | "PolicyDenied"
    | "Timeout"
    | "OutputLimitExceeded"
    | "DepsResolutionFailed"
    | "NoExecutorAttached"
    | "Internal";
}

/**
 * Server-to-browser SSE events (spec §2.2)
 */
export type SessionCommand = CapsuleCommand | CancelCommand | ShutdownCommand;

export interface CapsuleCommand {
  type: "capsule";
  capsule: {
    hash: string;
    manifestUrl: string;
    codeUrl: string;
    depsUrl?: string;
  };
  runId: string;
}

export interface CancelCommand {
  type: "cancel";
  runId: string;
}

export interface ShutdownCommand {
  type: "shutdown";
  gracePeriodMs: number;
}

/**
 * Browser-to-server backchannel events (spec §2.2)
 */
export interface BackchannelEvent {
  runId: string;
  event: ExecutionEvent;
}
