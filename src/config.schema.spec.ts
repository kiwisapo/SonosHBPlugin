import schema from '../config.schema.json';

describe('config.schema.json layout', () => {
    it('includes strict devices array with expected fields', () => {
        const layoutEntries = schema.layout as Array<string | Record<string, unknown>>;
        const devicesLayout = layoutEntries.find(
            (entry) => typeof entry === 'object' && entry !== null && (entry as { key?: string }).key === 'devices',
        ) as { items?: Array<{ items?: string[] }>; type?: string } | undefined;

        expect(devicesLayout).toBeDefined();
        expect(devicesLayout?.type).toBe('array');

        const fieldItems = devicesLayout?.items?.[0]?.items;
        expect(fieldItems).toEqual(
            expect.arrayContaining([
                'devices[].deviceName',
                'devices[].ipAddress',
                'devices[].macAddress',
            ]),
        );
    });

    it('mirrors the devices schema definition', () => {
        const devicesSchema = (schema.schema as { properties: Record<string, any> }).properties.devices;

        expect(devicesSchema.type).toBe('array');
        expect(devicesSchema.items.type).toBe('object');
        expect(devicesSchema.items.properties.deviceName.type).toBe('string');
        expect(devicesSchema.items.properties.ipAddress.type).toBe('string');
        expect(devicesSchema.items.properties.macAddress.type).toBe('string');
        expect(devicesSchema.items.required).toContain('deviceName');
    });
});
