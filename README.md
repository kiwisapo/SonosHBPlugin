# Homebridge Sonos Plugin

A Homebridge plugin to integrate Sonos speakers into HomeKit, specifically focusing on "Night Sound" and "Speech Enhancement" controls.

## Features

- **Device Discovery**: Automatically discovers Sonos devices on your local network.
- **Strict Filtering**: Only exposes devices that you explicitly allow in the configuration.
- **Night Sound**: Toggle "Night Sound" mode for compatible Sonos speakers (e.g. Playbar, Beam, Arc).
- **Speech Enhancement**: Toggle "Speech Enhancement" mode.

## Installation

1. Install Homebridge (if you haven't already).
2. Install this plugin:
   ```bash
   npm install -g homebridge-sonos-hb-plugin
   ```
   *Note: If you are installing from a local directory for development, use `npm link`.*

## Configuration

**IMPORTANT**: This plugin will NOT expose any devices by default. You must explicitly list the Room Name of each Sonos speaker you want to control.

Add the following to your `config.json` in the `platforms` array:

```json
{
    "platform": "SonosHBPlugin",
    "name": "Sonos",
    "deviceNames": [
        "Living Room",
        "Master Bedroom",
        "Media Room"
    ]
}
```

- `platform`: Must be "SonosHBPlugin".
- `name`: The name of the platform (optional, defaults to "Sonos").
- `deviceNames`: An array of strings. These **must match exactly** the Room Names of your Sonos devices as they appear in the Sonos app.

### Finding Room Names
To find the correct Room Names, check your Sonos App. Alternatively, you can run Homebridge with this plugin enabled; it will log all discovered devices (and their names) to the Homebridge console/log, even if they are ignored. Look for "Ignoring discovered device..." messages.

## Architecture & Design

This plugin uses the `homebridge` Dynamic Platform API.

1.  **Discovery**: On startup (`didFinishLaunching`), the plugin triggers a UPnP discovery for Sonos devices.
2.  **Filtering**: Discovered devices are compared against the `deviceNames` config. Only matches are registered.
3.  **Control**: The plugin uses direct SOAP requests (UPnP RenderingControl service) to toggle Night Mode and Speech Enhancement, bypassing the need for complex libraries for these specific features.
4.  **State Management**: Currently, the plugin sets state but assumes a default "OFF" state on startup / cache load. Bi-directional state syncing (polling or event subscription) is a future enhancement.

## Troubleshooting

- **No devices showing up?** Check the Homebridge logs. Ensure your `deviceNames` list exactly matches the names found in the logs.
- **Errors controlling device?** Ensure the device has a static IP or stable network connection. The plugin relies on the IP address discovered at startup.

## Development

```bash
# Build the plugin
npm run build

# Watch for changes
npm run watch
```
