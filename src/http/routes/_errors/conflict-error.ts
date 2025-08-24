export class ConflictError extends Error {
  constructor(message?: string) {
    super(message ?? 'Resource conflict.')
  }
}
