const form = document.getElementById('story-form');
const generateBtn = document.getElementById('generate-btn');
const btnText = document.getElementById('btn-text');
const btnSpinner = document.getElementById('btn-spinner');
const results = document.getElementById('results');
const storiesOutput = document.getElementById('stories-output');
const copyBtn = document.getElementById('copy-btn');
const errorSection = document.getElementById('error-section');
const errorMessage = document.getElementById('error-message');

function setLoading(loading) {
  generateBtn.disabled = loading;
  btnText.textContent = loading ? 'Generating…' : 'Generate User Stories';
  btnSpinner.classList.toggle('hidden', !loading);
}

function showError(msg) {
  results.classList.add('hidden');
  errorSection.classList.remove('hidden');
  errorMessage.textContent = msg;
}

function showResults(text) {
  errorSection.classList.add('hidden');
  storiesOutput.textContent = text;
  results.classList.remove('hidden');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const description = document.getElementById('description').value.trim();
  const numStories = parseInt(document.getElementById('num-stories').value, 10) || 3;

  if (!description) {
    showError('Please enter a feature or requirement description.');
    return;
  }

  setLoading(true);
  errorSection.classList.add('hidden');
  results.classList.add('hidden');

  try {
    const response = await fetch('/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description, num_stories: numStories }),
    });

    const data = await response.json();

    if (!response.ok) {
      showError(data.error || 'An unexpected error occurred. Please try again.');
    } else {
      showResults(data.stories);
    }
  } catch (err) {
    showError('Network error. Please check your connection and try again.');
  } finally {
    setLoading(false);
  }
});

copyBtn.addEventListener('click', () => {
  const text = storiesOutput.textContent;
  navigator.clipboard.writeText(text).then(() => {
    copyBtn.textContent = '✅ Copied!';
    setTimeout(() => { copyBtn.textContent = '📋 Copy to Clipboard'; }, 2000);
  }).catch(() => {
    copyBtn.textContent = '❌ Copy failed';
    setTimeout(() => { copyBtn.textContent = '📋 Copy to Clipboard'; }, 2000);
  });
});
