import type { Response } from "express";
import { throwError, sendSuccess } from "../../src/utils/response";

describe("Response Utilities", () => {
  describe("throwError", () => {
    it("should throw error with message and default code", () => {
      try {
        throwError("Test error message");
        fail("Expected error to be thrown");
      } catch (error: any) {
        expect(error.message).toBe("Test error message");
        expect(error.code).toBe(500);
        expect(error.isOperational).toBe(true);
      }
    });

    it("should throw error with custom code", () => {
      try {
        throwError("Not found", 404);
        fail("Expected error to be thrown");
      } catch (error: any) {
        expect(error.message).toBe("Not found");
        expect(error.code).toBe(404);
        expect(error.isOperational).toBe(true);
      }
    });

    it("should throw error with 400 status code", () => {
      try {
        throwError("Bad request", 400);
        fail("Expected error to be thrown");
      } catch (error: any) {
        expect(error.message).toBe("Bad request");
        expect(error.code).toBe(400);
        expect(error.isOperational).toBe(true);
      }
    });

    it("should throw error with 401 status code", () => {
      try {
        throwError("Unauthorized", 401);
        fail("Expected error to be thrown");
      } catch (error: any) {
        expect(error.message).toBe("Unauthorized");
        expect(error.code).toBe(401);
        expect(error.isOperational).toBe(true);
      }
    });

    it("should throw error with 403 status code", () => {
      try {
        throwError("Forbidden", 403);
        fail("Expected error to be thrown");
      } catch (error: any) {
        expect(error.message).toBe("Forbidden");
        expect(error.code).toBe(403);
        expect(error.isOperational).toBe(true);
      }
    });
  });

  describe("sendSuccess", () => {
    let mockResponse: Partial<Response>;

    beforeEach(() => {
      mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
    });

    it("should send success response with default values", () => {
      sendSuccess(mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: "success",
        code: 200,
        msg: "Success",
        data: undefined,
      });
    });

    it("should send success response with custom message", () => {
      sendSuccess(mockResponse as Response, "Custom message");

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: "success",
        code: 200,
        msg: "Custom message",
        data: undefined,
      });
    });

    it("should send success response with data", () => {
      const testData = { id: 1, name: "Test" };

      sendSuccess(mockResponse as Response, "Success", testData);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: "success",
        code: 200,
        msg: "Success",
        data: testData,
      });
    });

    it("should send success response with custom status code", () => {
      sendSuccess(mockResponse as Response, "Created", { id: 1 }, 201);

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: "success",
        code: 201,
        msg: "Created",
        data: { id: 1 },
      });
    });

    it("should send success response with array data", () => {
      const arrayData = [{ id: 1 }, { id: 2 }];

      sendSuccess(mockResponse as Response, "List fetched", arrayData);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: "success",
        code: 200,
        msg: "List fetched",
        data: arrayData,
      });
    });

    it("should send success response with null data", () => {
      sendSuccess(mockResponse as Response, "Deleted", null);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: "success",
        code: 200,
        msg: "Deleted",
        data: null,
      });
    });
  });
});
