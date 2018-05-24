/**
 * These models are used inside the EverMonkey as contract. For the full information about Evernote Thrift types, see http://dev.evernote.com/doc/reference/Types.html.
 */

export interface INoteBookModel {
  guid: string;
  name: string;
}

export interface IResourceModel {
}

export interface INoteAttributeModel {
}

export interface INoteModel {
  noteGuid?: string;
  title: string;
  content: string;
  contentHash?: string;
  contentLength?: number;
  notebookGuid: string;
  tagGuids?: Array<string>;
  tagNames: Array<string>;
  resources?: Array<IResourceModel>;
  attributes?: Array<INoteAttributeModel>;
}
