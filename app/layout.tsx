export const metadata = {
  title: 'PDF Tools MCP Server',
  description: 'MCP server for PDF operations',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
