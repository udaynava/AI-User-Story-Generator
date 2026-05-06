# AI User Story Generator

A lightweight web application that uses OpenAI's GPT models to turn plain-English feature descriptions into properly formatted agile **user stories** complete with acceptance criteria.

---

## Features

- 📝 Generate 1–10 user stories from a single description
- ✅ Acceptance criteria automatically included with every story
- 📋 One-click copy to clipboard
- 🚀 Clean, responsive UI — no JavaScript frameworks required

---

## Tech Stack

| Layer    | Technology         |
|----------|--------------------|
| Backend  | Python · Flask     |
| AI       | OpenAI GPT-4o-mini |
| Frontend | HTML · CSS · JS    |
| Tests    | pytest             |

---

## Getting Started

### Prerequisites

- Python 3.10+
- An [OpenAI API key](https://platform.openai.com/api-keys)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/udaynava/AI-User-Story-Generator.git
cd AI-User-Story-Generator

# 2. Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure your OpenAI key
cp .env.example .env
# Edit .env and replace "your_openai_api_key_here" with your real key
```

### Running the App

```bash
python app.py
```

Then open [http://localhost:5000](http://localhost:5000) in your browser.

---

## Usage

1. Enter a feature or requirement description in the text area.
2. Choose how many user stories to generate (1–10).
3. Click **Generate User Stories**.
4. Review the stories and click **Copy to Clipboard** if needed.

---

## Running Tests

```bash
pytest tests/ -v
```

---

## Project Structure

```
AI-User-Story-Generator/
├── app.py               # Flask application & OpenAI integration
├── requirements.txt     # Python dependencies
├── .env.example         # Environment variable template
├── templates/
│   └── index.html       # Main UI page
├── static/
│   ├── css/style.css    # Styles
│   └── js/app.js        # Frontend logic
└── tests/
    └── test_app.py      # Unit & integration tests
```

---

## License

MIT
