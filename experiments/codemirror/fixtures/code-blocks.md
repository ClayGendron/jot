# Code Block Test Fixtures

This file tests fenced code block rendering with syntax highlighting.

## JavaScript

```javascript
function greet(name) {
  console.log(`Hello, ${name}!`);
  return true;
}

const result = greet("World");
```

## TypeScript

```typescript
interface User {
  id: number;
  name: string;
  email?: string;
}

function createUser(data: Partial<User>): User {
  return {
    id: Date.now(),
    name: "Anonymous",
    ...data,
  };
}
```

## Python

```python
def fibonacci(n: int) -> list[int]:
    """Generate first n Fibonacci numbers."""
    if n <= 0:
        return []
    elif n == 1:
        return [0]

    fib = [0, 1]
    for i in range(2, n):
        fib.append(fib[i-1] + fib[i-2])
    return fib

print(fibonacci(10))
```

## No Language Specified

```
This is a code block without a language specified.
It should render as plain text.
Multiple lines work fine.
```

## Rust

```rust
fn main() {
    let numbers = vec![1, 2, 3, 4, 5];
    let doubled: Vec<i32> = numbers.iter().map(|x| x * 2).collect();
    println!("{:?}", doubled);
}
```

## JSON

```json
{
  "name": "jot",
  "version": "1.0.0",
  "dependencies": {
    "shiki": "^1.0.0"
  }
}
```

## Multiple Consecutive Code Blocks

First block:

```html
<div class="container">
  <h1>Hello World</h1>
  <p>This is HTML.</p>
</div>
```

Second block immediately after:

```css
.container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

h1 {
  color: #333;
}
```

## Code Block After Heading

### Small Utility Function

```bash
#!/bin/bash
echo "Hello from bash!"
for i in {1..5}; do
  echo "Count: $i"
done
```

## Code Block After List

Here's a list of things:

- First item
- Second item
- Third item

And here's some code:

```go
package main

import "fmt"

func main() {
    fmt.Println("Hello, Go!")
}
```

## Code Block After Blockquote

> This is a blockquote with some important context
> about the code that follows.

```sql
SELECT users.name, COUNT(orders.id) as order_count
FROM users
LEFT JOIN orders ON users.id = orders.user_id
GROUP BY users.id
ORDER BY order_count DESC;
```

## Edge Cases

### Single Line Code Block

```javascript
const x = 42;
```

### Empty Code Block

```

```

### Code with Special Characters

```javascript
const regex = /^[a-z]+$/gi;
const html = '<div class="test">&amp;</div>';
const template = `Hello ${name}!`;
```

### Very Long Line

```javascript
const veryLongString = "This is an extremely long line of code that goes on and on and might cause horizontal scrolling issues if not handled properly by the code block widget implementation";
```

## Normal Paragraph

This is just a normal paragraph after all the code blocks. The editor should handle transitions between code blocks and regular content smoothly.
