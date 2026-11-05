import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

export interface StandardErrorResponse {
  statusCode: number;
  error: string;
  message: string | string[];
  errors?: Array<{ path: (string | number)[]; message: string }>;
  timestamp: string;
  path: string;
  method: string;
  traceId?: string;
}

/**
 * Tầng Global Exception Filter bắt và chuẩn hóa toàn bộ lỗi trong hệ thống CRM
 * - Xử lý chuẩn xác các lỗi NestJS HttpException
 * - Bắt và phiên dịch các lỗi cơ sở dữ liệu Prisma (P2002 trùng lặp, P2025 không tìm thấy, P2003 khóa ngoại...)
 * - Bắt và bóc tách lỗi validation schema Zod
 * - Ẩn chi tiết lỗi hệ thống nội bộ khi chạy production để bảo mật mã nguồn
 * - Tương thích hoàn toàn với NestFastifyApplication
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<any>();
    const response = ctx.getResponse<any>();

    // Tránh gửi response lặp lại nếu Fastify đã phản hồi
    if (response?.sent || response?.headersSent) {
      return;
    }

    const path = (httpAdapter.getRequestUrl(request) || '').split('?')[0];
    const method = httpAdapter.getRequestMethod(request) || 'UNKNOWN';
    const traceId =
      request?.headers?.['x-request-id'] ||
      request?.headers?.['x-trace-id'] ||
      request?.id;

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorTitle = 'Internal Server Error';
    let errorMessage: string | string[] = 'Đã có lỗi hệ thống xảy ra. Vui lòng thử lại sau.';
    let validationErrors: Array<{ path: (string | number)[]; message: string }> | undefined;

    // 1. Phân loại HttpException chuẩn của NestJS (BadRequest, Unauthorized, Forbidden, NotFound...)
    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        errorMessage = exceptionResponse;
        errorTitle = exception.name.replace(/Exception$/, '');
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const respObj = exceptionResponse as Record<string, any>;
        errorMessage = respObj.message || exception.message;
        errorTitle = respObj.error || exception.name.replace(/Exception$/, '');
        if (Array.isArray(respObj.errors)) {
          validationErrors = respObj.errors;
        }
      }
    }
    // 2. Phân loại lỗi kiểm thực schema Zod (ZodError)
    else if (exception instanceof ZodError) {
      statusCode = HttpStatus.BAD_REQUEST;
      errorTitle = 'Bad Request';
      errorMessage = 'Dữ liệu đầu vào không hợp lệ.';
      validationErrors = exception.issues.map((issue) => ({
        path: issue.path.map((p) => (typeof p === 'symbol' ? p.toString() : p)),
        message: issue.message,
      }));
    }
    // 3. Phân loại lỗi truy vấn cơ sở dữ liệu Prisma Client
    else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002': {
          // Lỗi Unique Constraint Violated (trùng email, phone, slug...)
          statusCode = HttpStatus.CONFLICT;
          errorTitle = 'Conflict';
          const target = (exception.meta?.target as string[]) || [];
          const fieldNames = Array.isArray(target) ? target.join(', ') : 'dữ liệu';
          errorMessage = `Dữ liệu '${fieldNames}' đã tồn tại trong hệ thống. Vui lòng kiểm tra lại.`;
          break;
        }
        case 'P2025': {
          // Lỗi Record Not Found
          statusCode = HttpStatus.NOT_FOUND;
          errorTitle = 'Not Found';
          errorMessage = 'Bản ghi yêu cầu không tồn tại hoặc đã bị xóa khỏi hệ thống.';
          break;
        }
        case 'P2003': {
          // Lỗi Foreign Key Constraint Failed
          statusCode = HttpStatus.BAD_REQUEST;
          errorTitle = 'Bad Request';
          errorMessage = 'Ràng buộc khóa ngoại không hợp lệ hoặc thực thể liên kết không tồn tại.';
          break;
        }
        case 'P2014': {
          statusCode = HttpStatus.BAD_REQUEST;
          errorTitle = 'Bad Request';
          errorMessage = 'Thao tác vi phạm mối quan hệ bắt buộc giữa các bản ghi.';
          break;
        }
        default: {
          statusCode = HttpStatus.BAD_REQUEST;
          errorTitle = 'Database Error';
          errorMessage = `Thao tác cơ sở dữ liệu không hợp lệ (Mã: ${exception.code}).`;
          break;
        }
      }
    }
    // 4. Lỗi định dạng tham số truy vấn Prisma (PrismaClientValidationError)
    else if (exception instanceof Prisma.PrismaClientValidationError) {
      statusCode = HttpStatus.BAD_REQUEST;
      errorTitle = 'Bad Request';
      errorMessage = 'Dữ liệu hoặc tham số truy vấn cơ sở dữ liệu không đúng cấu trúc.';
    }
    // 5. Lỗi kết nối khởi tạo Prisma (PrismaClientInitializationError)
    else if (exception instanceof Prisma.PrismaClientInitializationError) {
      statusCode = HttpStatus.SERVICE_UNAVAILABLE;
      errorTitle = 'Service Unavailable';
      errorMessage = 'Không thể kết nối đến máy chủ cơ sở dữ liệu. Vui lòng thử lại sau.';
    }
    // 6. Các ngoại lệ runtime chưa xác định
    else if (exception instanceof Error) {
      const isDev = process.env.NODE_ENV !== 'production';
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      errorTitle = 'Internal Server Error';
      errorMessage = isDev ? exception.message : 'Đã có lỗi hệ thống xảy ra. Vui lòng thử lại sau.';
    }

    // Ghi log chi tiết: 4xx ghi warn, 5xx ghi error kèm stack trace
    const logPrefix = `[${method} ${path}] [Status: ${statusCode}]`;
    const clientIp = request?.ip || request?.headers?.['x-forwarded-for'] || 'unknown';

    if (statusCode >= 500) {
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(
        `${logPrefix} Error: ${Array.isArray(errorMessage) ? errorMessage.join('; ') : errorMessage} - IP: ${clientIp}`,
        stack,
      );
    } else {
      this.logger.warn(
        `${logPrefix} Handled Exception: ${Array.isArray(errorMessage) ? errorMessage.join('; ') : errorMessage} - IP: ${clientIp}`,
      );
    }

    const responseBody: StandardErrorResponse = {
      statusCode,
      error: errorTitle,
      message: errorMessage,
      ...(validationErrors ? { errors: validationErrors } : {}),
      timestamp: new Date().toISOString(),
      path,
      method,
      ...(traceId ? { traceId: String(traceId) } : {}),
    };

    httpAdapter.reply(response, responseBody, statusCode);
  }
}
