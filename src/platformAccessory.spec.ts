import { Service, Characteristic } from 'homebridge';
import { SonosPlatformAccessory } from './platformAccessory';
import { SonosHomebridgePlatform } from './platform';

// Mock node-fetch
const mockFetch = jest.fn();
jest.mock('node-fetch', () => ({
    __esModule: true,
    default: mockFetch,
}));

describe('SonosPlatformAccessory', () => {
    let accessory: any;
    let platform: any;
    let device: any;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let serviceNightSound: any;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let serviceSpeechEnhancement: any;

    beforeEach(() => {
        mockFetch.mockReset();
        mockFetch.mockResolvedValue({
            ok: true,
            statusText: 'OK',
            text: async () => 'OK'
        });

        // Mock Device
        device = {
            host: '192.168.1.50',
        };

        // Mock Homebridge Platform
        platform = {
            Service: {
                AccessoryInformation: 'AccessoryInformation',
                Switch: 'Switch',
            },
            Characteristic: {
                Manufacturer: 'Manufacturer',
                Model: 'Model',
                SerialNumber: 'SerialNumber',
                On: 'On',
            },
            log: {
                info: jest.fn(),
                debug: jest.fn(),
                error: jest.fn(),
            },
        } as unknown as SonosHomebridgePlatform;

        // Mock Platform Accessory
        const getServiceMock = jest.fn();
        const addServiceMock = jest.fn();
        const setCharacteristicMock = jest.fn();
        const getCharacteristicMock = jest.fn();
        const onSetMock = jest.fn().mockReturnThis();
        const onGetMock = jest.fn().mockReturnThis();

        // Characteristics chain
        getCharacteristicMock.mockReturnValue({
            onSet: onSetMock,
            onGet: onGetMock,
        });

        // Service chain
        const serviceMock = {
            setCharacteristic: setCharacteristicMock,
            getCharacteristic: getCharacteristicMock,
        };

        getServiceMock.mockReturnValue(serviceMock);
        addServiceMock.mockReturnValue(serviceMock);
        setCharacteristicMock.mockReturnThis();

        accessory = {
            context: { device },
            getService: getServiceMock,
            addService: addServiceMock,
            displayName: 'Test Speaker',
        };
    });

    it('should create an instance and register services', () => {
        new SonosPlatformAccessory(platform, accessory);

        expect(accessory.getService).toHaveBeenCalledWith(platform.Service.AccessoryInformation);
        // Should get or add Night Sound and Speech Enhancement
        expect(accessory.getService).toHaveBeenCalledWith('Night Sound');
        expect(accessory.getService).toHaveBeenCalledWith('Speech Enhancement');
    });

    it('should set Night Sound (UPnP SetEQ NightMode)', async () => {
        const sonosAccessory = new SonosPlatformAccessory(platform, accessory);

        await sonosAccessory.setNightSound(true);

        expect(mockFetch).toHaveBeenCalledTimes(1);
        const url = mockFetch.mock.calls[0][0];
        const options = mockFetch.mock.calls[0][1];

        expect(url).toContain('http://192.168.1.50:1400/MediaRenderer/RenderingControl/Control');
        expect(options.method).toBe('POST');
        expect(options.headers.SOAPACTION).toContain('SetEQ');
        expect(options.body).toContain('<EQType>NightMode</EQType>');
        expect(options.body).toContain('<DesiredValue>1</DesiredValue>'); // 1 for On
    });

    it('should turn off Night Sound', async () => {
        const sonosAccessory = new SonosPlatformAccessory(platform, accessory);

        await sonosAccessory.setNightSound(false);

        const options = mockFetch.mock.calls[0][1];
        expect(options.body).toContain('<DesiredValue>0</DesiredValue>'); // 0 for Off
    });

    it('should set Speech Enhancement (UPnP SetEQ DialogLevel)', async () => {
        const sonosAccessory = new SonosPlatformAccessory(platform, accessory);

        await sonosAccessory.setSpeechEnhancement(true);

        const options = mockFetch.mock.calls[0][1];
        expect(options.body).toContain('<EQType>DialogLevel</EQType>');
        expect(options.body).toContain('<DesiredValue>1</DesiredValue>');
    });

    it('should handle fetch errors gracefully', async () => {
        mockFetch.mockRejectedValue(new Error('Network Error'));
        const sonosAccessory = new SonosPlatformAccessory(platform, accessory);

        await expect(sonosAccessory.setNightSound(true)).rejects.toThrow('Network Error');
        expect(platform.log.error).toHaveBeenCalled();
    });
});
