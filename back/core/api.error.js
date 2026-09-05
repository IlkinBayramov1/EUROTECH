class ApiError extends Error {
  constructor(message, statusCode = 400, errors = null) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(msg, errors = null) {
    return new ApiError(msg, 400, errors);
  }

  static unauthorized(msg = 'Unauthorized access') {
    return new ApiError(msg, 401);
  }

  static forbidden(msg = 'Permission denied') {
    return new ApiError(msg, 403);
  }

  static notFound(msg = 'Resource not found') {
    return new ApiError(msg, 404);
  }

  static internal(msg = 'Internal server error') {
    return new ApiError(msg, 500);
  }
}

module.exports = ApiError;
