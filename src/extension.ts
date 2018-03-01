import * as buffer from "buffer";
import * as vscode from "vscode";
import Converter from "./converterplus";
import * as _ from "lodash";
import * as open from "opener";
import * as util from "util";
import * as path from "path";
import {
  hash,
  guessMime
} from "./myutil";
import fs from "./file";
import * as evernote from "evernote";
import * as everapi from "./everapi"

const config = vscode.workspace.getConfiguration("evermonkey");

const ATTACHMENT_FOLDER_PATH = config.attachmentsFolder || path.join(__dirname, "../../attachments");
const ATTACHMENT_SOURCE_LOCAL = 0;
const ATTACHMENT_SOURCE_SERVER = 1;
const TIP_BACK = "back...";
const METADATA_PATTERN = /^---[ \t]*\n((?:[ \t]*[^ \t:]+[ \t]*:[^\n]*\n)+)---[ \t]*\n/;

// notesMap -- [notebookguid:[notes]].
let notebooks, notesMap, selectedNotebook;
const localNote = {};
let showTips;
let client;
const serverResourcesCache = {};
const tagCache = {};
const converter = new Converter({});

// doc -> [{filepath: attachment}]
const attachmentsCache = {};

//  exact text Metadata by convention
function exactMetadata(text) {
  let metadata = {};
  let content = text;
  if (_.startsWith(text, "---")) {
    let match = METADATA_PATTERN.exec(text);
    if (match) {
      content = text.substring(match[0].trim().length).replace(/^\s+/, "");
      let metadataStr = match[1].trim();
      let metaArray = metadataStr.split("\n");
      metaArray.forEach(value => {
        let sep = value.indexOf(":");
        metadata[value.substring(0, sep).trim()] = value.substring(sep+1).trim();
      });
      if (metadata["tags"]) {
        let tagStr = metadata["tags"];
        metadata["tags"] = tagStr.split(",").map(value => value.trim());
      }
      if (typeof metadata["readonly"] !== "undefined") {
        if (metadata["readonly"] == "true") {
          metadata["readonly"] = true;
        } else if (metadata["readonly"] == "false") {
          metadata["readonly"] = false;
        } else {
          vscode.window.showWarningMessage("Illegal 'readonly' metadata");
          metadata["readonly"] = config.noteReadonly;
        }
      } else {
        metadata["readonly"] = config.noteReadonly;
      }
    }
  }
  return {
    "metadata": metadata,
    "content": content
  };
}

function genMetaHeader(title, tags, notebook, readonly) {
  let showReadonly : boolean = (config.readonlyInMeta || readonly != config.noteReadonly);
  const metaHeaderTemplate = `\
---
title: %s
tags: %s
notebook: %s\
${showReadonly ? "\nreadonly: %s" : ""}
---

`;
  if (showReadonly) {
    return util.format(metaHeaderTemplate, title, tags.join(","), notebook, String(readonly));
  } else {
    return util.format(metaHeaderTemplate, title, tags.join(","), notebook);
  }
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
      await vscode.window.showInformationMessage("Can not open an empty notebook.");
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
    // lazy initilation.
    // TODO: configuration update event should be awared, so that a token can be reconfigured.
    const config = vscode.workspace.getConfiguration("evermonkey");
    await vscode.window.setStatusBarMessage("Synchronizing your account...", 1000);
    client = new everapi.EvernoteClient(config.token, config.noteStoreUrl);
    const tags = await client.listTags();
    tags.forEach(tag => tagCache[tag.guid] = tag.name);
    notebooks = await client.listNotebooks();
    let promises = notebooks.map(notebook => client.listAllNoteMetadatas(notebook.guid));
    const allMetas = await Promise.all(promises);
    const notes = _.flattenDeep(allMetas.map((meta: evernote.Types.Note) => meta.notes));
    notesMap = _.groupBy(notes, "notebookGuid");
    vscode.window.setStatusBarMessage("Synchronizing succeeded!", 1000);
  } catch (err) {
    wrapError(err);
  }
}

// add attachtment to note.
async function attachToNote() {
  try {
    if (!notebooks || !notesMap) {
      await syncAccount();
    }
    const editor = await vscode.window.activeTextEditor;
    let doc = editor.document;
    let filepath = await vscode.window.showInputBox({
      placeHolder: "Full path of your attachtment:",
      ignoreFocusOut: true
    });
    if (!filepath) {
      throw "";
    }
    const extConfig = vscode.workspace.getConfiguration("evermonkey");
    if (extConfig.uploadFolder) {
      const folderExsit = await fs.exsit(extConfig.uploadFolder);
      if (folderExsit) {
        filepath = path.join(extConfig.uploadFolder, filepath);
      }
    } else {
      vscode.window.showWarningMessage("Attachments upload folder not set, you may have to use absolute file path.")
    }
    const fileName = path.basename(filepath);
    const mime: string = guessMime(fileName);
    const data = await fs.readFileAsync(filepath);
    const md5 = hash(data);
    const attachment = {
      "mime": mime,
      "data": {
        "body": data,
        "size": data.length,
        "bodyHash": md5
      },
      "attributes": {
        "fileName": fileName,
        "attachment": true,
        "timestamp": Date.now()
      }
    };
    const cache = {};
    cache[filepath] = attachment;
    attachmentsCache[doc.fileName].push(cache);
    // insert attachment to current position.
    const position = editor.selection.active;
    editor.edit(edit => {
      edit.insert(position, util.format('<en-media type="%s" hash="%s"></en-media>', attachment.mime, Buffer.from(attachment.data.bodyHash).toString("hex")));
    });
    vscode.window.showInformationMessage(util.format("%s has been attched to current note.", fileName));
  } catch (err) {
    wrapError(err);
  }
}

// remove a local attachment.
async function removeAttachment() {
  const editor = await vscode.window.activeTextEditor;
  let doc = editor.document;
  // Can only remove an attachment from a cache file
  if (attachmentsCache[doc.fileName]) {
    let localAttachments = attachmentsCache[doc.fileName].map(cache => _.values(cache)[0]);
    const selectedAttachment = await vscode.window.showQuickPick(localAttachments.map(attachment => attachment.attributes.fileName));
    if (!selectedAttachment) {
      throw "";
    }
    let attachmentToRemove = localAttachments.find(attachment => attachment.attributes.fileName === selectedAttachment);
    _.remove(attachmentsCache[doc.fileName], cache => _.values(cache)[0].attributes.fileName === selectedAttachment);
    vscode.window.showInformationMessage(util.format("%s has been removed from current note.", selectedAttachment));
  }
}

// list current file attachment.
async function listResources() {
  try {
    const editor = await vscode.window.activeTextEditor;
    let doc = editor.document;
    let localResources;
    let serverResources = serverResourcesCache[doc.fileName];
    // open a note from server ,may have resouces
    if (localNote[doc.fileName]) {
      const result = await client.getNoteResources(localNote[doc.fileName].guid);
      serverResources = result.resources;
      serverResourcesCache[doc.fileName] = serverResources;
    }
    // show local cache only.
    localResources = attachmentsCache[doc.fileName].map(cache => _.values(cache)[0]);
    let serverResourcesName = [];
    let localResourcesName = [];

    if (serverResources) {
      serverResourcesName = serverResources.map(attachment => "(server) " + attachment.attributes.fileName + " -- At " + new Date(attachment.attributes.timestamp).toLocaleString());
    }

    if (localResources) {
      localResourcesName = localResources.map(attachment => "(local) " + attachment.attributes.fileName + " -- At " + new Date(attachment.attributes.timestamp).toLocaleString());
    }

    if (serverResourcesName || localResourcesName) {
      const selected = await vscode.window.showQuickPick(serverResourcesName.concat(localResourcesName));
      // do not handle now.
      if (!selected) {
        throw "";
      }
      let selectedAttachment;
      let selectedFileName;
      let source;
      let uri;
      if (selected.startsWith("(server) ")) {
        selectedFileName = selected.substr(9);
        selectedAttachment = serverResources.find(resource => resource.attributes.fileName === selectedFileName);
        source = ATTACHMENT_SOURCE_SERVER;
      } else {
        selectedFileName = selected.substr(8);
        selectedAttachment = localResources.find(resource => resource.attributes.fileName === selectedFileName);
        source = ATTACHMENT_SOURCE_LOCAL;
        let selectedCache = attachmentsCache[doc.fileName].find(cache => _.values(cache)[0].attributes.fileName === selectedFileName);
        uri = _.keys(selectedCache)[0];
      }
      openAttachment(selectedAttachment, source, uri);
    } else {
      vscode.window.showInformationMessage("No resouce to show.");
    }
  } catch (err) {
    wrapError(err);
  }

}

// open an attachment, use default app.
async function openAttachment(attachment, source, uri) {
  switch (source) {
    case ATTACHMENT_SOURCE_LOCAL:
      try {
        open(uri);
      } catch (err) {
        wrapError(err);
      }
      break;
    case ATTACHMENT_SOURCE_SERVER:
      const resource = await client.getResource(attachment.guid);
      const fileName = resource.attributes.fileName;
      const data = resource.data.body;
      try {
        const isExist = await fs.exsit(ATTACHMENT_FOLDER_PATH);
        if (!isExist) {
          await fs.mkdirAsync(ATTACHMENT_FOLDER_PATH);
        }
        const tmpDir = await fs.mkdtempAsync(path.join(ATTACHMENT_FOLDER_PATH, "./evermonkey-"));
        const filepath = path.join(tmpDir, fileName);
        await fs.writeFileAsync(filepath, data);
        open(filepath);
      } catch (error) {
        wrapError(error);
      }
      break;
  }
}



// Publish note to Evernote Server. with resources.
async function publishNote() {
  try {
    if (!notebooks || !notesMap) {
      await syncAccount();
    }
    const editor = await vscode.window.activeTextEditor;
    let doc = editor.document;
    let result = exactMetadata(doc.getText());
    let content = await converter.toEnml(result.content);
    let meta = result.metadata;
    let title = meta["title"];
    let resources;
    if (attachmentsCache[doc.fileName]) {
      resources = attachmentsCache[doc.fileName].map(cache => _.values(cache)[0]);
    }
    if (localNote[doc.fileName]) {
      // update the note.
      vscode.window.setStatusBarMessage("Updaing the note.", 2000);
      let updatedNote;
      let noteGuid = localNote[doc.fileName].guid;
      const noteResources = await client.getNoteResources(noteGuid);
      if (noteResources.resources || resources) {
        if (noteResources.resources) {
          resources = resources.concat(noteResources.resources);
        }
        updatedNote = await updateNoteResources(meta, content, noteGuid, resources);
        updatedNote.resources = resources;
        serverResourcesCache[doc.fileName] = null;
      } else {
        updatedNote = await updateNoteContent(meta, content, noteGuid);
      }
      localNote[doc.fileName] = updatedNote;
      let notebookName = notebooks.find(notebook => notebook.guid === updatedNote.notebookGuid).name;
      // attachments cache should be removed.
      attachmentsCache[doc.fileName] = [];
      return vscode.window.showInformationMessage(`${notebookName}>>${title} updated successfully.`);
    } else {
      const nguid = await getNoteGuid(meta);
      if (nguid) {
        vscode.window.setStatusBarMessage("Updating to server.", 2000);
        const updateNote = await updateNoteOnServer(meta, content, resources, nguid);
        updateNote.resources = resources;
        if (!notesMap[updateNote.notebookGuid]) {
          notesMap[updateNote.notebookGuid] = [updateNote];
        } else {
          notesMap[updateNote.notebookGuid].push(updateNote);
        }
        localNote[doc.fileName] = updateNote;
        let notebookName = notebooks.find(notebook => notebook.guid === updateNote.notebookGuid).name;
        attachmentsCache[doc.fileName] = [];
        return vscode.window.showInformationMessage(`${notebookName}>>${title} update to server successfully.`);
      } else {
        vscode.window.setStatusBarMessage("Creating the note.", 2000);
        const createdNote = await createNote(meta, content, resources);
        createdNote.resources = resources;
        if (!notesMap[createdNote.notebookGuid]) {
          notesMap[createdNote.notebookGuid] = [createdNote];
        } else {
          notesMap[createdNote.notebookGuid].push(createdNote);
        }
        localNote[doc.fileName] = createdNote;
        let notebookName = notebooks.find(notebook => notebook.guid === createdNote.notebookGuid).name;
        attachmentsCache[doc.fileName] = [];
        return vscode.window.showInformationMessage(`${notebookName}>>${title} created successfully.`);
      }
   }
  } catch (err) {
    wrapError(err);
  }
}

// add resource data to note content. -- Note: server body hash is
function appendResourceContent(resources, content) {
  if (resources) {
    content = content.slice(0, -10);
    resources.forEach(attachment => {
      content = content + util.format('<en-media type="%s" hash="%s"/>', attachment.mime, Buffer.from(attachment.data.bodyHash).toString("hex"));
    });
    content = content + "</en-note>";
  }
  return content;
}

// Update an exsiting note.
async function updateNoteResources(meta, content, noteGuid, resources) {
  try {
    let tagNames = meta["tags"];
    let title = meta["title"];
    let notebook = meta["notebook"];
    let readonly = meta["readonly"];
    const notebookGuid = await getNotebookGuid(notebook);
    return client.updateNoteResources(noteGuid, title, content, tagNames, notebookGuid, resources || void 0, readonly);

  } catch (err) {
    wrapError(err);
  }
}

async function updateNoteContent(meta, content, noteGuid) {
  try {
    let tagNames = meta["tags"];
    let title = meta["title"];
    let notebook = meta["notebook"];
    let readonly = meta["readonly"];
    const notebookGuid = await getNotebookGuid(notebook);
    return client.updateNoteContent(noteGuid, title, content, tagNames, notebookGuid, readonly);

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

async function getNoteGuid(meta) {
    let title = meta["title"];
    let intitle = 'intitle:' + '"' + title + '"';
    let nguid = null;
    let re = await client.listMyNotes(intitle);
    let resul = re.notes;
    let arrayLength = resul.length;
    let i;
    for (i = 0; i < arrayLength; i ++) {
        if (resul[i].title == title) nguid = resul[i].guid;
    }
    return nguid;
}

async function updateNoteOnServer(meta, content, resources, nguid) {
  try {
    let title = meta["title"];
    let tagNames = meta["tags"];
    let notebook = meta["notebook"];
    const notebookGuid = await getNotebookGuid(notebook);
    return client.updateNoteResources(nguid, title, content, tagNames, notebookGuid, resources || void 0);
  } catch (err) {
    wrapError(err);
  }
}

// Create an new note.
async function createNote(meta, content, resources) {
  try {
    let tagNames = meta["tags"];
    let title = meta["title"];
    let notebook = meta["notebook"];
    let readonly = meta["readonly"];
    const notebookGuid = await getNotebookGuid(notebook);
    return client.createNote(title, notebookGuid, content, tagNames, resources, readonly);
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
      language: "markdown"
    });
    // init attachment cache
    attachmentsCache[doc.fileName] = [];
    const editor = await vscode.window.showTextDocument(doc);
    let startPos = new vscode.Position(1, 0);
    editor.edit(edit => {
      let metaHeader = genMetaHeader("", [], "", config.noteReadonly);
      edit.insert(startPos, metaHeader);
    });
    // start at the title.
    const titlePosition = startPos.with(1, 8);
    editor.selection = new vscode.Selection(titlePosition, titlePosition);
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
      let title = note["title"];
      selectedNotebook = notebooks.find(notebook => notebook.guid === note.notebookGuid);
      return selectedNotebook.name + ">>" + title;
    });
    const selectedNote = await vscode.window.showQuickPick(noteWithbook);
    if (!selectedNote) {
      throw ""; // user dismiss
    }
    await openSearchResult(selectedNote, searchResult.notes);
  } catch (err) {
    wrapError(err);
  }
}

async function openRecentNotes() {
  try {
    if (!notebooks || !notesMap) {
      await syncAccount();
    }
    const recentResults = await client.listRecentNotes();
    const recentNotes = recentResults.notes;
    const selectedNoteTitle = await vscode.window.showQuickPick(recentNotes.map(note => note.title));
    if (!selectedNoteTitle) {
      throw "";
    }
    let selectedNote = recentNotes.find(note => note.title === selectedNoteTitle);
    selectedNotebook = notebooks.find(notebook => notebook.guid === selectedNote.notebookGuid);
    return openNote(selectedNoteTitle);
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
    const note = await client.getNoteContent(chooseNote.guid);
    const content = note.content;
    const doc = await vscode.workspace.openTextDocument({
      language: "markdown"
    });
    await cacheAndOpenNote(note, doc, content);
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
    const note = await client.getNoteContent(selectedNote.guid);
    const content = note.content;
    const doc = await vscode.workspace.openTextDocument({
      language: "markdown"
    });
    await cacheAndOpenNote(note, doc, content);
  } catch (err) {
    wrapError(err);
  }
}

async function openNoteInClient() {
  const editor = await vscode.window.activeTextEditor;
  let doc = editor.document;
  if (localNote[doc.fileName]) {
    let noteGuid = localNote[doc.fileName].guid;
    if (noteGuid) {
      open(getNoteLink(noteGuid));
    }
  } else {
    vscode.window.showWarningMessage("Can not open the note, maybe not on the server");
  }
}

function getNoteLink(noteGuid) {
  const token = config.token;
  if (token && noteGuid) {
    let userInfo = token.split(":");
    let shardId = userInfo[0].substring(2);
    let userId = parseInt(userInfo[1].substring(2), 16);
    return `evernote:///view/${userId}/${shardId}/${noteGuid}/${noteGuid}/`;
  }
  return "";
}

async function openNoteInBrowser() {
  const config = vscode.workspace.getConfiguration("evermonkey");
  const editor = await vscode.window.activeTextEditor;
  let doc = editor.document;
  if (localNote[doc.fileName]) {
    let noteGuid = localNote[doc.fileName].guid;
    if (noteGuid) {
      const domain = config.noteStoreUrl.slice(0, -9);
      const url = util.format(domain + "view/%s", noteGuid);
      open(url);
    }
  } else {
    vscode.window.showWarningMessage("Can not open the note, maybe not on the server");
  }
}

// Open note in vscode and cache to memory.
async function cacheAndOpenNote(note, doc, content) {
  try {
    const editor = await vscode.window.showTextDocument(doc);
    localNote[doc.fileName] = note;
    // attachtment cache init.
    attachmentsCache[doc.fileName] = [];
    let startPos = new vscode.Position(1, 0);
    let tagGuids = note.tagGuids;
    let tags;
    if (tagGuids) {
      let newTags = _.filter(tagGuids, guid => !tagCache[guid]);
      let promises = newTags.map(guid => {
        if (guid) {
          return client.getTag(guid);
        }
      });
      const newTagObj = await Promise.all(promises);
      // update tag cache.
      newTagObj.forEach((tag: evernote.Types.Tag) => tagCache[tag.guid] = tag.name);
      tags = tagGuids.map(guid => tagCache[guid]);
    } else {
      tags = [];
    }
    editor.edit(edit => {
      let mdContent = converter.toMd(content);

      let metaHeader = genMetaHeader(note.title, tags,
        notebooks.find(notebook => notebook.guid === note.notebookGuid).name,
        note.attributes.contentClass === everapi.CONTENT_CLASS);
      edit.insert(startPos, metaHeader + mdContent);
    });
  } catch (err) {
    wrapError(err);
  }
}

// open evernote dev page to help you configure.
async function openDevPage() {
  try {
    const choice = await vscode.window.showQuickPick(["China", "International"]);
    if (!choice) {
      return;
    }
    if (choice === "China") {
      open("https://app.yinxiang.com/api/DeveloperToken.action");
    } else {
      open("https://www.evernote.com/api/DeveloperToken.action");
    }
    // input help configure.
    const token = await vscode.window.showInputBox({
      placeHolder: "Copy & paste your token here.",
      ignoreFocusOut: true
    });
    if (!token) {
      return;
    }
    const noteStoreUrl = await vscode.window.showInputBox({
      placeHolder: "Copy & paste your noteStoreUrl here.",
      ignoreFocusOut: true
    });
    if (!noteStoreUrl) {
      return;
    }
    config.update("token", token, true);
    config.update("noteStoreUrl", noteStoreUrl, true);
    if (config.token && config.noteStoreUrl) {
      vscode.window.showInformationMessage("Monkey is ready to work. Get the full documents here http://monkey.yoryor.me." +
        "If you get an error, just check the configuration and restart the vscode. Enjoy it and give me star on the github!")
    } else {
      if (!config.token) {
        vscode.window.showWarningMessage("It seems like no token has been entered, try again: ever token");
      }
      if (!config.noteStoreUrl) {
        vscode.window.showWarningMessage("It seems like no noteStoreUrl has been entered, try again: ever token");
      }
    }

  } catch (err) {
    wrapError(err)
  }
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
    errMsg = "Unexpected Error: " + JSON.stringify(error);
  }

  vscode.window.showErrorMessage(errMsg);
}

function activate(context) {
  const filesSettings = vscode.workspace.getConfiguration("files");
  filesSettings.update("eol", "\n", true);

  const markdownSettings = vscode.workspace.getConfiguration();
  markdownSettings.update("[markdown]", {"editor.quickSuggestions": true}, true);
  if (!config.token || !config.noteStoreUrl) {
    vscode.window.showInformationMessage("Evernote token not set, please enter ever token command to help you configure.");
  }
  // quick match for monkey.
  let action = vscode.languages.registerCompletionItemProvider(["plaintext", {
    "scheme": "untitled",
    "language": "markdown"
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
  let listAllNotebooksCmd = vscode.commands.registerCommand("extension.navToNote", navToNote);
  let publishNoteCmd = vscode.commands.registerCommand("extension.publishNote", publishNote);
  let openDevPageCmd = vscode.commands.registerCommand("extension.openDevPage", openDevPage);
  let syncCmd = vscode.commands.registerCommand("extension.sync", syncAccount);
  let newNoteCmd = vscode.commands.registerCommand("extension.newNote", newNote);
  let searchNoteCmd = vscode.commands.registerCommand("extension.searchNote", searchNote);
  let openRecentNotesCmd = vscode.commands.registerCommand("extension.openRecentNotes", openRecentNotes);
  let attachToNoteCmd = vscode.commands.registerCommand("extension.attachToNote", attachToNote);
  let listResourcesCmd = vscode.commands.registerCommand("extension.listResources", listResources);
  let openNoteInBrowserCmd = vscode.commands.registerCommand("extension.openNoteInBrowser", openNoteInBrowser);
  let removeAttachmentCmd = vscode.commands.registerCommand("extension.removeAttachment", removeAttachment);
  let openNoteInClientCmd = vscode.commands.registerCommand("extension.viewInEverClient", openNoteInClient);

  context.subscriptions.push(listAllNotebooksCmd);
  context.subscriptions.push(publishNoteCmd);
  context.subscriptions.push(openDevPageCmd);
  context.subscriptions.push(syncCmd);
  context.subscriptions.push(newNoteCmd);
  context.subscriptions.push(action);
  context.subscriptions.push(searchNoteCmd);
  context.subscriptions.push(openRecentNotesCmd);
  context.subscriptions.push(attachToNoteCmd);
  context.subscriptions.push(listResourcesCmd);
  context.subscriptions.push(openNoteInBrowserCmd);
  context.subscriptions.push(removeAttachmentCmd);
  context.subscriptions.push(openNoteInClientCmd);


}
exports.activate = activate;

// remove local cache when closed the editor.
function removeLocal(event) {
  localNote[event.fileName] = null;
  serverResourcesCache[event.fileName] = null;
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
