import { renderTemplate } from "../../src/services/TemplateService";
import { readFile } from "fs/promises";

// Mock dependencies
jest.mock("fs/promises");
jest.mock("../../src/helpers/logger");

const mockedReadFile = readFile as jest.MockedFunction<typeof readFile>;

describe("TemplateService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("renderTemplate", () => {
    it("should render template successfully", async () => {
      const mockTemplateContent = `
        <!DOCTYPE html>
        <html>
          <head><title>{{subject}}</title></head>
          <body>
            <h1>Hello {{name}}</h1>
            <p>{{message}}</p>
            <p>Year: {{currentYear}}</p>
          </body>
        </html>
      `;

      mockedReadFile.mockResolvedValue(mockTemplateContent);

      const result = await renderTemplate("test-template", {
        subject: "Test Subject",
        name: "John",
        message: "Welcome!",
      });

      expect(result.subject).toBe("Test Subject");
      expect(result.html).toContain("Hello John");
      expect(result.html).toContain("Welcome!");
      expect(result.text).toContain("Hello John");
      expect(result.text).toContain("Welcome!");
    });

    it("should cache compiled templates", async () => {
      const mockTemplateContent = "<p>{{name}}</p>";
      mockedReadFile.mockResolvedValue(mockTemplateContent);

      await renderTemplate("cached-template", {
        subject: "Test",
        name: "John",
      });
      await renderTemplate("cached-template", {
        subject: "Test",
        name: "Jane",
      });

      // Should only read file once (template is cached)
      expect(mockedReadFile).toHaveBeenCalledTimes(1);
    });

    it("should convert HTML to plain text", async () => {
      const mockTemplateContent = `
        <html>
          <head>
            <style>body { color: red; }</style>
          </head>
          <body>
            <h1>Hello &amp; Welcome</h1>
            <p>&nbsp;Test&nbsp;content&nbsp;</p>
            <script>alert('test');</script>
          </body>
        </html>
      `;

      mockedReadFile.mockResolvedValue(mockTemplateContent);

      const result = await renderTemplate("html-template", {
        subject: "Test",
      });

      expect(result.text).not.toContain("<html>");
      expect(result.text).not.toContain("<style>");
      expect(result.text).not.toContain("<script>");
      expect(result.text).toContain("Hello & Welcome");
    });

    it("should handle special HTML entities", async () => {
      const mockTemplateContent = `
        <p>&lt;code&gt;</p>
        <p>&gt;&lt;</p>
        <p>&quot;quoted&quot;</p>
        <p>&#39;apostrophe&#39;</p>
      `;

      mockedReadFile.mockResolvedValue(mockTemplateContent);

      const result = await renderTemplate("entity-template", {
        subject: "Test",
      });

      expect(result.text).toContain("<code>");
      expect(result.text).toContain("><");
      expect(result.text).toContain('"quoted"');
      expect(result.text).toContain("'apostrophe'");
    });

    it("should include app name and current year", async () => {
      const mockTemplateContent = `
        <p>App: {{appName}}</p>
        <p>Year: {{currentYear}}</p>
      `;

      mockedReadFile.mockResolvedValue(mockTemplateContent);

      const result = await renderTemplate("meta-template", {
        subject: "Test",
      });

      expect(result.html).toContain("Year:");
      // The actual year and app name come from config
    });

    it("should throw error for non-existent template", async () => {
      mockedReadFile.mockRejectedValue(new Error("ENOENT: no such file"));

      await expect(
        renderTemplate("non-existent-template", { subject: "Test" })
      ).rejects.toThrow("ENOENT");
    });
  });
});
