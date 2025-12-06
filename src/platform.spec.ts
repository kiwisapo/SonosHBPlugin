import { SonosHomebridgePlatform } from './platform';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings';

// Mock sonos library
// Mock sonos library
jest.mock('sonos', () => {
    return {
        DeviceDiscovery: jest.fn(),
        Sonos: jest.fn(),
    };
});

// Import after mock
import { DeviceDiscovery } from 'sonos';
const mockDeviceDiscovery = DeviceDiscovery as jest.Mock;

describe('SonosHomebridgePlatform', () => {
    let platform: SonosHomebridgePlatform;
    let api: any;
    let log: any;
    let config: any;

    beforeEach(() => {
        // Reset mocks
        mockDeviceDiscovery.mockReset();

        // Mock API
        api = {
            on: jest.fn(),
            hap: {
                Service: jest.fn(),
                Characteristic: jest.fn(),
                uuid: {
                    generate: jest.fn((str) => 'generated-uuid-' + str),
                },
            },
            platformAccessory: jest.fn().mockImplementation((name, uuid) => ({
                displayName: name,
                UUID: uuid,
                context: {},
                getService: jest.fn().mockReturnValue({
                    setCharacteristic: jest.fn().mockReturnThis(),
                    getCharacteristic: jest.fn().mockReturnValue({
                        onSet: jest.fn().mockReturnThis(),
                        onGet: jest.fn().mockReturnThis(),
                    }),
                }),
                addService: jest.fn().mockReturnValue({
                    setCharacteristic: jest.fn().mockReturnThis(),
                    getCharacteristic: jest.fn().mockReturnValue({
                        onSet: jest.fn().mockReturnThis(),
                        onGet: jest.fn().mockReturnThis(),
                    }),
                }),
            })),
            registerPlatformAccessories: jest.fn(),
            updatePlatformAccessories: jest.fn(),
        };

        log = {
            info: jest.fn(),
            debug: jest.fn(),
            error: jest.fn(),
        };

        config = {
            name: 'Sonos',
            platform: 'SonosHBPlugin',
        };

        platform = new SonosHomebridgePlatform(log, config, api);
    });

    it('should initialize and listen to didFinishLaunching', () => {
        expect(api.on).toHaveBeenCalledWith('didFinishLaunching', expect.any(Function));
    });

    it('should discover devices and register new accessories', async () => {
        // Trigger discoverDevices via the callback (simulate startup)
        const didFinishLaunchingCallback = api.on.mock.calls[0][1];

        // Setup DeviceDiscovery mock to callback immediately with a mock device
        const mockDevice = {
            host: '192.168.1.50',
            deviceDescription: jest.fn().mockResolvedValue({
                UDN: 'uuid:12345',
                roomName: 'Living Room',
            }),
        };

        mockDeviceDiscovery.mockImplementation((callback) => {
            callback(mockDevice);
            return { destroy: jest.fn() }; // Mock return value just in case
        });

        // Run discovery
        await platform.discoverDevices();

        // Assert DeviceDiscovery was called
        expect(mockDeviceDiscovery).toHaveBeenCalled();

        // Wait for async execution
        await new Promise(resolve => setTimeout(resolve, 500));

        expect(log.error).not.toHaveBeenCalled();

        // Assert UUID generation
        expect(api.hap.uuid.generate).toHaveBeenCalledWith('uuid:12345');

        // Assert Accessory Creation
        expect(api.platformAccessory).toHaveBeenCalledWith('Living Room', 'generated-uuid-uuid:12345');

        // Assert Register
        expect(api.registerPlatformAccessories).toHaveBeenCalledWith(
            PLUGIN_NAME,
            PLATFORM_NAME,
            [expect.objectContaining({ displayName: 'Living Room' })]
        );
    });

    it('should restore existing accessories', async () => {
        const mockDevice = {
            host: '192.168.1.60',
            deviceDescription: jest.fn().mockResolvedValue({
                UDN: 'uuid:existing',
                roomName: 'Bedroom',
            }),
        };

        mockDeviceDiscovery.mockImplementation((callback) => {
            callback(mockDevice);
        });

        // Pre-load an accessory into cache
        const existingUuid = 'generated-uuid-uuid:existing';
        const existingAccessory = {
            UUID: existingUuid,
            displayName: 'Bedroom',
            context: {},
            getService: jest.fn(),
            addService: jest.fn(),
        };

        // Mock get/add service for the 'SonosPlatformAccessory' init inside discoverDevices
        (existingAccessory.getService as any).mockReturnValue({
            getCharacteristic: jest.fn().mockReturnValue({ onSet: jest.fn(), onGet: jest.fn() }),
            setCharacteristic: jest.fn().mockReturnThis(),
        });
        (existingAccessory.addService as any).mockReturnValue({
            getCharacteristic: jest.fn().mockReturnValue({ onSet: jest.fn(), onGet: jest.fn() }),
            setCharacteristic: jest.fn().mockReturnThis(),
        });


        platform.configureAccessory(existingAccessory as any);
        expect(platform.accessories).toHaveLength(1);

        await platform.discoverDevices();
        await new Promise(process.nextTick);

        // Should NOT register new
        expect(api.registerPlatformAccessories).not.toHaveBeenCalled();

        // Should update existing
        expect(api.updatePlatformAccessories).toHaveBeenCalledWith([existingAccessory]);
        expect(existingAccessory.context).toHaveProperty('device', mockDevice);
    });
});
