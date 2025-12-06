import { API } from 'homebridge';
import registerPlatform from './index';
import { PLATFORM_NAME } from './settings';
import { SonosHomebridgePlatform } from './platform';

describe('index', () => {
    let api: API;

    beforeEach(() => {
        api = {
            registerPlatform: jest.fn(),
        } as unknown as API;
    });

    it('should register the platform', () => {
        registerPlatform(api);

        expect(api.registerPlatform).toHaveBeenCalledWith(
            PLATFORM_NAME,
            SonosHomebridgePlatform,
        );
    });
});
