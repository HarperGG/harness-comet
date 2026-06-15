export interface CometCliStatus {
  installed: boolean;
  version?: string;
  supported: boolean;
  supportedRange: string;
  error?: string;
}

export interface AgentPlatformRecord {
  id: string;
  displayName: string;
  platformRoot: string;
  skillRoot: string;
}

export interface SkillRootIssue {
  code:
    | "platform-root-missing"
    | "skill-root-missing"
    | "required-file-missing"
    | "version-unsupported";
  message: string;
  path?: string;
}

export interface SkillRootStatus {
  platformId: string;
  detected: boolean;
  valid: boolean;
  skillRoot: string;
  issues: SkillRootIssue[];
}

export interface CometDiscoveryReport {
  comet: CometCliStatus;
  targets: SkillRootStatus[];
}

export interface ManagedFileRecord {
  relativePath: string;
  absolutePath: string;
  sha256: string;
  executable: boolean;
}

export type CometLanguage = "en" | "zh";
export type HarnessCometProjectMode = "runtime" | "playwright";

export interface AgentTargetManifestRecord {
  platformId: string;
  skillRoot: string;
  installedAt: string;
  language?: CometLanguage;
  managedFiles: ManagedFileRecord[];
}

export interface HarnessCometManifestV1 {
  schemaVersion: 1;
  harnessCometVersion: string;
  compatibleCometRange: string;
  upstreamRepository: "https://github.com/rpamis/comet";
  installedAt: string;
  targets: AgentTargetManifestRecord[];
}

export interface CometInstallFilePlan {
  relativePath: string;
  absolutePath: string;
  action: "create" | "update" | "noop";
  executable: boolean;
}

export interface CometInstallTargetResult {
  platformId: string;
  skillRoot: string;
  writes: CometInstallFilePlan[];
}

export interface CometInstallSummary {
  targets: number;
  writes: number;
  backups: number;
  changed: boolean;
}

export interface CometInstallReport {
  comet: CometCliStatus;
  dryRun: boolean;
  manifestPath: string;
  manifestWritten: boolean;
  backupRoot?: string;
  targets: CometInstallTargetResult[];
  summary: CometInstallSummary;
}

export interface CometInstallOptionsLike {
  projectMode?: HarnessCometProjectMode;
}

export interface CometDiffFileChange {
  relativePath: string;
  status: "create" | "clean" | "drift";
}

export interface CometDiffTargetReport {
  platformId: string;
  skillRoot: string;
  status: "pending" | "clean" | "drift";
  manifestStatus: "missing" | "unchanged" | "changed";
  fileChanges: CometDiffFileChange[];
}

export interface CometDiffReport {
  comet: CometCliStatus;
  manifestPath: string;
  targets: CometDiffTargetReport[];
}

export interface CometUninstallTargetReport {
  platformId: string;
  skillRoot: string;
  removed: string[];
  kept: string[];
}

export interface CometUninstallReport {
  comet: CometCliStatus;
  manifestPath: string;
  manifestWritten: boolean;
  targets: CometUninstallTargetReport[];
}

export interface VerifyReceiptV1 {
  schemaVersion: 1;
  change: string;
  harnessCometVersion: string;
  cometVersion: string;
  gitTreeHash: string;
  configHash: string;
  assetHash: string;
  selectedScenarios: string[];
  status: "passed" | "failed" | "error";
  completedAt: string;
}

export interface CometBindReport {
  change: string;
  cometYamlPath: string;
  command: string;
}

export interface CometVerifyReport {
  change: string;
  comet: CometCliStatus;
  receiptPath: string;
  reportPath: string;
  reused: boolean;
  selectedScenarios: string[];
  result: "passed" | "failed" | "error";
  gitTreeHash: string;
}

export interface CometArchiveCheckReport {
  change: string;
  receiptPath: string;
  reportPath: string;
  gitTreeHash: string;
  status: "passed";
}
