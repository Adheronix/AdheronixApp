import { Injectable } from '@nestjs/common';

@Injectable()
export class ResponseFormatterService {
  formatForChat(rawText: string): string {
    if (!rawText) return '';

    let formatted = rawText;

    formatted = this.stripCodeBlocks(formatted);
    formatted = this.convertBold(formatted);
    formatted = this.convertItalic(formatted);
    formatted = this.convertHeaders(formatted);
    formatted = this.convertLists(formatted);
    formatted = this.convertInlineCode(formatted);
    formatted = this.cleanUpWhitespace(formatted);

    return formatted;
  }

  formatForNotification(rawText: string): string {
    if (!rawText) return '';

    let formatted = rawText;
    formatted = formatted.replace(/\*\*(.+?)\*\*/g, '$1');
    formatted = formatted.replace(/\*(.+?)\*/g, '$1');
    formatted = formatted.replace(/#{1,6}\s+/g, '');
    formatted = formatted.replace(/```[\s\S]*?```/g, '');
    formatted = formatted.replace(/`(.+?)`/g, '$1');
    formatted = formatted.replace(/\n{3,}/g, '\n\n');
    return formatted.trim();
  }

  private stripCodeBlocks(text: string): string {
    return text.replace(/```[\s\S]*?```/g, (match) => {
      const content = match.replace(/```(?:\w+)?\n?/, '').replace(/```$/, '');
      return content.trim();
    });
  }

  private convertBold(text: string): string {
    return text.replace(/\*\*(.+?)\*\*/g, '𝗕𝗼𝗹𝗱: $1');
  }

  private convertItalic(text: string): string {
    return text.replace(/\*(.+?)\*/g, '$1');
  }

  private convertHeaders(text: string): string {
    return text.replace(/#{1,6}\s+(.+)/g, (match, content) => {
      return `${content}`;
    });
  }

  private convertLists(text: string): string {
    text = text.replace(/^[-*]\s+(.+)/gm, '  • $1');
    text = text.replace(/^\d+\.\s+(.+)/gm, (match, content, offset, string) => {
      const precedingLines = string.slice(0, offset).split('\n').length;
      return `  ${precedingLines}. ${content}`;
    });
    return text;
  }

  private convertInlineCode(text: string): string {
    return text.replace(/`(.+?)`/g, '$1');
  }

  private cleanUpWhitespace(text: string): string {
    text = text.replace(/\n{3,}/g, '\n\n');
    text = text.replace(/[ \t]+$/gm, '');
    return text.trim();
  }
}
