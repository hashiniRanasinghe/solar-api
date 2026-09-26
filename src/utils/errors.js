const MORE_INFO = '/docs';

class AppError extends Error {
  constructor(status, number, message, description, error = []) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = status * 100 + number;
    this.description = description;
    this.error = error;
  }

  static malformedJson() {
    return new AppError(400, 1, 'Malformed JSON', 'The request body is not valid JSON.');
  }

  static invalidQuery(error) {
    return new AppError(
      400,
      2,
      'Invalid query parameter',
      'One or more query parameters are not valid.',
      error
    );
  }

  static routeNotFound() {
    return new AppError(404, 1, 'Not found', 'The requested route does not exist.');
  }

  static resourceNotFound(resourceName) {
    return new AppError(
      404,
      2,
      'Resource not found',
      `The requested ${resourceName} does not exist.`
    );
  }

  static unexpected() {
    return new AppError(500, 1, 'Internal server error', 'An unexpected error occurred.');
  }
}

// Codes for the per-field items in error[] (same status x 100 + n scheme).
const FIELD_ERROR = {
  offset: 40003,
  limit: 40004,
  sort: 40005,
  filter: 40006,
};

module.exports = { AppError, MORE_INFO, FIELD_ERROR };
