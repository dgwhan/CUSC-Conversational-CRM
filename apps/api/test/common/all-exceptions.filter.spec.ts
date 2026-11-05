import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import type { HttpAdapterHost } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { z, ZodError } from 'zod';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter.js';

describe('AllExceptionsFilter (Tầng bắt và chuẩn hóa lỗi toàn hệ thống)', () => {
  let filter: AllExceptionsFilter;
  let mockHttpAdapter: {
    getRequestUrl: ReturnType<typeof vi.fn>;
    getRequestMethod: ReturnType<typeof vi.fn>;
    reply: ReturnType<typeof vi.fn>;
  };
  let mockAdapterHost: HttpAdapterHost;
  let mockRequest: any;
  let mockResponse: any;
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    mockHttpAdapter = {
      getRequestUrl: vi.fn().mockReturnValue('/api/customers?active=true'),
      getRequestMethod: vi.fn().mockReturnValue('POST'),
      reply: vi.fn(),
    };

    mockAdapterHost = {
      httpAdapter: mockHttpAdapter as any,
    } as unknown as HttpAdapterHost;

    mockRequest = {
      headers: {
        'x-request-id': 'req-test-trace-123',
        'x-forwarded-for': '127.0.0.1',
      },
    };

    mockResponse = {
      sent: false,
      headersSent: false,
    };

    mockHost = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    } as unknown as ArgumentsHost;

    filter = new AllExceptionsFilter(mockAdapterHost);
  });

  it('1. Bắt và chuẩn hóa HttpException (BadRequestException)', () => {
    const exception = new BadRequestException('Email không hợp lệ');

    filter.catch(exception, mockHost);

    expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
      mockResponse,
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        message: 'Email không hợp lệ',
        path: '/api/customers',
        method: 'POST',
        traceId: 'req-test-trace-123',
      }),
      HttpStatus.BAD_REQUEST,
    );
  });

  it('2. Bắt và chuẩn hóa ForbiddenException (403 Forbidden)', () => {
    const exception = new ForbiddenException('Bạn không có quyền truy cập khách hàng này');

    filter.catch(exception, mockHost);

    expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
      mockResponse,
      expect.objectContaining({
        statusCode: HttpStatus.FORBIDDEN,
        error: 'Forbidden',
        message: 'Bạn không có quyền truy cập khách hàng này',
      }),
      HttpStatus.FORBIDDEN,
    );
  });

  it('3. Bắt và bóc tách lỗi Zod schema validation (ZodError -> 400)', () => {
    const TestSchema = z.object({
      email: z.string().email(),
      age: z.number().min(18),
    });

    const parsed = TestSchema.safeParse({ email: 'invalid-email', age: 15 });
    expect(parsed.success).toBe(false);
    const zodError = (parsed as any).error as ZodError;

    filter.catch(zodError, mockHost);

    expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
      mockResponse,
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        message: 'Dữ liệu đầu vào không hợp lệ.',
        errors: expect.arrayContaining([
          expect.objectContaining({ path: ['email'] }),
          expect.objectContaining({ path: ['age'] }),
        ]),
      }),
      HttpStatus.BAD_REQUEST,
    );
  });

  it('4. Bắt lỗi Prisma P2002 (Unique Constraint Violated -> 409 Conflict)', () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed on the fields: (`email`)',
      {
        code: 'P2002',
        clientVersion: '7.10.1',
        meta: { target: ['email'] },
      },
    );

    filter.catch(prismaError, mockHost);

    expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
      mockResponse,
      expect.objectContaining({
        statusCode: HttpStatus.CONFLICT,
        error: 'Conflict',
        message: expect.stringContaining('email'),
      }),
      HttpStatus.CONFLICT,
    );
  });

  it('5. Bắt lỗi Prisma P2025 (Record Not Found -> 404 Not Found)', () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError(
      'An operation failed because it depends on one or more records that were required but not found.',
      {
        code: 'P2025',
        clientVersion: '7.10.1',
      },
    );

    filter.catch(prismaError, mockHost);

    expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
      mockResponse,
      expect.objectContaining({
        statusCode: HttpStatus.NOT_FOUND,
        error: 'Not Found',
        message: 'Bản ghi yêu cầu không tồn tại hoặc đã bị xóa khỏi hệ thống.',
      }),
      HttpStatus.NOT_FOUND,
    );
  });

  it('6. Bắt lỗi Prisma P2003 (Foreign Key Constraint Failed -> 400 Bad Request)', () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError(
      'Foreign key constraint failed on the field: (`workspace_id`)',
      {
        code: 'P2003',
        clientVersion: '7.10.1',
      },
    );

    filter.catch(prismaError, mockHost);

    expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
      mockResponse,
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        message: expect.stringContaining('Ràng buộc khóa ngoại'),
      }),
      HttpStatus.BAD_REQUEST,
    );
  });

  it('7. Bắt lỗi PrismaClientValidationError (Query format error -> 400 Bad Request)', () => {
    const prismaError = new Prisma.PrismaClientValidationError(
      'Unknown field `avatarUrl` for select statement on model `User`.',
      { clientVersion: '7.10.1' },
    );

    filter.catch(prismaError, mockHost);

    expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
      mockResponse,
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        message: 'Dữ liệu hoặc tham số truy vấn cơ sở dữ liệu không đúng cấu trúc.',
      }),
      HttpStatus.BAD_REQUEST,
    );
  });

  it('8. Bắt lỗi PrismaClientInitializationError (DB connection down -> 503 Service Unavailable)', () => {
    const prismaError = new Prisma.PrismaClientInitializationError(
      'Can not reach database server at `localhost:5432`',
      '7.10.1',
    );

    filter.catch(prismaError, mockHost);

    expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
      mockResponse,
      expect.objectContaining({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        error: 'Service Unavailable',
        message: 'Không thể kết nối đến máy chủ cơ sở dữ liệu. Vui lòng thử lại sau.',
      }),
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  });

  it('9. Bắt ngoại lệ runtime chưa xác định (500 Internal Server Error)', () => {
    const error = new Error('Unexpected database syntax crash');

    filter.catch(error, mockHost);

    expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
      mockResponse,
      expect.objectContaining({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        error: 'Internal Server Error',
      }),
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  });

  it('10. Không gửi đúp response nếu Fastify đã gửi headers (headersSent / sent = true)', () => {
    mockResponse.sent = true;

    filter.catch(new Error('Some error after response'), mockHost);

    expect(mockHttpAdapter.reply).not.toHaveBeenCalled();
  });
});
