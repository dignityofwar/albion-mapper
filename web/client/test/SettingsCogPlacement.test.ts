import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import RoomView from '../src/views/RoomView.vue';
import { useRoomStore } from '../src/stores/useRoomStore';
import { nextTick } from 'vue';

// Mock VueFlow and router to avoid complex setup
vi.mock('@vue-flow/core', () => ({
  useVueFlow: () => ({
    fitView: vi.fn(),
    updateNode: vi.fn(),
  }),
  VueFlow: { template: '<div><slot /></div>' },
  ConnectionMode: { Loose: 'loose' },
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({
    replace: vi.fn(),
  }),
}));

describe('SettingsCogPlacement', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    sessionStorage.clear();
  });

  it('renders RoomSettings to the left of the title in desktop view', async () => {
    const store = useRoomStore();
    store.applyMessage({
      type: 'sync',
      connections: [],
      homeZoneId: 'zone-a',
      title: 'Test Room',
      nodePositions: [],
      lastUpdatedAt: new Date().toISOString()
    });

    const wrapper = mount(RoomView, {
      props: { id: 'room-1' },
      global: {
        stubs: {
          DebugTray: true,
          ReportForm: true,
          RoomSettings: { template: '<div data-testid="stub-settings-cog">COG</div>' },
          Background: true,
          Controls: true
        }
      }
    });

    await nextTick();

    // Check desktop side div
    const desktopDiv = wrapper.find('[data-testid="desktop-side-header"]');
    expect(desktopDiv.exists()).toBe(true);
    
    const cog = desktopDiv.find('[data-testid="stub-settings-cog"]');
    const title = desktopDiv.find('[data-testid="room-title-desktop"]');
    
    expect(cog.exists()).toBe(true);
    expect(title.exists()).toBe(true);
    
    // Verify cog is BEFORE title in DOM
    const html = desktopDiv.html();
    expect(html.indexOf('data-testid="stub-settings-cog"')).toBeLessThan(html.indexOf('data-testid="room-title-desktop"'));
  });

  it('renders RoomSettings in tablet header even without a title', async () => {
    const store = useRoomStore();
    store.applyMessage({
      type: 'sync',
      connections: [],
      homeZoneId: 'zone-a',
      title: '', // NO TITLE
      nodePositions: [],
      lastUpdatedAt: new Date().toISOString()
    });

    const wrapper = mount(RoomView, {
      props: { id: 'room-1' },
      global: {
        stubs: {
          DebugTray: true,
          ReportForm: true,
          RoomSettings: { template: '<div data-testid="stub-settings-cog">COG</div>' },
          Background: true,
          Controls: true
        }
      }
    });

    await nextTick();

    // Check tablet header
    const tabletHeader = wrapper.find('[data-testid="tablet-header"]');
    expect(tabletHeader.exists()).toBe(true);
    
    const cog = tabletHeader.find('[data-testid="stub-settings-cog"]');
    expect(cog.exists()).toBe(true);
    
    const title = tabletHeader.find('[data-testid="room-title-tablet"]');
    expect(title.exists()).toBe(false);
  });
});
