(function () {
  const BUTTON_CONFIG = [
    { id: 'btnToggle', type: 'TOGGLE_OVERLAY' },
    { id: 'btnMap', type: 'MAP' },
    { id: 'btnSendMap', type: 'SEND_MAP' },
    { id: 'btnFill', type: 'FILL_DEMO' }
  ]

  function sendMessageToActiveTab(message) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0]
      if (!tab || typeof tab.id !== 'number') {
        console.warn('[AnchorGhost Popup] Unable to find active tab for message:', message.type)
        return
      }
      chrome.tabs.sendMessage(tab.id, message, () => {
        if (chrome.runtime.lastError) {
          console.warn('[AnchorGhost Popup] Message failed:', chrome.runtime.lastError.message)
        }
      })
    })
  }

  function init() {
    BUTTON_CONFIG.forEach(({ id, type }) => {
      const button = document.getElementById(id)
      if (!button) return
      button.addEventListener('click', () => sendMessageToActiveTab({ type }))
    })
  }

  document.addEventListener('DOMContentLoaded', init)
})()
