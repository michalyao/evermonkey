const vscode = require('vscode');
const converter = require('./converter');
const EvernoteClient = require('./everapi');
const _ = require('lodash');
const open = require('open');
const util = require('util');

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
function navToNote() {
    listNotebooks()
        .then(selected => listNotes(selected))
        .then(selected => openNote(selected))
}


function syncAccount() {
    // init cache.
    return client.listTags().then(tags => {
            tags.forEach(tag => tagCache[tag.guid] = tag.name);
            return vscode.window.setStatusBarMessage('Synchronizing your account...', 1000);
        }).then(re => client.listNotebooks())
        .then(allNotebooks => {
            notebooks = allNotebooks;
            let promises = notebooks.map(notebook => client.listAllNoteMetadatas(notebook.guid));
            return Promise.all(promises);
        }).then(allMetas => {
            let notes = _.flattenDeep(allMetas.map(meta => meta.notes));
            notesMap = _.groupBy(notes, 'notebookGuid');
            vscode.window.setStatusBarMessage('Synchronizing succeeded!', 1000);
        }).
    catch(e => wrapError(e));
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

function publishNote() {
    let editor = vscode.window.activeTextEditor;
    let doc = editor.document;
    let result = exactMetadata(doc.getText());
    let content = converter.toEnml(result.content);
    let meta = result.metadata;
    let tagNames = meta['tags'];
    let title = meta['title'];
    let notebook = meta['notebook'];
    // LOCAL NOTE SHOULD BE UPDATED WHETHER THE THE TITLE IS EQUAL OR NOT.
    if (localNote[doc.fileName]) {
        // update
        console.log(localNote[doc.fileName])
        if (notebook) {
            let notebookGuid = notebooks.find(nb => nb.name === notebook).guid;
            client.updateNoteContent(localNote[doc.fileName].guid, title, content, tagNames, notebookGuid).then(result => {
                localNote[doc.fileName] = result;
                console.log(localNote[doc.fileName])
                vscode.window.showInformationMessage(`${title} updated successfully.`);
            }).catch(e => wrapError(e));
        } else {
            client.getDefaultNotebook().then(notebook => {
                client.updateNoteContent(localNote[doc.fileName].guid, title, content, tagNames, notebook.guid).then(result => {
                    localNote[doc.fileName] = result;
                    vscode.window.showInformationMessage(`${title} updated successfully.`);
                }).catch(e => wrapError(e));
            }).catch(e => wrapError(e));
        }

    } else {
        // new
        title = meta['title'];
        let selectedNotebook;
        if (notebook) {
            selectedNotebook = notebooks.find(nb => notebook === nb.name);
            if (!selectedNotebook) {
                client.createNotebook(notebook).then(createdNotebook => {
                        selectedNotebook = createdNotebook;
                        notebooks.push(selectedNotebook);
                        client.createNote(title, createdNotebook.guid, content, tagNames).then(note => {
                            if (!notesMap[selectedNotebook.guid]) {
                                notesMap[selectedNotebook.guid] = [note];
                            } else {
                                notesMap[selectedNotebook.guid].push(note);
                            }
                            localNote[doc.fileName] = note;
                        });
                    }).then(re =>
                        vscode.window.showInformationMessage(`${title} created successfully.`))
                    .catch(e => wrapError(e));
            } else {
                client.createNote(title, selectedNotebook.guid, content, tagNames).then(note => {
                        if (!notesMap[selectedNotebook.guid]) {
                            notesMap[selectedNotebook.guid] = [note];
                        } else {
                            notesMap[selectedNotebook.guid].push(note);
                        }
                        localNote[doc.fileName] = note;
                    }).then(re =>
                        vscode.window.showInformationMessage(`${title} created successfully.`))
                    .catch(e => wrapError(e));
            }
        } else {
            // use default notebook.
            client.getDefaultNotebook().then(defaultNotebook =>
                client.createNote(title, defaultNotebook.guid, content, tagNames)
                .then(note => {
                    if (!notesMap[defaultNotebook.guid]) {
                        notesMap[defaultNotebook.guid] = [note];
                    } else {
                        notesMap[defaultNotebook.guid].push(note);
                    }
                    localNote[doc.fileName] = note;
                }).then((re =>
                    vscode.window.showInformationMessage(`${title} created successfully.`)))
                .catch(e => wrapError(e)));
        }
    }
}


function listNotebooks() {
    if (!notebooks || !notesMap) {
        return syncAccount().then(re => vscode.window.showQuickPick(notebooks.map(notebook => notebook.name)));
    }
    return vscode.window.showQuickPick(notebooks.map(notebook => notebook.name));
}

function listNotes(selected) {
    if (!selected) {
        throw "";
    }
    selectedNotebook = notebooks.find(notebook => notebook.name === selected);
    let noteLists = notesMap[selectedNotebook.guid];
    if (!noteLists) {
        vscode.window.showInformationMessage("can not open an empty notebook.");
        return navToNote();
    } else {
        let noteTitles = noteLists.map(note => note.title);
        return vscode.window.showQuickPick(noteTitles.concat(TIP_BACK));
    }
}

// create a note with metadata
function newNote() {
    if (!notebooks) {
        syncAccount();
    }
    return vscode.workspace.openTextDocument({
        language: 'markdown'
    }).then(doc => {
        return vscode.window.showTextDocument(doc);
    }).then(editor => {
        let startPos = new vscode.Position(1, 0);
        editor.edit(edit => {
            let metaHeader = util.format(METADATA_HEADER, '', '', '');
            edit.insert(startPos, metaHeader);
        });
    });
}

function searchNote() {
    let resultNotes;
    if (!notesMap || !notebooks) {
        syncAccount();
    }
    vscode.window.showInputBox({
            placeHolder: "Use Evernote query to search notes."
        })
        .then(input => {
            client.searchNote(input).then(result => {
                resultNotes = result;
                // result -> noteTitleList and show in vscode. with notebook
                let searchResult = result.notes.map(note => {
                    let title = note['title'];
                    selectedNotebook = notebooks.find(notebook => notebook.guid === note.notebookGuid);
                    return selectedNotebook.name + ">>" + title;
                });
                return vscode.window.showQuickPick(searchResult);
            }).then(selected => {
                if (!selected) {
                    throw ""; //user dismiss
                }
                let index = selected.indexOf(">>");
                let searchNoteResult = selected.substring(index + 2);
                let chooseNote = resultNotes.notes.find(note => note.title === searchNoteResult);
                return client.getNoteContent(chooseNote.guid).then(content => {
                    return vscode.workspace.openTextDocument({
                        language: 'markdown'
                    }).then(doc => {
                        localNote[doc.fileName] = chooseNote;
                        return vscode.window.showTextDocument(doc);
                    }).then(editor => {
                        let startPos = new vscode.Position(1, 0);
                        editor.edit(edit => {
                            let mdContent = converter.toMd(content);
                            let tagGuids = chooseNote.tagGuids;
                            let tags;
                            if (tagGuids) {
                                tags = tagGuids.map(guid => tagCache[guid]);
                            } else {
                                tags = [];
                            }
                            let metaHeader = genMetaHeader(chooseNote.title, tags,
                                notebooks.find(notebook => notebook.guid === chooseNote.notebookGuid).name);
                            edit.insert(startPos, metaHeader + mdContent);
                        });
                    });
                });
            }).catch(e => wrapError(e));
        })
}

function openNote(selected) {
    if (!selected) {
        throw "";
    }
    if (selected === TIP_BACK) {
        return navToNote();
    }
    let selectedNote = notesMap[selectedNotebook.guid].find(note => note.title === selected);
    return client.getNoteContent(selectedNote.guid).then(content => {
        return vscode.workspace.openTextDocument({
            language: 'markdown'
        }).then(doc => {
            localNote[doc.fileName] = selectedNote;
            return vscode.window.showTextDocument(doc);
        }).then(editor => {
            let startPos = new vscode.Position(1, 0);
            editor.edit(edit => {
                let mdContent = converter.toMd(content);
                let tagGuids = selectedNote.tagGuids;
                let tags;
                if (tagGuids) {
                    tags = tagGuids.map(guid => tagCache[guid]);
                } else {
                    tags = [];
                }
                let metaHeader = genMetaHeader(selectedNote.title, tags,
                    notebooks.find(notebook => notebook.guid === selectedNote.notebookGuid).name);
                edit.insert(startPos, metaHeader + mdContent);
            });
        });
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