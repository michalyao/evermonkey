import * as vscode from "vscode";

/**
 * 打开图片选择弹窗
 * @param workspace
 */
export async function openFilePicker(basePath: string) {
  /**
   * 路径
   */
  const pathUri = vscode.Uri.file(basePath);

  /**
   * 选择的文件列表
   */
  const selectedFileUris = await vscode.window.showOpenDialog({
    defaultUri: pathUri,
    canSelectMany: true,
  });
  if (!selectedFileUris) {
    return;
  }

  const firstFile = selectedFileUris[0];
  return firstFile;
}
