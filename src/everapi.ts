import * as Evernote from 'evernote';
import * as vscode from 'vscode';
const MAX_NOTE_COUNTS = 200;
const RECENT_NOTE_COUNTS = 12;

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

    listRecentNotes() {
      return this.noteStore.findNotesMetadata({order : Evernote.Types.NoteSortOrder.UPDATED}, 0, RECENT_NOTE_COUNTS, {
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
        }, 0, MAX_NOTE_COUNTS, {
            includeTitle: true,
            includeNotebookGuid: true,
            includeTagGuids: true
        });
    }

    getNoteContent(noteGuid) {
        return this.noteStore.getNoteContent(noteGuid);
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

    createNotebook(title) {
        return this.noteStore.createNotebook({
            name: title
        });
    }

    createNote(title, notebookGuid, content, tagNames) {
        return this.noteStore.createNote({
            title,
            notebookGuid,
            content,
            tagNames
        });
    }

    // list all tags, and store it in local. guid -> name (hash by guid)
    listTags() {
        return this.noteStore.listTags();
    }

    searchNote(words) {
        return this.noteStore.findNotesMetadata({ words }, 0, MAX_NOTE_COUNTS, {
            includeNotebookGuid: true, includeTitle: true
        });
    }

    getDefaultNotebook() {
        return this.noteStore.getDefaultNotebook();
    }
}
