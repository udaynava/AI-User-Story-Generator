import os
from flask import Flask, render_template, request, jsonify
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

SYSTEM_PROMPT = (
    "You are an expert agile coach and product owner. Your task is to generate clear, "
    "well-structured user stories based on a given feature or requirement description. "
    "Each user story must follow the format:\n\n"
    "**User Story:** As a [type of user], I want [some goal], so that [some reason].\n\n"
    "**Acceptance Criteria:**\n"
    "- Criterion 1\n"
    "- Criterion 2\n"
    "- ...\n\n"
    "Generate the number of user stories requested. Each story should be distinct and "
    "cover different aspects of the described feature. Separate stories with a blank line. "
    "Do not include any additional commentary outside of the user stories."
)


def generate_user_stories(description: str, num_stories: int = 3, api_key: str | None = None) -> str:
    """Call the OpenAI API and return generated user stories as a string."""
    key = api_key or os.getenv("OPENAI_API_KEY")
    client = OpenAI(api_key=key)

    user_prompt = (
        f"Generate {num_stories} user story/stories for the following feature or requirement:\n\n"
        f"{description}"
    )

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.7,
    )

    return response.choices[0].message.content.strip()


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/generate", methods=["POST"])
def generate():
    data = request.get_json(silent=True) or {}
    description = (data.get("description") or "").strip()
    if not description:
        return jsonify({"error": "Please provide a feature or requirement description."}), 400

    try:
        num_stories = max(1, min(10, int(data.get("num_stories", 3))))
    except (TypeError, ValueError):
        num_stories = 3

    try:
        stories = generate_user_stories(description, num_stories)
    except Exception:
        return jsonify({"error": "Failed to generate user stories. Please try again later."}), 500

    return jsonify({"stories": stories})


if __name__ == "__main__":
    debug = os.getenv("FLASK_DEBUG", "false").lower() == "true"
    app.run(debug=debug)
