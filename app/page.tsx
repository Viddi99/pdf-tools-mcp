export default function Home() {
  return (
    <main>
      <h1>PDF Tools MCP Server</h1>
      <p>This server is running and ready to connect to Dust.</p>
      <h2>Available Tools:</h2>
      <ul>
        <li>read_pdf_content - Extract text from PDFs</li>
        <li>read_pdf_fields - List form fields</li>
        <li>fill_pdf - Fill PDF forms</li>
        <li>validate_pdf - Check for empty fields</li>
      </ul>
      <h2>MCP Endpoint:</h2>
      <p>/sse</p>
    </main>
  );
}
