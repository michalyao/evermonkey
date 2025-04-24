import * as Evernote from "evernote";
import * as vscode from "vscode";


const config = vscode.workspace.getConfiguration("evermonkey");
const RECENT_NOTE_COUNT = config.recentNotesCount || 10;
const MAX_NOTE_COUNT = config.maxNoteCount || 50;
let attributes = {};
let html_attributes = {};
if (config.noteReadonly) {
  attributes = {
    contentClass: "michalyao.vscode.evermonkey"
  }
}

function getDefaultAttributes(isMD) {
  return isMD ? attributes : html_attributes
}

export type Note = {
  guid: any,
  notebookGuid: any,
  resources: any,
  content: any,
  isMD: boolean,
  /* metadata */
  title: string,
  tagNames: Array<string>,
  notebook: string,
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

  updateNoteContent(note: Note) {
    return this.noteStore.updateNote({
      guid: note.guid,
      title: note.title,
      content: note.content,
      tagNames: note.tagNames,
      notebookGuid: note.notebookGuid,
      attributes: getDefaultAttributes(note.isMD),
    });
  }

  updateNoteResources(note: Note) {
    return this.noteStore.updateNote({
      guid: note.guid,
      title: note.title,
      content: note.content,
      tagNames: note.tagNames,
      notebookGuid: note.notebookGuid,
      resources: note.resources || void 0,
      attributes: getDefaultAttributes(note.isMD),
    });
  }


  createNotebook(title) {
    return this.noteStore.createNotebook({
      name: title
    });
  }

  createNote(note: Note) {
    return this.noteStore.createNote({
      title: note.title,
      notebookGuid: note.notebookGuid,
      content: note.content,
      tagNames: note.tagNames,
      resources: note.resources || void 0,
      attributes: getDefaultAttributes(note.isMD),
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
