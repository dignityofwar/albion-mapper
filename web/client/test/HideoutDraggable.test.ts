import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import RoomView from '../src/views/RoomView.vue';
import { useRoomStore } from '../src/stores/useRoomStore';
import { setActivePinia, createPinia } from 'pinia';

describe('Hideout Draggable', () => {
  it('should make hideout nodes draggable even if it is the only node', async () => {
    setActivePinia(createPinia());
    const store = useRoomStore();
    sessionStorage.setItem('token:room1', 'some-token');
    
    // Qiient-Al-Nusom is a roadsHideout
    store.applyMessage({ 
        type: 'sync', 
        connections: [], 
        homeZoneId: 'other-zone',
        nodePositions: [
            { zoneId: 'qiient-al-nusom', x: 0, y: 0 }
        ],
        lastUpdatedAt: new Date().toISOString()
    });

    const wrapper = mount(RoomView, {
      props: { id: 'room1' },
      global: {
        stubs: {
          ReportForm: true,
          DebugTray: true,
          RoomSettings: true,
          VueFlow: true,
          Background: true,
          Controls: true
        }
      }
    });

    const vm = wrapper.vm as any;
    
    // Check nodes
    console.log(vm.flowNodes.map((n: any) => n.id));
    expect(vm.flowNodes.length).toBeGreaterThan(0);
    const hideoutNode = vm.flowNodes.find((n: any) => n.id === 'qiient-al-nusom');
    
    // This is what we expect to fail now
    expect(hideoutNode.draggable).toBe(true);
    
    wrapper.unmount();
  });
});
