# Links

This document tests link display and editing in WYSIWYG mode.

## Basic Links

Here is a [simple link](https://example.com) in a paragraph.

Multiple links: [first](https://first.com), [second](https://second.com), and [third](https://third.com).

## Links with Various Text

[Short](https://example.com)

[This is a longer link with more text](https://example.com/path/to/page)

[Link with special chars: 123 !@#](https://example.com)

## Links with Empty Parts

[empty URL]()

[](https://no-text-link.com)

## Links in Context

Start of paragraph [middle link](https://example.com) end of paragraph.

[link at start](https://start.com) followed by text.

Text followed by [link at end](https://end.com)

## Links with Formatting

**Bold text with [a link](https://example.com) inside**

*Italic text with [a link](https://example.com) inside*

[**Bold link text**](https://example.com)

[*Italic link text*](https://example.com)

## Test Cases

1. Navigate into link: place cursor before [ and press ArrowRight
2. Navigate out of link: place cursor at end of link text and press ArrowRight
3. Edit link text: click in link text and type
4. Backspace at link start: should remove link syntax, keep text
5. Cmd+K on link: should open URL editor
6. Cmd+K with selection: should wrap selection in link
