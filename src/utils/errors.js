const MORE_INFO = '/docs';
const BEARER_CHALLENGE = 'Bearer realm="solar"';
const API_KEY_CHALLENGE = 'ApiKey realm="solar"';

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

  // Device routes: the key goes in X-API-Key. A bearer token is not a
  // credential there.
  static apiKeyRequired() {
    return new AppError(
      401,
      4,
      'API key required',
      'Send the installation device key in the X-API-Key header.',
      [],
      { 'WWW-Authenticate': API_KEY_CHALLENGE }
    );
  }

  static invalidApiKey() {
    return new AppError(
      401,
      5,
      'API key not accepted',
      'The device key in the X-API-Key header is not valid.',
      [],
      { 'WWW-Authenticate': API_KEY_CHALLENGE }
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

  // Also for an installation that does not exist, so a device key never
  // reveals which installation ids exist (OQ-26).
  static notOwnInstallation() {
    return new AppError(
      403,
      2,
      'Not your installation',
      'A device key may only write readings for its own installation.'
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

  static methodNotAllowed(allow) {
    return new AppError(
      405,
      1,
      'Method not allowed',
      `This resource supports only: ${allow}.`,
      [],
      { Allow: allow }
    );
  }

  static notAcceptable() {
    return new AppError(
      406,
      1,
      'Not acceptable',
      'This API only returns application/json. Send an Accept header that allows it.'
    );
  }

  static duplicateReading() {
    return new AppError(
      409,
      1,
      'Duplicate reading',
      'A reading with this timestamp is already stored for the installation.'
    );
  }

  static energyDecreased() {
    return new AppError(
      409,
      2,
      'Energy lower than the latest reading',
      'energy_kwh is cumulative and must not be lower than the latest stored reading.'
    );
  }

  static olderThanLatest() {
    return new AppError(
      409,
      3,
      'Reading older than the latest reading',
      'The timestamp is older than the latest stored reading of the installation.'
    );
  }

  static unsupportedMediaType() {
    return new AppError(
      415,
      1,
      'Unsupported media type',
      'The request body must be sent as Content-Type: application/json.'
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
  timestamp: 40013,
  timestampBoundary: 40014,
  power_kw: 40016,
  energy_kwh: 40017,
  voltage: 40018,
  readOnly: 40019,
};

module.exports = { AppError, MORE_INFO, FIELD_ERROR };
