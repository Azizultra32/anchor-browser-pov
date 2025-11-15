import { ChromeBridge } from '../chrome-bridge.js';

export async function mapPageTool(chromeBridge: ChromeBridge, args: any) {
  const { url, includeHidden = false } = args;

  // Navigate if URL provided
  if (url) {
    await chromeBridge.navigateTo(url);
    // Wait for extension to inject
    await sleep(1000);
  }

  // Dispatch MAP event to extension
  const mapData = await chromeBridge.dispatchExtensionEvent('MAP', {
    includeHidden,
  });

  if (!mapData || mapData.error) {
    return {
      content: [
        {
          type: 'text',
          text: `Failed to map page: ${mapData?.error || 'Unknown error'}`,
        },
      ],
      isError: true,
    };
  }

  // Format response
  const summary = `
**Page Mapped Successfully**

URL: ${mapData.url}
Fields Found: ${mapData.fields?.length || 0}
Scan Duration: ${mapData.scanDuration?.toFixed(2)}ms

**Field Breakdown:**
${generateFieldBreakdown(mapData.fields || [])}

**Sections Detected:**
${(mapData.sections || []).map((s: any) => `- ${s.label} (${s.fields.length} fields)`).join('\n') || '- None'}
  `.trim();

  return {
    content: [
      {
        type: 'text',
        text: summary,
      },
      {
        type: 'text',
        text: `\n\n**Full Map Data:**\n\`\`\`json\n${JSON.stringify(mapData, null, 2)}\n\`\`\``,
      },
    ],
  };
}

function generateFieldBreakdown(fields: any[]): string {
  const byType: Record<string, number> = {};

  fields.forEach((field) => {
    const type = field.type || 'unknown';
    byType[type] = (byType[type] || 0) + 1;
  });

  return Object.entries(byType)
    .map(([type, count]) => `- ${type}: ${count}`)
    .join('\n') || '- No fields';
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
