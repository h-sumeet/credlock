import {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  emailVerifyToken,
  resetPasswordSchema,
  refreshTokenSchema,
  tokenHeaderSchema,
  validate,
} from "../../src/middleware/validation";

describe("Validation Schemas", () => {
  describe("Registration Schema", () => {
    it("should validate registration without phone number", () => {
      const validData = {
        name: "John Doe",
        email: "john@example.com",
        password: "StrongPass123!",
        redirectUrl: "https://example.com",
      };

      const { error } = registerSchema.validate(validData);
      expect(error).toBeUndefined();
    });

    it("should validate registration with phone number", () => {
      const validData = {
        name: "John Doe",
        email: "john@example.com",
        phone: "+1234567890",
        password: "StrongPass123!",
        redirectUrl: "https://example.com",
      };

      const { error } = registerSchema.validate(validData);
      expect(error).toBeUndefined();
    });

    it("should reject registration with invalid phone format", () => {
      const invalidData = {
        name: "John Doe",
        email: "john@example.com",
        phone: "1234567890", // Missing + prefix
        password: "StrongPass123!",
        redirectUrl: "https://example.com",
      };

      const { error } = registerSchema.validate(invalidData);
      expect(error).toBeTruthy();
      if (error && error.details && error.details[0]) {
        expect(error.details[0].message).toContain("country code");
      }
    });
  });

  describe("Profile Update Schema", () => {
    it("should validate optional phone in profile update", () => {
      const validDataWithoutPhone = {
        name: "Updated Name",
      };

      const { error: errorWithoutPhone } = updateProfileSchema.validate(
        validDataWithoutPhone
      );
      expect(errorWithoutPhone).toBeUndefined();

      const validDataWithPhone = {
        name: "Updated Name",
        phone: "+1234567890",
      };

      const { error: errorWithPhone } =
        updateProfileSchema.validate(validDataWithPhone);
      expect(errorWithPhone).toBeUndefined();
    });
  });

  describe("Phone Number Validation", () => {
    it("should validate various country code formats", () => {
      const validPhones = [
        "+1234567890", // US format
        "+911234567890", // India format
        "+8612345678901", // China format
        "+442012345678", // UK format
        "+33123456789", // France format
        "+4912345678901", // Germany format
        "+81234567890", // Japan format
      ];

      validPhones.forEach((phone) => {
        const data = {
          name: "Test User",
          email: "test@example.com",
          phone,
          password: "StrongPass123!",
          redirectUrl: "https://example.com",
        };

        const { error } = registerSchema.validate(data);
        expect(error).toBeUndefined();
      });
    });

    it("should reject invalid phone formats", () => {
      const invalidPhones = [
        "1234567890", // No country code
        "+0123456789", // Starts with 0
        "++1234567890", // Double plus
        "+", // Just plus
        "+12345", // Too short
        "+123456789012345678901234567890", // Too long
        "+1-234-567-890", // Contains dashes
        "+1 234 567 890", // Contains spaces
      ];

      invalidPhones.forEach((phone) => {
        const data = {
          name: "Test User",
          email: "test@example.com",
          phone,
          password: "StrongPass123!",
          redirectUrl: "https://example.com",
        };

        const { error } = registerSchema.validate(data);
        expect(error).toBeTruthy();
      });
    });
  });

  describe("Password Validation", () => {
    it("should validate strong passwords", () => {
      const validPasswords = [
        "StrongPass123!",
        "MyP@ssw0rd",
        "Secure#123",
        "Complex$Pass9",
      ];

      validPasswords.forEach((password) => {
        const data = {
          name: "Test User",
          email: "test@example.com",
          password,
          redirectUrl: "https://example.com",
        };

        const { error } = registerSchema.validate(data);
        expect(error).toBeUndefined();
      });
    });

    it("should reject weak passwords", () => {
      const invalidPasswords = [
        "password", // No uppercase, numbers, special chars
        "PASSWORD123", // No lowercase, special chars
        "Password", // No numbers, special chars
        "Pass1", // Missing special character
        "password123!", // No uppercase
        "PASSWORD123!", // No lowercase
        "Password!", // No numbers
        "Password123", // No special chars
      ];

      invalidPasswords.forEach((password) => {
        const data = {
          name: "Test User",
          email: "test@example.com",
          password,
          redirectUrl: "https://example.com",
        };

        const { error } = registerSchema.validate(data);
        expect(error).toBeTruthy();
      });
    });
  });

  describe("Email Validation", () => {
    it("should validate various email formats", () => {
      const validEmails = [
        "user@example.com",
        "test.email@domain.org",
        "user+tag@example.co.uk",
        "firstname.lastname@company.in",
        "user123@test-domain.com",
      ];

      validEmails.forEach((email) => {
        const data = {
          name: "Test User",
          email,
          password: "StrongPass123!",
          redirectUrl: "https://example.com",
        };

        const { error } = registerSchema.validate(data);
        expect(error).toBeUndefined();
      });
    });

    it("should reject invalid email formats", () => {
      const invalidEmails = [
        "invalid-email",
        "@domain.com",
        "user@",
        "user@domain",
        "user..double.dot@domain.com",
        "user@domain..com",
      ];

      invalidEmails.forEach((email) => {
        const data = {
          name: "Test User",
          email,
          password: "StrongPass123!",
          redirectUrl: "https://example.com",
        };

        const { error } = registerSchema.validate(data);
        expect(error).toBeTruthy();
      });
    });
  });

  describe("Login Schema", () => {
    it("should validate correct login data", () => {
      const validData = {
        email: "user@example.com",
        password: "StrongPass123!",
      };
      const { error } = loginSchema.validate(validData);
      expect(error).toBeUndefined();
    });
    it("should reject missing email", () => {
      const invalidData = {
        password: "StrongPass123!",
      };
      const { error } = loginSchema.validate(invalidData);
      expect(error).toBeTruthy();
      if (error && error.details && error.details[0]) {
        expect(error.details[0].message).toContain("Email is required");
      }
    });
    it("should reject missing password", () => {
      const invalidData = {
        email: "user@example.com",
      };
      const { error } = loginSchema.validate(invalidData);
      expect(error).toBeTruthy();
      if (error && error.details && error.details[0]) {
        expect(error.details[0].message).toContain("Password is required");
      }
    });
    it("should reject invalid email format", () => {
      const invalidData = {
        email: "invalid-email",
        password: "StrongPass123!",
      };
      const { error } = loginSchema.validate(invalidData);
      expect(error).toBeTruthy();
      if (error && error.details && error.details[0]) {
        expect(error.details[0].message).toContain("valid email address");
      }
    });
  });

  describe("Verify Email Schema", () => {
    it("should validate correct token", () => {
      const validData = { token: "sometoken123" };
      const { error } = emailVerifyToken.validate(validData);
      expect(error).toBeUndefined();
    });
    it("should reject missing token", () => {
      const invalidData = {};
      const { error } = emailVerifyToken.validate(invalidData);
      expect(error).toBeTruthy();
      if (error && error.details && error.details[0]) {
        expect(error.details[0].message).toContain(
          "Verification token is required"
        );
      }
    });
    it("should reject empty token", () => {
      const invalidData = { token: "" };
      const { error } = emailVerifyToken.validate(invalidData);
      expect(error).toBeTruthy();
      if (error && error.details && error.details[0]) {
        expect(error.details[0].message).toContain(
          "Verification token is required"
        );
      }
    });
  });

  describe("Reset Password Schema", () => {
    it("should validate correct token and password", () => {
      const validData = {
        token: "resettoken123",
        password: "StrongPass123!",
      };
      const { error } = resetPasswordSchema.validate(validData);
      expect(error).toBeUndefined();
    });
    it("should reject missing token", () => {
      const invalidData = { password: "StrongPass123!" };
      const { error } = resetPasswordSchema.validate(invalidData);
      expect(error).toBeTruthy();
      if (error && error.details && error.details[0]) {
        expect(error.details[0].message).toContain("Reset token is required");
      }
    });
    it("should reject missing password", () => {
      const invalidData = { token: "resettoken123" };
      const { error } = resetPasswordSchema.validate(invalidData);
      expect(error).toBeTruthy();
      if (error && error.details && error.details[0]) {
        expect(error.details[0].message).toContain("Password is required");
      }
    });
    it("should reject weak password", () => {
      // Use a password that is long enough but fails complexity (e.g., all lowercase, no uppercase, number, or special char)
      const invalidData = { token: "resettoken123", password: "passworddddd" };
      const { error } = resetPasswordSchema.validate(invalidData);
      expect(error).toBeTruthy();
      if (error && error.details && error.details[0]) {
        expect(error.details[0].message).toContain(
          "Password must contain at least one lowercase letter"
        );
      }
    });
  });

  describe("Refresh Token Schema", () => {
    it("should validate correct refresh token", () => {
      const validData = {
        "x-refresh-token": "sometoken1234567890123456789012345678901234567890",
      };
      const { error } = refreshTokenSchema.validate(validData);
      expect(error).toBeUndefined();
    });
    it("should reject missing refresh token", () => {
      const invalidData = {};
      const { error } = refreshTokenSchema.validate(invalidData);
      expect(error).toBeTruthy();
      if (error && error.details && error.details[0]) {
        expect(error.details[0].message).toContain("Refresh token is required");
      }
    });
    it("should reject empty refresh token", () => {
      const invalidData = { "x-refresh-token": "" };
      const { error } = refreshTokenSchema.validate(invalidData);
      expect(error).toBeTruthy();
      if (error && error.details && error.details[0]) {
        expect(error.details[0].message).toContain("Refresh token is required");
      }
    });
  });

  describe("Token Header Schema", () => {
    it("should validate correct authorization header", () => {
      const validData = {
        authorization:
          "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
      };
      const { error } = tokenHeaderSchema.validate(validData);
      expect(error).toBeUndefined();
    });

    it("should reject missing authorization header", () => {
      const invalidData = {};
      const { error } = tokenHeaderSchema.validate(invalidData);
      expect(error).toBeTruthy();
      if (error && error.details && error.details[0]) {
        expect(error.details[0].message).toContain(
          "Authorization header is required"
        );
      }
    });

    it("should allow valid authorization without refresh token", () => {
      const validData = {
        authorization:
          "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
      };
      const { error } = tokenHeaderSchema.validate(validData);
      expect(error).toBeUndefined();
    });

    it("should reject invalid authorization format", () => {
      const invalidData = {
        authorization: "InvalidFormat token",
      };
      const { error } = tokenHeaderSchema.validate(invalidData);
      expect(error).toBeTruthy();
      if (error && error.details && error.details[0]) {
        expect(error.details[0].message).toContain(
          "Access token must be a valid JWT"
        );
      }
    });

    it("should reject authorization without Bearer prefix", () => {
      const invalidData = {
        authorization:
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
      };
      const { error } = tokenHeaderSchema.validate(invalidData);
      expect(error).toBeTruthy();
      if (error && error.details && error.details[0]) {
        expect(error.details[0].message).toContain(
          "Access token must be a valid JWT"
        );
      }
    });

    it("should reject authorization with only Bearer prefix", () => {
      const invalidData = {
        authorization: "Bearer",
      };
      const { error } = tokenHeaderSchema.validate(invalidData);
      expect(error).toBeTruthy();
      if (error && error.details && error.details[0]) {
        expect(error.details[0].message).toContain(
          "Access token must be a valid JWT"
        );
      }
    });

    it("should reject invalid JWT format", () => {
      const invalidData = {
        authorization: "Bearer invalid-jwt-token",
      };
      const { error } = tokenHeaderSchema.validate(invalidData);
      expect(error).toBeTruthy();
      if (error && error.details && error.details[0]) {
        expect(error.details[0].message).toContain(
          "Access token must be a valid JWT"
        );
      }
    });

    it("should allow additional headers", () => {
      const validData = {
        authorization:
          "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
        "content-type": "application/json",
        "user-agent": "Mozilla/5.0",
      };
      const { error } = tokenHeaderSchema.validate(validData);
      expect(error).toBeUndefined();
    });

    it("should preserve additional headers when validation middleware runs", () => {
      const mockReq = {
        headers: {
          authorization:
            "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
          "extra-header": "should be preserved",
        },
      } as any;
      const mockRes = {} as any;
      const mockNext = jest.fn();

      const middleware = validate(tokenHeaderSchema, "headers");
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.headers["extra-header"]).toBe("should be preserved");
    });
  });

  describe("Validation Middleware Function", () => {
    it("should validate body data by default", () => {
      const mockReq = {
        body: { email: "test@example.com", password: "StrongPass123!" },
      } as any;
      const mockRes = {} as any;
      const mockNext = jest.fn();

      const middleware = validate(loginSchema);
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.body).toEqual({
        email: "test@example.com",
        password: "StrongPass123!",
      });
    });

    it("should validate headers when source is headers", () => {
      const mockReq = {
        headers: {
          authorization:
            "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
        },
      } as any;
      const mockRes = {} as any;
      const mockNext = jest.fn();

      const middleware = validate(tokenHeaderSchema, "headers");
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.headers).toEqual({
        authorization:
          "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
      });
    });

    it("should throw error for invalid body data", () => {
      const mockReq = {
        body: { email: "invalid-email" },
      } as any;
      const mockRes = {} as any;
      const mockNext = jest.fn();

      const middleware = validate(loginSchema);

      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Please provide a valid email address",
        })
      );
    });

    it("should throw error for invalid headers", () => {
      const mockReq = {
        headers: {
          authorization: "InvalidFormat",
        },
      } as any;
      const mockRes = {} as any;
      const mockNext = jest.fn();

      const middleware = validate(tokenHeaderSchema, "headers");

      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Access token must be a valid JWT",
        })
      );
    });

    it("should strip unknown fields from body", () => {
      const mockReq = {
        body: {
          email: "test@example.com",
          password: "StrongPass123!",
          extraField: "should be removed",
        },
      } as any;
      const mockRes = {} as any;
      const mockNext = jest.fn();

      const middleware = validate(loginSchema);
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.body).toEqual({
        email: "test@example.com",
        password: "StrongPass123!",
      });
      expect(mockReq.body.extraField).toBeUndefined();
    });

    it("should preserve unknown fields in headers", () => {
      const mockReq = {
        headers: {
          authorization:
            "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
          "extra-header": "should be preserved",
        },
      } as any;
      const mockRes = {} as any;
      const mockNext = jest.fn();

      const middleware = validate(tokenHeaderSchema, "headers");
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.headers["extra-header"]).toBe("should be preserved");
    });
  });
});
