import * as cheerio from "cheerio";
import * as hljs from "highlight.js";
import * as inlineCss from "inline-css";
import * as MarkdownIt from "markdown-it";
import * as mdSub from "markdown-it-sub";
import * as mdSup from "markdown-it-sup";
import * as mdEmoji from "markdown-it-emoji";
import * as mdEnmlTodo from "markdown-it-enml-todo";
import markdownItGithubToc from "markdown-it-github-toc";
import * as path from "path";
import fs from "./file";
import * as toMarkdown from "to-markdown";
import * as vscode from "vscode";
import * as util from "util";

// Make this configurable
const MARKDOWN_THEME_PATH = path.join(__dirname, "../../themes");
const HIGHLIGHT_THEME_PATH = path.join(__dirname, "../../node_modules/highlight.js/styles");
const DEFAULT_HIGHLIGHT_THEME = "github";
const MAGIC_SPELL = "%EVERMONKEY%";

const OVERRIDE_FONT_FAMILY = `
.markdown-body {
  font-family: %s !important;
}`;

const OVERRIDE_FONT_SIZE = `
.markdown-body {
  font-size: %s !important;
}`;

const OVERRIDE_CODE_FONT_FAMILY = `
.hljs {
  font-family: %s !important;
}`;

const OVERRIDE_CODE_FONT_SIZE = `
.hljs {
  font-size: %s !important;
}`;


const config = vscode.workspace.getConfiguration("evermonkey");

export default class Converter {
  md;
  styles;
  constructor(options = {}) {
    const md = new MarkdownIt({
      html: true,
      linkify: true,
      highlight(code, lang) {
        // code highlight
        if (lang && hljs.getLanguage(lang)) {
          try {
            return `<pre class="hljs"><code>${hljs.highlight(lang, code, true).value}</code></pre>`;
          } catch (err) {}
        }
        return `<pre class="hljs"><code>${md.utils.escapeHtml(code)}</code></pre>`;
      },
      ...options,
    });

    // markdown-it plugin
    md.use(mdSub)
      .use(mdSup)
      .use(mdEnmlTodo)
      .use(mdEmoji)
      .use(markdownItGithubToc, {
        anchorLink: false
      });

    // Inline code class for enml style.
    const inlineCodeRule = md.renderer.rules.code_inline;
    md.renderer.rules.code_inline = (...args) => {
      const result = inlineCodeRule.call(md, ...args);
      return result.replace("<code>", '<code class="inline">');
    };
    this.md = md;
    this.initStyles().then(data => this.styles = data).catch(e => console.log(e));
  }

  initStyles() {
    const highlightTheme = config.highlightTheme || DEFAULT_HIGHLIGHT_THEME;
    // TODO: customize Mevernote rendering by input markdown theme.
    const markdownTheme = config.markdownTheme || "github.css"
    return Promise.all([
      // TODO: read to the memory, instead of IO each time.
      fs.readFileAsync(path.join(MARKDOWN_THEME_PATH, markdownTheme)),
      // TODO: read config css here and cover the default one.
      fs.readFileAsync(path.join(HIGHLIGHT_THEME_PATH, `${highlightTheme}.css`))
    ])
  }

  async toHtml(markcontent) {
    const tokens = this.md.parse(markcontent, {});
    const html = this.md.renderer.render(tokens, this.md.options);
    const $ = cheerio.load(html);
    await this.processStyle($);
    return $.xml();
  }

  async toEnml(markcontent) {
    const html = await this.toHtml(markcontent);
    let enml = '<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE en-note SYSTEM "http://xml.evernote.com/pub/enml2.dtd"><en-note>';
    enml += "<!--" + MAGIC_SPELL;
    enml += Buffer.from(markcontent, "utf-8").toString("base64");
    enml += MAGIC_SPELL + "-->";
    enml += html;
    enml += "</en-note>";
    return enml;
  }

  async processStyle($) {
    const styleHtml = this.customizeCss($);
    $.root().html(styleHtml);

    // Change html classes to inline styles
    const inlineStyleHtml = await inlineCss($.html(), {
      url: "/",
      removeStyleTags: true,
      removeHtmlSelectors: true,
    });
    $.root().html(inlineStyleHtml);
    $("en-todo").removeAttr("style");
  }

  customizeCss($) {
    const config = vscode.workspace.getConfiguration("evermonkey");
    let fontFamily;
    let fontSize;
    let codeFontFamily;
    let codeFontSize;
    if (config.fontFamily) {
      fontFamily = util.format(OVERRIDE_FONT_FAMILY, config.fontFamily.join(","));
    }
    if (config.fontSize) {
      fontSize = util.format(OVERRIDE_FONT_SIZE, config.fontSize);
    }
    if (config.codeFontFamily) {
      codeFontFamily = util.format(OVERRIDE_CODE_FONT_FAMILY, config.codeFontFamily.join(","));
    }
    if (config.codeFontSize) {
      codeFontSize = util.format(OVERRIDE_CODE_FONT_SIZE, config.codeFontSize);
    }
    return `<style>${this.styles.join("")}${fontFamily}${fontSize}${codeFontFamily}${codeFontSize}</style>` +
      `<div class="markdown-body">${$.html()}</div>`;
  }

  toMd(enml) {
    if (!enml) {
      return "";
    }
    let beginTagIndex = enml.indexOf("<en-note");
    let startIndex = enml.indexOf(">", beginTagIndex) + 1;
    let endIndex = enml.indexOf("</en-note>");
    let rawContent = enml.substring(startIndex, endIndex);
    if (rawContent.indexOf(MAGIC_SPELL) !== -1) {
      let beginMark = "<!--" + MAGIC_SPELL;
      let beginMagicIdx = rawContent.indexOf(beginMark) + beginMark.length;
      let endMagicIdx = rawContent.indexOf(MAGIC_SPELL + "-->");
      let magicString = rawContent.substring(beginMagicIdx, endMagicIdx);
      let base64content = new Buffer(magicString, "base64");
      return base64content.toString("utf-8");
    } else {
      let commentRegex = /<!--.*?-->/;
      let htmlStr = rawContent.replace(commentRegex, "");
      let mdtxt = toMarkdown(htmlStr);
      return this.todoFix(mdtxt);
    }
  }

  todoFix(markdown) {
    return markdown.replace(/<en-todo\s+checked="true"\s*\/?>/g, '[x] ')
      .replace(/<en-todo\s+checked="false"\s*\/?>/g, '[ ] ')
      .replace(/<en-todo\s*\/?>/g, '[ ] ')
      .replace(/<\/en-todo>/g, '');
  }

}
