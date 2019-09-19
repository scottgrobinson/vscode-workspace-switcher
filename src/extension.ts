'use strict';

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as mkdirp from 'mkdirp';
import * as util from './util';
import { WorkspaceEntry } from './model/workspace-entry';
import { TreeItem } from './tree-view/explorer/tree-item';
import { TreeDataProvider } from './tree-view/explorer/tree-data-provider';

export function activate(context: vscode.ExtensionContext) {
  const disposables = [];

  disposables.push(vscode.commands.registerCommand('vscodeWorkspaceSwitcher.saveWorkspace',
    () => saveWorkspacePrompt()));
  disposables.push(vscode.commands.registerCommand('vscodeWorkspaceSwitcher.switchWorkspace',
    (workspaceEntry?: WorkspaceEntry) => workspaceEntry
      ? util.switchToWorkspace(workspaceEntry, false)
      : switchWorkspacePrompt(false)));
  disposables.push(vscode.commands.registerCommand('vscodeWorkspaceSwitcher.switchWorkspaceNewWindow',
    (treeItem?: TreeItem) => treeItem
      ? util.switchToWorkspace(treeItem.workspaceEntry, true)
      : switchWorkspacePrompt(true)));
  disposables.push(vscode.commands.registerCommand('vscodeWorkspaceSwitcher.deleteWorkspace',
    (treeItem?: TreeItem) => treeItem
      ? util.deleteWorkspace(treeItem.workspaceEntry, true)
      : deleteWorkspacePrompt()));
  disposables.push(vscode.commands.registerCommand('vscodeWorkspaceSwitcher.reloadWorkspaces',
    () => util.refreshTreeData()));
  disposables.push(vscode.commands.registerCommand('vscodeWorkspaceSwitcher.closeWorkspace',
    () => util.closeWorkspace()));
  disposables.push(util.listenForConfigurationChanges());

  const treeDataProvider = new TreeDataProvider();

  vscode.window.registerTreeDataProvider('vscodeWorkspaceSwitcherViewInActivityBar', treeDataProvider);
  vscode.window.registerTreeDataProvider('vscodeWorkspaceSwitcherViewInExplorer', treeDataProvider);

  disposables.push(vscode.commands.registerCommand('vscodeWorkspaceSwitcher.treeData.refresh', () => treeDataProvider.refresh()));

  context.subscriptions.push(...disposables);

  util.setVSCodeWorkspaceSwitcherViewContainersShow();
  util.setVSCodeWorkspaceSwitcherViewInActivityBarShow();
  util.setVSCodeWorkspaceSwitcherViewInExplorerShow();
}

export function deactivate() { }

function saveWorkspacePrompt() {
  const workspaceEntryDirectories = util.getWorkspaceEntryDirectories();

  if (!workspaceEntryDirectories.length) {
    vscode.window.showInformationMessage('No workspace directories have been configured');

    return;
  }

  const directoryItems = workspaceEntryDirectories.map(directory => <vscode.QuickPickItem>{
    label: directory.base,
    description: directory.dir,
  });

  const options = <vscode.QuickPickOptions>{
    matchOnDescription: false,
    matchOnDetail: false,
    placeHolder: 'Choose a workspace directory to save the new workspace file...',
  };

  vscode.window.showQuickPick(directoryItems, options).then(
    (directoryItem: vscode.QuickPickItem) => {
      if (!directoryItem) {
        return;
      }

      vscode.window.showInputBox(<vscode.InputBoxOptions>{
        value: util.getFirstWorkspaceFolderName(),
        prompt: 'Enter a path for the workspace file...'
      }).then(
        (workspaceFileName: string) => {
          workspaceFileName = (workspaceFileName || '').trim();

          if (workspaceFileName === '') {
            return;
          }

          workspaceFileName = workspaceFileName.replace(/\\+/g, '/').replace(/\/\/+/g, '/').replace(/^\//, '');

          workspaceFileName = path.join(...workspaceFileName.split(/\//));

          const workspaceDirectoryPath = path.join(
            directoryItem.description, directoryItem.label, path.dirname(workspaceFileName));

          workspaceFileName = path.basename(workspaceFileName);

          try {
            mkdirp.sync(workspaceDirectoryPath);
          } catch (err) {
            return;
          }

          const workspaceFilePath = path.join(workspaceDirectoryPath, workspaceFileName) + '.code-workspace';

          const workspaceFolderPaths = (vscode.workspace.workspaceFolders || []).map(
            (workspaceFolder: vscode.WorkspaceFolder) => ({ path: workspaceFolder.uri.fsPath }));

          const workspaceFileContent = JSON.stringify({
            folders: workspaceFolderPaths,
            settings: {},
          });

          const workspaceFilePathSaveFunc = () => {
            try {
              fs.writeFileSync(workspaceFilePath, workspaceFileContent, { encoding: 'utf8' });

              util.refreshTreeData();

              util.switchToWorkspace(new WorkspaceEntry(null, path.parse(workspaceFilePath)));
            } catch (error) {
              vscode.window.showErrorMessage(
                'Error while trying to save workspace '
                + `${workspaceFileName} to ${workspaceFilePath}: ${error.message}`);
            }
          }

          if (fs.existsSync(workspaceFilePath)) {
            vscode.window.showInformationMessage(
              `File ${workspaceFilePath} already exists. Do you want to override it?`, 'Yes', 'No').then(
                (answer: string) => {
                  if ((answer || '').trim().toLowerCase() !== 'yes') {
                    return;
                  }

                  workspaceFilePathSaveFunc();
                },
                (reason: any) => { });
          } else {
            workspaceFilePathSaveFunc();
          }
        },
        (reason: any) => { });
    },
    (reason: any) => { });
}

function switchWorkspacePrompt(inNewWindow: boolean = false) {
  const workspaceEntries = util.gatherWorkspaceEntries();

  if (!workspaceEntries.length) {
    vscode.window.showInformationMessage('No workspaces found');

    return;
  }

  const workspaceItems = workspaceEntries.map(entry => <vscode.QuickPickItem>{
    label: entry.name,
    description: entry.path,
  });

  const options = <vscode.QuickPickOptions>{
    matchOnDescription: false,
    matchOnDetail: false,
    placeHolder: `Choose a workspace to switch to${inNewWindow ? ' in a new window' : ''}...`,
  };

  vscode.window.showQuickPick(workspaceItems, options).then(
    (workspaceItem: vscode.QuickPickItem) => {
      if (!workspaceItem) {
        return;
      }

      const entry = workspaceEntries.find(entry => entry.path === workspaceItem.description);

      if (!entry) {
        return;
      }

      util.switchToWorkspace(entry, inNewWindow);
    },
    (reason: any) => { });
}


function deleteWorkspacePrompt() {
  let workspaceEntries = util.gatherWorkspaceEntries();

  if (!workspaceEntries.length) {
    vscode.window.showInformationMessage('No workspaces found');

    return;
  }

  const workspaceItems = workspaceEntries.map(entry => <vscode.QuickPickItem>{
    label: entry.name,
    description: entry.path,
  });

  const options = <vscode.QuickPickOptions>{
    matchOnDescription: false,
    matchOnDetail: false,
    placeHolder: `Choose a workspace to delete...`,
  };

  vscode.window.showQuickPick(workspaceItems, options).then(
    (workspaceItem: vscode.QuickPickItem) => {
      if (!workspaceItem) {
        return;
      }

      const entry = workspaceEntries.find(entry => entry.path === workspaceItem.description);

      if (!entry) {
        return;
      }

      util.deleteWorkspace(entry, true);
    },
    (reason: any) => { });
}
