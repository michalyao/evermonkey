import { INoteModel, IResourceModel } from "../../model/common/model";

export interface IEvernoteService {

  listRecentNotes(): any;

  listUserNotesInTile(title: string): any;

  listNotebooks(): any;

  listNotebookMetas(notebookGuid: string): any;

  listTags(): any;

  listNotesByKeyword(keyword: string): any;

  getNoteWithContent(noteGuid: string): INoteModel;

  getNoteWithResources(noteGuid: string): INoteModel;

  getResource(resourceGuid: string): any;

  getTag(tagGuid: string): any;

  getDefaultNotebook(): any;

  createNoteBookWithTitle(title: string): any;

  createNote(note: INoteModel): any;

  updateNote(note: INoteModel): any;

}
