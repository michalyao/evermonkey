import * as toMarkdown from 'to-markdown';
import * as marked from 'marked';
const MAGIC_SPELL = "%EVERMONKEY%";

const customRenderer = new marked.Renderer();
customRenderer.heading = (text, level) => {
    return '<h'+ level + '>'
    + text
    + '</h' + level + '>\n';
};

export function toMd(enml) {
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

function toHtml(markdown) {
    return marked(markdown, { xhtml: true, renderer: customRenderer });
}

export function toEnml(content) {
    let enml = '<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE en-note SYSTEM "http://xml.evernote.com/pub/enml2.dtd"><en-note style=";">';
    enml += '<!--' + MAGIC_SPELL;
    enml += new Buffer(content, 'utf-8').toString('base64');
    enml += MAGIC_SPELL + '-->';
    enml += toHtml(content);
    enml += '</en-note>';
    return enml;
}