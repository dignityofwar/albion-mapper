import { describe, it, expect } from 'vitest'
import { getConnectionPath } from '../src/utils/connectionPath'
import { Position } from '@vue-flow/core'

describe('getConnectionPath Path Type', () => {
  it('should return a straight line when connecting to center', () => {
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
    
    // Straight line starts with M and has one L
    expect(path[0]).toContain('L')
    expect(path[0]).not.toContain('C')
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
