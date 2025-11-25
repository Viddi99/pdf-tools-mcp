import { createMcpHandler } from "@vercel/mcp-adapter";
import { z } from "zod";
import { PDFDocument } from "pdf-lib";

const handler = createMcpHandler((server) => {
  // TOOL 1: Read PDF Content
  server.tool(
    "read_pdf_content",
    "Extract and read all text content from a PDF file. Provide the PDF as a base64-encoded string.",
    {
      pdf_base64: z.string().describe("The PDF file encoded as base64"),
    },
    async ({ pdf_base64 }) => {
      try {
        const pdfBuffer = Buffer.from(pdf_base64, "base64");
        const pdfParse = (await import("pdf-parse")).default;
        const data = await pdfParse(pdfBuffer);
        return {
          content: [{ type: "text", text: JSON.stringify({ success: true, pageCount: data.numpages, text: data.text }, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Failed to read PDF" }) }],
        };
      }
    }
  );

  // TOOL 2: Read PDF Form Fields
  server.tool(
    "read_pdf_fields",
    "Extract all form field information from a PDF. Returns field names and types.",
    {
      pdf_base64: z.string().describe("The PDF file encoded as base64"),
    },
    async ({ pdf_base64 }) => {
      try {
        const pdfBuffer = Buffer.from(pdf_base64, "base64");
        const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
        const form = pdfDoc.getForm();
        const fields = form.getFields().map((field) => ({
          name: field.getName(),
          type: field.constructor.name,
        }));
        return {
          content: [{ type: "text", text: JSON.stringify({ success: true, fieldCount: fields.length, fields }, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Failed to read PDF fields" }) }],
        };
      }
    }
  );

  // TOOL 3: Fill PDF Form
  server.tool(
    "fill_pdf",
    "Fill a PDF form with provided data. Returns the filled PDF as base64.",
    {
      pdf_base64: z.string().describe("The PDF file encoded as base64"),
      field_data: z.string().describe("JSON string mapping field names to values, e.g. {\"name\": \"John\", \"date\": \"2024-01-01\"}"),
      flatten: z.boolean().optional().describe("If true, make fields non-editable"),
    },
    async ({ pdf_base64, field_data, flatten }) => {
      try {
        const pdfBuffer = Buffer.from(pdf_base64, "base64");
        const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
        const form = pdfDoc.getForm();
        const filledFields: string[] = [];
        const data = JSON.parse(field_data);
        
        for (const [fieldName, value] of Object.entries(data)) {
          try {
            const field = form.getField(fieldName);
            const fieldType = field.constructor.name;
            if (fieldType === "PDFTextField") {
              (field as any).setText(String(value));
              filledFields.push(fieldName);
            } else if (fieldType === "PDFCheckBox") {
              String(value).toLowerCase() === "true" ? (field as any).check() : (field as any).uncheck();
              filledFields.push(fieldName);
            } else if (fieldType === "PDFDropdown" || fieldType === "PDFRadioGroup") {
              (field as any).select(String(value));
              filledFields.push(fieldName);
            }
          } catch (e) {
            // Skip fields that can't be filled
          }
        }
        
        if (flatten) form.flatten();
        const filledPdfBytes = await pdfDoc.save();
        const filledPdfBase64 = Buffer.from(filledPdfBytes).toString("base64");
        
        return {
          content: [{ type: "text", text: JSON.stringify({ success: true, filledFields, filled_pdf_base64: filledPdfBase64 }, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Failed to fill PDF" }) }],
        };
      }
    }
  );

  // TOOL 4: Validate PDF Form
  server.tool(
    "validate_pdf",
    "Check a PDF form for missing required fields. Returns validation status.",
    {
      pdf_base64: z.string().describe("The PDF file encoded as base64"),
    },
    async ({ pdf_base64 }) => {
      try {
        const pdfBuffer = Buffer.from(pdf_base64, "base64");
        const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
        const form = pdfDoc.getForm();
        const fields = form.getFields();
        const emptyFields: string[] = [];
        const filledFields: string[] = [];
        
        for (const field of fields) {
          const name = field.getName();
          const type = field.constructor.name;
          let isEmpty = true;
          
          if (type === "PDFTextField") {
            const text = (field as any).getText();
            isEmpty = !text || text.trim() === "";
          } else if (type === "PDFCheckBox") {
            isEmpty = !(field as any).isChecked();
          }
          
          if (isEmpty) {
            emptyFields.push(name);
          } else {
            filledFields.push(name);
          }
        }
        
        return {
          content: [{ type: "text", text: JSON.stringify({ success: true, isValid: emptyFields.length === 0, totalFields: fields.length, filledCount: filledFields.length, emptyCount: emptyFields.length, emptyFields, filledFields }, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Failed to validate PDF" }) }],
        };
      }
    }
  );
});

export { handler as GET, handler as POST };
