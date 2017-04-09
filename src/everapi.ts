import * as Evernote from 'evernote';
import * as vscode from 'vscode';
const MAX_NOTE_COUNTS = 200;

//TODO: add some friendly msg.
export class EvernoteClient {
  noteStore;
  constructor(token, noteStoreUrl) {
    if (!token) {
      vscode.window.showWarningMessage('missing token in configuration');
    }
    const options = {
      token
    };
    const client = new Evernote.Client(options);
    this.noteStore = client.getNoteStore(noteStoreUrl);
  }
  listNotebooks() {
    return this.noteStore.listNotebooks();
  }

  listAllNoteMetadatas(notebookGuid) {
    return this.noteStore.findNotesMetadata({
      notebookGuid
    }, 0, MAX_NOTE_COUNTS, {
      includeTitle: true,
      includeNotebookGuid: true,
      includeTagGuids: true
    })
  }

  getNoteContent(noteGuid) {
    return this.noteStore.getNoteContent(noteGuid);
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
      notebookGuid
    });
  }

  updateNoteResources(guid, title, content, tagNames, notebookGuid, resources) {
     return this.noteStore.updateNote({
      guid,
      title,
      content,
      tagNames,
      notebookGuid,
      resources
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
      resources
    });
  }

  // list all tags, and store it in local. guid -> name (hash by guid)
  listTags() {
    return this.noteStore.listTags();
  }

  searchNote(words) {
    return this.noteStore.findNotesMetadata({
      words
    }, 0, MAX_NOTE_COUNTS, {
      includeNotebookGuid: true,
      includeTitle: true
    });
  }

  getDefaultNotebook() {
    return this.noteStore.getDefaultNotebook();
  }
}
