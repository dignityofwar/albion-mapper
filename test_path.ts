
import { getConnectionPath } from './web/client/src/utils/connectionPath';
import { Position } from '@vue-flow/core';

// Test N to S connection
const params = {
  sourceX: 100,
  sourceY: 100,
  targetX: 100,
  targetY: 200,
  sourcePosition: Position.Top,
  targetPosition: Position.Bottom,
  sourceHandleId: 'n',
  targetHandleId: 's',
};

const [path] = getConnectionPath(params);
console.log('Path N to S:', path);

// Test N to N connection
const params2 = {
  sourceX: 100,
  sourceY: 100,
  targetX: 200,
  targetY: 100,
  sourcePosition: Position.Top,
  targetPosition: Position.Top,
  sourceHandleId: 'n',
  targetHandleId: 'n',
};

const [path2] = getConnectionPath(params2);
console.log('Path N to N:', path2);
