import { describe, it, expect } from 'vitest'
import { getConnectionPath } from '../src/utils/connectionPath'
import { Position } from '@vue-flow/core'

describe('getConnectionPath', () => {
  it('should return a straight line when targetHandleId is center', () => {
    const path = getConnectionPath({
      sourceX: -110.3072,
      sourceY: -61.64609999999999,
      targetX: 37.445850000000014,
      targetY: -536.29126,
      sourcePosition: 'left',
      targetPosition: 'right',
      sourceHandleId: 'w',
      targetHandleId: 'center',
    })
    
    expect(path[0]).toBe('M-110.3072,-61.64609999999999 L37.445850000000014,-536.29126')
  })

  it('should return a straight line when forceStraight is true', () => {
    const path = getConnectionPath({
      sourceX: 0,
      sourceY: 0,
      targetX: 100,
      targetY: 100,
      sourcePosition: 'left',
      targetPosition: 'right',
      sourceHandleId: 'nw',
      targetHandleId: 'ne',
      forceStraight: true,
    })
    
    expect(path[0]).toBe('M0,0 L100,100')
  })
})
