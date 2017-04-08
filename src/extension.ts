import * as vscode from 'vscode';
import Converter from './converterplus';
import * as _ from 'lodash';
import * as open from 'open';
import * as util from 'util';
import * as evernote from 'evernote';
import {
  EvernoteClient
} from './everapi';
// const vscode = require('vscode');
// const converter = require('./converter');
// const EvernoteClient = require('./everapi');
// const _ = require('lodash');
// const open = require('open');
// const util = require('util');

const TIP_BACK = 'back...';
const METADATA_PATTERN = /^---[ \t]*\n((?:[ \t]*[^ \t:]+[ \t]*:[^\n]*\n)+)---[ \t]*\n/;

const METADATA_HEADER = `\
---
title: %s
tags: %s
notebook: %s
---
`

// notesMap -- notebook - notes.
let notebooks, notesMap, selectedNotebook;
const localNote = {};
let showTips;
let client;
const tagCache = {};
const converter = new Converter({});

//  exact text Metadata by convention
function exactMetadata(text) {
  let metadata = {};
  let content = text;
  if (_.startsWith(text, '---')) {
    let match = METADATA_PATTERN.exec(text);
    if (match) {
      content = text.substring(match[0].trim().length);
      let metadataStr = match[1].trim();
      let metaArray = metadataStr.split('\n');
      metaArray.forEach(value => {
        let entry = value.split(':');
        metadata[entry[0]] = entry[1].trim()
      });
      if (metadata['tags']) {
        let tagStr = metadata['tags'];
        metadata['tags'] = tagStr.split(',').map(value => value.trim());
      }
    }
  }
  return {
    "metadata": metadata,
    "content": content
  };
}

function genMetaHeader(title, tags, notebook) {
  return util.format(METADATA_HEADER, title, tags.join(','), notebook);
}

// nav to one Note
async function navToNote() {
  try {
    const notebooksName = await listNotebooks();
    const selectedNotebook = await vscode.window.showQuickPick(notebooksName);
    if (!selectedNotebook) {
      throw ""; // user dismisss
    }
    const noteLists = await listNotes(selectedNotebook);
    if (!noteLists) {
      await vscode.window.showInformationMessage("can not open an empty notebook.");
      return navToNote();
    } else {
      let noteTitles = noteLists.map(note => note.title);
      const selectedNote = await vscode.window.showQuickPick(noteTitles.concat(TIP_BACK));
      if (!selectedNote) {
        throw "";
      }
      return openNote(selectedNote);
    }
  } catch (err) {
    wrapError(err);
  }

}


// Synchronize evernote account. For metadata.
async function syncAccount() {
  try {
    const tags = await client.listTags();
    tags.forEach(tag => tagCache[tag.guid] = tag.name);
    await vscode.window.setStatusBarMessage('Synchronizing your account...', 1000);
    notebooks = await client.listNotebooks();
    let promises = notebooks.map(notebook => client.listAllNoteMetadatas(notebook.guid));
    const allMetas = await Promise.all(promises);
    const notes = _.flattenDeep(allMetas.map((meta: evernote.Types.Note) => meta.notes));
    notesMap = _.groupBy(notes, 'notebookGuid');
    vscode.window.setStatusBarMessage('Synchronizing succeeded!', 1000);
  } catch (err) {
    wrapError(err);
  }
}

// Publish note to Evernote Server.
async function publishNote() {
  let editor = vscode.window.activeTextEditor;
  let doc = editor.document;
  let result = exactMetadata(doc.getText());
  let content = await converter.toEnml(result.content);
  let meta = result.metadata;
  let title = meta['title'];
  if (localNote[doc.fileName]) {
    // update the note.
    let noteGuid = localNote[doc.fileName].guid;
    const updatedNote = await updateNote(meta, content, noteGuid);
    localNote[doc.fileName] = updatedNote;
    let notebookName = notebooks.find(notebook => notebook.guid === updatedNote.notebookGuid).name;
    return vscode.window.showInformationMessage(`${notebookName}>>${title} updated successfully.`);
  } else {
    const createdNote = await createNote(meta, content);
    if (!notesMap[createdNote.notebookGuid]) {
      notesMap[createdNote.notebookGuid] = [createdNote];
    } else {
      notesMap[createdNote.notebookGuid].push(createdNote);
    }
    localNote[doc.fileName] = createdNote;
    let notebookName = notebooks.find(notebook => notebook.guid === createdNote.notebookGuid).name;
    return vscode.window.showInformationMessage(`${notebookName}>>${title} created successfully.`);
  }
}

// Update an exsiting note.
async function updateNote(meta, content, noteGuid) {
  try {
    let tagNames = meta['tags'];
    let title = meta['title'];
    let notebook = meta['notebook'];
    const notebookGuid = await getNotebookGuid(notebook);
    return client.updateNoteContent(noteGuid, title, content, tagNames, notebookGuid);

  } catch (err) {
    wrapError(err);
  }
}

// Choose notebook. Used for publish.
async function getNotebookGuid(notebook) {
  try {
    let notebookGuid;
    if (notebook) {
      let notebookLocal = notebooks.find(nb => nb.name === notebook);
      if (notebookLocal) {
        notebookGuid = notebookLocal.guid;
      } else {
        const createdNotebook = await client.createNotebook(notebook);
        notebooks.push(createdNotebook);
        notebookGuid = createdNotebook.guid;
      }
    } else {
      const defaultNotebook = await client.getDefaultNotebook();
      notebookGuid = defaultNotebook.guid;
    }
    return notebookGuid;
  } catch (err) {
    wrapError(err);
  }
}

// Create an new note.
async function createNote(meta, content) {
  try {
    let tagNames = meta['tags'];
    let title = meta['title'];
    let notebook = meta['notebook'];
    const notebookGuid = await getNotebookGuid(notebook);
    return client.createNote(title, notebookGuid, content, tagNames);
  } catch (err) {
    wrapError(err);
  }
}

// List all notebooks name.
async function listNotebooks() {
  try {
    if (!notebooks || !notesMap) {
      await syncAccount();
    }
    return notebooks.map(notebook => notebook.name);
  } catch (err) {
    wrapError(err);
  }

}

// List notes in the notebook. (200 limits.)
function listNotes(notebook) {
  selectedNotebook = notebooks.find(nb => nb.name === notebook);
  let noteLists = notesMap[selectedNotebook.guid];
  return noteLists;
}

// Create an empty note with metadata and markdown support in vscode.
async function newNote() {
  try {
    if (!notebooks) {
      await syncAccount();
    }
    const doc = await vscode.workspace.openTextDocument({
      language: 'markdown'
    });
    const editor = await vscode.window.showTextDocument(doc);
    let startPos = new vscode.Position(1, 0);
    editor.edit(edit => {
      let metaHeader = util.format(METADATA_HEADER, '', '', '');
      edit.insert(startPos, metaHeader);
    });
  } catch (err) {
    wrapError(err);
  }

}

// Search note.
async function searchNote() {
  try {
    if (!notesMap || !notebooks) {
      await syncAccount();
    }
    const query = await vscode.window.showInputBox({
      placeHolder: "Use Evernote Search Grammar to search notes."
    });
    const searchResult = await client.searchNote(query);
    const noteWithbook = searchResult.notes.map(note => {
      let title = note['title'];
      selectedNotebook = notebooks.find(notebook => notebook.guid === note.notebookGuid);
      return selectedNotebook.name + ">>" + title;
    });
    const selectedNote = await vscode.window.showQuickPick(noteWithbook);
    if (!selectedNote) {
      throw ""; //user dismiss
    }
    await openSearchResult(selectedNote, searchResult.notes);
  } catch (err) {
    wrapError(err);
  }

}

// Open search result note. (notebook >> note)
async function openSearchResult(noteWithbook, notes) {
  try {
    let index = noteWithbook.indexOf(">>");
    let searchNoteResult = noteWithbook.substring(index + 2);
    let chooseNote = notes.find(note => note.title === searchNoteResult);
    const content = await client.getNoteContent(chooseNote.guid);
    const doc = await vscode.workspace.openTextDocument({
      language: 'markdown'
    });
    await cacheAndOpenNote(chooseNote, doc, content);
  } catch (err) {
    wrapError(err);
  }

}

// Open note by title in vscode
async function openNote(noteTitle) {
  try {
    if (noteTitle === TIP_BACK) {
      return navToNote();
    }
    let selectedNote = notesMap[selectedNotebook.guid].find(note => note.title === noteTitle);
    const content = await client.getNoteContent(selectedNote.guid);
    const doc = await vscode.workspace.openTextDocument({
      language: 'markdown'
    });
    await cacheAndOpenNote(selectedNote, doc, content);
  } catch (err) {
    wrapError(err);
  }
}


// Open note in vscode and cache to memory.
async function cacheAndOpenNote(note, doc, content) {
  try {
    const editor = await vscode.window.showTextDocument(doc);
    localNote[doc.fileName] = note;
    let startPos = new vscode.Position(1, 0);
    editor.edit(edit => {
      let mdContent = converter.toMd(content);
      let tagGuids = note.tagGuids;
      let tags;
      if (tagGuids) {
        tags = tagGuids.map(guid => tagCache[guid]);
      } else {
        tags = [];
      }
      let metaHeader = genMetaHeader(note.title, tags,
        notebooks.find(notebook => notebook.guid === note.notebookGuid).name);
      edit.insert(startPos, metaHeader + mdContent);
    });
  } catch (err) {
    wrapError(err);
  }
}

// open evernote dev page.
function openDevPage() {
  vscode.window.showQuickPick(["China", "Other"]).then(choice => {
    if (!choice) {
      return;
    }
    if (choice === "China") {
      open("https://app.yinxiang.com/api/DeveloperToken.action");
    } else {
      open("https://www.evernote.com/api/DeveloperToken.action");
    }
  });
}

function wrapError(error) {
  if (!error) {
    return;
  }
  console.log(error);

  let errMsg;
  if (error.statusCode && error.statusMessage) {
    errMsg = `Http Error: ${error.statusCode}- ${error.statusMessage}, Check your ever config please.`;
  } else if (error.errorCode && error.parameter) {
    errMsg = `Evernote Error: ${error.errorCode} - ${error.parameter}`;
  } else {
    errMsg = "Unexpected Error: " + error;
  }

  vscode.window.showErrorMessage(errMsg);
}

function activate(context) {
  const config = vscode.workspace.getConfiguration('evermonkey');
  if (!config.token || !config.noteStoreUrl) {
    vscode.window.showWarningMessage('Please use ever token command to get the token and storeUrl, copy&paste to the settings, and then restart the vscode.');
    vscode.commands.executeCommand('workbench.action.openGlobalSettings');
  }
  client = new EvernoteClient(config.token, config.noteStoreUrl);

  // quick match for monkey.
  let action = vscode.languages.registerCompletionItemProvider(['plaintext', {
    'scheme': 'untitled',
    'language': 'markdown'
  }], {
    provideCompletionItems(doc, position) {
      // simple but enough validation for title, tags, notebook
      // title dont show tips.
      if (position.line === 1) {
        return [];
      } else if (position.line === 2) {
        // tags
        if (tagCache) {
          return _.values(tagCache).map(tag => new vscode.CompletionItem(tag));
        }
      } else if (position.line === 3) {
        if (notebooks) {
          return notebooks.map(notebook => new vscode.CompletionItem(notebook.name));
        }
      }

    }
  });
  vscode.workspace.onDidCloseTextDocument(removeLocal);
  vscode.workspace.onDidSaveTextDocument(alertToUpdate);
  let listAllNotebooksCmd = vscode.commands.registerCommand('extension.navToNote', navToNote);
  let publishNoteCmd = vscode.commands.registerCommand('extension.publishNote', publishNote);
  let openDevPageCmd = vscode.commands.registerCommand('extension.openDevPage', openDevPage);
  let syncCmd = vscode.commands.registerCommand('extension.sync', syncAccount);
  let newNoteCmd = vscode.commands.registerCommand('extension.newNote', newNote);
  let searchNoteCmd = vscode.commands.registerCommand('extension.searchNote', searchNote);

  context.subscriptions.push(listAllNotebooksCmd);
  context.subscriptions.push(publishNoteCmd);
  context.subscriptions.push(openDevPageCmd);
  context.subscriptions.push(syncCmd);
  context.subscriptions.push(newNoteCmd);
  context.subscriptions.push(action);
  context.subscriptions.push(searchNoteCmd);
}
exports.activate = activate;

// remove local cache when closed the editor.
function removeLocal(event) {
  localNote[event.fileName] = null;
}

function alertToUpdate() {
  if (!showTips) {
    return;
  }

  let msg = "Saving to local won't sync the remote. Try ever publish";
  let option = "Ignore";
  vscode.window.showWarningMessage(msg, option).then(result => {
    if (result === option) {
      showTips = false;
    }
  });
}

// this method is called when your extension is deactivated
function deactivate() {}
exports.deactivate = deactivate;
