export interface PlaywrightArchiveFingerprintReceipt {
  action: string;
  status: string;
  configHash: string;
  assetHash: string;
  targetTests: string[];
}

export interface PlaywrightArchiveFingerprintCurrent {
  action: string;
  status: string;
  configHash: string;
  assetHash: string;
  targetTests: string[];
}

export function matchesPlaywrightArchiveFingerprint(
  receipt: PlaywrightArchiveFingerprintReceipt,
  current: PlaywrightArchiveFingerprintCurrent
): boolean {
  return (
    receipt.status === current.status &&
    receipt.action === current.action &&
    receipt.configHash === current.configHash &&
    receipt.assetHash === current.assetHash &&
    JSON.stringify(receipt.targetTests) === JSON.stringify(current.targetTests)
  );
}
