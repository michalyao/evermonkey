---
search: english
---

# EverMoneky

Evernote Editing. Redefined.

## Features
Edit your evernote with markdown support, with full power of VS Code.

## Configuration

### Extension Settings

Open VS Code Command Platte(F1), input `Preferences: Open User Settings`.

The full Configuration properties list here:

- evermonkey.token: Evernote API token.
- evermonkey.noteStoreUrl: Evernote noteStoreUrl.
- evermonkey.highlightTheme: Code highlight Theme. The full languages and themes support see [highlight.js](https://highlightjs.org/static/demo/)
- evermonkey.recentNotesCount: The count of the notes returned when you enter `ever recent`.
- evermonkey.attachmentsFolder: Local directory to save server attachments.
- evermonkey.uploadFolder: Local directory to upload attachments.
- evermonkey.showTips: Whether to show you some friendly tips.

### VS Code Settings

- To enable completion for tags and notebook, you may have to open the markdown quick suggestion manually, as show below:

``` json
"[markdown]": {
        "editor.quickSuggestions": true
}
```

- For Windows user, you may have to force VS Code use LF as line seperator. See [issue2957](https://github.com/Microsoft/vscode/issues/2957).

``` json
"files.eol": "\n"
```

## Commands

### `ever new`

Create a new empty file with markdown language support and metadata init.

### `ever open`

Open a note much like a tree structure.

### `ever search`

Use evernote query to search note. More details about [Evernote Search Grammar](https://dev.evernote.com/doc/articles/search_grammar.php)

### `ever publish`

Update editing note or create a new one. (Use this whenever you want to publish your note to Evernote.)

### `ever recent`

Open recently edited notes.

### `ever browse`

Open editing note in Evernote Web. Be sure the server has it, I mean you have already published.

### `ever attach`

Insert a attachment to currently editing file. If you have configured uploadFolder and put your file into the folder, you can specify by the file name. Otherwise, the full path for the file is needed. **Note, this operation only attach the file to local cache, you may have to use `ever publish` to update to the server.**

### `ever unattach`

Once you want to delete a local attachment, you can use this command, only cache removed.

### `ever resources`

List attachments of the currently editing note. You may see some magic here, attachments are marked as (local) or (server). The server one will be downloaded to the attachmentsFolder and opened by the default app, the local one will be opened directly.

### `ever sync`

Synchronize your Evernote account. (**Maybe you use evernote concurrently in multi endpoints, most of time I wish you dont do this**)

### `ever token`

Help you get your token & noteStoreUrl.

## Shortcut

The default keybindings for monkey is alt plus the command verb's first word. For example, `alt+n` is for `ever new`. And of course, you can customize it as you like.

## Markdown Syntax

### Headers

```
# H1
## H2
### H3
#### H4
##### H5
###### H6
```

### Emphasis

```
*This text will be italic*
_This will also be italic_

**This text will be bold**
__This will also be bold__

~~This text will be crossed~~

_You **can** combine ~~them~~_
```

### Sup and Sub

```
19^th^
H~2~O
```

### Emoji

```
:smile: :heart: :sunny: :watermelon: :cn:
```

### Link

```
http://github.com - automatic!
[GitHub](http://github.com)
```

### Blockquotes

```
As Kanye West said:

> We're living the future so
> the present is our past.
```

### List

#### unordered

```
- Item 1
- Item 2
  - Item 2a
  - Item 2b
```

#### ordered

```
1. Item 1
1. Item 2
1. Item 3
   - Item 3a
   - Item 3b
```

### Todo

```
- [x] Write blog post with :heart:
- [x] Create sample **gist**
- [ ] Take screenshots for blog post
```

### Table

```
First Header | Second Header
------------ | -------------
Content from cell 1 | Content from cell 2
Content in the first column | Content in the second column
```

### Images

```
![Image of Test](img/test.png "Image of Test")
![GitHub Logo](https://assets-cdn.github.com/images/modules/logos_page/Octocat.png "GitHub Logo")
```

### Inline code

```
This is an inline code: `var example = true`
```

### Code Highlight

``` js
console.log("Hello Monkey!");
```


### Raw HTML

```
<div style="color: red;">This is a <strong>html</strong> code.</div>
```

## License
MIT

Built by [docute](http://docute.js.org)
