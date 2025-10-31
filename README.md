# Twitch Video Preview Extension

A Chrome extension that enhances your Twitch browsing experience by showing live video previews when hovering over channels, without any ads.

## Features

- **Floating Previews**: Hover over channels in the sidebar to see a floating video preview window
- **Grid Previews**: Hover over channel cards in browse/directory pages to see inline video previews
- **Ad-Free Experience**: Automatically blocks Twitch ads in previews
- **Picture-in-Picture Support**: Click on previews to enter picture-in-picture mode
- **Viewing History**: Tracks channels you've previewed for analytics
- **Smart Positioning**: Previews position themselves intelligently to stay within viewport
- **Keyboard Controls**: Press Escape to close all active previews

## Installation

### From Chrome Web Store
*(Coming soon)*

### Manual Installation (Developer Mode)

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory
5. The extension should now be installed and active

## Usage

1. Navigate to [twitch.tv](https://twitch.tv)
2. **Sidebar Previews**: Hover over any channel in the left sidebar
   - A floating preview window will appear after 500ms
   - Move your mouse away to hide the preview
3. **Grid Previews**: Hover over channel cards in browse or directory pages
   - The thumbnail will be replaced with a live video preview
   - Move your mouse away to restore the original thumbnail
4. **Picture-in-Picture**: Click on any preview to enter picture-in-picture mode
5. **Close Previews**: Press `Escape` to close all active previews

## How It Works

The extension consists of three main components:

- **Content Script** (`content.js`): Handles UI interactions, creates preview iframes, manages positioning and timing
- **Background Script** (`background.js`): Blocks ad requests using Chrome's declarativeNetRequest API
- **Manifest** (`manifest.json`): Defines extension permissions and structure

### Preview Types

1. **Floating Previews** (Sidebar)
   - 400x225px overlay window
   - Positioned relative to the hovered element
   - Supports picture-in-picture mode

2. **Inline Previews** (Grid)
   - Replaces existing thumbnails
   - Maintains original card dimensions
   - Smooth fade-in animation

## Permissions

The extension requires the following permissions:

- `storage`: To save viewing history locally
- `declarativeNetRequest`: To block ad requests
- Host permission for `*://*.twitch.tv/*`: To inject content scripts on Twitch pages

## Development

### Prerequisites

- Chrome browser
- Basic understanding of Chrome extensions

### Project Structure

```
├── manifest.json      # Extension manifest
├── background.js      # Service worker for ad blocking
├── content.js         # Main content script
├── styles.css         # Additional styling
└── favicon.png        # Extension icon
```

### Building

No build process required - the extension runs directly from source files.

### Testing

1. Load the extension in developer mode
2. Visit twitch.tv
3. Test hovering over sidebar channels and grid cards
4. Verify ad blocking is working (check network tab)

## Browser Compatibility

- Chrome 88+ (required for Manifest V3 and declarativeNetRequest)
- Chromium-based browsers (Edge, Opera, etc.)

## Privacy

- No data is sent to external servers
- Viewing history is stored locally only
- No tracking or analytics beyond local storage

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly on Twitch
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Changelog

### v1.0.0
- Initial release
- Floating and grid preview functionality
- Ad blocking
- Picture-in-picture support
- Viewing history tracking

## Support

If you encounter issues or have suggestions:

1. Check the [Issues](https://github.com/rusnakdima/TwitchPreviewExtension/issues) page
2. Create a new issue with detailed information
3. Include your browser version and steps to reproduce

## Acknowledgments

- Built for the Twitch community
- Uses Twitch's official player embed API
- Inspired by the need for ad-free browsing experiences
