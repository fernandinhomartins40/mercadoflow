import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { config, logger } from '@/lib/services';
import { AppError, ValidationError, NotFoundError, UnauthorizedError, ForbiddenError } from '../types/common.types';
import { ErrorCodes } from '../types/api.types';

export const errorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // If response already sent, pass to default Express error handler
  if (res.headersSent) {
    return next(error);
  }

  let statusCode = 500;
  let errorCode = ErrorCodes.INTERNAL_ERROR;
  let message = 'Internal server error';
  let details: any = undefined;

  // Handle different types of errors
  if (error instanceof AppError) {
    // Custom application errors
    statusCode = error.statusCode;
    errorCode = error.code as ErrorCodes;
    message = error.message;
  } else if (error instanceof ValidationError) {
    // Validation errors
    statusCode = 400;
    errorCode = ErrorCodes.VALIDATION_ERROR;
    message = error.message;
    details = { field: error.field };
  } else if (error instanceof NotFoundError) {
    // Not found errors
    statusCode = 404;
    errorCode = ErrorCodes.NOT_FOUND;
    message = error.message;
  } else if (error instanceof UnauthorizedError) {
    // Unauthorized errors
    statusCode = 401;
    errorCode = ErrorCodes.AUTHENTICATION_ERROR;
    message = error.message;
  } else if (error instanceof ForbiddenError) {
    // Forbidden errors
    statusCode = 403;
    errorCode = ErrorCodes.AUTHORIZATION_ERROR;
    message = error.message;
  } else if (error instanceof ZodError) {
    // Zod validation errors
    statusCode = 400;
    errorCode = ErrorCodes.VALIDATION_ERROR;
    message = 'Validation failed';
    details = {
      issues: error.issues.map(issue => ({
        field: issue.path.join('.'),
        message: issue.message,
        code: issue.code
      }))
    };
  } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // Prisma known errors
    ({ statusCode, errorCode, message, details } = handlePrismaError(error));
  } else if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    // Prisma unknown errors
    statusCode = 500;
    errorCode = ErrorCodes.INTERNAL_ERROR;
    message = 'Database error occurred';
    details = config.isDevelopment() ? { originalError: error.message } : undefined;
  } else if (error instanceof Prisma.PrismaClientRustPanicError) {
    // Prisma panic errors
    statusCode = 500;
    errorCode = ErrorCodes.SERVICE_UNAVAILABLE;
    message = 'Database service unavailable';
  } else if (error instanceof Prisma.PrismaClientInitializationError) {
    // Prisma initialization errors
    statusCode = 500;
    errorCode = ErrorCodes.SERVICE_UNAVAILABLE;
    message = 'Database connection failed';
  } else if (error instanceof Prisma.PrismaClientValidationError) {
    // Prisma validation errors
    statusCode = 400;
    errorCode = ErrorCodes.VALIDATION_ERROR;
    message = 'Invalid database query parameters';
    details = config.isDevelopment() ? { originalError: error.message } : undefined;
  } else if (error.name === 'MulterError') {
    // File upload errors
    ({ statusCode, errorCode, message, details } = handleMulterError(error));
  } else if (error.code === 'ENOENT') {
    // File not found errors
    statusCode = 404;
    errorCode = ErrorCodes.NOT_FOUND;
    message = 'File not found';
  } else if (error.code === 'EACCES') {
    // Permission errors
    statusCode = 403;
    errorCode = ErrorCodes.AUTHORIZATION_ERROR;
    message = 'Access denied';
  } else if (error.code === 'EMFILE' || error.code === 'ENFILE') {
    // Too many files open
    statusCode = 503;
    errorCode = ErrorCodes.SERVICE_UNAVAILABLE;
    message = 'Server temporarily unavailable';
  } else if (error.code === 'ECONNREFUSED') {
    // Connection refused (external service)
    statusCode = 503;
    errorCode = ErrorCodes.EXTERNAL_API_ERROR;
    message = 'External service unavailable';
  } else if (error.name === 'TimeoutError') {
    // Timeout errors
    statusCode = 408;
    errorCode = ErrorCodes.EXTERNAL_API_ERROR;
    message = 'Request timeout';
  } else if (error.name === 'SyntaxError' && error.type === 'entity.parse.failed') {
    // JSON parsing errors
    statusCode = 400;
    errorCode = ErrorCodes.INVALID_REQUEST;
    message = 'Invalid JSON in request body';
  } else if (error.name === 'PayloadTooLargeError') {
    // Payload too large
    statusCode = 413;
    errorCode = ErrorCodes.INVALID_REQUEST;
    message = 'Request payload too large';
  }

  // Log error with appropriate level
  const logData = {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code
    },
    request: {
      method: req.method,
      url: req.url,
      headers: {
        'user-agent': req.get('User-Agent'),
        'content-type': req.get('Content-Type'),
        'content-length': req.get('Content-Length')
      },
      ip: req.ip,
      userId: (req as any).user?.id
    },
    response: {
      statusCode,
      errorCode
    }
  };

  if (statusCode >= 500) {
    logger.error('Server error', logData);
  } else if (statusCode >= 400) {
    logger.warn('Client error', logData);
  }

  // Send error response
  const response = {
    success: false,
    error: {
      code: errorCode,
      message
    } as any
  };

  // Include details in development or for specific error types
  if (details && (config.isDevelopment() || statusCode < 500)) {
    response.error.details = details;
  }

  // Include stack trace in development
  if (config.isDevelopment() && error.stack) {
    response.error.stack = error.stack;
  }

  // Add request ID if available
  if ((req as any).id) {
    response.error.requestId = (req as any).id;
  }

  res.status(statusCode).json(response);
};

function handlePrismaError(error: Prisma.PrismaClientKnownRequestError) {
  let statusCode = 500;
  let errorCode = ErrorCodes.INTERNAL_ERROR;
  let message = 'Database error';
  let details: any = undefined;

  switch (error.code) {
    case 'P2000':
      statusCode = 400;
      errorCode = ErrorCodes.VALIDATION_ERROR;
      message = 'Input value too long for field';
      details = { field: error.meta?.target };
      break;

    case 'P2001':
      statusCode = 404;
      errorCode = ErrorCodes.NOT_FOUND;
      message = 'Record not found';
      details = { where: error.meta?.cause };
      break;

    case 'P2002':
      statusCode = 409;
      errorCode = ErrorCodes.DUPLICATE_ENTRY;
      message = 'Unique constraint violation';
      details = { field: error.meta?.target };
      break;

    case 'P2003':
      statusCode = 400;
      errorCode = ErrorCodes.VALIDATION_ERROR;
      message = 'Foreign key constraint violation';
      details = { field: error.meta?.field_name };
      break;

    case 'P2004':
      statusCode = 400;
      errorCode = ErrorCodes.VALIDATION_ERROR;
      message = 'Constraint violation';
      break;

    case 'P2005':
      statusCode = 400;
      errorCode = ErrorCodes.VALIDATION_ERROR;
      message = 'Invalid value for field';
      details = { field: error.meta?.field_name, value: error.meta?.field_value };
      break;

    case 'P2006':
      statusCode = 400;
      errorCode = ErrorCodes.VALIDATION_ERROR;
      message = 'Invalid value provided';
      break;

    case 'P2007':
      statusCode = 400;
      errorCode = ErrorCodes.VALIDATION_ERROR;
      message = 'Data validation error';
      break;

    case 'P2008':
      statusCode = 400;
      errorCode = ErrorCodes.VALIDATION_ERROR;
      message = 'Failed to parse query';
      break;

    case 'P2009':
      statusCode = 400;
      errorCode = ErrorCodes.VALIDATION_ERROR;
      message = 'Failed to validate query';
      break;

    case 'P2010':
      statusCode = 500;
      errorCode = ErrorCodes.INTERNAL_ERROR;
      message = 'Raw query failed';
      break;

    case 'P2011':
      statusCode = 400;
      errorCode = ErrorCodes.VALIDATION_ERROR;
      message = 'Null constraint violation';
      details = { field: error.meta?.constraint };
      break;

    case 'P2012':
      statusCode = 400;
      errorCode = ErrorCodes.VALIDATION_ERROR;
      message = 'Missing required value';
      details = { path: error.meta?.path };
      break;

    case 'P2013':
      statusCode = 400;
      errorCode = ErrorCodes.VALIDATION_ERROR;
      message = 'Missing required argument';
      details = { argument: error.meta?.argument_name };
      break;

    case 'P2014':
      statusCode = 400;
      errorCode = ErrorCodes.VALIDATION_ERROR;
      message = 'Relation violation';
      details = { relation: error.meta?.relation_name };
      break;

    case 'P2015':
      statusCode = 404;
      errorCode = ErrorCodes.NOT_FOUND;
      message = 'Related record not found';
      break;

    case 'P2016':
      statusCode = 400;
      errorCode = ErrorCodes.VALIDATION_ERROR;
      message = 'Query interpretation error';
      break;

    case 'P2017':
      statusCode = 400;
      errorCode = ErrorCodes.VALIDATION_ERROR;
      message = 'Records not connected';
      details = { relation: error.meta?.relation_name };
      break;

    case 'P2018':
      statusCode = 404;
      errorCode = ErrorCodes.NOT_FOUND;
      message = 'Required connected records not found';
      break;

    case 'P2019':
      statusCode = 400;
      errorCode = ErrorCodes.VALIDATION_ERROR;
      message = 'Input error';
      break;

    case 'P2020':
      statusCode = 400;
      errorCode = ErrorCodes.VALIDATION_ERROR;
      message = 'Value out of range';
      break;

    case 'P2021':
      statusCode = 404;
      errorCode = ErrorCodes.NOT_FOUND;
      message = 'Table not found';
      break;

    case 'P2022':
      statusCode = 404;
      errorCode = ErrorCodes.NOT_FOUND;
      message = 'Column not found';
      break;

    case 'P2023':
      statusCode = 400;
      errorCode = ErrorCodes.VALIDATION_ERROR;
      message = 'Inconsistent column data';
      break;

    case 'P2024':
      statusCode = 408;
      errorCode = ErrorCodes.EXTERNAL_API_ERROR;
      message = 'Connection timeout';
      break;

    case 'P2025':
      statusCode = 404;
      errorCode = ErrorCodes.NOT_FOUND;
      message = 'Record to update not found';
      break;

    default:
      // Unknown Prisma error code
      statusCode = 500;
      errorCode = ErrorCodes.INTERNAL_ERROR;
      message = 'Unknown database error';
      details = config.isDevelopment() ? { prismaCode: error.code } : undefined;
  }

  return { statusCode, errorCode, message, details };
}

function handleMulterError(error: any) {
  let statusCode = 400;
  let errorCode = ErrorCodes.VALIDATION_ERROR;
  let message = 'File upload error';
  let details: any = undefined;

  switch (error.code) {
    case 'LIMIT_FILE_SIZE':
      message = 'File too large';
      details = { maxSize: error.limit };
      break;

    case 'LIMIT_FILE_COUNT':
      message = 'Too many files';
      details = { maxCount: error.limit };
      break;

    case 'LIMIT_FIELD_KEY':
      message = 'Field name too long';
      break;

    case 'LIMIT_FIELD_VALUE':
      message = 'Field value too long';
      break;

    case 'LIMIT_FIELD_COUNT':
      message = 'Too many fields';
      break;

    case 'LIMIT_UNEXPECTED_FILE':
      message = 'Unexpected file field';
      details = { fieldName: error.field };
      break;

    case 'MISSING_FIELD_NAME':
      message = 'Missing field name';
      break;

    default:
      message = 'File upload failed';
  }

  return { statusCode, errorCode, message, details };
}

// 404 handler for unmatched routes
export const notFoundHandler = (req: Request, res: Response) => {
  logger.warn('Route not found', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.status(404).json({
    success: false,
    error: {
      code: ErrorCodes.NOT_FOUND,
      message: `Route ${req.method} ${req.path} not found`
    }
  });
};