// CommonJS for zero-config Node
const CDP = require('chrome-remote-interface');

const DEMO_URL = 'http://localhost:8788/ehr.html';

async function findOrOpenDemoTab() {
  let targets = await CDP.List();
  let target = targets.find(t => t.type === 'page' && t.url.startsWith(DEMO_URL));
  if (!target) {
    await CDP.New({ url: DEMO_URL });
    await new Promise(r => setTimeout(r, 500));
    targets = await CDP.List();
    target = targets.find(t => t.type === 'page' && t.url.startsWith(DEMO_URL));
  }
  if (!target) throw new Error('Could not open demo tab at ' + DEMO_URL);
  return target;
}

async function run() {
  const target = await findOrOpenDemoTab();
  const client = await CDP({ target });
  const { Page, Runtime } = client;

  await Page.enable();
  await Runtime.enable();
  await new Promise(r => setTimeout(r, 500));

  // 1) Check floating button
  const btnCheck = await Runtime.evaluate({
    expression: "!!document.getElementById('__anchor_ghost_toggle__')",
    returnByValue: true
  });
  if (!btnCheck.result.value) {
    throw new Error("SMOKE_FAIL toggle_button_missing");
  }

  // 2) Toggle overlay
  await Runtime.evaluate({
    expression: "document.getElementById('__anchor_ghost_toggle__').click(); true;",
    returnByValue: true
  });

  // Helper to click overlay buttons by data-action
  async function clickAction(action) {
    const res = await Runtime.evaluate({
      expression: `
        (function(){
          const el = document.querySelector('[data-action="${action}"]');
          if (!el) throw new Error("SMOKE_FAIL button_not_found:${action}");
          el.click(); true;
        })()
      `
    });
    return res;
  }

  await clickAction('map');
  await new Promise(r => setTimeout(r, 250));
  await clickAction('send-map');
  await new Promise(r => setTimeout(r, 400));
  await clickAction('fill-demo');
  await new Promise(r => setTimeout(r, 400));

  // 3) Verify demo inputs received values
  const values = await Runtime.evaluate({
    expression: `
      (function(){
        const out = {};
        const ids = ['pt_name','cc','bp','hr','temp'];
        ids.forEach(id => {
          const n = document.getElementById(id);
          if (n && 'value' in n) out[id] = n.value;
        });
        out;
      })()
    `,
    returnByValue: true
  });

  console.log(JSON.stringify({ ok: true, values: values.result.value }, null, 2));
  await client.close();
}

run().catch(err => {
  console.error(String(err.message || err));
  process.exit(1);
});