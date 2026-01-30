const form = document.getElementById('checkin-form');
const nameInput = document.getElementById('patron-name');
const messageDiv = document.getElementById('message');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const patronName = nameInput.value.trim();

  if (!patronName) {
    showMessage('Please enter your name', 'error');
    return;
  }

  // Disable form during submission
  form.classList.add('loading');
  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  try {
    const response = await fetch('/api/checkin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ patronName })
    });

    const data = await response.json();

    if (response.ok) {
      showMessage(
        `✅ Success! You're #${data.position} in the queue. Please wait to be called.`,
        'success'
      );
      nameInput.value = '';
    } else {
      showMessage(`❌ Error: ${data.error || 'Failed to check in'}`, 'error');
    }
  } catch (error) {
    console.error('Check-in error:', error);
    showMessage('❌ Network error. Please try again.', 'error');
  } finally {
    form.classList.remove('loading');
    submitBtn.disabled = false;
    nameInput.focus();
  }
});

function showMessage(text, type = 'info') {
  messageDiv.textContent = text;
  messageDiv.className = `message ${type}`;
  messageDiv.classList.remove('hidden');

  // Auto-hide success messages after 5 seconds
  if (type === 'success') {
    setTimeout(() => {
      messageDiv.classList.add('hidden');
    }, 5000);
  }
}
