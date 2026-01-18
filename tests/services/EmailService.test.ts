import nodemailer from "nodemailer";

// Mock nodemailer before importing EmailService
jest.mock("nodemailer");
const mockedNodemailer = nodemailer as jest.Mocked<typeof nodemailer>;

const mockTransporter = {
  sendMail: jest.fn(),
  verify: jest.fn(),
} as any;

// Set up the mock before importing EmailService
mockedNodemailer.createTransport.mockReturnValue(mockTransporter);

import {
  sendEmail,
  testConnection,
  getTransporter,
} from "../../src/services/EmailService";
import type { ServiceId } from "../../src/constants/common";

// Mock other dependencies
jest.mock("../../src/helpers/logger");

describe("EmailService", () => {
  const serviceId: ServiceId = "examaxis";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("sendEmail", () => {
    it("should send email successfully", async () => {
      const mockTemplate = {
        subject: "Test Subject",
        text: "Test text content",
        html: "<p>Test html content</p>",
      };

      mockTransporter.sendMail.mockResolvedValue({ messageId: "test-id" });

      await sendEmail("test@example.com", mockTemplate, serviceId);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: expect.any(String),
        to: "test@example.com",
        subject: mockTemplate.subject,
        text: mockTemplate.text,
        html: mockTemplate.html,
      });
    });

    it("should throw error when email sending fails", async () => {
      const mockTemplate = {
        subject: "Test Subject",
        text: "Test text content",
        html: "<p>Test html content</p>",
      };

      mockTransporter.sendMail.mockRejectedValue(new Error("SMTP Error"));

      await expect(
        sendEmail("test@example.com", mockTemplate, serviceId)
      ).rejects.toThrow("Failed to send email");
    });

    it("should handle network timeout errors", async () => {
      const mockTemplate = {
        subject: "Test Subject",
        text: "Test text content",
        html: "<p>Test html content</p>",
      };

      mockTransporter.sendMail.mockRejectedValue(new Error("ETIMEDOUT"));

      await expect(
        sendEmail("test@example.com", mockTemplate, serviceId)
      ).rejects.toThrow("Failed to send email");
    });

    it("should handle authentication errors", async () => {
      const mockTemplate = {
        subject: "Test Subject",
        text: "Test text content",
        html: "<p>Test html content</p>",
      };

      mockTransporter.sendMail.mockRejectedValue(
        new Error("Authentication failed")
      );

      await expect(
        sendEmail("test@example.com", mockTemplate, serviceId)
      ).rejects.toThrow("Failed to send email");
    });
  });

  describe("testConnection", () => {
    it("should return true when connection is successful", async () => {
      mockTransporter.verify.mockResolvedValue(true);

      const result = await testConnection(serviceId);

      expect(result).toBe(true);
      expect(mockTransporter.verify).toHaveBeenCalled();
    });

    it("should return false when connection fails", async () => {
      mockTransporter.verify.mockRejectedValue(new Error("Connection failed"));

      const result = await testConnection(serviceId);

      expect(result).toBe(false);
    });

    it("should return false on SMTP connection timeout", async () => {
      mockTransporter.verify.mockRejectedValue(new Error("ETIMEDOUT"));

      const result = await testConnection(serviceId);

      expect(result).toBe(false);
    });
  });

  describe("getTransporter", () => {
    it("should return transporter for service", () => {
      const transporter = getTransporter(serviceId);

      expect(transporter).toBeDefined();
    });

    it("should return cached transporter on subsequent calls", () => {
      const transporter1 = getTransporter(serviceId);
      const transporter2 = getTransporter(serviceId);

      // Should be the same cached instance
      expect(transporter1).toBe(transporter2);
    });
  });
});
