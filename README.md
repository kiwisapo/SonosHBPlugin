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
### Manual Installation (via npm pack)
If you want to install this plugin manually (e.g., for testing a local build):

1. **Pack the plugin**:
   Run the following command in the root of the project to create a `.tgz` file (e.g., `homebridge-sonos-hb-plugin-2.0.0.tgz`):
   ```bash
   npm pack
   ```

2. **Install the package**:
   Copy the generated `.tgz` file to your Homebridge server (if different) and run:
   ```bash
   npm install -g ./homebridge-sonos-hb-plugin-2.0.0.tgz
   ```

3. **Restart Homebridge**:
   Restart your Homebridge service to load the new plugin version.

## Configuration

**IMPORTANT**: This plugin will NOT expose any devices by default. You must explicitly list the Room Name of each Sonos speaker you want to control.

Add the following to your `config.json` in the `platforms` array:

```json
{
    "platforms": [
        {
            "platform": "SonosHBPlugin",
            "name": "Sonos",
            "deviceNames": ["Living Room", "Kitchen"],
            "devices": [
                {
                    "deviceName": "Office",
                    "ipAddress": "192.168.1.50"
                },
                {
                    "deviceName": "Master Bedroom",
                    "macAddress": "B8:E9:37:XX:XX:XX"
                }
            ]
        }
    ]
}
```

- `platform`: Must be "SonosHBPlugin".
- `name`: The name of the platform (optional, defaults to "Sonos").
- `deviceNames`: (Legacy) An array of strings. These **must match exactly** the Room Names of your Sonos devices.
- `devices`: (Strict Filter) Array of objects. If populated, this list takes precedence. Each item **must** have a `deviceName` and **optional** `ipAddress` or `macAddress`.
  - If `ipAddress` is provided, the device must match BOTH the name and IP.
  - If `macAddress` is provided, the device must match BOTH the name and MAC.
  - If both are provided, it must match ALL conditions.

### Finding Room Names
To find the correct Room Names, check your Sonos App. Alternatively, run Homebridge with this plugin enabled; it will log all discovered devices (and their names) to the Homebridge console/log.

## Architecture & Design

This plugin uses the `homebridge` Dynamic Platform API.

1.  **Discovery**: On startup (`didFinishLaunching`), the plugin triggers a UPnP discovery for Sonos devices.
2.  **Filtering**: Discovered devices are compared against the configuration. Only matches are registered.
3.  **Control**: The plugin uses direct SOAP requests (UPnP RenderingControl service).
4.  **State Management**: Currently assumes default "OFF" state on startup.

## Troubleshooting

- **No devices showing up?** Check the Homebridge logs. Ensure your `deviceNames` list matches.
- **Errors controlling device?** Ensure the device has a static IP.

## Development

```bash
# Build the plugin
npm run build

# Watch for changes
npm run watch
```
