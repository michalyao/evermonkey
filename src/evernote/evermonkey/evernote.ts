import vscode = require('vscode');
import { Client as EvernoteClient, NoteStore, Types } from "evernote";
import { IEvernoteService } from "../common/evernote";
import { INoteBookModel, INoteModel, IResourceModel } from "../../model/common/model";
import * as config from "../../config/evermonkey/config";


const RECENT_NOTE_COUNT = config.getOrDefault("recentNotesCount", 10);
const MAX_NOTE_COUNT = config.getOrDefault("maxNoteCount", 50);

export class EvernoteService implements IEvernoteService {

  private noteStore;

  constructor(token: string, noteStoreUrl: string) {
    if (!token) {
      vscode.window.showWarningMessage("Missing token in configuration");
    }
    if (!noteStoreUrl) {
      vscode.window.showWarningMessage("Missing noteStoreUrl in configuration");
    }
    const options = {
      token
    };
    const client = new EvernoteClient(options);
    this.noteStore = client.getNoteStore(noteStoreUrl);
  }


  createNote(note: INoteModel): any {
    return this.noteStore.createNote(note);
  }

  createNoteBookWithTitle(title: string): any {
    return this.noteStore.createNotebook({name: title});
  }

  getDefaultNotebook(): INoteBookModel {
    return this.noteStore.getDefaultNotebook();
  }

  getNoteWithContent(noteGuid: string): INoteModel {
    return this.noteStore.getNoteWithResultSpec(noteGuid, {
      includeContent: true
    });
  }

  getNoteWithResources(noteGuid: string): INoteModel {
    return this.noteStore.getNoteWithResultSpec(noteGuid, {
      includeResourceData: true
    });
  }

  getResource(resourceGuid: string): any {
    return this.noteStore.getResource(resourceGuid, true, false, true, false);
  }

  getTag(tagGuid: string): any {
    return this.noteStore.getTag(tagGuid);
  }

  listTags(): any {
    return this.noteStore.listTags();
  }

  listNotebooks(): any {
    return this.noteStore.listNotebooks();
  }

  listNotebookMetas(notebookGuid: string): any {
    return this.noteStore.findNotesMetadata({
      notebookGuid
    }, 0, MAX_NOTE_COUNT, {
      includeTitle: true,
      includeNotebookGuid: true,
      includeTagGuids: true
    });
  }

  listNotesByKeyword(keyword: string): any {
    let filter = new NoteStore.NoteFilter({
      words: keyword,
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

  listRecentNotes(): any {
    return this.noteStore.findNotesMetadata({
      order: Types.NoteSortOrder.UPDATED
    }, 0, RECENT_NOTE_COUNT, {
      includeTitle: true,
      includeNotebookGuid: true,
      includeTagGuids: true
    });
  }

  listUserNotesInTile(title: string): any {
    let filter = new NoteStore.NoteFilter({
      words: title,
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

  updateNote(note: INoteModel): any {
    return this.noteStore.updateNote(note);
  }

}

