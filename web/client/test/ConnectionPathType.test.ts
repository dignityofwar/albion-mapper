import { describe, it, expect } from 'vitest'
import { getConnectionPath } from '../src/utils/connectionPath'
import { Position } from '@vue-flow/core'

describe('getConnectionPath Path Type', () => {
  it('should return a bezier path when connecting to center', () => {
    const path = getConnectionPath({
      sourceX: 0,
      sourceY: 0,
      targetX: 100,
      targetY: 100,
      sourcePosition: Position.Top,
      targetPosition: Position.Bottom,
      sourceHandleId: 'n',
      targetHandleId: 'center',
    })
    
    // Bezier path uses 'C'
    expect(path[0]).toContain('C')
    expect(path[0]).not.toContain(' L')
  })

  it('should return a bezier path when connecting non-center handles that are not orthogonal (e.g. top to top)', () => {
    const path = getConnectionPath({
      sourceX: 0,
      sourceY: 0,
      targetX: 100,
      targetY: 100,
      sourcePosition: Position.Top,
      targetPosition: Position.Top,
      sourceHandleId: 'n',
      targetHandleId: 'n',
    })
    
    // Our custom bezier path uses 'C'
    expect(path[0]).toContain('C')
  })
  
  it('should return a bezier path when connecting orthogonal non-center handles (e.g. top to bottom)', () => {
    const path = getConnectionPath({
      sourceX: 0,
      sourceY: 0,
      targetX: 0,
      targetY: 100,
      sourcePosition: Position.Top,
      targetPosition: Position.Bottom,
      sourceHandleId: 'n',
      targetHandleId: 's',
    })
    
    expect(path[0]).toContain('C')
    expect(path[0]).not.toContain('L')
  })

  it('should return a bezier path when connecting right to left (orthogonal)', () => {
    const path = getConnectionPath({
      sourceX: 0,
      sourceY: 0,
      targetX: 100,
      targetY: 0,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      sourceHandleId: 'e',
      targetHandleId: 'w',
    })
    
    expect(path[0]).toContain('C')
    expect(path[0]).not.toContain('L')
  })
  
  it('should offset the label towards the source node when target is a center handle', () => {
    const path = getConnectionPath({
      sourceX: 0,
      sourceY: 0,
      targetX: 100,
      targetY: 0,
      sourcePosition: Position.Top,
      targetPosition: Position.Bottom,
      sourceHandleId: 'n',
      targetHandleId: 'center',
    })

    const labelX = path[1]
    const labelY = path[2]
    const midX = (0 + 100) / 2

    // Label should be closer to source (x < midpoint) not at the midpoint
    expect(labelX).toBeLessThan(midX)
    expect(labelY).toBeCloseTo(-18.75, 2)
  })

  it('should offset the label towards the source node when target is a center-overlay handle', () => {
    const path = getConnectionPath({
      sourceX: 0,
      sourceY: 0,
      targetX: 0,
      targetY: 200,
      sourcePosition: Position.Top,
      targetPosition: Position.Bottom,
      sourceHandleId: 'n',
      targetHandleId: 'center-overlay',
    })

    const labelY = path[2]
    const midY = (0 + 200) / 2

    // Label should be closer to source (y < midpoint) not at the midpoint
    expect(labelY).toBeLessThan(midY)
  })

  it('should return a straight line when forced straight even if not center', () => {
    const path = getConnectionPath({
      sourceX: 0,
      sourceY: 0,
      targetX: 100,
      targetY: 100,
      sourcePosition: Position.Top,
      targetPosition: Position.Top,
      sourceHandleId: 'n',
      targetHandleId: 'n',
      forceStraight: true
    })
    
    expect(path[0]).toContain('L')
    expect(path[0]).not.toContain('C')
  })
})
