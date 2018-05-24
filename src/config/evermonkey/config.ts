import vscode = require('vscode');

const monkeyConfig = vscode.workspace.getConfiguration("evermonkey");


export function get(key: string) {
  return monkeyConfig[key];
}

export function getOrDefault(key: string, defaultValue: any): any {
  return monkeyConfig[key] || defaultValue;

}

export function setGlobal(key: string, value: any) {
  monkeyConfig.update(key, value, true);
}

export function setLocal(key: string, value: any) {
  monkeyConfig.update(key, value, true);
}
