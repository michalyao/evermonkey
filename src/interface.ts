import * as vscode from "vscode";

/**
 * 附件的类型
 */
export enum AttachType {
  local = 0,
  server = 1,
}

export interface EnhanceQuickPickItem extends vscode.QuickPickItem {
  type?: AttachType;
  guid?: string;
}
