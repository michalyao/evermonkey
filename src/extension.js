const vscode = require('vscode');
const converter = require('./converter');
const EvernoteClient = require('./everapi');
const _ = require('lodash');
const open = require('open');

const config = vscode.workspace.getConfiguration('evermonkey');
const TIP_BACK = 'back...';

let notebooks, notesMap, selectedNotebook;
const localNote = {};
let showTips = config.showTips;


// nav to one Note
function navToNote() {
    listNotebooks()
        .then(selected => listNotes(selected))
        .then(selected => openNote(selected))
}

// sycn account
function sync() {
    vscode.window.setStatusBarMessage('Synchronizing your account...', 2);
    return client.listNotebooks().then(allNotebooks => {
        notebooks = allNotebooks;
        let promises = notebooks.map(notebook => client.listAllNoteMetadatas(notebook.guid));
        return Promise.all(promises);
    }).then(allMetas => {
        let notes = _.flattenDeep(allMetas.map(meta => meta.notes));
        notesMap = _.groupBy(notes, 'notebookGuid');
        return vscode.window.showQuickPick(notebooks.map(notebook => notebook.name));
    }).
        catch(e => wrapError(e));
}

// open evernote dev page.
function openDevPage() {
    console.log(config);
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

// TODO: add tags in inputbox?
function publishNote() {
    let editor = vscode.window.activeTextEditor;
    let content;
    let doc = editor.document;
    if (doc.languageId === "markdown") {
        content = converter.toEnml(doc.getText());
    } else {
        content = converter.toEnml(doc.getText());
    }
    if (localNote[doc.fileName]) {
        // update
        let title = localNote[doc.fileName].title;
        client.updateNoteContent(localNote[doc.fileName].guid, title, content).catch(e => wrapError(e));
        vscode.window.showInformationMessage(`${title} updated successfully.`);
    } else {
        // new 
        listNotebooks().then(selected => {
            let selectedNotebook = notebooks.find(notebook => notebook.name === selected);
            vscode.window.showInputBox({
                placeHolder: "Name your note please."
            }).then(result => {
                if (result) {
                    client.createNote(result, selectedNotebook.guid, content).then(note => {
                        notesMap[selectedNotebook.guid].push(note);
                    }).catch(e => wrapError(e));
                    
                    vscode.window.showInformationMessage(`${result} created successfully.`);
                }
            })
        });
    }
}


function listNotebooks() {
    if (!notebooks || !notesMap) {
        return sync();
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
                edit.insert(startPos, mdContent);
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
    const client = new EvernoteClient(config.token, config.noteStoreUrl);

    vscode.workspace.onDidCloseTextDocument(removeLocal);
    vscode.workspace.onDidSaveTextDocument(alertToUpdate);
    let listAllNotebooksCmd = vscode.commands.registerCommand('extension.navToNote', navToNote);
    let publishNoteCmd = vscode.commands.registerCommand('extension.publishNote', publishNote);
    let openDevPageCmd = vscode.commands.registerCommand('extension.openDevPage', openDevPage);
    let syncCmd = vscode.commands.registerCommand('extension.sync', sync);
    context.subscriptions.push(listAllNotebooksCmd);
    context.subscriptions.push(publishNoteCmd);
    context.subscriptions.push(openDevPageCmd);
    context.subscriptions.push(syncCmd);
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
function deactivate() { }
exports.deactivate = deactivate;