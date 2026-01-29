# Complex Markdown Test File

This file tests various markdown features for conversion testing.

## Basic Formatting

This paragraph has **bold text**, *italic text*, and ***bold italic*** together.
Also ~~strikethrough~~ and `inline code` are supported.

## Links

- [External link](https://example.com)
- [Internal link](other-note.md)
- [Internal link with heading](other-note.md#section)
- [Another internal link](subfolder/deep-note.md)

## Code Blocks

### JavaScript

```javascript
function greet(name) {
  const message = `Hello, ${name}!`;
  console.log(message);
  return message;
}

// HTML-like content in code
const html = '<div class="container">Content</div>';
const condition = a && b || c;
```

### HTML (tests special character handling)

```html
<!DOCTYPE html>
<html>
<head>
  <title>Test &amp; Demo</title>
</head>
<body>
  <div class="test">
    <p>Hello &lt;World&gt;</p>
  </div>
</body>
</html>
```

### Python

```python
def calculate(x, y):
    """Calculate something useful."""
    if x > 0 and y > 0:
        return x + y
    return None
```

## Lists

### Unordered List

- First item
- Second item
  - Nested item 1
  - Nested item 2
- Third item

### Ordered List

1. First step
2. Second step
3. Third step
   1. Sub-step A
   2. Sub-step B

### Task List

- [ ] Todo item
- [x] Completed item
- [ ] Another todo

## Blockquotes

> This is a simple blockquote.

> This is a multi-line blockquote
> that spans multiple lines
> and contains **formatting**.

## Tables

| Feature | Status | Notes |
| --- | --- | --- |
| Basic text | ✅ Done | Works great |
| **Bold** in table | ✅ Done | Inline formatting |
| `code` in table | ✅ Done | Inline code |

## Horizontal Rules

---

Above and below are horizontal rules.

***

## Images

![Alt text for image](images/test.png)

![](images/no-alt.png)

## Special Characters in Text

This tests special characters: <angle brackets>, &ampersands&, and "quotes".

The expression `a < b && c > d` should be preserved in inline code.

## Edge Cases

### Empty Sections

### Heading with **bold** and *italic*

### Code with angle brackets

Use `<div>` for containers and `</div>` to close them.

The `&&` operator is for logical AND.

---

## Deeply Nested Structures

### Nested Lists with Formatting

- Level 1 item with **bold**
  - Level 2 with *italic*
    - Level 3 with `code`
      - Level 4 with [link](test.md)
        - Level 5 deeply nested
  - Another level 2
- Back to level 1

### Mixed List Types

1. Ordered item 1
   - Unordered nested
   - Another unordered
2. Ordered item 2
   1. Nested ordered
   2. Another nested ordered
      - Mixed in unordered
3. Ordered item 3

## Complex Code Blocks

### JSX/React Component

```jsx
function MyComponent({ items, onSelect }) {
  const [selected, setSelected] = useState(null);

  return (
    <div className="container">
      {items.map((item, index) => (
        <button
          key={item.id}
          onClick={() => {
            setSelected(item);
            onSelect && onSelect(item);
          }}
          disabled={item.disabled}
        >
          {item.label} {index > 0 && <span>({index})</span>}
        </button>
      ))}
      {selected && <p>Selected: {selected.label}</p>}
    </div>
  );
}
```

### SQL with Special Characters

```sql
SELECT u.id, u.name, COUNT(*) as total
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
WHERE u.created_at >= '2024-01-01'
  AND u.status <> 'deleted'
  AND (o.amount > 100 OR o.priority = 'high')
GROUP BY u.id, u.name
HAVING COUNT(*) >= 5
ORDER BY total DESC;
```

### Shell Script

```bash
#!/bin/bash
set -euo pipefail

for file in *.md; do
  if [[ -f "$file" ]]; then
    count=$(wc -l < "$file")
    echo "File: $file has $count lines"

    # Check for patterns
    if grep -q "TODO" "$file"; then
      echo "  -> Contains TODO items"
    fi
  fi
done

# Pipes and redirects
cat input.txt | grep "pattern" | sort | uniq > output.txt 2>&1
```

### TypeScript with Generics

```typescript
interface Result<T, E = Error> {
  ok: boolean;
  value?: T;
  error?: E;
}

async function fetchData<T>(
  url: string,
  options?: RequestInit
): Promise<Result<T>> {
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      return { ok: false, error: new Error(`HTTP ${response.status}`) };
    }
    const data: T = await response.json();
    return { ok: true, value: data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e : new Error(String(e)) };
  }
}

// Usage with type parameters
type User = { id: number; name: string; email: string };
const result = await fetchData<User[]>('/api/users');
```

### JSON Configuration

```json
{
  "name": "test-project",
  "version": "1.0.0",
  "scripts": {
    "build": "tsc && vite build",
    "test": "vitest run"
  },
  "dependencies": {
    "@tiptap/core": "^2.0.0",
    "markdown-it": "^14.0.0"
  },
  "config": {
    "special_chars": "<>&\"'",
    "nested": {
      "deep": {
        "value": true
      }
    }
  }
}
```

### YAML

```yaml
version: '3.8'
services:
  app:
    build:
      context: .
      args:
        - NODE_ENV=production
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - API_KEY=${API_KEY}
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    depends_on:
      - db

  db:
    image: postgres:15
    environment:
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

## Complex Tables

### Table with Code and Links

| Function | Syntax | Description |
| --- | --- | --- |
| `map()` | `arr.map(fn)` | Transform each element |
| `filter()` | `arr.filter(fn)` | Keep matching elements |
| `reduce()` | `arr.reduce(fn, init)` | Accumulate to single value |
| See [MDN Docs](https://developer.mozilla.org) | `Array.prototype` | Full reference |

### Table with Special Characters

| Symbol | HTML Entity | Description |
| --- | --- | --- |
| < | `&lt;` | Less than |
| > | `&gt;` | Greater than |
| & | `&amp;` | Ampersand |
| " | `&quot;` | Double quote |
| ' | `&#39;` | Single quote |

## Edge Cases and Stress Tests

### Consecutive Code Blocks

```js
const a = 1;
```

```js
const b = 2;
```

```js
const c = 3;
```

### Empty Code Block

```
```

### Code Block with Only Whitespace

```


```

### Inline Code Edge Cases

Here's `code with spaces`, and `` `backticks` `` inside, and `a < b && c > d` operators.

Multiple `inline` `code` `spans` in `one` `line`.

### Links with Special Characters

- [Link with spaces](file%20with%20spaces.md)
- [Link with query](file.md?param=value&other=123)
- [Link with hash](file.md#section-name)
- [Complex link](path/to/file.md#heading?query=1)

### Escaped Characters

Use \*asterisks\* without emphasis.

Use \`backticks\` without code.

Use \[brackets\] without links.

Use \# hash without heading.

### Unicode and Emoji

- Emoji: 🎉 🚀 ✅ ❌ 📝 💻
- Unicode: café, naïve, 中文, 日本語, العربية
- Math symbols: α β γ δ ∑ ∫ √ ≠ ≤ ≥
- Currency: $ € £ ¥ ₹

### Very Long Lines

This is a very long line that goes on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on to test line wrapping behavior.

### Multiple Blank Lines Between Sections




The above had multiple blank lines.

### Blockquote with Code

> Here's a blockquote with `inline code` and a code block:
>
> ```python
> def quoted_code():
>     return "inside blockquote"
> ```
>
> And more text after.

### Nested Blockquotes

> Level 1 quote
> > Level 2 nested quote
> > > Level 3 deeply nested
> > Back to level 2
> Back to level 1

### Definition-style Content

**Term 1**
: Definition of term 1 with *formatting* and `code`.

**Term 2**
: Definition of term 2 with [a link](ref.md).

### Footnote-style References

Here's some text with a reference[^1] and another[^2].

[^1]: This is the first footnote.
[^2]: This is the second footnote with `code`.

---

*End of test file*
