import { ChromeBridge } from '../chrome-bridge.js';

export async function executeFillTool(chromeBridge: ChromeBridge, args: any) {
  const { plan, preview = false, url } = args;

  if (!plan || !plan.items) {
    return {
      content: [
        {
          type: 'text',
          text: 'Error: "plan" parameter is required and must contain items array',
        },
      ],
      isError: true,
    };
  }

  // Navigate if URL provided
  if (url) {
    await chromeBridge.navigateTo(url);
    await sleep(1000);
  }

  // Dispatch FILL event to extension
  const result = await chromeBridge.dispatchExtensionEvent('FILL', {
    plan,
    preview,
  });

  if (!result || result.error) {
    return {
      content: [
        {
          type: 'text',
          text: `Failed to execute fill: ${result?.error || 'Unknown error'}`,
        },
      ],
      isError: true,
    };
  }

  // Format response
  const successCount = result.results?.filter((r: any) => r.success).length || 0;
  const failCount = result.results?.filter((r: any) => !r.success).length || 0;

  const summary = `
**Fill ${preview ? 'Preview' : 'Execution'} Complete**

Status: ${result.status}
Plan ID: ${result.planId || plan.planId}
Success: ${successCount}/${result.results?.length || 0}
Failed: ${failCount}

**Results:**
${(result.results || []).map((r: any, i: number) => `
${i + 1}. ${r.success ? '✓' : '✗'} ${r.label || 'Field'}
   - Selector: \`${r.selector}\`
   ${r.success ? `- Filled successfully` : `- Error: ${r.error}`}
`).join('\n')}

${preview ? '\n**This was a preview only. Use preview: false to execute.**' : ''}
${!preview && successCount > 0 ? '\n**Changes applied to page. Use Ghost overlay to undo if needed.**' : ''}
  `.trim();

  return {
    content: [
      {
        type: 'text',
        text: summary,
      },
      {
        type: 'text',
        text: `\n\n**Full Result:**\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``,
      },
    ],
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
