import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { SonosHomebridgePlatform } from './platform';


/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class SonosPlatformAccessory {
    private serviceNightSound: Service;
    private serviceSpeechEnhancement: Service;

    // Track state internally (optional, can also fetch live)
    private nightSoundState = false;
    private speechEnhancementState = false;

    constructor(
        private readonly platform: SonosHomebridgePlatform,
        private readonly accessory: PlatformAccessory,
    ) {
        const device = accessory.context.device;

        // set accessory information
        this.accessory.getService(this.platform.Service.AccessoryInformation)!
            .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Sonos')
            .setCharacteristic(this.platform.Characteristic.Model, 'Sonos Speaker')
            .setCharacteristic(this.platform.Characteristic.SerialNumber, device.host);

        // Night Sound Switch
        this.serviceNightSound = this.accessory.getService('Night Sound') ||
            this.accessory.addService(this.platform.Service.Switch, 'Night Sound', 'NightSound');

        this.serviceNightSound.getCharacteristic(this.platform.Characteristic.On)
            .onSet(this.setNightSound.bind(this))
            .onGet(this.getNightSound.bind(this));


        // Speech Enhancement Switch
        this.serviceSpeechEnhancement = this.accessory.getService('Speech Enhancement') ||
            this.accessory.addService(this.platform.Service.Switch, 'Speech Enhancement', 'SpeechEnhancement');

        this.serviceSpeechEnhancement.getCharacteristic(this.platform.Characteristic.On)
            .onSet(this.setSpeechEnhancement.bind(this))
            .onGet(this.getSpeechEnhancement.bind(this));
    }

    /**
     * Helper to invoke RenderingControl SetEQ
     */
    async setEQ(eqType: string, value: boolean) {
        const device = this.accessory.context.device;
        const val = value ? 1 : 0;

        // Using raw UPnP call matching the 'sonos' library structure if possible,
        // or constructing the SOAP envelope manually.
        // The 'node-sonos' library exposes .renderingControlService() usually.
        // Let's try to use the raw request for 'RenderingControl' service.

        // Service: urn:upnp-org:serviceId:RenderingControl
        // Endpoint: /MediaRenderer/RenderingControl/Control
        // Action: SetEQ
        // Args: InstanceID: 0, EQType: eqType, DesiredValue: val

        // NOTE: 'sonos' library methods return Promises.
        // However, since 'setEQ' isn't standard, we rely on a generic 'runCommand' or similar if available,
        // OR we use the fact that 'sonos' might not have this typed.
        // We will try to map it to what we saw in 'sonos-discovery':
        // soap.invoke(`${baseUrl}/MediaRenderer/RenderingControl/Control`, TYPE.SetEQ, { eqType, value })

        try {
            // We will construct the body and send it via the device.
            // It seems 'node-sonos' generic request might be hidden or complex.
            // Let's assume we can define a simpler method or use what is available.
            // Since I don't have the full 'node-sonos' docs loaded for "custom actions",
            // I'll try to use a direct SOAP request if I can access the IP.

            // Actually, let's try to see if we can use a simpler approach.
            // 'sonos' library has a 'MusicServices' but this is RenderingControl.

            // Re-implementing a simple SOAP request like in 'sonos-discovery' might be safest
            // if we can't find a direct method on the 'device' object.
            // But the 'device' object has the IP (host).

            const endpoint = '/MediaRenderer/RenderingControl/Control';
            const action = 'urn:schemas-upnp-org:service:RenderingControl:1#SetEQ';
            const body = `<u:SetEQ xmlns:u="urn:schemas-upnp-org:service:RenderingControl:1"><InstanceID>0</InstanceID><EQType>${eqType}</EQType><DesiredValue>${val}</DesiredValue></u:SetEQ>`;

            // Use the library's internal request mechanism if public, or fetch.
            // Assuming we need to fetch:
            const fetch = (await import('node-fetch')).default;
            const response = await fetch(`http://${device.host}:1400${endpoint}`, {
                method: 'POST',
                headers: {
                    'CONTENT-TYPE': 'text/xml; charset="utf-8"',
                    'SOAPACTION': `"${action}"`
                },
                body: `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body>${body}</s:Body></s:Envelope>`
            });

            if (!response.ok) {
                throw new Error(`SOAP request failed: ${response.statusText}`);
            }
            this.platform.log.debug(`SetEQ ${eqType} to ${value} success`);

        } catch (error) {
            this.platform.log.error('Error setting EQ:', error);
            throw error;
        }
    }

    async setNightSound(value: CharacteristicValue) {
        this.nightSoundState = value as boolean;
        await this.setEQ('NightMode', this.nightSoundState);
    }

    async getNightSound(): Promise<CharacteristicValue> {
        // Ideally we fetch the state. For now returning cached/default.
        // Implementing 'GetEQ' logic would be similar but parsing XML response.
        return this.nightSoundState;
    }

    async setSpeechEnhancement(value: CharacteristicValue) {
        this.speechEnhancementState = value as boolean;
        await this.setEQ('DialogLevel', this.speechEnhancementState);
    }

    async getSpeechEnhancement(): Promise<CharacteristicValue> {
        return this.speechEnhancementState;
    }
}
