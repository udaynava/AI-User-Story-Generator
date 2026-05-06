import json
import pytest
from unittest.mock import MagicMock, patch

import app as app_module
from app import app as flask_app


@pytest.fixture
def client():
    flask_app.config["TESTING"] = True
    with flask_app.test_client() as c:
        yield c


# ── generate_user_stories unit tests ─────────────────────────────────────────

class TestGenerateUserStories:
    def _make_mock_response(self, content: str) -> MagicMock:
        mock_response = MagicMock()
        mock_response.choices[0].message.content = content
        return mock_response

    @patch("app.OpenAI")
    def test_returns_stripped_content(self, MockOpenAI):
        mock_client = MockOpenAI.return_value
        mock_client.chat.completions.create.return_value = self._make_mock_response(
            "  User Story: As a user...\n  "
        )
        result = app_module.generate_user_stories("Login feature", api_key="test-key")
        assert result == "User Story: As a user..."

    @patch("app.OpenAI")
    def test_sends_correct_num_stories(self, MockOpenAI):
        mock_client = MockOpenAI.return_value
        mock_client.chat.completions.create.return_value = self._make_mock_response("story")
        app_module.generate_user_stories("Search feature", num_stories=5, api_key="test-key")
        call_kwargs = mock_client.chat.completions.create.call_args
        messages = call_kwargs.kwargs["messages"]
        user_message = next(m["content"] for m in messages if m["role"] == "user")
        assert "5" in user_message

    @patch("app.OpenAI")
    def test_uses_provided_api_key(self, MockOpenAI):
        mock_client = MockOpenAI.return_value
        mock_client.chat.completions.create.return_value = self._make_mock_response("story")
        app_module.generate_user_stories("Feature", api_key="custom-key")
        MockOpenAI.assert_called_once_with(api_key="custom-key")


# ── /generate endpoint tests ──────────────────────────────────────────────────

class TestGenerateEndpoint:
    @patch("app.generate_user_stories")
    def test_returns_stories_on_success(self, mock_gen, client):
        mock_gen.return_value = "**User Story:** As a user..."
        rv = client.post(
            "/generate",
            data=json.dumps({"description": "User login", "num_stories": 2}),
            content_type="application/json",
        )
        assert rv.status_code == 200
        data = rv.get_json()
        assert "stories" in data
        assert data["stories"] == "**User Story:** As a user..."

    def test_empty_description_returns_400(self, client):
        rv = client.post(
            "/generate",
            data=json.dumps({"description": "   "}),
            content_type="application/json",
        )
        assert rv.status_code == 400
        assert "error" in rv.get_json()

    def test_missing_description_returns_400(self, client):
        rv = client.post(
            "/generate",
            data=json.dumps({}),
            content_type="application/json",
        )
        assert rv.status_code == 400

    @patch("app.generate_user_stories")
    def test_invalid_num_stories_defaults_to_3(self, mock_gen, client):
        mock_gen.return_value = "story"
        client.post(
            "/generate",
            data=json.dumps({"description": "Login", "num_stories": "bad"}),
            content_type="application/json",
        )
        mock_gen.assert_called_once()
        args, _ = mock_gen.call_args
        assert args[1] == 3

    @patch("app.generate_user_stories")
    def test_num_stories_clamped_to_max_10(self, mock_gen, client):
        mock_gen.return_value = "story"
        client.post(
            "/generate",
            data=json.dumps({"description": "Login", "num_stories": 99}),
            content_type="application/json",
        )
        args, _ = mock_gen.call_args
        assert args[1] == 10

    @patch("app.generate_user_stories")
    def test_num_stories_clamped_to_min_1(self, mock_gen, client):
        mock_gen.return_value = "story"
        client.post(
            "/generate",
            data=json.dumps({"description": "Login", "num_stories": -5}),
            content_type="application/json",
        )
        args, _ = mock_gen.call_args
        assert args[1] == 1

    @patch("app.generate_user_stories", side_effect=Exception("API error"))
    def test_openai_error_returns_500(self, _mock_gen, client):
        rv = client.post(
            "/generate",
            data=json.dumps({"description": "Login"}),
            content_type="application/json",
        )
        assert rv.status_code == 500
        data = rv.get_json()
        assert "error" in data
        assert data["error"] == "Failed to generate user stories. Please try again later."

    def test_non_json_body_returns_400(self, client):
        rv = client.post(
            "/generate",
            data="not json",
            content_type="text/plain",
        )
        assert rv.status_code == 400


# ── index page test ───────────────────────────────────────────────────────────

class TestIndexPage:
    def test_returns_html(self, client):
        rv = client.get("/")
        assert rv.status_code == 200
        assert b"AI User Story Generator" in rv.data
