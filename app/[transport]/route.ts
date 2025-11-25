import { createMcpHandler } from "@vercel/mcp-adapter";
import { z } from "zod";
import { PDFDocument } from "pdf-lib";

// This creates the MCP server with all our PDF tools
const handler = createMcpHandler({
  name: "pdf-tools",
  version: "1.0.0",
  capabilities: {
    tools: {},
  },
  // Define all the tools your Dust agent can use
  tools: {
    // ========================================
    // TOOL 1: Read PDF Content
    // ========================================
    read_pdf_content: {
      description:
        "Extract and read all text content from a PDF file. Provide the PDF as a base64-encoded string.",
      parameters: z.object({
        pdf_base64: z
          .string()
          .describe("The PDF file encoded as a base64 string"),
        password: z
          .string()
          .optional()
          .describe("Password if the PDF is protected"),
      }),
      execute: async ({ pdf_base64, password }) => {
        try {
          // Convert base64 to buffer
          const pdfBuffer = Buffer.from(pdf_base64, "base64");

          // Use dynamic import for pdf-parse
          const pdfParse = (await import("pdf-parse")).default;
          const data = await pdfParse(pdfBuffer, {
            password: password,
          });

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    success: true,
                    pageCount: data.numpages,
                    text: data.text,
                    info: data.info,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  success: false,
                  error:
                    error instanceof Error
                      ? error.message
                      : "Failed to read PDF",
                }),
              },
            ],
          };
        }
      },
    },

    // ========================================
    // TOOL 2: Read PDF Form Fields
    // ========================================
    read_pdf_fields: {
      description:
        "Extract all form field information from a PDF. Returns field names, types, and current values.",
      parameters: z.object({
        pdf_base64: z
          .string()
          .describe("The PDF file encoded as a base64 string"),
        password: z
          .string()
          .optional()
          .describe("Password if the PDF is protected"),
      }),
      execute: async ({ pdf_base64, password }) => {
        try {
          const pdfBuffer = Buffer.from(pdf_base64, "base64");
          const pdfDoc = await PDFDocument.load(pdfBuffer, {
            password: password,
            ignoreEncryption: false,
          });

          const form = pdfDoc.getForm();
          const fields = form.getFields();

          const fieldInfo = fields.map((field) => {
            const name = field.getName();
            const type = field.constructor.name;
            let value: string | boolean | string[] | null = null;

            try {
              if (type === "PDFTextField") {
                value = (field as any).getText() || null;
              } else if (type === "PDFCheckBox") {
                value = (field as any).isChecked();
              } else if (type === "PDFDropdown") {
                value = (field as any).getSelected();
              } else if (type === "PDFRadioGroup") {
                value = (field as any).getSelected() || null;
              }
            } catch {
              value = null;
            }

            return { name, type, value };
          });

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    success: true,
                    fieldCount: fields.length,
                    fields: fieldInfo,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  success: false,
                  error:
                    error instanceof Error
                      ? error.message
                      : "Failed to read PDF fields",
                }),
              },
            ],
          };
        }
      },
    },

    // ========================================
    // TOOL 3: Fill PDF Form
    // ========================================
    fill_pdf: {
      description:
        "Fill a PDF form with provided data. Returns the filled PDF as base64.",
      parameters: z.object({
        pdf_base64: z
          .string()
          .describe("The PDF file encoded as a base64 string"),
        field_data: z
          .record(z.string())
          .describe(
            "Object mapping field names to values. Example: {\"name\": \"John\", \"date\": \"2024-01-01\"}"
          ),
        password: z
          .string()
          .optional()
          .describe("Password if the PDF is protected"),
        flatten: z
          .boolean()
          .optional()
          .default(false)
          .describe("If true, flatten the form (make fields non-editable)"),
      }),
      execute: async ({ pdf_base64, field_data, password, flatten }) => {
        try {
          const pdfBuffer = Buffer.from(pdf_base64, "base64");
          const pdfDoc = await PDFDocument.load(pdfBuffer, {
            password: password,
            ignoreEncryption: false,
          });

          const form = pdfDoc.getForm();
          const filledFields: string[] = [];
          const errors: string[] = [];

          for (const [fieldName, value] of Object.entries(field_data)) {
            try {
              const field = form.getField(fieldName);
              const fieldType = field.constructor.name;

              if (fieldType === "PDFTextField") {
                (field as any).setText(value);
                filledFields.push(fieldName);
              } else if (fieldType === "PDFCheckBox") {
                if (
                  value.toLowerCase() === "true" ||
                  value === "1" ||
                  value.toLowerCase() === "yes"
                ) {
                  (field as any).check();
                } else {
                  (field as any).uncheck();
                }
                filledFields.push(fieldName);
              } else if (fieldType === "PDFDropdown") {
                (field as any).select(value);
                filledFields.push(fieldName);
              } else if (fieldType === "PDFRadioGroup") {
                (field as any).select(value);
                filledFields.push(fieldName);
              }
            } catch (fieldError) {
              errors.push(
                `Field '${fieldName}': ${
                  fieldError instanceof Error
                    ? fieldError.message
                    : "Unknown error"
                }`
              );
            }
          }

          if (flatten) {
            form.flatten();
          }

          const filledPdfBytes = await pdfDoc.save();
          const filledPdfBase64 = Buffer.from(filledPdfBytes).toString(
            "base64"
          );

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    success: true,
                    filledFields: filledFields,
                    errors: errors.length > 0 ? errors : undefined,
                    filled_pdf_base64: filledPdfBase64,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  success: false,
                  error:
                    error instanceof Error
                      ? error.message
                      : "Failed to fill PDF",
                }),
              },
            ],
          };
        }
      },
    },

    // ========================================
    // TOOL 4: Validate PDF Form
    // ========================================
    validate_pdf: {
      description:
        "Check a PDF form for missing required fields. Returns validation status.",
      parameters: z.object({
        pdf_base64: z
          .string()
          .describe("The PDF file encoded as a base64 string"),
        required_fields: z
          .array(z.string())
          .optional()
          .describe(
            "List of field names that must be filled. If not provided, checks all fields."
          ),
        password: z
          .string()
          .optional()
          .describe("Password if the PDF is protected"),
      }),
      execute: async ({ pdf_base64, required_fields, password }) => {
        try {
          const pdfBuffer = Buffer.from(pdf_base64, "base64");
          const pdfDoc = await PDFDocument.load(pdfBuffer, {
            password: password,
            ignoreEncryption: false,
          });

          const form = pdfDoc.getForm();
          const fields = form.getFields();

          const fieldsToCheck = required_fields
            ? fields.filter((f) => required_fields.includes(f.getName()))
            : fields;

          const emptyFields: string[] = [];
          const filledFields: string[] = [];

          for (const field of fieldsToCheck) {
            const name = field.getName();
            const type = field.constructor.name;
            let isEmpty = true;

            try {
              if (type === "PDFTextField") {
                const text = (field as any).getText();
                isEmpty = !text || text.trim() === "";
              } else if (type === "PDFCheckBox") {
                isEmpty = !(field as any).isChecked();
              } else if (type === "PDFDropdown") {
                const selected = (field as any).getSelected();
                isEmpty = !selected || selected.length === 0;
              } else if (type === "PDFRadioGroup") {
                isEmpty = !(field as any).getSelected();
              }
            } catch {
              isEmpty = true;
            }

            if (isEmpty) {
              emptyFields.push(name);
            } else {
              filledFields.push(name);
            }
          }

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    success: true,
                    isValid: emptyFields.length === 0,
                    totalChecked: fieldsToCheck.length,
                    filledCount: filledFields.length,
                    emptyCount: emptyFields.length,
                    emptyFields: emptyFields,
                    filledFields: filledFields,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  success: false,
                  error:
                    error instanceof Error
                      ? error.message
                      : "Failed to validate PDF",
                }),
              },
            ],
          };
        }
      },
    },
  },
});

// These lines make the server respond to requests
export const GET = handler;
export const POST = handler;
