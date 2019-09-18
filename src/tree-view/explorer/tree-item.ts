'use strict';

import * as path from 'path';
import * as vscode from 'vscode';
import { WorkspaceEntry } from '../../model/workspace-entry';

export class TreeItem extends vscode.TreeItem {
  public readonly label: string;

  constructor(name: string, treeItemCollapsibleState: vscode.TreeItemCollapsibleState) {
    super(name, treeItemCollapsibleState);

    this.label = name;
  }

  get description(): string {
    return '';
  }

  get tooltip(): string {
    throw Error('Not implemented');
  }

  get command(): vscode.Command {
    return null;
  }

  get path(): string {
    throw Error('Not implemented');
  }
}
