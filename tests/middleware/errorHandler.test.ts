import type { Request, Response, NextFunction } from "express";
import { errorHandler, notFound } from "../../src/middleware/errorHandler";

describe("Error Handler Middleware", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {};
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  describe("errorHandler", () => {
    it("should handle operational error with custom code", () => {
      const error = {
        code: 400,
        message: "Bad Request",
        isOperational: true,
      };

      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.send).toHaveBeenCalledWith({
        code: 400,
        status: "error",
        msg: "Bad Request",
      });
    });

    it("should handle operational error with 500 default code", () => {
      const error = {
        message: "Something went wrong",
        isOperational: true,
      };

      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.send).toHaveBeenCalledWith({
        code: 500,
        status: "error",
        msg: "Something went wrong",
      });
    });

    it("should hide message for non-operational errors", () => {
      const error = {
        code: 500,
        message: "Internal database error details",
        isOperational: false,
      };

      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.send).toHaveBeenCalledWith({
        code: 500,
        status: "error",
        msg: "Internal Server Error",
      });
    });

    it("should hide message when isOperational is undefined", () => {
      const error = {
        message: "Sensitive error details",
      };

      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.send).toHaveBeenCalledWith({
        code: 500,
        status: "error",
        msg: "Internal Server Error",
      });
    });

    it("should handle 401 unauthorized error", () => {
      const error = {
        code: 401,
        message: "Unauthorized access",
        isOperational: true,
      };

      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.send).toHaveBeenCalledWith({
        code: 401,
        status: "error",
        msg: "Unauthorized access",
      });
    });

    it("should handle 403 forbidden error", () => {
      const error = {
        code: 403,
        message: "Access forbidden",
        isOperational: true,
      };

      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.send).toHaveBeenCalledWith({
        code: 403,
        status: "error",
        msg: "Access forbidden",
      });
    });

    it("should handle 404 not found error", () => {
      const error = {
        code: 404,
        message: "Resource not found",
        isOperational: true,
      };

      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.send).toHaveBeenCalledWith({
        code: 404,
        status: "error",
        msg: "Resource not found",
      });
    });

    it("should handle error without message", () => {
      const error = {
        code: 500,
        isOperational: true,
      };

      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.send).toHaveBeenCalledWith({
        code: 500,
        status: "error",
        msg: undefined,
      });
    });
  });

  describe("notFound", () => {
    it("should return 404 response for unknown routes", () => {
      notFound(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.send).toHaveBeenCalledWith({
        code: 404,
        status: "error",
        msg: "Resource not found",
      });
    });

    it("should not call next", () => {
      notFound(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});
