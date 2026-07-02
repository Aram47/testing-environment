export const dockerComposeExample = `services:
  api:
    image: your-company/backend-api:latest
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgres://user:pass@postgres:5432/app
    depends_on:
      - postgres

  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
      POSTGRES_DB: app
`;

export const backendTestExample = `version: "1.0"

environment:
  type: "docker_compose"
  compose_file: "./docker-compose.test.yml"

app:
  service: "api"
  base_url: "http://localhost:8000"
  healthcheck:
    path: "/health"
    expected_status: 200
    timeout_seconds: 60

tests:
  - "./tests/auth.yml"

run:
  timeout_minutes: 10
  cleanup: true
`;

export const testSuiteExample = `suite: "Auth API"

tests:
  - name: "Health check"
    request:
      method: GET
      path: "/health"
    expect:
      status: 200

  - name: "Register user"
    request:
      method: POST
      path: "/auth/register"
      json:
        email: "test@example.com"
        password: "123456"
    expect:
      status: 201
      json_contains:
        email: "test@example.com"
    save:
      user_id: "$.id"

  - name: "Login user"
    request:
      method: POST
      path: "/auth/login"
      json:
        email: "test@example.com"
        password: "123456"
    expect:
      status: 200
    save:
      access_token: "$.access_token"

  - name: "Get current user"
    request:
      method: GET
      path: "/users/me"
      headers:
        Authorization: "Bearer {{ access_token }}"
    expect:
      status: 200
`;
