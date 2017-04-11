---
nav: zh-Hans
search: zh-Hans
---

# EverMonkey

重新定义，印象笔记编辑体验。

## 特点

Markdown 的轻量编辑体验由 VS Code 的强力驱动。

## 安装

[VS Code](https://code.visualstudio.com/) v1.10+

在扩展商店处搜索 evermonkey 并安装。

## 配置

### 插件配置

打开命令面板(F1), 输入首选项: 打开用户配置(Preferences: Open User Settings) 即可进入 VS Code 的配置页面.

EverMonkey 配置参数如下:

- evermonkey.token: 印象笔记开发者令牌。
- evermonkey.noteStoreUrl: 印象笔记 noteStore 地址。
- evermonkey.highlightTheme: 代码高亮主题。支持的主题及编程语言见 [highlight.js](https://highlightjs.org/static/demo/).
- evermonkey.recentNotesCount: 执行 `ever recent` 命令返回的最近编辑过的笔记数量。
- evermonkey.attachmentsFolder: 打开印象笔记附件的临时下载文件夹。
- evermonkey.uploadFolder: 上传印象笔记附件的文件夹。
- evermonkey.showTips: 是否开启操作提示。

关于 token 和 noteStoreUrl 的获取可以使用 `ever token` 命令。 其中国内印象笔记用户点击 [China](https://app.yinxiang.com/api/DeveloperToken.action), 国际版用户点击 [Other](https://www.evernote.com/api/DeveloperToken.action).

### VS Code 配置

- 开启 Markdown 代码补全, 这样在输入笔记元数据(标签，笔记本)的时候会有补全提示。配置方法如下:

``` json
"[markdown]": {
        "editor.quickSuggestions": true
}
```

- Windows 用户需要注意，默认 Windows 下的换行符是 CRLF. 需要设置为 LF, 见 [issue2957](https://github.com/Microsoft/vscode/issues/2957)。配置方法如下:

``` json
 "files.eol": "\n"
```

## 开始使用

打开命令面板(F1 或者 ctrl+shift+p), 输入以下命令即可操作印象笔记。

### 新建笔记 -- `ever new`

新建一个空白笔记, 文档顶部是笔记元数据，包括笔记的标题，标签，所属笔记本等(不支持分级)。
当输入笔记本和标签时，如果是已经存在的，则会有代码补全提示，否则将会在印象笔记中新建。标签需要用**半角**逗号分隔。

### 打开笔记 -- `ever open`

以树形结构打开印象笔记。选中笔记后，默认会将笔记的内容转换为 markdown 格式，如果有不支持的媒体格式，那么转换后可能会影响笔记的内容。如果在多端进行编辑也会出现 html 标签的情况。

### 搜索笔记 -- `ever search`

根据输入的搜索条件返回印象笔记。返回的形式是 `notebook>>note`, 搜索使用的是印象笔记官方的搜索语言，比如 `tag:java` 等。更多使用方法可以查看官方文档 [Evernote Search Grammar](https://dev.evernote.com/doc/articles/search_grammar.php)

### 发布笔记 -- `ever publish`

当编辑或者更新笔记后，可以使用 `ever publish` 命令将笔记发布到印象笔记服务器上，实现笔记的同步。monkey 会根据缓存信息判断是需要新建还是更新笔记, 更新成功后会弹出消息。

### 打开最近编辑的笔记 -- `ever recent`

打开最近编辑过的笔记。选中笔记后，默认会将笔记的内容转换为 markdown 格式，如果有不支持的媒体格式，那么转换后可能会影响笔记的内容。如果在多端进行编辑也会出现 html 标签的情况。

### 在浏览器中打开编辑的笔记 -- `ever browse`

在印象笔记网页端打开当前编辑的笔记，如果还未发布，则无法打开。

### 上传附件到当前编辑的笔记 -- `ever attach`

上传附件到当前编辑的笔记中。如果已经配置了 uploadFolder, 可以将附件放到对应的文件夹下，输入文件名即可实现上传。否则，需要输入文件的绝对路径。上传后的附件是缓存在本地的，需要使用 `ever publish` 命令将附件上传。

### 取消上传附件到当前编辑的笔记 -- `ever unattach`

如果附件上传后还没有 publish, 此时可以使用 `ever unattach` 命令进行取消。
**注: monkey 中不提供任何删除服务器端笔记的命令！**

### 浏览当前编辑笔记的附件 -- `ever resources`

浏览当前编辑的笔记。其中会以 (server), (local) 的形式区分本地附件和服务器附件。如果是服务器端的附件，选中后会临时下载到 attachmentsFolder 中, 并使用默认应用打开附件。 如果是本地附件，则会直接使用默认应用打开。

### 同步笔记账户 -- `ever sync`

同步笔记账户，这个命令会在第一次使用 monkey 的时候调用，并将结果缓存到内存中。如果没有缓存报错(通常是由于网络原因导致请求失败，本地缓存失效), 或者在多端使用印象笔记，不建议使用此命令。可能会由于印象笔记限流导致，账户暂时无法调用 API。

### 打开印象笔记开发者网页 -- `ever token`

获取 token 和 noteStoreUrl。

## 快捷键

v2.2.0 版本加入快捷键设置，默认的快捷键形式是 alt + 命令动词的首字母。比如 `ever new` 的快捷键就是 `alt+n`. 也可以自己绑定快捷键。

## Markdown 语法

### 标题

```
# H1
## H2
### H3
#### H4
##### H5
###### H6
```

### 强调

```
*This text will be italic*
_This will also be italic_

**This text will be bold**
__This will also be bold__

~~This text will be crossed~~

_You **can** combine ~~them~~_
```

### 上标和下标

```
19^th^
H~2~O
```

### 表情符

```
:smile: :heart: :sunny: :watermelon: :cn:
```

### 链接

```
http://github.com - automatic!
[GitHub](http://github.com)
```

### 引用

```
As Kanye West said:

> We're living the future so
> the present is our past.
```

### 列表

#### 无序列表

```
- Item 1
- Item 2
  - Item 2a
  - Item 2b
```

#### 有序列表

```
1. Item 1
1. Item 2
1. Item 3
   - Item 3a
   - Item 3b
```

### 任务列表

```
- [x] Write blog post with :heart:
- [x] Create sample **gist**
- [ ] Take screenshots for blog post
```

### 表格

```
First Header | Second Header
------------ | -------------
Content from cell 1 | Content from cell 2
Content in the first column | Content in the second column
```

### 图片

```
![Image of Test](img/test.png "Image of Test")
![GitHub Logo](https://assets-cdn.github.com/images/modules/logos_page/Octocat.png "GitHub Logo")
```

### 行内代码

```
This is an inline code: `var example = true`
```

### 代码块

``` js
console.log("Hello Monkey!");
```


### 原始 HTML

```
<div style="color: red;">This is a <strong>html</strong> code.</div>
```

## License
MIT

Built by [docute](http://docute.js.org)
