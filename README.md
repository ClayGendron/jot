# Jot

A lightweight, fast, cross-platform markdown editor that's free forever.

## Features

- **Fast** - Sub-second startup, instant responsiveness
- **WYSIWYG** - Beautiful editing without needing to know markdown syntax
- **Autosave** - Never lose your work, with full version history
- **Mermaid Diagrams** - Create beautiful diagrams inline
- **Spell & Grammar Check** - On-device, no cloud required
- **Semantic Search** - Find notes by meaning, not just keywords
- **Export** - PDF, Word, and HTML export built-in
- **Cross-Platform** - macOS, Windows, Linux, iOS, and Android
- **No Cloud Lock-in** - Your files are standard markdown, stored locally
- **Free Forever** - No subscriptions, no paid tiers

## Tech Stack

- **Desktop**: [Tauri](https://tauri.app/) (Rust + TypeScript/React)
- **Mobile**: React Native
- **Editor**: [TipTap](https://tiptap.dev/)
- **Styling**: Tailwind CSS

## Development

### Prerequisites

- [Bun](https://bun.sh/) - JavaScript runtime and package manager
- [Rust](https://www.rust-lang.org/tools/install) - For Tauri backend
- [Tauri Prerequisites](https://tauri.app/start/prerequisites/) - Platform-specific dependencies

### Setup

```bash
# Install dependencies
bun install

# Start development server
bun run tauri dev

# Run tests
bun test

# Build for production
bun run tauri build
```

### Project Structure

```
jot/
├── src/                  # React frontend
│   ├── components/       # React components
│   ├── lib/             # Pure business logic
│   ├── hooks/           # React hooks
│   └── stores/          # State management
├── src-tauri/           # Rust backend
│   ├── src/             # Rust source code
│   └── Cargo.toml       # Rust dependencies
├── FEATURE_SCOPE.md     # Feature planning document
└── package.json         # Frontend dependencies
```

## License

MIT License - see [LICENSE](LICENSE) for details.

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting a PR.
