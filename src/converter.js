'use strict'
//pass ENML to md, and back

// const xml2js = require('xml2js');
const MarkdownIt = require('markdown-it');
const toMarkdown = require('to-markdown');
const md = new MarkdownIt({
    html: true, // Enable HTML tags in source
    linkify: true, // Autoconvert URL-like text to links

    // Highlighter function. Should return escaped HTML,
    // or '' if the source string is not changed
    highlight(code, lang) {
        if (code.match(/^graph/) || code.match(/^sequenceDiagram/) || code.match(/^gantt/)) {
            return `<div class="mermaid">${code}</div>`
        }

        if (lang && hljs.getLanguage(lang)) {
            try {
                return `<pre class="hljs"><code>${hljs.highlight(lang, code, true).value}</code></pre>`
            } catch (err) {
                // Ignore error
            }
        }

        return `<pre class="hljs"><code>${md.utils.escapeHtml(code)}</code></pre>`
    }
});

const inlineCodeRule = md.renderer.rules.code_inline
md.renderer.rules.code_inline = (...args) => {
    const result = inlineCodeRule.call(md, ...args)
    return result.replace('<code>', '<code class="inline">')
}

function toMd(enml) {
    if (!enml) {
        return "";
    }

    let beginTagIndex = enml.indexOf('<en-note'); 
    let startIndex = enml.indexOf('>', beginTagIndex) + 1;
    let endIndex = enml.indexOf('</en-note>');
    let rawContent = enml.substring(startIndex, endIndex);

    let commentRegex = /<!--.*?-->/;
    let htmlStr = rawContent.replace(commentRegex, '');
    return toMarkdown(htmlStr);
}

function toHtml(markdown) {
    return md.render(markdown);
}

function toEnml(content) {
    let enml = '<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE en-note SYSTEM "http://xml.evernote.com/pub/enml2.dtd"><en-note style=";">';
    enml += toHtml(content);

    enml += '</en-note>';

    return enml;
}

exports.toMd = toMd;
exports.toEnml = toEnml;
exports.toHtml = toHtml;