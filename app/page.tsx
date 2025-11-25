export default function Home() {
  return (
    <main style= padding: '40px', fontFamily: 'system-ui' >
      <h1>📄 PDF Tools MCP Server</h1>
      <p>This server is running and ready to connect to Dust.</p>
      <h2>Available Tools:</h2>
      <ul>
        <li><strong>read_pdf_content</strong> - Extract text from PDFs</li>
        <li><strong>read_pdf_fields</strong> - List form fields</li>
        <li><strong>fill_pdf</strong> - Fill PDF forms</li>
        <li><strong>validate_pdf</strong> - Check for empty fields</li>
      </ul>
      <h2>MCP Endpoint:</h2>
      <code style= background: '#f0f0f0', padding: '8px' >
        {typeof window !== 'undefined' ? window.location.origin : ''}/sse
      </code>
    </main>
  );
}
