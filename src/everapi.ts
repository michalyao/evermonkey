import * as Evernote from "evernote";
import * as vscode from "vscode";


const config = vscode.workspace.getConfiguration("evermonkey");
const RECENT_NOTE_COUNT = config.recentNotesCount || 10;
const MAX_NOTE_COUNT = config.maxNoteCount || 50;
let attributes = {};
if (config.noteReadonly) {
  attributes = {
    contentClass: "michalyao.vscode.evermonkey"
  }
} 


export class EvernoteClient {
  noteStore;
  constructor(token, noteStoreUrl) {
    if (!token) {
      vscode.window.showWarningMessage("missing token in configuration");
    }
    const options = {
      token
    };
    const client = new Evernote.Client(options);
    this.noteStore = client.getNoteStore(noteStoreUrl);
  }

  listRecentNotes() {
    return this.noteStore.findNotesMetadata({
      order: Evernote.Types.NoteSortOrder.UPDATED
    }, 0, RECENT_NOTE_COUNT, {
      includeTitle: true,
      includeNotebookGuid: true,
      includeTagGuids: true
    });
  }

  listMyNotes(intitle) {
    let filter = new Evernote.NoteStore.NoteFilter({
      words: intitle,
      ascending: true
    });
    return this.noteStore.findNotesMetadata(
      filter,
      0, 500, {
        includeTitle: true,
        includeNotebookGuid: true,
        includeTagGuids: true
      });
  }
  listNotebooks() {
    return this.noteStore.listNotebooks();
  }


  listAllNoteMetadatas(notebookGuid) {
    return this.noteStore.findNotesMetadata({
      notebookGuid
    }, 0, MAX_NOTE_COUNT, {
      includeTitle: true,
      includeNotebookGuid: true,
      includeTagGuids: true
    });
  }

  getNoteContent(noteGuid) {
    return this.noteStore.getNoteWithResultSpec(noteGuid, {
      includeContent: true
    });
  }

  getNoteResources(noteGuid) {
    return this.noteStore.getNoteWithResultSpec(noteGuid, {
      includeResourceData: true
    });

  }

  getResource(guid) {
    return this.noteStore.getResource(guid, true, false, true, false);
  }

  updateNoteContent(guid, title, content, tagNames, notebookGuid) {
    return this.noteStore.updateNote({
      guid,
      title,
      content,
      tagNames,
      notebookGuid,
      attributes
    });
  }

  updateNoteResources(guid, title, content, tagNames, notebookGuid, resources) {
    return this.noteStore.updateNote({
      guid,
      title,
      content,
      tagNames,
      notebookGuid,
      resources,
      attributes
    });
  }


  createNotebook(title) {
    return this.noteStore.createNotebook({
      name: title
    });
  }

  createNote(title, notebookGuid, content, tagNames, resources) {
    return this.noteStore.createNote({
      title,
      notebookGuid,
      content,
      tagNames,
      resources,
      attributes
    });
  }

  // list all tags, and store it in local. guid -> name (hash by guid)
  listTags() {
    return this.noteStore.listTags();
  }

  searchNote(words) {
    return this.noteStore.findNotesMetadata({
      words
    }, 0, MAX_NOTE_COUNT, {
      includeNotebookGuid: true,
      includeTitle: true
    });
  }

  getTag(guid) {
    return this.noteStore.getTag(guid);
  }

  getDefaultNotebook() {
    return this.noteStore.getDefaultNotebook();
  }
}
