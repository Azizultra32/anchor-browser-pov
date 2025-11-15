import { ChromeBridge } from '../chrome-bridge.js';

export async function planFillTool(chromeBridge: ChromeBridge, args: any) {
  const { note, url, targetNoteField } = args;

  if (!note || typeof note !== 'string') {
    return {
      content: [
        {
          type: 'text',
          text: 'Error: "note" parameter is required and must be a string',
        },
      ],
      isError: true,
    };
  }

  // Get current URL if not provided
  const targetURL = url || await chromeBridge.getCurrentURL();

  // Call local agent's planning API
  const agentURL = 'http://localhost:8787';
  const response = await fetch(`${agentURL}/actions/plan`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      note,
      url: targetURL,
      targetNoteField,
    }),
  });

  if (!response.ok) {
    return {
      content: [
        {
          type: 'text',
          text: `Agent planning failed: ${response.statusText}`,
        },
      ],
      isError: true,
    };
  }

  const plan = await response.json();

  // Format response
  const summary = `
**Fill Plan Generated**

Target URL: ${targetURL}
Plan ID: ${plan.planId}
Items: ${plan.items?.length || 0}

**Planned Fills:**
${(plan.items || []).map((item: any, i: number) => `
${i + 1}. **${item.label || 'Unknown Field'}**
   - Selector: \`${item.selector}\`
   - Value: "${truncate(item.value, 100)}"
   - Confidence: ${(item.score * 100).toFixed(1)}%
`).join('\n')}

${plan.notes?.length > 0 ? `\n**Notes:**\n${plan.notes.map((n: string) => `- ${n}`).join('\n')}` : ''}
  `.trim();

  return {
    content: [
      {
        type: 'text',
        text: summary,
      },
      {
        type: 'text',
        text: `\n\n**Full Plan (for anchor_execute_fill):**\n\`\`\`json\n${JSON.stringify(plan, null, 2)}\n\`\`\``,
      },
    ],
  };
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen) + '...';
}
