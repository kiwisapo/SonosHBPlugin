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
     * Helper to invoke RenderingControl SetEQ for Sonos devices.
     * This uses a direct UPnP SOAP request to the device.
     * 
     * @param eqType - The EQ type to set (e.g., 'NightMode', 'DialogLevel')
     * @param value - The boolean state to set (true/false)
     */
    async setEQ(eqType: string, value: boolean) {
        const device = this.accessory.context.device;
        const numericValue = value ? 1 : 0;

        /**
         * UPnP Service Info:
         * Service: urn:upnp-org:serviceId:RenderingControl
         * Endpoint: /MediaRenderer/RenderingControl/Control
         * Action: SetEQ
         */

        try {
            const endpoint = '/MediaRenderer/RenderingControl/Control';
            const serviceType = 'urn:schemas-upnp-org:service:RenderingControl:1';
            const action = `${serviceType}#SetEQ`;

            // Construct the SOAP body for the SetEQ action
            const soapBody = `
                <u:SetEQ xmlns:u="${serviceType}">
                    <InstanceID>0</InstanceID>
                    <EQType>${eqType}</EQType>
                    <DesiredValue>${numericValue}</DesiredValue>
                </u:SetEQ>
            `;

            // Wrap in the standard SOAP envelope
            const soapEnvelope = `
                <s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
                    <s:Body>${soapBody}</s:Body>
                </s:Envelope>
            `;

            // Prepare the fetch request
            const fetch = (await import('node-fetch')).default;
            const url = `http://${device.host}:1400${endpoint}`;

            this.platform.log.debug(`Sending SetEQ request to ${device.host}: ${eqType} = ${value}`);

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'CONTENT-TYPE': 'text/xml; charset="utf-8"',
                    'SOAPACTION': `"${action}"`
                },
                body: soapEnvelope
            });

            if (!response.ok) {
                throw new Error(`SOAP request failed: ${response.status} ${response.statusText}`);
            }

            this.platform.log.debug(`Successfully set ${eqType} to ${value}`);

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
