import { INoteBookModel } from "../../model/common/model";

export interface ISyncService {
  pullNoteBooks(): INoteBookModel;
}
