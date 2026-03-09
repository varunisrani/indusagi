# Editor Border Color Demo - #F36A35

## Visual Representation

```
Before Update (Theme Default):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
│ Input your text here                                  │
│ Multiple lines supported                             │
│ ↓ 2 more lines                                        │
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
(Border color varies by theme: Blue in dark, Blue in light)


After Update (Orange #F36A35):
🟠🟠🟠🟠🟠🟠🟠🟠🟠🟠🟠🟠🟠🟠🟠🟠🟠🟠🟠🟠🟠🟠🟠🟠🟠🟠🟠
│ Input your text here                                  │
│ Multiple lines supported                             │
│ ↓ 2 more lines                                        │
🟠🟠🟠🟠🟠🟠🟠🟠🟠🟠🟠🟠🟠🟠🟠🟠🟠🟠🟠🟠🟠🟠🟠🟠🟠🟠🟠
(Border color is always Orange #F36A35)
```

## Color Specifications

| Property | Value |
|----------|-------|
| Hex Code | `#F36A35` |
| RGB | `(243, 106, 53)` |
| ANSI | `ESC[38;2;243;106;53m` |
| Display Name | Indusagi Orange |

## Implementation Details

### File
`src/tui/components/editor.ts`

### Constructor Change
```typescript
// OLD:
this.borderColor = theme.borderColor;

// NEW:
this.borderColor = (str: string) => chalk.hex("#F36A35")(str);
```

### Affected Elements
1. **Top Border** (with scroll indicator when scrolled)
   ```
   ──────────────────────────────────────
   ```

2. **Bottom Border** (with scroll indicator when content below)
   ```
   ──────────────────────────────────────
   ```

3. **Scroll Indicators**
   ```
   ─── ↑ 3 more ─────────────────────────  (top)
   ─── ↓ 5 more ─────────────────────────  (bottom)
   ```

## Terminal Compatibility
- Works with all modern terminals supporting ANSI 24-bit color (Truecolor)
- Tested with iTerm2, Terminal.app, VS Code terminal
- Fallback for older terminals that don't support Truecolor

## Usage Example
```typescript
import { Editor } from "@indusagi/tui";
import chalk from "chalk";

// The editor now automatically uses #F36A35 for borders
const editor = new Editor(tui, {
    borderColor: (str) => chalk.hex("#F36A35")(str),
    selectList: { /* ... */ }
});
```

## Related Components
- The `borderColor` property is accessible as a public property:
  ```typescript
  editor.borderColor = (str) => chalk.hex("#AABBCC")(str);  // Can be changed dynamically
  ```

## Notes
- This change is purely visual and doesn't affect editor functionality
- The orange color maintains good contrast in both dark and light terminal themes
- The color matches the Indusagi ASCII art logo color
