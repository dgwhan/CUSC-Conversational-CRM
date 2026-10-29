import { describe, expect, it } from 'vitest';
import { Reflector } from '@nestjs/core';
import { WorkspaceRolesGuard } from '../../src/common/guards/workspace-roles.guard.js';
import { ROLES_KEY } from '../../src/common/decorators/roles.decorator.js';
import { ForbiddenException, ExecutionContext } from '@nestjs/common';

describe('WorkspaceRolesGuard', () => {
  it('should allow access if no roles are required', () => {
    const reflector = new Reflector();
    reflector.getAllAndOverride = () => undefined;

    const guard = new WorkspaceRolesGuard(reflector);
    const mockContext = {
      getHandler: () => {},
      getClass: () => {},
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: 'STAFF' } }),
      }),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(mockContext)).toBe(true);
  });

  it('should allow OWNER access when OWNER is required', () => {
    const reflector = new Reflector();
    reflector.getAllAndOverride = (key) => (key === ROLES_KEY ? ['OWNER'] : undefined);

    const guard = new WorkspaceRolesGuard(reflector);
    const mockContext = {
      getHandler: () => {},
      getClass: () => {},
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { 'x-user-role': 'OWNER' },
        }),
      }),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(mockContext)).toBe(true);
  });

  it('should throw ForbiddenException when STAFF tries to access OWNER endpoint', () => {
    const reflector = new Reflector();
    reflector.getAllAndOverride = (key) => (key === ROLES_KEY ? ['OWNER'] : undefined);

    const guard = new WorkspaceRolesGuard(reflector);
    const mockContext = {
      getHandler: () => {},
      getClass: () => {},
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { 'x-user-role': 'STAFF' },
        }),
      }),
    } as unknown as ExecutionContext;

    expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
  });
});
