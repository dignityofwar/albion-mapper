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
  Position: { Top: 'top', Right: 'right', Bottom: 'bottom', Left: 'left' },
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
      lastUpdatedAt: new Date().toISOString(),
      watching: 0, totalConnected: 0
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

    // Check settings cog exists
    const cog = wrapper.find('[data-testid="stub-settings-cog"]');
    expect(cog.exists()).toBe(true);
    
    const title = wrapper.find('[data-testid="room-title"]');
    expect(title.exists()).toBe(true);
    
    // Verify cog is BEFORE title in DOM
    const html = wrapper.html();
    expect(html.indexOf('data-testid="stub-settings-cog"')).toBeLessThan(html.indexOf('data-testid="room-title"'));
  });

  it('renders RoomSettings even without a title', async () => {
    const store = useRoomStore();
    store.applyMessage({
      type: 'sync',
      connections: [],
      homeZoneId: 'zone-a',
      title: '', // NO TITLE
      nodePositions: [],
      lastUpdatedAt: new Date().toISOString(),
      watching: 0, totalConnected: 0
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

    // Check settings cog exists
    const cog = wrapper.find('[data-testid="stub-settings-cog"]');
    expect(cog.exists()).toBe(true);
    
    const title = wrapper.find('[data-testid="room-title"]');
    expect(title.exists()).toBe(false);
  });
});
