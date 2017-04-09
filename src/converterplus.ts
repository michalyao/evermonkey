import * as cheerio from 'cheerio';
import * as hljs from 'highlight.js';
import * as inlineCss from 'inline-css'
import * as MarkdownIt from 'markdown-it';
import * as mdSub from 'markdown-it-sub';
import * as mdSup from 'markdown-it-sup';
import * as mdEmoji from 'markdown-it-emoji';
import * as mdEnmlTodo from 'markdown-it-enml-todo';
import * as mermaidLib from 'mermaid/lib';
import * as mermaidCli from 'mermaid/lib/cli';
import * as svg2png from 'svg2png';
import * as path from 'path';
import fs from './file'
import * as toMarkdown from 'to-markdown';
import * as vscode from 'vscode';

// Make this configurable
const MARKDOWN_THEME_PATH = path.join(__dirname, '../../themes');
const HIGHLIGHT_THEME_PATH = path.join(__dirname, '../../node_modules/highlight.js/styles');
const DEFAULT_HIGHLIGHT_THEME = 'github';
const MAGIC_SPELL = "%EVERMONKEY%";


const config = vscode.workspace.getConfiguration('evermonkey');

export default class Converter {
  md;
  constructor(options = {}) {
    const md = new MarkdownIt({
      html: true,
      linkify: true,
      highlight(code, lang) {
        // code highlight
        if (lang && hljs.getLanguage(lang)) {
          try {
            return `<pre class="hljs"><code>${hljs.highlight(lang, code, true).value}</code></pre>`
          } catch (err) {}
        }
        // diagram style
        if (code.match(/^graph/) || code.match(/^sequenceDiagram/) || code.match(/^gantt/)) {
          return `<div class="mermaid">${code}</div>`
        }

        return `<pre class="hljs"><code>${md.utils.escapeHtml(code)}</code></pre>`
      },
      ...options,
    });

    // markdown-it plugin
    md.use(mdSub)
      .use(mdSup)
      .use(mdEnmlTodo)
      .use(mdEmoji);

    // Inline code class for enml style.
    const inlineCodeRule = md.renderer.rules.code_inline;
    md.renderer.rules.code_inline = (...args) => {
      const result = inlineCodeRule.call(md, ...args);
      return result.replace('<code>', '<code class="inline">');
    }
    this.md = md;
  }

  async toHtml(markcontent) {
    const tokens = this.md.parse(markcontent, {});
    const html = this.md.renderer.render(tokens, this.md.options);
    const $ = cheerio.load(html);
    await this.processDiagram($);
    await this.processStyle($);
    return $.xml();
  }

  // get mermaid tokens.
  async processDiagram($) {
    const mermaidList = [];
    const mermaidElements = $('.mermaid');
    mermaidElements.each((idx, element) => mermaidList.push($(element).text()));
  }

  async toEnml(markcontent) {
    const html = await this.toHtml(markcontent);
    let enml = '<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE en-note SYSTEM "http://xml.evernote.com/pub/enml2.dtd"><en-note style=";">';
    enml += '<!--' + MAGIC_SPELL;
    enml += Buffer.from(markcontent, 'utf-8').toString('base64');
    enml += MAGIC_SPELL + '-->';
    enml += html;
    enml += '</en-note>';
    return enml;
  }

  async processStyle($) {
    // make configurable
    const highlightTheme = config.highlightTheme || DEFAULT_HIGHLIGHT_THEME;
    const styles = await Promise.all([
      fs.readFileAsync(path.join(MARKDOWN_THEME_PATH, 'github.css')),
      fs.readFileAsync(path.join(HIGHLIGHT_THEME_PATH, `${highlightTheme}.css`))
    ]);
    const styleHtml = `<style>${styles.join('')}</style>` +
      `<div class="markdown-body">${$.html()}</div>`;
    $.root().html(styleHtml);

    // Change html classes to inline styles
    const inlineStyleHtml = await inlineCss($.html(), {
      url: '/',
      removeStyleTags: true,
      removeHtmlSelectors: true,
    });
    $.root().html(inlineStyleHtml);
    $('en-todo').removeAttr('style');
  }

  toMd(enml) {
    if (!enml) {
      return "";
    }
    let beginTagIndex = enml.indexOf('<en-note');
    let startIndex = enml.indexOf('>', beginTagIndex) + 1;
    let endIndex = enml.indexOf('</en-note>');
    let rawContent = enml.substring(startIndex, endIndex);
    if (rawContent.indexOf(MAGIC_SPELL) != -1) {
      let beginMark = '<!--' + MAGIC_SPELL;
      let beginMagicIdx = rawContent.indexOf(beginMark) + beginMark.length;
      let endMagicIdx = rawContent.indexOf(MAGIC_SPELL + '-->');
      let magicString = rawContent.substring(beginMagicIdx, endMagicIdx);
      let base64content = new Buffer(magicString, 'base64');
      return base64content.toString('utf-8');
    } else {
      let commentRegex = /<!--.*?-->/;
      let htmlStr = rawContent.replace(commentRegex, '');
      return toMarkdown(htmlStr);
    }
  }

}
