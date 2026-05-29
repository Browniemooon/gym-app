import { OperationType } from '../types';

export function handleFirestoreError(error: any, operation: OperationType, path: string) {
  console.error(`Firestore Error [${operation}] at ${path}:`, error);
  if (error.code === 'permission-denied') {
    return 'Permission denied. Please check your user role.';
  }
  return error.message || 'An unexpected database error occurred.';
}
