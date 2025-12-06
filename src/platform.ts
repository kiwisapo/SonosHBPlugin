import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { SonosPlatformAccessory } from './platformAccessory';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { DeviceDiscovery } = require('sonos');


/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class SonosHomebridgePlatform implements DynamicPlatformPlugin {
    public readonly Service: typeof Service = this.api.hap.Service;
    public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

    // this is used to track restored cached accessories
    public readonly accessories: PlatformAccessory[] = [];

    constructor(
        public readonly log: Logger,
        public readonly config: PlatformConfig,
        public readonly api: API,
    ) {
        this.log.debug('Finished initializing platform:', this.config.name);

        // When this event is fired it means Homebridge has restored all cached accessories from disk.
        // Dynamic Platform plugins should only register new accessories after this event was fired,
        // in order to ensure they weren't added to homebridge already. This event can also be used
        // to start discovery of new accessories.
        this.api.on('didFinishLaunching', () => {
            this.log.debug('Executed didFinishLaunching callback');
            // run the method to discover / register your accessories as example
            this.discoverDevices();
        });
    }

    /**
     * This function is invoked when homebridge restores cached accessories from disk at startup.
     * It should be used to setup event handlers for characteristics and update respective values.
     */
    configureAccessory(accessory: PlatformAccessory) {
        this.log.info('Loading accessory from cache:', accessory.displayName);

        // add the restored accessory to the accessories cache so we can track if it has already been registered
        this.accessories.push(accessory);
    }

    /**
     * Discover Sonos devices on the network.
     * Accessories must only be registered once, previously created accessories
     * must not be registered again to prevent "duplicate UUID" errors.
     * 
     * NEW REQUIREMENT: Devices must be explicitly selected in the configuration to be added.
     */
    async discoverDevices() {
        const configuredDevices: string[] = this.config.deviceNames || [];
        const strictDevices: { deviceName: string; ipAddress?: string; macAddress?: string }[] = this.config.devices || [];

        if (configuredDevices.length === 0 && strictDevices.length === 0) {
            this.log.warn('No devices configured in "deviceNames" or "devices". No Sonos devices will be added.');
            this.log.warn('Please add your Sonos Room Names to the "deviceNames" list or use "devices" for strict filtering in the Homebridge configuration.');
            return;
        }

        this.log.info('Starting Sonos device discovery...');

        // Use the 'sonos' library to discover devices on the local network
        DeviceDiscovery((device: any) => {
            this.log.debug('Discovered a Sonos device at:', device.host);

            // Fetch device details (e.g. Serial Number, Room Name / Friendly Name)
            device.deviceDescription().then((model: any) => {
                // Generate a unique ID based on the UDN (Unique Device Name) or IP host as fallback
                const uuid = this.api.hap.uuid.generate(model.UDN || device.host);
                const displayName = model.roomName || 'Sonos Device';

                const ipAddress = device.host;
                const macAddress = model.MACAddress || model.serialNum?.split(':')[0]; // Fallback if MAC not explicit

                // FILTERING LOGIC
                let shouldAdd = false;

                if (strictDevices.length > 0) {
                    // Strict filtering takes precedence
                    const match = strictDevices.find(d => {
                        if (d.deviceName !== displayName) { return false; }

                        // Check IP if configured
                        if (d.ipAddress && d.ipAddress !== ipAddress) { return false; }

                        // Check MAC if configured
                        if (d.macAddress && d.macAddress !== macAddress) { return false; }

                        return true;
                    });

                    if (match) {
                        shouldAdd = true;
                    } else {
                        this.log.debug(`Ignoring discovered device "${displayName}" (IP: ${ipAddress}, MAC: ${macAddress}) as it does not match any entry in "devices".`);
                    }
                } else {
                    // Legacy filtering
                    if (configuredDevices.includes(displayName)) {
                        shouldAdd = true;
                    } else {
                        this.log.debug(`Ignoring discovered device "${displayName}" as it is not in the "deviceNames" list.`);
                    }
                }

                if (!shouldAdd) {
                    return;
                }

                // Check if the accessory already exists in the cache
                const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

                if (existingAccessory) {
                    // The accessory already exists
                    this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);

                    // If you need to update the accessory.context then you should run `api.updatePlatformAccessories`.
                    // eg. existingAccessory.context.device = device;
                    existingAccessory.context.device = device;
                    this.api.updatePlatformAccessories([existingAccessory]);

                    // Create the accessory handler for the restored accessory
                    // this is imported from `platformAccessory.ts`
                    new SonosPlatformAccessory(this, existingAccessory);
                } else {
                    // The accessory does not yet exist, so we need to create it
                    this.log.info('Adding new accessory:', displayName);

                    // Create a new accessory
                    const accessory = new this.api.platformAccessory(displayName, uuid);

                    // Store a copy of the device object in the `accessory.context`
                    // the `context` property can be used to store any data about the accessory you may need
                    accessory.context.device = device;

                    // Create the accessory handler for the newly create accessory
                    // this is imported from `platformAccessory.ts`
                    new SonosPlatformAccessory(this, accessory);

                    // Link the accessory to your platform
                    this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
                }
            }).catch((err: any) => {
                this.log.error('Error getting device description for device at ' + device.host, err);
            });
        });
    }
}
