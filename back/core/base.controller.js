const ApiResponse = require('./api.response');

class BaseController {
  constructor(service) {
    this.service = service;
  }

  sendSuccess(res, data = {}, message = 'Success', statusCode = 200) {
    return ApiResponse.success(res, data, message, statusCode);
  }

  sendError(res, message = 'Error', statusCode = 400, errors = null) {
    return ApiResponse.error(res, message, statusCode, errors);
  }
}

module.exports = BaseController;
