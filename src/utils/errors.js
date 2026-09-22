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

  static routeNotFound() {
    return new AppError(404, 1, 'Not found', 'The requested route does not exist.');
  }

  static unexpected() {
    return new AppError(500, 1, 'Internal server error', 'An unexpected error occurred.');
  }
}

module.exports = { AppError, MORE_INFO };
