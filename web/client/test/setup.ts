import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/vue';
import { afterEach } from 'vitest';

// Auto-cleanup after each test (mirrors @testing-library/react behaviour)
afterEach(() => {
  cleanup();
});

// reka-ui / Vue Flow call scrollIntoView on highlighted list items — jsdom
// doesn't implement it so we stub it out to avoid TypeError noise in tests.
if (typeof window !== 'undefined') {
  window.HTMLElement.prototype.scrollIntoView = function () {};
}
