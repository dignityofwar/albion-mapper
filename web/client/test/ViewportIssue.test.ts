import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import RoomView from '../src/views/RoomView.vue';
import { createPinia, setActivePinia } from 'pinia';
import { useRoomStore } from '../src/stores/useRoomStore';
import { createRouter, createWebHistory } from 'vue-router';

// Mock Vue Flow
vi.mock('@vue-flow/core', () => ({
  VueFlow: { template: '<div><slot /></div>' },
  useVueFlow: () => ({
    fitView: vi.fn(),
    updateNode: vi.fn(),
    onConnect: vi.fn(),
    onConnectStart: vi.fn(),
    onConnectEnd: vi.fn(),
    onNodeDragStop: vi.fn(),
    addEdges: vi.fn(),
  }),
  ConnectionMode: { Loose: 'loose' },
}));

vi.mock('@vue-flow/background', () => ({
  Background: { template: '<div></div>' },
}));

vi.mock('@vue-flow/controls', () => ({
  Controls: { template: '<div></div>' },
}));

const router = createRouter({
  history: createWebHistory(),
  routes: [{ path: '/rooms/:id', component: RoomView }],
});

describe('RoomView Viewport Issue', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    sessionStorage.setItem('token:test-room', 'fake-token');
    
    // Mock window.innerWidth
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1300 });
    window.dispatchEvent(new Event('resize'));
  });

  it('renders title on desktop (xl) breakpoint', async () => {
    const store = useRoomStore();
    store.roomTitle = 'Test Room Title';
    store.wsStatus = 'connected';

    const wrapper = mount(RoomView, {
      global: {
        plugins: [router],
        stubs: {
          ReportForm: true,
          RoomSettings: true,
          DebugTray: true,
          ZoneNode: true,
          ConnectionEdge: true,
        }
      },
      props: {
        id: 'test-room'
      }
    });

    await router.isReady();

    // Check if desktop-side-header is visible
    // Note: Vitest/JSDOM doesn't actually process CSS classes like 'hidden xl:flex' 
    // unless we use a tool that supports it, but we can check the classes.
    
    const desktopHeader = wrapper.find('[data-testid="desktop-side-header"]');
    expect(desktopHeader.exists()).toBe(true);
    expect(desktopHeader.classes()).toContain('xl:flex');
    
    const title = wrapper.find('[data-testid="room-title-desktop"]');
    expect(title.exists()).toBe(true);
    expect(title.text()).toBe('Test Room Title');
  });
});
