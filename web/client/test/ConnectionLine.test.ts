import { mount } from '@vue/test-utils';
import { describe, it, expect, vi } from 'vitest';
import ConnectionLine from '../src/components/flow/ConnectionLine.vue';
import { Position } from '@vue-flow/core';

// Mock connectionPath utility
vi.mock('../../utils/connectionPath.js', () => ({
  getConnectionPath: vi.fn().mockReturnValue(['M0,0 L100,100', 50, 50, 50, 50])
}));

// Mock shared
vi.mock('shared', () => ({
  getHandleFacing: vi.fn().mockReturnValue('n'),
  getDefaultHandles: vi.fn().mockReturnValue([]),
  getOppositeHandleId: vi.fn().mockReturnValue('default-nw'),
  DEFAULT_INTERNAL_HANDLES: []
}));

describe('ConnectionLine', () => {
  const defaultProps = {
    sourceX: 0,
    sourceY: 0,
    targetX: 100,
    targetY: 100,
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    sourceNode: { data: {} },
    sourceHandle: { id: 'h1' },
    isOccupied: false,
    targetHandle: null,
  };

  it('renders ghost diamond when not occupied and no target handle', () => {
    const wrapper = mount(ConnectionLine, {
      props: defaultProps as any
    });

    expect(wrapper.find('foreignObject').exists()).toBe(true);
    expect(wrapper.find('.diamond-shape').exists()).toBe(true);
  });

  it('hides ghost diamond when occupied', () => {
    const wrapper = mount(ConnectionLine, {
      props: {
        ...defaultProps,
        isOccupied: true,
      } as any
    });

    expect(wrapper.find('foreignObject').exists()).toBe(false);
  });

  it('hides ghost diamond when target handle is present', () => {
    const wrapper = mount(ConnectionLine, {
      props: {
        ...defaultProps,
        targetHandle: { id: 'h2' },
      } as any
    });

    expect(wrapper.find('foreignObject').exists()).toBe(false);
  });

  it('hides everything when source handle is missing', () => {
    const wrapper = mount(ConnectionLine, {
      props: {
        ...defaultProps,
        sourceHandle: null,
      } as any
    });

    expect(wrapper.find('path').exists()).toBe(false);
    expect(wrapper.find('foreignObject').exists()).toBe(false);
  });
});
