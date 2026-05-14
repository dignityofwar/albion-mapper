import { setActivePinia, createPinia } from 'pinia';
import { describe, it, expect, beforeEach } from 'vitest';
import { usePlotRouteStore } from '../src/stores/usePlotRouteStore';
import { useRoomStore } from '../src/stores/useRoomStore';

const makeConn = (id: string, from: string, to: string) => ({
  id,
  roomId: 'room1',
  fromZoneId: from,
  toZoneId: to,
  expiresAt: new Date(Date.now() + 3600_000).toISOString(),
  reportedAt: new Date().toISOString(),
});

describe('usePlotRouteStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('enters and exits plot route mode', () => {
    const store = usePlotRouteStore();
    store.enterPlotRouteMode();
    expect(store.isPlotRouteMode).toBe(true);
    store.exitPlotRouteMode();
    expect(store.isPlotRouteMode).toBe(false);
  });

  it('computes a route via BFS and sets plottedConnectionIds', () => {
    const store = usePlotRouteStore();
    const connections = [
      makeConn('c1', 'home', 'a'),
      makeConn('c2', 'a', 'b'),
      makeConn('c3', 'b', 'dest'),
    ];
    store.selectDestination('home', 'dest', connections);
    expect(store.plottedConnectionIds.has('c1')).toBe(true);
    expect(store.plottedConnectionIds.has('c2')).toBe(true);
    expect(store.plottedConnectionIds.has('c3')).toBe(true);
    expect(store.hasRoute).toBe(true);
    expect(store.isPlotRouteMode).toBe(false);
  });

  it('clears route when a plotted connection is removed', () => {
    const store = usePlotRouteStore();
    const connections = [makeConn('c1', 'home', 'dest')];
    store.selectDestination('home', 'dest', connections);
    expect(store.hasRoute).toBe(true);

    store.onConnectionRemoved('c1');

    expect(store.hasRoute).toBe(false);
    expect(store.isPlotRouteMode).toBe(false);
    expect(store.destinationZoneId).toBeNull();
  });

  it('does NOT clear route when an unrelated connection is removed', () => {
    const store = usePlotRouteStore();
    const connections = [makeConn('c1', 'home', 'dest')];
    store.selectDestination('home', 'dest', connections);
    expect(store.hasRoute).toBe(true);

    store.onConnectionRemoved('unrelated-id');

    expect(store.hasRoute).toBe(true);
  });

  it('clears route when the destination zone is removed', () => {
    const store = usePlotRouteStore();
    const connections = [makeConn('c1', 'home', 'dest')];
    store.selectDestination('home', 'dest', connections);
    expect(store.hasRoute).toBe(true);

    store.onNodeRemoved('dest');

    expect(store.hasRoute).toBe(false);
    expect(store.isPlotRouteMode).toBe(false);
    expect(store.destinationZoneId).toBeNull();
  });

  it('does NOT clear route when an unrelated zone is removed', () => {
    const store = usePlotRouteStore();
    const connections = [makeConn('c1', 'home', 'dest')];
    store.selectDestination('home', 'dest', connections);
    expect(store.hasRoute).toBe(true);

    store.onNodeRemoved('some-other-zone');

    expect(store.hasRoute).toBe(true);
  });

  it('applies a plotted route from server sync', () => {
    const store = usePlotRouteStore();
    store.applyPlottedRoute(['c1', 'c2', 'c3']);
    expect(store.plottedConnectionIds.has('c1')).toBe(true);
    expect(store.plottedConnectionIds.has('c2')).toBe(true);
    expect(store.hasRoute).toBe(true);
  });

  it('applies a plotted route with destination from server', () => {
    const store = usePlotRouteStore();
    store.applyPlottedRoute(['c1', 'c2'], 'dest-zone');
    expect(store.plottedConnectionIds.has('c1')).toBe(true);
    expect(store.destinationZoneId).toBe('dest-zone');
  });

  it('clears state when applyPlottedRoute receives empty array', () => {
    const store = usePlotRouteStore();
    store.applyPlottedRoute(['c1']);
    store.applyPlottedRoute([]);
    expect(store.hasRoute).toBe(false);
    expect(store.isPlotRouteMode).toBe(false);
    expect(store.destinationZoneId).toBeNull();
  });

  it('room_reset message clears plot route via room store', () => {
    const store = usePlotRouteStore();
    store.applyPlottedRoute(['c1', 'c2']);
    expect(store.hasRoute).toBe(true);

    store.exitPlotRouteMode();

    expect(store.hasRoute).toBe(false);
    expect(store.isPlotRouteMode).toBe(false);
  });

  it('returns empty route when no path exists', () => {
    const store = usePlotRouteStore();
    const connections = [makeConn('c1', 'home', 'a')];
    store.selectDestination('home', 'unreachable', connections);
    expect(store.hasRoute).toBe(false);
    expect(store.plottedConnectionIds.size).toBe(0);
  });
});

describe('useRoomStore — plot route integration', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('connection_removed clears plot route if connection was plotted', () => {
    const roomStore = useRoomStore();
    const plotStore = usePlotRouteStore();

    // Manually set a plotted route
    plotStore.applyPlottedRoute(['conn-abc']);
    expect(plotStore.hasRoute).toBe(true);

    // Simulate connection_removed WS message
    roomStore.applyMessage({ type: 'connection_removed', connectionId: 'conn-abc' });

    expect(plotStore.hasRoute).toBe(false);
    expect(plotStore.isPlotRouteMode).toBe(false);
  });

  it('connection_removed does not clear plot route for unrelated connection', () => {
    const roomStore = useRoomStore();
    const plotStore = usePlotRouteStore();

    plotStore.applyPlottedRoute(['conn-abc']);
    expect(plotStore.hasRoute).toBe(true);

    roomStore.applyMessage({ type: 'connection_removed', connectionId: 'other-conn' });

    expect(plotStore.hasRoute).toBe(true);
  });

  it('room_reset clears plot route', () => {
    const roomStore = useRoomStore();
    const plotStore = usePlotRouteStore();

    plotStore.applyPlottedRoute(['conn-abc']);
    expect(plotStore.hasRoute).toBe(true);

    roomStore.applyMessage({ type: 'room_reset' });

    expect(plotStore.hasRoute).toBe(false);
    expect(plotStore.isPlotRouteMode).toBe(false);
  });

  it('plot_route_updated message applies route and destination to plot store', () => {
    const roomStore = useRoomStore();
    const plotStore = usePlotRouteStore();

    roomStore.applyMessage({ 
      type: 'plot_route_updated', 
      plottedRoute: ['c1', 'c2'],
      destinationZoneId: 'dest-zone'
    });

    expect(plotStore.plottedConnectionIds.has('c1')).toBe(true);
    expect(plotStore.plottedConnectionIds.has('c2')).toBe(true);
    expect(plotStore.destinationZoneId).toBe('dest-zone');
    expect(plotStore.hasRoute).toBe(true);
  });

  it('sync message with plottedRoute applies route to plot store', () => {
    const roomStore = useRoomStore();
    const plotStore = usePlotRouteStore();

    roomStore.applyMessage({
      type: 'sync',
      connections: [],
      homeZoneId: 'home',
      nodePositions: [],
      lastUpdatedAt: new Date().toISOString(),
      watching: 0,
      totalConnected: 0,
      plottedRoute: ['c1', 'c2'],
    });

    expect(plotStore.plottedConnectionIds.has('c1')).toBe(true);
    expect(plotStore.hasRoute).toBe(true);
  });
});
