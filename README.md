# Telegram Downloader

A professional browser extension designed to bypass content restrictions on Telegram Web (versions A and K). This tool enables the download of media, documents, and audio even from channels or chats where saving content is officially disabled.

## Purpose

Telegram often restricts the ability to save or forward content in specific channels to protect intellectual property or maintain privacy. This extension works at the browser level to capture media streams and files directly, allowing users to save data that is otherwise restricted.

## Key Features

- Bypass Restrictions: Download content from channels and groups where saving or forwarding is disabled.
- Multi-File Downloading: Start multiple downloads simultaneously with an integrated queue management system.
- Download Controls: Each active task can be paused, resumed, or cancelled at any time without losing progress.
- Intelligent Naming: Automatically restores original filenames from Telegram metadata or generates descriptive names based on message captions.
- Universal Support: Works with videos, high-resolution images, documents, and audio files across both Telegram Web A and Web K interfaces.
- Custom Prefixes: Option to prepend custom keywords or dates to your downloaded files for better organization.

## Installation

1. Clone this repository: `git clone https://github.com/StealthMoud/Telegram-Downloader.git`
2. Install dependencies: `npm install`
3. Build the extension: `npm run build`
4. Load into Browser:
   - Open your browser's extension management page (e.g., chrome://extensions).
   - Enable "Developer mode".
   - Click "Load unpacked" and select the `dist` folder generated in the project directory.

## How to Use

1. Open Telegram Web (A or K version).
2. Navigate to any message containing media or a file.
3. You will see a "DOWNLOAD" or "DOWNLOAD AUDIO" button injected directly into the message bubble.
4. Click the button. The extension will surgically capture the media URL and start the download.
5. Track your progress in the side panel. You can manage multiple downloads, pause those in progress, or cancel individual tasks.

## Technical Overview

The extension uses a segment-based fetching engine to handle large files efficiently. By bypassing the standard UI restrictions and directly interacting with the underlying media streams, it captures the highest resolution available.

## Disclaimer

This tool is intended for personal use and backup purposes. Please respect the copyright and privacy of content creators. The developers are not responsible for any misuse of this software.
