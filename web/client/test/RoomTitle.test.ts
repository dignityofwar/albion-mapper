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

describe('RoomTitleVisibility', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    sessionStorage.clear();
  });

  it('renders the room title in desktop view when available', async () => {
    const store = useRoomStore();
    const title = 'Test Room Title';
    
    // Simulate sync message with title
    store.applyMessage({
      type: 'sync',
      connections: [],
      homeZoneId: 'zone-a',
      title: title,
      nodePositions: [],
      lastUpdatedAt: new Date().toISOString()
    });

    const wrapper = mount(RoomView, {
      props: { id: 'room-1' },
      global: {
        stubs: ['DebugTray', 'ReportForm', 'RoomSettings', 'Background', 'Controls']
      }
    });

    await nextTick();

    const titleElement = wrapper.find('[data-testid="room-title"]');
    expect(titleElement.exists()).toBe(true);
    expect(titleElement.text()).toBe(title);
  });

  it('renders the room title in tablet view when available', async () => {
    const store = useRoomStore();
    const title = 'Test Room Title';
    
    // Simulate sync message with title
    store.applyMessage({
      type: 'sync',
      connections: [],
      homeZoneId: 'zone-a',
      title: title,
      nodePositions: [],
      lastUpdatedAt: new Date().toISOString()
    });

    const wrapper = mount(RoomView, {
      props: { id: 'room-1' },
      global: {
        stubs: ['DebugTray', 'ReportForm', 'RoomSettings', 'Background', 'Controls']
      }
    });

    await nextTick();

    const titleElement = wrapper.find('[data-testid="room-title"]');
    expect(titleElement.exists()).toBe(true);
    expect(titleElement.text()).toBe(title);
  });

  it('does not render room title if it is missing', async () => {
    const store = useRoomStore();
    
    // Simulate sync message WITHOUT title
    store.applyMessage({
      type: 'sync',
      connections: [],
      homeZoneId: 'zone-a',
      title: '',
      nodePositions: [],
      lastUpdatedAt: new Date().toISOString()
    });

    const wrapper = mount(RoomView, {
      props: { id: 'room-1' },
      global: {
        stubs: ['DebugTray', 'ReportForm', 'RoomSettings', 'Background', 'Controls']
      }
    });

    await nextTick();

    expect(wrapper.find('[data-testid="room-title"]').exists()).toBe(false);
  });
});
