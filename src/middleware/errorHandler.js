const { AppError, MORE_INFO } = require('../utils/errors');

function errorHandler(err, req, res, next) {
  let appError;

  if (err instanceof AppError) {
    appError = err;
  } else if (err.type === 'entity.parse.failed') {
    appError = AppError.malformedJson();
  } else {
    appError = AppError.unexpected();
  }

  console.log(`[error] ${err.name} ${appError.status}`);

  res.set(appError.headers || {});
  res.status(appError.status).json({
    code: appError.code,
    message: appError.message,
    description: appError.description,
    moreInfo: MORE_INFO,
    error: appError.error,
  });
}

module.exports = errorHandler;
