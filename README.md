# indusagi

> **Inspired by Pi**: *"Code with clarity, collaborate with purpose, and build with intelligence. Every line you write is a conversation between you and your assistant."*

All-in-one package that bundles:

- `indusagi-ai`
- `indusagi-agent`
- `indusagi-tui`
- `indusagi-webui`

Use this package if you want a single dependency for the core Indusagi SDK stack.

Docs: https://www.indusagi.com

For the CLI, install `indusagi-coding-agent` globally:

```bash
npm install -g indusagi-coding-agent
```

## Install

```bash
npm install indusagi
```

## Usage

```ts
import { getModel } from "indusagi/ai";
import { Agent } from "indusagi/agent";
import { TUI } from "indusagi/tui";
import { ChatPanel } from "indusagi/webui";
```

Or import everything:

```ts
import * as indusagi from "indusagi";
```

## License

MIT
