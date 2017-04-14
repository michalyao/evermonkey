# Change Log

## [Released]

- v2.3.8
    - New created note's editor cursor now starts after the title.
    - Add `ever everclient` command to support view note in client. (**Note: Editing note in multiple clients may cause a mess when converting the html to markdown, you will see <div>...</div> in vscode, and in result, you may get an error when you publish again. So try to edit in vscode only.**)
    - Add support for changing evernote font rendering in the extension settings.
    - Add support for customizing theme file.
    - Performance and experience improved.
    
    For more details, check the full documents [here](http://monkey.yoryor.me)

- v2.3.7
    - Performance improved.
    - Update `ever token` command to be friendly to the new user. -- fixed #39
    - Much better experience to use Monkey!

- v2.3.6
    - add support for markdown TOC. **Note: Navigation not supported in Evernote.**

- v2.3.5
    - Bug fixed. #30, #35, #36, #37

- v2.3.1
    - fixed tag cache.

- v2.2.0
    - Support markdown emoji
    - Support open note in Evernote Web.
    - Support attachment
    - Support open recent edited notes
    - Support command keyboard shortcut.
    - Small fixed.

- v2.0.0
    - Support markdown code highlight
    - Support markdown todo
    - Use typescript. Markdown lib change to markdown-it.

- v1.3.0
    - If none notebook specific, the default notebook will be chosen.
    - Add support for editing metadata to update note instead of creating a new one. -- title, tags, notebook

- v1.2.9
    - Search algorithm tuned. Support for a large notes count. -- #17


- v1.2.8
    - fixed #12 -- add new create note to local cache.

- v1.2.7
    - fixed notebook cache.
    - Markdown completion should be opened via configuration.

- v1.2.6
    - fixed can't create new notebook

- v1.2.5
    - Add search note support.
    - Minor experience improved.

- v1.2.4
    - Add metadata tips for tags and notebook.
    - Bug fixed.
    - Made documents better.

- v1.1.0
    - Add metadata support for tags.
    - Add new command ever new to create a file with metadata.

- v1.0.3
    - Fix some markdown error.

- v1.0.2
    - Fixed bug -- Can not create note in an empty notebook.
    - Update readme.

- v1.0.1
    - Fixed local cache crashed.
    
- v1.0.0 Initial release.



















