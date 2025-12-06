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
            deviceNames: ['Arc'], // Added for testing filtering
        };

        platform = new SonosHomebridgePlatform(log, config, api);
    });

    it('should initialize and listen to didFinishLaunching', () => {
        expect(api.on).toHaveBeenCalledWith('didFinishLaunching', expect.any(Function));
    });

    it('should discover devices and register new accessories', async () => {
        // Trigger discoverDevices via the callback (simulate startup)
        // const didFinishLaunchingCallback = api.on.mock.calls[0][1];

        // Ensure 'Living Room' is allowed
        config.deviceNames = ['Living Room'];

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

        // Temporarily update config to allow 'Bedroom' for this test
        config.deviceNames = ['Bedroom'];

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

    it('allows strict filtering by serial-number-derived MAC when MACAddress is missing', async () => {
        config.devices = [
            { deviceName: 'Serial Room', macAddress: 'SN-123-456' },
        ];

        const mockDevice = {
            host: '192.168.1.150',
            deviceDescription: jest.fn().mockResolvedValue({
                UDN: 'uuid:serial',
                roomName: 'Serial Room',
                serialNum: 'SN-123-456',
            }),
        };

        mockDeviceDiscovery.mockImplementation((callback) => {
            callback(mockDevice);
        });

        await platform.discoverDevices();
        await new Promise(process.nextTick);

        const registerCalls = api.registerPlatformAccessories.mock.calls;
        const registeredNames = registerCalls.flatMap((call: any[]) => call[2].map((acc: any) => acc.displayName));

        expect(registeredNames).toContain('Serial Room');
    });

    it('should filter devices based on strict "devices" config (IP/MAC)', async () => {
        // Update config to use strict filtering
        config.devices = [
            { deviceName: 'IP Room', ipAddress: '192.168.1.100' },
            { deviceName: 'MAC Room', macAddress: 'AA:BB:CC:DD:EE:FF' },
            { deviceName: 'Strict Room', ipAddress: '10.0.0.1', macAddress: '11:22:33:44:55:66' }
        ];

        const mockDevices = [
            // Success: IP Match
            {
                host: '192.168.1.100',
                deviceDescription: jest.fn().mockResolvedValue({
                    UDN: 'uuid:ip',
                    roomName: 'IP Room',
                    MACAddress: 'XX:XX:XX:XX:XX:XX'
                })
            },
            // Success: MAC Match
            {
                host: '192.168.1.200', // Different IP
                deviceDescription: jest.fn().mockResolvedValue({
                    UDN: 'uuid:mac',
                    roomName: 'MAC Room',
                    MACAddress: 'AA:BB:CC:DD:EE:FF'
                })
            },
            // Fail: IP Mismatch (Name matches but IP wrong)
            {
                host: '192.168.1.101',
                deviceDescription: jest.fn().mockResolvedValue({
                    UDN: 'uuid:ip-fail',
                    roomName: 'IP Room',
                    MACAddress: 'XX:XX:XX:XX:XX:XX'
                })
            },
            // Fail: MAC Mismatch (Name matches but MAC wrong)
            {
                host: '192.168.1.201',
                deviceDescription: jest.fn().mockResolvedValue({
                    UDN: 'uuid:mac-fail',
                    roomName: 'MAC Room',
                    MACAddress: '00:00:00:00:00:00'
                })
            },
            // Success: Both Match
            {
                host: '10.0.0.1',
                deviceDescription: jest.fn().mockResolvedValue({
                    UDN: 'uuid:strict',
                    roomName: 'Strict Room',
                    MACAddress: '11:22:33:44:55:66'
                })
            }
        ];

        mockDeviceDiscovery.mockImplementation((callback) => {
            mockDevices.forEach(d => callback(d));
        });

        await platform.discoverDevices();
        await new Promise(process.nextTick);

        // Helper to find calls to registerPlatformAccessories
        const registerCalls = api.registerPlatformAccessories.mock.calls;
        const registeredNames = registerCalls.flatMap((call: any[]) => call[2].map((acc: any) => acc.displayName));

        expect(registeredNames).toContain('IP Room');
        expect(registeredNames).toContain('MAC Room');
        expect(registeredNames).toContain('Strict Room');

        // Ensure failures were not registered (implied by checking count if unique names)
        expect(registeredNames.filter((n: string) => n === 'IP Room').length).toBe(1);
        expect(registeredNames.filter((n: string) => n === 'MAC Room').length).toBe(1);
    });
});
