#!/usr/bin/env node

console.log('Diagnosing fill flow...\n')

// Test agent
try {
  const res = await fetch('http://localhost:8787/actions/fill', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: 'http://localhost:8788/ehr.html',
      fields: [
        { selector: '#pt_name', label: 'Patient Name', editable: true },
        { selector: '#dob', label: 'Date of Birth', editable: true },
        { selector: '#cc', label: 'Chief Complaint', editable: true }
      ],
      note: 'Test note from diagnostic'
    })
  })
  
  const plan = await res.json()
  console.log('Agent response:')
  console.log(JSON.stringify(plan, null, 2))
  
  console.log('\nPlan structure:')
  console.log('- Has "actions"?', !!plan.actions)
  console.log('- Has "steps"?', !!plan.steps)
  
  const items = plan.actions || plan.steps || []
  console.log(`- ${items.length} items found`)
  
  if (items.length > 0) {
    console.log('\nFirst item:')
    console.log(JSON.stringify(items[0], null, 2))
    console.log('- action field:', items[0].action)
    console.log('- type field:', items[0].type)
  }
  
} catch (err) {
  console.error('Error:', err.message)
  console.error('\nMake sure agent is running on port 8787')
}