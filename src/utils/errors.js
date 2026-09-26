const MORE_INFO = '/docs';
const BEARER_CHALLENGE = 'Bearer realm="solar"';

class AppError extends Error {
  constructor(status, number, message, description, error = [], headers = {}) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = status * 100 + number;
    this.description = description;
    this.error = error;
    this.headers = headers;
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

  static invalidBody(error) {
    return new AppError(
      400,
      10,
      'Invalid request body',
      'One or more fields in the request body are not valid.',
      error
    );
  }

  // Every 401 carries WWW-Authenticate (WP section 9). error="invalid_token"
  // only when a token was sent and rejected.
  static authenticationRequired() {
    return new AppError(
      401,
      1,
      'Authentication required',
      'Send a bearer token in the Authorization header.',
      [],
      { 'WWW-Authenticate': BEARER_CHALLENGE }
    );
  }

  static invalidToken() {
    return new AppError(
      401,
      2,
      'Invalid or expired token',
      'The bearer token is not valid or has expired. Log in again.',
      [],
      { 'WWW-Authenticate': `${BEARER_CHALLENGE}, error="invalid_token"` }
    );
  }

  static invalidCredentials() {
    return new AppError(
      401,
      3,
      'Invalid username or password',
      'The username or password is not correct.',
      [],
      { 'WWW-Authenticate': BEARER_CHALLENGE }
    );
  }

  static outOfScope() {
    return new AppError(
      403,
      1,
      'Outside your jurisdiction',
      'The requested resource is outside your jurisdiction.'
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

  static noReadingYet() {
    return new AppError(
      404,
      3,
      'No reading yet',
      'The installation exists but has not sent any reading yet.'
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
  from: 40007,
  to: 40008,
  timeWindow: 40009,
  username: 40011,
  password: 40012,
};

module.exports = { AppError, MORE_INFO, FIELD_ERROR };
