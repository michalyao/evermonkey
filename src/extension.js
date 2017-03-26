// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const converter = require('./converter');
const EvernoteClient = require('./everapi');
const _ = require('lodash');
const open = require('open');

 
const config = vscode.workspace.getConfiguration('evermonkey');
const client = new EvernoteClient(config.token, config.noteStoreUrl);
// const client = new EvernoteClient('S=s1:U=937a9:E=16252cc3284:C=15afb1b0380:P=1cd:A=en-devtoken:V=2:H=7110d1259eee40fdb73e702928dceb88', 'https://sandbox.evernote.com/shard/s1/notestore');
const TIP_BACK = 'back...';

let notebooks, notesMap, selectedNotebook;
const localNote = {};
let showTips = config.showTips;

function listNotebooks() {
    if (!notebooks || !notesMap) {
        vscode.window.setStatusBarMessage('Synchronizing your account...');
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
    return vscode.window.showQuickPick(notebooks.map(notebook => notebook.name));
}

function listNotes(selected) {
    if (!selected) {
        throw "";
    }
    selectedNotebook = notebooks.find(notebook => notebook.name === selected);
    let noteLists = notesMap[selectedNotebook.guid].map(note => note.title);
    return vscode.window.showQuickPick(noteLists.concat(TIP_BACK));
}

// nav to one Note
function navToNote() {
    listNotebooks()
        .then(selected => listNotes(selected))
        .then(selected => openNote(selected))
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
    if (localNote.meta) {
        // update
        let title = localNote.meta.title;
        client.updateNoteContent(localNote.meta.guid, title, content).catch(e => wrapError(e));
        vscode.window.showInformationMessage(`${localNote.meta.title} updated successfully.`);
    } else {
        // new 
        listNotebooks().then(selected => {
            let selectedNotebook = notebooks.find(notebook => notebook.name === selected);
            vscode.window.showInputBox({
                placeHolder: "Name your note please."
            }).then(result => {
                if (result) {
                    client.createNote(result, selectedNotebook.guid, content).catch(e => wrapError(e));
                    vscode.window.showInformationMessage(`${result} created successfully.`);
                }
            })
        })
    }

}

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

function openNote(selected) {
    if (!selected) {
        throw "";
    }
    if (selected === TIP_BACK) {
        return navToNote();
    }
    let selectedNote = notesMap[selectedNotebook.guid].find(note => note.title === selected);
    localNote.meta = selectedNote;
    return client.getNoteContent(selectedNote.guid).then(content => {
        return vscode.workspace.openTextDocument({
            language: 'markdown'
        }).then(doc => {
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
        errMsg = "Unexpected Error: " + error.toString();
    }
    
    vscode.window.showErrorMessage(errMsg);
}

function activate(context) {
    vscode.workspace.onDidSaveTextDocument(alertToUpdate);
    let listAllNotebooksCmd = vscode.commands.registerCommand('extension.navToNote', navToNote);
    let publishNoteCmd = vscode.commands.registerCommand('extension.publishNote', publishNote);
    let openDevPageCmd = vscode.commands.registerCommand('extension.openDevPage', openDevPage);
    context.subscriptions.push(listAllNotebooksCmd);
    context.subscriptions.push(publishNoteCmd);
    context.subscriptions.push(openDevPageCmd);
    

}
exports.activate = activate;

function alertToUpdate() {
    if (!showTips) {
        return;
    }

    let msg = "Saving to local won't sync the remote. Try ever: publishs";
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