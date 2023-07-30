import { beforeEach, describe, expect, it } from 'vitest';
import { _createRouter } from '../core';

describe('Router', () => {
    it('should load with a specific rootPath', async () => {
        const r = _createRouter();
        r.init("/");
    });
});
