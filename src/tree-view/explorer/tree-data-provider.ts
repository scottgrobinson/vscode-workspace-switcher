'use strict';

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as util from '../../util';
import { WorkspaceEntryTreeFolder } from './workspace-entry-tree-folder';
import { WorkspaceEntryTreeItem } from './workspace-entry-tree-item';
import { TreeItem } from './tree-item';
import { WorkspaceEntry } from '../../model/workspace-entry';

interface TreeViewReducerAcc {
  folders: WorkspaceEntryTreeFolder[],
  items: WorkspaceEntryTreeItem[]
}

interface TreeViewUniqueFoldersAcc {
  [_: string]: WorkspaceEntryTreeFolder
}

export class TreeDataProvider implements vscode.TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined> =
    new vscode.EventEmitter<TreeItem | undefined>();
  readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined> = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(treeItem: TreeItem): vscode.TreeItem {
    return treeItem;
  }

  getChildren(treeItem?: TreeItem): Thenable<TreeItem[]> {
    const showTreeView = util.getVSCodeWorkspaceSwitcherViewContainerTreeViewShow();
    const treeItems = showTreeView ? this.getChildrenAsTree(treeItem) : this.getChildrenAsList();

    return Promise.resolve(treeItems);
  }

  private getChildrenAsTree(treeItem: TreeItem): TreeItem[] {
    let paths = null;

    if (treeItem) {
      paths = [path.join(treeItem.path, '**/')];
    }

    const workspaceEntries = util.gatherWorkspaceEntries(paths);
    const directoryParsedPaths = util.getWorkspaceEntryDirectories(paths);
    const directoryPaths = directoryParsedPaths.map(path.format);

    const _treeItems =
      workspaceEntries.reduce((acc: TreeViewReducerAcc, workspaceEntry: WorkspaceEntry) => {
        const directoryPathPrefix = directoryPaths.find(directoryPath =>
          workspaceEntry.parsedPath.dir.startsWith(directoryPath));

        const relativePath = path.relative(directoryPathPrefix, workspaceEntry.path);
        const relativeParsedPath = path.parse(relativePath);

        if (relativeParsedPath.dir === '') {
          acc.items.push(new WorkspaceEntryTreeItem(workspaceEntry));
        } else {
          let relativePathParts = relativePath.split(path.sep);

          relativePathParts.pop();

          let folderName = relativePathParts.splice(0, 1)[0];
          let folderPath = path.join(directoryPathPrefix, folderName);

          while (relativePathParts.length > 0 && fs.readdirSync(folderPath).length === 1) {
            folderName = path.join(folderName, relativePathParts.splice(0, 1)[0]);
            folderPath = path.join(directoryPathPrefix, folderName);
          }

          const folderParsedPath = path.parse(folderPath);

          acc.folders.push(new WorkspaceEntryTreeFolder(folderName, folderParsedPath));
        }

        return acc;
      }, {folders: [], items: []});

    const uniqueFolders = _treeItems.folders.reduce(
      (acc: TreeViewUniqueFoldersAcc, workspaceEntryTreeFolder: WorkspaceEntryTreeFolder) => {
        acc[workspaceEntryTreeFolder.name] = workspaceEntryTreeFolder;

        return acc;
      },
      {});

    _treeItems.folders = Object.keys(uniqueFolders).reduce((acc: WorkspaceEntryTreeFolder[], name: string) => {
      acc.push(uniqueFolders[name]);

      return acc;
    }, []);

    const treeItems = [];

    _treeItems.folders.forEach(item => treeItems.push(item));

    _treeItems.items.forEach(item => treeItems.push(item));

    return treeItems;
  }

  private getChildrenAsList(): TreeItem[] {
    return util.gatherWorkspaceEntries().map(
      (workspaceEntry: WorkspaceEntry) => new WorkspaceEntryTreeItem(workspaceEntry));
  }
}
