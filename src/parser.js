// The token-tree renderer: a port of marked 18.1.3's Parser (MIT; see vendor/marked/LICENSE).
// Extensions are not part of the default configuration, so the extension hooks are omitted.

import { Renderer, TextRenderer } from './render.js';
import { escape } from './util.js';

export class Parser {
  constructor() {
    this.renderer = new Renderer();
    this.renderer.parser = this;
    this.textRenderer = new TextRenderer();
    this.textRenderer.parser = this;
  }

  parse(tokens) {
    this.renderer.parser = this;
    let out = '';
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      switch (token.type) {
        case 'space':
          out += this.renderer.space(token);
          break;
        case 'hr':
          out += this.renderer.hr(token);
          break;
        case 'heading':
          out += this.renderer.heading(token);
          break;
        case 'code':
          out += this.renderer.code(token);
          break;
        case 'table':
          out += this.renderer.table(token);
          break;
        case 'blockquote':
          out += this.renderer.blockquote(token);
          break;
        case 'list':
          out += this.renderer.list(token);
          break;
        case 'checkbox':
          out += this.renderer.checkbox(token);
          break;
        case 'html':
          out += this.renderer.html(token);
          break;
        case 'def':
          out += this.renderer.def(token);
          break;
        case 'paragraph':
          out += this.renderer.paragraph(token);
          break;
        case 'text':
          out += token.tokens ? this.parseInline(token.tokens) : token.escaped ? token.text : escape(token.text);
          break;
        default:
          throw new Error('Token with "' + token.type + '" type was not found.');
      }
    }
    return out;
  }

  parseInline(tokens, renderer = this.renderer) {
    this.renderer.parser = this;
    let out = '';
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      switch (token.type) {
        case 'escape':
          out += renderer.text(token);
          break;
        case 'html':
          out += renderer.html(token);
          break;
        case 'link':
          out += renderer.link(token);
          break;
        case 'image':
          out += renderer.image(token);
          break;
        case 'checkbox':
          out += renderer.checkbox(token);
          break;
        case 'strong':
          out += renderer.strong(token);
          break;
        case 'em':
          out += renderer.em(token);
          break;
        case 'codespan':
          out += renderer.codespan(token);
          break;
        case 'br':
          out += renderer.br(token);
          break;
        case 'del':
          out += renderer.del(token);
          break;
        case 'text':
          out += token.tokens ? this.parseInline(token.tokens, renderer) : token.escaped ? token.text : escape(token.text);
          break;
        default:
          throw new Error('Token with "' + token.type + '" type was not found.');
      }
    }
    return out;
  }
}
